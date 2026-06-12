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
    public string? FilterProductCategory { get; init; }
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
        if (FilterProductCategory is not null) q = q.Where(l => l.GetString("Product_Category") == FilterProductCategory);
        if (FilterOriginCountry is not null) q = q.Where(l => l.GetString("Origin_Country") == FilterOriginCountry);
        if (FilterSegment is not null) q = q.Where(l => l.GetString("Segment") == FilterSegment);
        if (FilterMode is not null) q = q.Where(l => l.GetString("Mode") == FilterMode);
        return q.ToList();
    }
}

public static class ScenarioLibrary
{
    // Curated, realistic optimization opportunities. Each is a distinct, sensible
    // decision (product / geography / lever specific) rather than a formulaic variant,
    // so the AI recommendation list reads like real opportunities.
    //   fields: id, name, type, lever, desc, prod, oc, sg, md,
    //           freight%, transitDays, tariff%, co2%, otifPts, wc%,
    //           exit$, it$, customs$, assetSpec, supConc, geoConc
    private static readonly (string id, string name, string type, string lever, string desc,
        string? prod, string? oc, string? sg, string? md,
        double fd, int tt, double tar, double co2, double otif, double wc,
        double exit, double it, double cust, double asset, double sup, double geo)[] Defs =
    {
        // ── Modal optimization (largest emission levers) ──
        ("SCN-001", "Convert Refrigerator air freight to ocean + rail", "modal_shift", "Modal conversion",
            "Move expedited refrigerator air lanes to ocean plus inland intermodal rail. Large emissions and cost reduction for a few added transit days.",
            "Refrigerator", null, null, "air", -0.34, 6, 0, -0.68, -1.0, 0.05, 120_000, 160_000, 0, 0.2, 0.25, 0.25),
        ("SCN-002", "Cut Microwave air-freight dependency", "modal_shift", "Modal conversion",
            "Shift high-volume microwave oven air shipments to ocean. Microwaves are light and high-density, so ocean economics are very favourable.",
            "Microwave Oven", null, null, "air", -0.30, 7, 0, -0.71, -1.5, 0.06, 90_000, 140_000, 0, 0.18, 0.2, 0.22),
        ("SCN-003", "Ocean drayage to intermodal rail (Port to Plant)", "modal_shift", "Modal conversion",
            "Convert eligible Port to Plant ocean-plus-road drayage to intermodal rail. Lower cost and roughly half the emissions, modest transit increase.",
            null, null, "Port→Plant", "ocean", -0.18, 2, 0, -0.52, -1.0, 0.04, 150_000, 130_000, 0, 0.2, 0.2, 0.25),
        ("SCN-004", "Shift Washing Machine road lanes to rail", "modal_shift", "Modal conversion",
            "Move long-haul washing machine truck lanes to rail. Meaningful emission reduction with a small lead-time and reliability trade-off.",
            "Washing Machine", null, null, "road", -0.12, 2, 0, -0.44, -1.5, 0.03, 80_000, 110_000, 0, 0.2, 0.3, 0.25),
        ("SCN-005", "Air Conditioner air to ocean conversion", "modal_shift", "Modal conversion",
            "Convert seasonal air conditioner air freight to ocean ahead of the cooling season. Very large emissions cut; requires demand planning.",
            "Air Conditioner", null, null, "air", -0.26, 8, 0, -0.66, -2.0, 0.08, 110_000, 150_000, 0, 0.25, 0.3, 0.28),

        // ── Supplier / nearshoring ──
        ("SCN-006", "Nearshore Refrigerator sourcing: China to Mexico", "supplier", "Sourcing relocation",
            "Relocate refrigerator component sourcing from China to Mexico for US plants. Removes tariff exposure and replaces ocean legs with short road lanes.",
            "Refrigerator", "CN", null, null, -0.15, -22, -0.45, -0.31, 2.0, -0.12, 850_000, 620_000, 360_000, 0.6, 0.45, 0.5),
        ("SCN-007", "Dual-source Washing Machine parts in Vietnam", "supplier", "Supplier diversification",
            "Qualify Vietnam as a second source for washing machine components to cut China concentration risk and tariffs at a small cost premium.",
            "Washing Machine", "CN", null, null, 0.02, 4, -0.20, -0.08, 0.0, 0.07, 180_000, 420_000, 220_000, 0.3, 0.25, 0.3),
        ("SCN-008", "Shift Dishwasher sourcing China to India", "supplier", "Sourcing relocation",
            "Move dishwasher sourcing to India under preferential terms. Lower unit freight and tariffs, longer transit and modest emissions change.",
            "Dishwasher", "CN", null, null, -0.11, 8, -0.22, -0.10, -1.0, 0.06, 420_000, 520_000, 300_000, 0.45, 0.4, 0.4),
        ("SCN-009", "Korea to India sourcing for Air Conditioners", "supplier", "Sourcing relocation",
            "Re-source air conditioner compressors from Korea to India. Lower landed cost, neutral emissions, improves geographic balance.",
            "Air Conditioner", "KR", null, null, -0.09, 5, -0.12, -0.06, 0.5, 0.03, 300_000, 480_000, 200_000, 0.4, 0.35, 0.38),

        // ── Carrier optimization ──
        ("SCN-010", "Consolidate ocean carriers to low-intensity partners", "carrier", "Carrier rationalization",
            "Consolidate ocean volume onto strategic carriers with newer, lower-intensity vessels for rate leverage and reduced emissions.",
            null, null, null, "ocean", -0.07, 0, 0, -0.09, 1.0, 0.0, 450_000, 220_000, 0, 0.15, 0.55, 0.2),
        ("SCN-011", "Road carrier rationalization (domestic lanes)", "carrier", "Carrier rationalization",
            "Consolidate domestic road carriers to strategic partners for volume leverage and improved OTIF, with contract-exit friction.",
            null, null, null, "road", -0.09, 0, 0, -0.05, 1.5, 0.0, 700_000, 260_000, 0, 0.15, 0.6, 0.2),

        // ── Route optimization ──
        ("SCN-012", "Re-route Supplier to Plant via optimized ports", "route", "Lane re-routing",
            "Re-route direct supplier-to-plant lanes through optimized port pairs to cut distance and dwell. Cost and emissions improvement, no investment.",
            null, null, "Supplier→Plant", null, -0.06, -2, 0, -0.09, 1.0, 0.0, 0, 90_000, 0, 0.15, 0.2, 0.25),
        ("SCN-013", "Optimize Microwave DC-to-DC transfers", "route", "Lane re-routing",
            "Reduce microwave oven inter-DC repositioning by re-balancing allocation. Lower internal freight and emissions.",
            "Microwave Oven", null, "DC→DC", null, -0.08, -1, 0, -0.10, 0.5, -0.05, 0, 80_000, 0, 0.2, 0.25, 0.3),

        // ── Manufacturing relocation ──
        ("SCN-014", "Relocate Refrigerator assembly to renewable-powered plant", "plant_allocation", "Plant sourcing mix",
            "Shift refrigerator final assembly toward plants on higher-renewable grids. Capital-intensive, strong long-term emission and energy benefit.",
            "Refrigerator", null, "Plant→DC", null, -0.03, 2, 0, -0.18, 0.0, 0.0, 0, 1_100_000, 0, 0.7, 0.35, 0.4),
        ("SCN-015", "Inter-plant transfer optimization", "plant_allocation", "Plant sourcing mix",
            "Shift inter-plant transfers to better-located plants, reducing internal freight and emissions with modest capital.",
            null, null, "Plant→Plant", null, -0.12, -1, 0, -0.14, 0.5, 0.03, 0, 280_000, 0, 0.55, 0.3, 0.35),

        // ── Distribution optimization ──
        ("SCN-016", "Shift distribution through Chennai DC", "dc_allocation", "Distribution allocation",
            "Re-balance India-bound Plant to DC flows through a higher-utilization Chennai DC to lower cost-to-serve and inventory holding.",
            null, "IN", "Plant→DC", null, -0.08, 1, 0, -0.11, -0.5, -0.18, 0, 320_000, 0, 0.4, 0.25, 0.45),
        ("SCN-017", "Re-balance Dishwasher DC allocation", "dc_allocation", "Distribution allocation",
            "Re-allocate dishwasher distribution toward higher-throughput DCs, releasing working capital with a slight transit penalty.",
            "Dishwasher", null, "Plant→DC", null, -0.06, 1, 0, -0.08, -0.5, -0.15, 0, 280_000, 0, 0.4, 0.25, 0.4),

        // ── Hybrid (compounded) ──
        ("SCN-018", "Refrigerator network transition: Mexico sourcing + rail", "hybrid", "Supplier + mode + carrier",
            "Combined China-to-Mexico refrigerator sourcing shift with intermodal rail and carrier consolidation for compounded cost and emission gains.",
            "Refrigerator", "CN", null, null, -0.18, -14, -0.40, -0.34, 1.0, -0.10, 950_000, 720_000, 340_000, 0.6, 0.45, 0.5),
        ("SCN-019", "Air Conditioner network: nearshore + modal shift", "hybrid", "Supplier + mode + carrier",
            "Nearshore air conditioner sourcing combined with air-to-ocean conversion. Large emissions cut, significant investment, longer transit.",
            "Air Conditioner", "CN", null, null, -0.10, 6, -0.30, -0.36, -1.0, 0.0, 700_000, 800_000, 300_000, 0.55, 0.4, 0.5),

        // ── Strategic transition (capital-heavy, mostly emissions) ──
        ("SCN-020", "Washing Machine sourcing China to Mexico", "supplier", "Sourcing relocation",
            "Relocate washing machine sourcing to Mexico. Higher upfront cost and investment, strong emission and resilience improvement.",
            "Washing Machine", "CN", null, null, 0.03, -18, -0.40, -0.28, 1.0, -0.10, 800_000, 700_000, 360_000, 0.65, 0.45, 0.5),

        // ── Likely-rejected (visible bad options that build trust) ──
        ("SCN-021", "Expedite Air Conditioners by air for peak season", "modal_shift", "Modal conversion",
            "Switch a share of air conditioner ocean volume to air to protect peak-season service. Faster but far higher cost and emissions.",
            "Air Conditioner", null, null, "ocean", 0.45, -12, 0, 1.40, 3.0, -0.05, 0, 40_000, 0, 0.1, 0.2, 0.2),
        ("SCN-022", "Premium express carrier upgrade", "carrier", "Carrier rationalization",
            "Upgrade to a premium express road carrier for service. Improves OTIF marginally at a notable cost premium and little emission benefit.",
            null, null, null, "road", 0.12, -1, 0, -0.02, 2.5, 0.0, 200_000, 120_000, 0, 0.15, 0.5, 0.2),
        ("SCN-023", "India sourcing for EU plants", "supplier", "Sourcing relocation",
            "Source EU-plant components from India. Lower unit freight but much longer transit and higher emissions from added distance.",
            null, "IN", null, null, -0.10, 12, -0.20, 0.08, -1.5, 0.10, 500_000, 600_000, 340_000, 0.5, 0.4, 0.45),

        // ── Broad sustainability lever ──
        ("SCN-024", "Network-wide ocean to rail intermodal program", "modal_shift", "Modal conversion",
            "Roll out intermodal rail across eligible long-haul ocean-plus-road corridors network-wide. Large aggregate emission cut, phased investment.",
            null, null, null, "ocean", -0.10, 3, 0, -0.40, -1.5, 0.05, 300_000, 400_000, 0, 0.3, 0.3, 0.3),
    };

    public static readonly List<Scenario> All = Defs.Select(d => new Scenario
    {
        ScenarioId = d.id, Name = d.name, Type = d.type, Lever = d.lever, Description = d.desc,
        FilterProductCategory = d.prod, FilterOriginCountry = d.oc, FilterSegment = d.sg, FilterMode = d.md,
        FreightDeltaPct = d.fd, TransitDeltaDays = d.tt, TariffDeltaPct = d.tar, Co2eDeltaPct = d.co2,
        OtifDeltaPts = d.otif, WcDeltaPct = d.wc, ContractExitUsd = d.exit, ItIntegrationUsd = d.it,
        CustomsSetupUsd = d.cust, AssetSpecificity = d.asset, SupplierConcentration = d.sup, GeoConcentration = d.geo,
    }).ToList();

    /// <summary>Maps a scenario type to its recommendation-category label.</summary>
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
