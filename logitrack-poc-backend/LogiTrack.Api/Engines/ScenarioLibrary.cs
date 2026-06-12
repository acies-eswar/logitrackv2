using LogiTrack.Api.Core;

namespace LogiTrack.Api.Engines;

/// <summary>A Module 3/6 scenario definition (deltas applied to a live baseline).</summary>
public sealed class Scenario
{
    public required string ScenarioId { get; init; }
    public required string Name { get; init; }
    public required string Type { get; init; }
    public required string Lever { get; init; }
    public required string Description { get; init; }

    // Filter (any subset)
    public string? FilterOriginCountry { get; init; }
    public string? FilterSegment { get; init; }
    public string? FilterMode { get; init; }

    public double FreightDeltaPct { get; init; }
    public int TransitDeltaDays { get; init; }
    public double TariffDeltaPct { get; init; }
    public double Co2eDeltaPct { get; init; }
    public double OtifDeltaPts { get; init; }
    public double WcDeltaPct { get; init; }
    public double ContractExitUsd { get; init; }
    public double ItIntegrationUsd { get; init; }
    public double CustomsSetupUsd { get; init; }
    public double AssetSpecificity { get; init; }
    public double SupplierConcentration { get; init; }
    public double GeoConcentration { get; init; }

    public List<Row> AffectedLanes(List<Row> lanes)
    {
        IEnumerable<Row> q = lanes;
        if (FilterOriginCountry is not null) q = q.Where(l => l.GetString("Origin_Country") == FilterOriginCountry);
        if (FilterSegment is not null) q = q.Where(l => l.GetString("Segment") == FilterSegment);
        if (FilterMode is not null) q = q.Where(l => l.GetString("Mode") == FilterMode);
        return q.ToList();
    }
}

public static class ScenarioLibrary
{
    // ─────────── 8 hand-authored anchor scenarios ───────────
    private static readonly List<Scenario> Anchors = new()
    {
        new Scenario {
            ScenarioId = "SCN-001", Name = "China \u2192 Mexico Supplier Shift",
            Type = "supplier", Lever = "Sourcing relocation",
            Description = "Relocate primary sourcing from China to Mexico suppliers feeding US plants. " +
                          "Removes Section 232 tariff exposure, cuts ocean legs to short road lanes.",
            FilterOriginCountry = "CN",
            FreightDeltaPct = -0.16, TransitDeltaDays = -26, TariffDeltaPct = -0.45,
            Co2eDeltaPct = -0.30, OtifDeltaPts = 2.0, WcDeltaPct = -0.12,
            ContractExitUsd = 900_000, ItIntegrationUsd = 650_000, CustomsSetupUsd = 380_000,
            AssetSpecificity = 0.65, SupplierConcentration = 0.45, GeoConcentration = 0.5,
        },
        new Scenario {
            ScenarioId = "SCN-002", Name = "Ocean \u2192 Rail Modal Shift (Port\u2192Plant)",
            Type = "modal_shift", Lever = "Modal conversion",
            Description = "Convert eligible Port\u2192Plant ocean drayage+road to intermodal rail. " +
                          "Lower cost and ~65% lower emissions, modest transit increase.",
            FilterSegment = "Port\u2192Plant", FilterMode = "ocean",
            FreightDeltaPct = -0.20, TransitDeltaDays = 2, TariffDeltaPct = 0.0,
            Co2eDeltaPct = -0.55, OtifDeltaPts = -1.0, WcDeltaPct = 0.05,
            ContractExitUsd = 150_000, ItIntegrationUsd = 120_000, CustomsSetupUsd = 0,
            AssetSpecificity = 0.2, SupplierConcentration = 0.2, GeoConcentration = 0.25,
        },
        new Scenario {
            ScenarioId = "SCN-003", Name = "Carrier Consolidation (Road)",
            Type = "carrier", Lever = "Carrier rationalization",
            Description = "Consolidate road carriers to strategic partners for volume leverage. " +
                          "~9% rate reduction and improved OTIF; contract exit friction.",
            FilterMode = "road",
            FreightDeltaPct = -0.09, TransitDeltaDays = 0, TariffDeltaPct = 0.0,
            Co2eDeltaPct = -0.04, OtifDeltaPts = 1.5, WcDeltaPct = 0.0,
            ContractExitUsd = 700_000, ItIntegrationUsd = 260_000, CustomsSetupUsd = 0,
            AssetSpecificity = 0.15, SupplierConcentration = 0.6, GeoConcentration = 0.2,
        },
        new Scenario {
            ScenarioId = "SCN-004", Name = "DC Allocation Re-balance",
            Type = "dc_allocation", Lever = "Distribution allocation",
            Description = "Re-balance Plant\u2192DC flows toward higher-utilization DCs to lower " +
                          "cost-to-serve and inventory holding. Slight transit penalty.",
            FilterSegment = "Plant\u2192DC",
            FreightDeltaPct = -0.07, TransitDeltaDays = 1, TariffDeltaPct = 0.0,
            Co2eDeltaPct = -0.10, OtifDeltaPts = -0.5, WcDeltaPct = -0.18,
            ContractExitUsd = 0, ItIntegrationUsd = 320_000, CustomsSetupUsd = 0,
            AssetSpecificity = 0.4, SupplierConcentration = 0.25, GeoConcentration = 0.45,
        },
        new Scenario {
            ScenarioId = "SCN-005", Name = "Plant Allocation Optimization",
            Type = "plant_allocation", Lever = "Plant sourcing mix",
            Description = "Shift inter-plant (Plant\u2192Plant) transfers to better-located plants, " +
                          "reducing internal freight and emissions.",
            FilterSegment = "Plant\u2192Plant",
            FreightDeltaPct = -0.12, TransitDeltaDays = -1, TariffDeltaPct = 0.0,
            Co2eDeltaPct = -0.14, OtifDeltaPts = 0.5, WcDeltaPct = 0.03,
            ContractExitUsd = 0, ItIntegrationUsd = 180_000, CustomsSetupUsd = 0,
            AssetSpecificity = 0.55, SupplierConcentration = 0.3, GeoConcentration = 0.35,
        },
        new Scenario {
            ScenarioId = "SCN-006", Name = "Vietnam Dual-Sourcing",
            Type = "supplier", Lever = "Supplier diversification",
            Description = "Qualify Vietnam as a second source to reduce China concentration risk. " +
                          "Small cost premium, large concentration-risk reduction.",
            FilterOriginCountry = "CN",
            FreightDeltaPct = 0.03, TransitDeltaDays = 4, TariffDeltaPct = -0.18,
            Co2eDeltaPct = -0.05, OtifDeltaPts = 0.0, WcDeltaPct = 0.08,
            ContractExitUsd = 150_000, ItIntegrationUsd = 420_000, CustomsSetupUsd = 220_000,
            AssetSpecificity = 0.3, SupplierConcentration = 0.25, GeoConcentration = 0.3,
        },
        new Scenario {
            ScenarioId = "SCN-007", Name = "Route Optimization (Supplier\u2192Plant)",
            Type = "route", Lever = "Lane re-routing",
            Description = "Re-route direct Supplier\u2192Plant lanes via optimized port pairs to cut " +
                          "distance and dwell. Cost and emissions improvement.",
            FilterSegment = "Supplier\u2192Plant",
            FreightDeltaPct = -0.06, TransitDeltaDays = -2, TariffDeltaPct = 0.0,
            Co2eDeltaPct = -0.08, OtifDeltaPts = 1.0, WcDeltaPct = 0.0,
            ContractExitUsd = 0, ItIntegrationUsd = 90_000, CustomsSetupUsd = 0,
            AssetSpecificity = 0.15, SupplierConcentration = 0.2, GeoConcentration = 0.25,
        },
        new Scenario {
            ScenarioId = "SCN-008", Name = "India Sourcing for EU Plants",
            Type = "supplier", Lever = "Sourcing relocation",
            Description = "Source EU-plant components from India under preferential terms. Lower unit " +
                          "freight, longer transit, modest emissions increase from added distance.",
            FilterOriginCountry = "IN",
            FreightDeltaPct = -0.10, TransitDeltaDays = 10, TariffDeltaPct = -0.20,
            Co2eDeltaPct = 0.06, OtifDeltaPts = -1.5, WcDeltaPct = 0.10,
            ContractExitUsd = 500_000, ItIntegrationUsd = 600_000, CustomsSetupUsd = 340_000,
            AssetSpecificity = 0.5, SupplierConcentration = 0.4, GeoConcentration = 0.45,
        },
    };

    /// <summary>Anchors + generated alternatives (the full evaluable library).</summary>
    public static readonly List<Scenario> All = BuildAll();

    private static List<Scenario> BuildAll()
    {
        var list = new List<Scenario>(Anchors);
        list.AddRange(Generated());
        return list;
    }

    // ─────────── Generated alternatives (spec §28: target 10-50 alternatives) ───────────
    // Deterministic, data-safe expansion across the six recommendation categories
    // (Route / Carrier / Modal / Supplier / Manufacturing / Hybrid - spec §26).
    private static IEnumerable<Scenario> Generated()
    {
        var rng = new Random(20260610);
        double R(double lo, double hi) => lo + (hi - lo) * rng.NextDouble();
        int Ri(int lo, int hi) => rng.Next(lo, hi + 1);
        T Pick<T>(T[] a) => a[rng.Next(a.Length)];

        var seg = new[] { "Supplier→Plant", "Plant→DC", "DC→DC", "Plant→Plant", "Port→Plant" };
        var modes = new[] { "road", "ocean", "rail" };
        var srcCountries = new[] { "CN", "VN", "IN", "MX", "KR", "DE", "TH", "PL" };
        var srcCity = new Dictionary<string, string> {
            ["CN"] = "China", ["VN"] = "Vietnam", ["IN"] = "India", ["MX"] = "Mexico",
            ["KR"] = "Korea", ["DE"] = "Germany", ["TH"] = "Thailand", ["PL"] = "Poland",
        };
        var gen = new List<Scenario>();
        int id = 9;
        Scenario Make(string name, string type, string lever, string desc,
            string? oc, string? sg, string? md,
            double fd, int tt, double tar, double co2, double otif, double wc,
            double exit, double it, double cust, double asset, double sup, double geo)
            => new()
            {
                ScenarioId = $"SCN-{id:000}", Name = name, Type = type, Lever = lever, Description = desc,
                FilterOriginCountry = oc, FilterSegment = sg, FilterMode = md,
                FreightDeltaPct = fd, TransitDeltaDays = tt, TariffDeltaPct = tar, Co2eDeltaPct = co2,
                OtifDeltaPts = otif, WcDeltaPct = wc, ContractExitUsd = exit, ItIntegrationUsd = it,
                CustomsSetupUsd = cust, AssetSpecificity = asset, SupplierConcentration = sup, GeoConcentration = geo,
            };

        // Route Optimization (7)
        for (int i = 0; i < 7; i++)
        {
            var sg = Pick(seg);
            gen.Add(Make($"Route Optimization ({sg})", "route", "Lane re-routing",
                $"Re-route {sg} flows through optimized port/hub pairs to cut distance, dwell and idle emissions.",
                null, sg, null, -R(0.04, 0.09), -Ri(1, 3), 0, -R(0.05, 0.12), R(0.2, 1.4), R(-0.02, 0.03),
                0, R(60_000, 180_000), 0, R(0.12, 0.25), R(0.18, 0.3), R(0.2, 0.32)));
            id++;
        }
        // Carrier Optimization (7)
        for (int i = 0; i < 7; i++)
        {
            var md = Pick(modes);
            gen.Add(Make($"Carrier Consolidation ({md})", "carrier", "Carrier rationalization",
                $"Consolidate {md} carriers onto strategic, lower-intensity partners for rate leverage and better OTIF.",
                null, null, md, -R(0.05, 0.12), 0, 0, -R(0.03, 0.09), R(0.5, 2.0), 0,
                R(250_000, 750_000), R(120_000, 300_000), 0, R(0.12, 0.2), R(0.45, 0.65), R(0.15, 0.25)));
            id++;
        }
        // Modal Optimization (7)
        var modalDefs = new[] {
            ("Ocean → Rail Modal Shift", "ocean", 2, -0.55), ("Road → Rail Modal Shift", "road", 1, -0.45),
            ("Air → Ocean Conversion", "air", 6, -0.72), ("Road → Rail (Inland)", "road", 2, -0.40),
            ("Ocean → Rail (Drayage)", "ocean", 3, -0.58), ("Air → Rail Conversion", "air", 4, -0.60),
            ("Road → Intermodal", "road", 2, -0.42),
        };
        // Modal: some carry a cost premium for speed/reliability → Sustainability-First, not Win-Win.
        foreach (var (nm, md, tt, co2) in modalDefs)
        {
            gen.Add(Make(nm, "modal_shift", "Modal conversion",
                $"Convert eligible {md} legs to lower-emission intermodal rail/ocean. Large emissions cut; cost may rise modestly.",
                null, null, md, R(-0.18, 0.06), tt, 0, co2 + R(-0.04, 0.04), -R(0, 1.5), R(0, 0.06),
                R(80_000, 200_000), R(100_000, 220_000), 0, R(0.15, 0.3), R(0.15, 0.3), R(0.2, 0.3)));
            id++;
        }
        // Supplier Optimization (8) - nearshoring often costs a premium; emissions benefit varies.
        for (int i = 0; i < 8; i++)
        {
            var oc = Pick(srcCountries);
            gen.Add(Make($"{srcCity[oc]} Supplier Reallocation", "supplier", "Sourcing relocation",
                $"Shift sourcing away from {srcCity[oc]} toward lower-tariff, nearer-shore suppliers feeding the same plants.",
                oc, null, null, R(-0.12, 0.12), Ri(-24, 10), -R(0.15, 0.45), R(-0.30, 0.06), R(-1.5, 2.0), R(-0.12, 0.10),
                R(300_000, 950_000), R(400_000, 700_000), R(200_000, 420_000), R(0.4, 0.7), R(0.3, 0.5), R(0.35, 0.55)));
            id++;
        }
        // Manufacturing Relocation (6) - capital-heavy, long-term: Strategic Transition.
        var plantSegs = new[] { "Plant→Plant", "Plant→DC" };
        for (int i = 0; i < 6; i++)
        {
            var sg = Pick(plantSegs);
            gen.Add(Make($"Manufacturing Reallocation ({sg})", "plant_allocation", "Plant sourcing mix",
                $"Relocate {sg} production/transfers to better-located, higher-renewable plants. Long-term emissions benefit, capital-intensive.",
                null, sg, null, R(-0.06, 0.05), Ri(-2, 4), 0, -R(0.08, 0.20), R(-0.5, 1.0), R(-0.05, 0.05),
                R(0, 200_000), R(600_000, 1_400_000), 0, R(0.6, 0.85), R(0.25, 0.45), R(0.3, 0.5)));
            id++;
        }
        // Hybrid Optimization (7) - compounded gains; a few are over-ambitious and get rejected.
        for (int i = 0; i < 7; i++)
        {
            var oc = Pick(srcCountries);
            gen.Add(Make($"Hybrid Transition ({srcCity[oc]})", "hybrid", "Supplier + mode + carrier",
                $"Combined supplier shift, modal conversion and carrier consolidation across the {srcCity[oc]} network for compounded gains.",
                oc, null, null, R(-0.16, 0.08), Ri(0, 8), -R(0.20, 0.40), R(-0.40, 0.05), R(-1.5, 1.5), R(-0.10, 0.08),
                R(400_000, 1_200_000), R(500_000, 900_000), R(150_000, 380_000), R(0.45, 0.7), R(0.3, 0.5), R(0.35, 0.55)));
            id++;
        }
        return gen;
    }

    /// <summary>Maps a scenario type to its PDF recommendation-category label (spec §26).</summary>
    public static string CategoryOf(Scenario s) => s.Type switch
    {
        "route" => "Route Optimization",
        "carrier" => "Carrier Optimization",
        "modal_shift" => "Modal Optimization",
        "supplier" => "Supplier Optimization",
        "plant_allocation" => "Manufacturing Relocation",
        "dc_allocation" => "Distribution Optimization",
        "hybrid" => "Hybrid Optimization",
        _ => "Network Optimization",
    };

    public static Scenario? Get(string id) => All.FirstOrDefault(s => s.ScenarioId == id);

    public static object Listing() => All.Select(s => (object)new Dictionary<string, object?>
    {
        ["scenario_id"] = s.ScenarioId, ["name"] = s.Name, ["type"] = s.Type,
        ["lever"] = s.Lever, ["description"] = s.Description, ["category"] = CategoryOf(s),
    }).ToList();
}
