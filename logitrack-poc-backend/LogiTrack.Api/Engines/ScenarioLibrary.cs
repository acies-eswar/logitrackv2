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
    public static readonly List<Scenario> All = new()
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

    public static Scenario? Get(string id) => All.FirstOrDefault(s => s.ScenarioId == id);

    public static object Listing() => All.Select(s => (object)new Dictionary<string, object?>
    {
        ["scenario_id"] = s.ScenarioId, ["name"] = s.Name, ["type"] = s.Type,
        ["lever"] = s.Lever, ["description"] = s.Description,
    }).ToList();
}
