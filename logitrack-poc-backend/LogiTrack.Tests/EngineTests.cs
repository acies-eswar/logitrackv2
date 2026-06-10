using LogiTrack.Api.Core;
using LogiTrack.Api.Engines;
using Xunit;

namespace LogiTrack.Tests;

public class RngTests
{
    [Fact]
    public void Random_MatchesCPythonSeed11()
    {
        var r = new PyRandom(11);
        double[] expected = { 0.4523795535, 0.5597723861, 0.924210584,
                              0.4656500701, 0.5078412731, 0.5873848288 };
        foreach (var e in expected)
            Assert.Equal(e, r.NextDouble(), 9);
    }

    [Fact]
    public void Gauss_MatchesCPythonSeed11()
    {
        var r = new PyRandom(11);
        Assert.Equal(0.8775927324, r.Gauss(1.0, 0.1), 9);
        Assert.Equal(1.0377588198, r.Gauss(1.0, 0.1), 9);
        Assert.Equal(1.0994999628, r.Gauss(1.0, 0.1), 9);
        Assert.Equal(0.5078412731, r.NextDouble(), 9);          // spare exhausted; next raw draw
        Assert.Equal(0.1046123312, r.Uniform(0.04, 0.15), 9);
    }
}

public class MetricsTests
{
    private static Row Lane(string mode, double w, double dist, int ship, double? co2 = null)
    {
        var l = new Row
        {
            ["Mode"] = mode, ["Avg_Weight_KG"] = w, ["Distance_KM"] = dist,
            ["Shipments_Per_Year"] = ship,
        };
        if (co2 is not null) l["CO2e_Tonnes"] = co2;
        return l;
    }

    [Fact]
    public void Co2ePhysicsDerivation()
    {
        var l = Lane("road", 10000, 100, 10);
        // 10 t × 100 km = 1000 t-km × 86 g / 1e6 = 0.086 t/shipment
        Assert.Equal(0.086, Metrics.LaneCo2ePerShipment(l), 9);
        Assert.Equal(0.86, Metrics.LaneAnnualCo2e(l), 9);
    }

    [Fact]
    public void Co2ePrefersExplicit()
    {
        var l = Lane("road", 10000, 100, 1, co2: 0.5);
        Assert.Equal(0.5, Metrics.LaneCo2ePerShipment(l), 9);
    }

    [Theory]
    [InlineData("ocean", 9.7)]
    [InlineData("road", 86.0)]
    [InlineData("rail", 28.0)]
    [InlineData("air", 600.0)]
    public void IntensityMatchesFactor(string mode, double factor)
    {
        var l = Lane(mode, 5000, 200, 1);
        Assert.Equal(factor, Metrics.LaneIntensityGPerTkm(l), 6);
    }

    [Fact]
    public void ZeroDistanceNoCrash()
    {
        var l = Lane("road", 5000, 0, 5);
        Assert.Equal(0.0, Metrics.LaneCo2ePerShipment(l));
        Assert.Equal(0.0, Metrics.LaneIntensityGPerTkm(l));
    }

    [Fact]
    public void SafeDivZero() => Assert.Equal(0.0, NumberUtil.SafeDiv(5, 0));
}

public class EngineTests : IClassFixture<StoreFixture>
{
    private readonly DataStore _store;
    public EngineTests(StoreFixture f) => _store = f.Store;

    [Fact]
    public void LanesInScopeOnlyAllowedSegments()
    {
        foreach (var l in _store.LanesInScope())
            Assert.Contains(l.GetString("Segment"), Config.AllowedSegments);
    }

    [Fact]
    public void NetworkSummaryPositive()
    {
        var r = (Dictionary<string, object?>)NetworkEngine.Summary(_store, _store.LanesInScope());
        Assert.True((double)r["total_annual_freight_usd"]! > 0);
        Assert.True((double)r["total_annual_co2e"]! > 0);
        Assert.True((double)r["network_intensity_g_per_tkm"]! > 0);
    }

    [Fact]
    public void LandedCostComponentsSum()
    {
        var trade = _store.GetRows("trade");
        foreach (var l in _store.LanesInScope().Take(20))
        {
            var d = SustainabilityEngine.LaneLanded(l, trade, 75);
            double total = (double)d["freight"]! + (double)d["duty"]! + (double)d["tariff"]!
                         + (double)d["handling"]! + (double)d["carbon_cost"]!;
            Assert.True(Math.Abs(total - (double)d["landed_cost_per_shipment"]!) < 0.05);
        }
    }

    [Fact]
    public void AllScenariosEvaluate()
    {
        var lanes = _store.LanesInScope();
        var trade = _store.GetRows("trade");
        var fin = _store.GetObject("financial");
        foreach (var s in ScenarioLibrary.All)
        {
            Assert.True(s.AffectedLanes(lanes).Count > 0, $"{s.ScenarioId} affects no lanes");
            var te = (Dictionary<string, object?>)EconomicsEngine.TransitionEconomics(
                s, lanes, trade, fin, 75, 8.5, 5, Config.DefaultMonteCarloTrials);
            var r = (Dictionary<string, object?>)te["risk_adjusted_npv"]!;
            double p10 = (double)r["p10_npv_usd"]!, p50 = (double)r["p50_npv_usd"]!, p90 = (double)r["p90_npv_usd"]!;
            Assert.True(p10 <= p50 && p50 <= p90);
            double pos = (double)r["probability_positive_pct"]!;
            Assert.InRange(pos, 0, 100);
            var wcb = (Dictionary<string, object?>)te["working_capital_bridge"]!;
            Assert.Equal(25, ((List<object>)wcb["snapshots"]!).Count);
            var vrt = (Dictionary<string, object?>)te["value_realization"]!;
            Assert.Equal(37, ((List<object>)vrt["timeline"]!).Count);
            var risk = (Dictionary<string, object?>)te["scenario_risk"]!;
            Assert.InRange((double)risk["risk_score"]!, 0, 100);
            Assert.Contains((string)te["verdict"]!, new[] { "APPROVE", "PILOT", "CONDITIONAL", "DECLINE" });
        }
    }

    [Fact]
    public void DecisionHubRanksDescending()
    {
        var hub = (Dictionary<string, object?>)DecisionHubEngine.Build(
            _store.LanesInScope(), _store.GetRows("trade"), _store.GetObject("financial"),
            75, 8.5, 5, Config.DefaultMonteCarloTrials);
        var rows = ((List<object>)hub["scenarios"]!).Cast<Dictionary<string, object?>>().ToList();
        var npvs = rows.Select(r => (double)r["p50_npv_usd"]!).ToList();
        for (int i = 0; i + 1 < npvs.Count; i++)
            Assert.True(npvs[i] >= npvs[i + 1]);
    }
}

public sealed class StoreFixture
{
    public DataStore Store { get; }
    public StoreFixture() => Store = new DataStore(FindDataDir());

    private static string FindDataDir()
    {
        // Data/ is copied next to the test assembly via the csproj Content link.
        var dir = AppContext.BaseDirectory;
        for (int i = 0; i < 8 && dir is not null; i++)
        {
            var candidate = Path.Combine(dir, "Data");
            if (File.Exists(Path.Combine(candidate, "bundle.json"))) return candidate;
            dir = Directory.GetParent(dir)?.FullName;
        }
        return Path.Combine(AppContext.BaseDirectory, "Data");
    }
}
