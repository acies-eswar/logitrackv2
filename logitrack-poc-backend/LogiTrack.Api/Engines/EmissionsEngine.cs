using LogiTrack.Api.Core;
using static LogiTrack.Api.Core.NumberUtil;
using static LogiTrack.Api.Engines.Metrics;

namespace LogiTrack.Api.Engines;

/// <summary>
/// Emissions Intelligence - comprehensive logistics carbon footprint view.
/// Covers breakdowns by source, scope, mode, and lane-level hotspots.
/// </summary>
public static class EmissionsEngine
{
    public static object Build(List<Row> lanes, Row fin, double carbonPrice)
    {
        double totalCo2 = lanes.Sum(LaneAnnualCo2e);
        if (totalCo2 <= 0) totalCo2 = 1.0;

        double revenue = fin.GetDouble("Revenue_USD", 1_000_000_000.0);
        double carbonCostExposure = totalCo2 * carbonPrice;
        double intensityPerRevDollar = totalCo2 * 1000.0 / (revenue / 1000.0); // kg per $1k revenue

        // By mode
        var byMode = new Dictionary<string, double>();
        foreach (var l in lanes)
        {
            var m = l.GetString("Mode");
            if (!byMode.ContainsKey(m)) byMode[m] = 0;
            byMode[m] += LaneAnnualCo2e(l);
        }

        // By source (segment type → emission source label)
        var sourceMap = new Dictionary<string, string>
        {
            ["Supplier→Port"] = "Inbound Transport",
            ["Port→Plant"]    = "Port Drayage & Plant Inbound",
            ["Supplier→Plant"]= "Direct Supplier Transport",
            ["Plant→Plant"]   = "Inter-plant Transfer",
            ["Plant→DC"]      = "Outbound Distribution",
            ["DC→DC"]         = "DC Transfer",
        };
        var bySource = new Dictionary<string, double>();
        foreach (var l in lanes)
        {
            var seg = l.GetString("Segment");
            var label = sourceMap.TryGetValue(seg, out var s) ? s : seg;
            if (!bySource.ContainsKey(label)) bySource[label] = 0;
            bySource[label] += LaneAnnualCo2e(l);
        }

        // By scope (Scope 1 = road owned, Scope 3 = outsourced ocean/road/air/rail)
        // All transport here is outsourced → Scope 3. Add reasonable Scope 1/2 estimates.
        double scope3 = totalCo2;
        double scope1 = scope3 * 0.04;  // ~4% direct emissions (owned fleet, stationary)
        double scope2 = scope3 * 0.06;  // ~6% purchased energy (plants/DCs)
        double byScope_total = scope1 + scope2 + scope3;
        var byScope = new Dictionary<string, double>
        {
            ["Scope 1"] = R2(scope1),
            ["Scope 2"] = R2(scope2),
            ["Scope 3"] = R2(scope3),
        };

        // Top 10 emission hotspots
        var hotspots = lanes
            .Select(l => new
            {
                lane      = $"{l.GetString("Origin")} → {l.GetString("Destination")}",
                mode      = l.GetString("Mode"),
                segment   = l.GetString("Segment"),
                co2e      = R2(LaneAnnualCo2e(l)),
                pct       = R2(LaneAnnualCo2e(l) / totalCo2 * 100),
            })
            .OrderByDescending(x => x.co2e)
            .Take(12)
            .Select(x => (object)new Dictionary<string, object?>
            {
                ["lane"] = x.lane, ["mode"] = x.mode, ["segment"] = x.segment,
                ["co2e"] = x.co2e, ["pct_of_total"] = x.pct,
            })
            .ToList();

        // Trend data (last 12 months, synthesized from lanes with seasonal variation)
        var rng = new PyRandom(99);
        double monthly = totalCo2 / 12.0;
        var trend = Enumerable.Range(1, 12).Select(m =>
        {
            double factor = 1.0 + 0.08 * Math.Sin(m * Math.PI / 6.0) + rng.Gauss(0, 0.04);
            return (object)new Dictionary<string, object?>
            {
                ["month"] = $"M{m:D2}", ["co2e"] = R2(monthly * factor),
            };
        }).ToList();

        return new Dictionary<string, object?>
        {
            ["total_tco2e"]                   = R2(totalCo2),
            ["total_scope1_tco2e"]            = R2(scope1),
            ["total_scope2_tco2e"]            = R2(scope2),
            ["total_scope3_tco2e"]            = R2(scope3),
            ["carbon_cost_exposure_usd"]      = R2(carbonCostExposure),
            ["emissions_per_revenue_dollar"]  = R2(intensityPerRevDollar),
            ["by_mode"]                       = byMode.ToDictionary(k => k.Key, k => (object)R2(k.Value)),
            ["by_source"]                     = bySource.ToDictionary(k => k.Key, k => (object)R2(k.Value)),
            ["by_scope"]                      = byScope.ToDictionary(k => k.Key, k => (object)k.Value),
            ["hotspots"]                      = hotspots,
            ["monthly_trend"]                 = trend,
            ["carbon_coverage"]               = Metrics.CarbonCoverage(lanes),
        };
    }
}
