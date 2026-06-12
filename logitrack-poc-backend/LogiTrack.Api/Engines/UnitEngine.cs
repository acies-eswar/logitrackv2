using LogiTrack.Api.Core;
using static LogiTrack.Api.Core.NumberUtil;
using static LogiTrack.Api.Engines.Metrics;

namespace LogiTrack.Api.Engines;

/// <summary>Unit-level GLEC emissions engine (Sections 4.8-4.12 of spec).</summary>
public static class UnitEngine
{
    // Product family reference data (spec Section 5A)
    private static readonly Dictionary<string, (double BareKg, double PkgKg, double PkgM3, double LoadFactor, int UnitsPerContainer)> ProductFamilies = new()
    {
        ["Large washer-class"]    = (62, 74,  0.53, 1.19, 150),
        ["Large cooling-class"]   = (95, 112, 1.19, 1.18,  64),
        ["Medium HVAC-class"]     = (48, 56,  0.35, 1.17, 280),
        ["Medium built-in-class"] = (45, 53,  0.36, 1.18, 190),
        ["Small countertop-class"]= (16, 21,  0.11, 1.31, 1100),
        // Whirlpool specific product SKUs (real-world specs)
        ["Refrigerator"]    = (85,  100, 1.10, 1.18,  60),
        ["Washing Machine"] = (75,   88, 0.70, 1.17,  95),
        ["Air Conditioner"] = (22,   28, 0.25, 1.27, 250),
        ["Microwave Oven"]  = (13,   17, 0.08, 1.31, 840),
        ["Dishwasher"]      = (50,   60, 0.60, 1.20, 110),
    };

    // Packaging embodied emission factors (spec Section 4.8, kgCO2e/kg)
    private static readonly Dictionary<string, double> PackagingFactors = new()
    {
        ["corrugated_cardboard"] = 0.94,
        ["eps_foam"] = 3.30,
        ["wood_pallet"] = 0.46,
        ["ldpe_wrap"] = 2.10,
        ["steel_strapping"] = 2.50,
    };

    // Hub handling defaults (kgCO2e per unit throughput)
    private const double PortHandlingKgCo2ePerUnit = 0.018;
    private const double DcHandlingKgCo2ePerUnit   = 0.012;
    private const double PlantHandlingKgCo2ePerUnit = 0.009;

    public static object Defaults()
    {
        var families = ProductFamilies.Select(kv => (object)new Dictionary<string, object?>
        {
            ["name"] = kv.Key,
            ["bare_weight_kg"] = kv.Value.BareKg,
            ["packaged_weight_kg"] = kv.Value.PkgKg,
            ["packaged_volume_m3"] = kv.Value.PkgM3,
            ["load_factor"] = kv.Value.LoadFactor,
            ["units_per_container"] = kv.Value.UnitsPerContainer,
        }).ToList();

        return new Dictionary<string, object?>
        {
            ["product_families"] = families,
            ["glec_emission_factors_g_co2e_per_tkm"] = Config.EmissionFactors.ToDictionary(kv => kv.Key, kv => (object)kv.Value),
            ["packaging_factors_kg_co2e_per_kg"] = PackagingFactors.ToDictionary(kv => kv.Key, kv => (object)kv.Value),
            ["hub_handling_kg_co2e_per_unit"] = new Dictionary<string, object?>
            {
                ["port_terminal"] = PortHandlingKgCo2ePerUnit,
                ["dc_warehouse"] = DcHandlingKgCo2ePerUnit,
                ["plant_inbound"] = PlantHandlingKgCo2ePerUnit,
            },
        };
    }

    public static object EmissionsFactors()
    {
        return new Dictionary<string, object?>
        {
            ["version"] = "GLEC v3.x / ISO 14083:2023",
            ["basis"] = "WTW (Well-to-Wheel)",
            ["unit"] = "gCO2e per tonne-km",
            ["factors"] = new List<object>
            {
                Factor("Ocean",  "Container vessel, TEU-based (~10 t/TEU)",  9.7),
                Factor("Rail",   "Intermodal, diesel/electric blend",         28.0),
                Factor("Rail",   "Fully electric",                            16.0),
                Factor("Rail",   "Fully diesel",                              35.0),
                Factor("Road",   "Articulated HGV 32-34 t (general)",         86.0),
                Factor("Road",   "Rigid truck 16-20 t (China)",              110.0),
                Factor("Road",   "Refrigerated (reefer)",                    102.0),
                Factor("Air",    "Freighter (exception only)",               600.0),
                Factor("Inland waterway", "Barge",                           31.0),
            },
        };
    }

    private static object Factor(string mode, string subtype, double ef) =>
        new Dictionary<string, object?> { ["mode"] = mode, ["subtype"] = subtype, ["ef_g_co2e_per_tkm"] = ef };

    // Compute per-unit emissions given input drivers
    public static object ComputeUnit(UnitComputeRequest req)
    {
        var fam = ProductFamilies.TryGetValue(req.ProductFamily, out var f)
            ? f : ProductFamilies["Medium HVAC-class"];

        double bareKg   = req.BareWeightKg    > 0 ? req.BareWeightKg    : fam.BareKg;
        double pkgKg    = req.PackagedWeightKg > 0 ? req.PackagedWeightKg : fam.PkgKg;
        double loadFact = pkgKg / Math.Max(bareKg, 1);
        double fillPct  = req.ContainerFillPct > 0 ? req.ContainerFillPct : 0.85;

        // --- transport emissions (GLEC Section 4.3) ---
        double eTransport = 0.0;
        var legDetails = new List<object>();
        foreach (var leg in req.Legs)
        {
            double ef = Config.EmissionFactors.TryGetValue(leg.Mode.ToLowerInvariant(), out var ef0) ? ef0 : 86.0;
            double tkm = (pkgKg / 1000.0) * leg.DistanceKm;
            double legCo2eKg = tkm * ef / 1_000_000.0 * 1000.0; // kgCO2e per unit
            eTransport += legCo2eKg;
            legDetails.Add(new Dictionary<string, object?>
            {
                ["mode"] = leg.Mode, ["distance_km"] = leg.DistanceKm, ["carrier"] = leg.Carrier,
                ["ef_g_co2e_per_tkm"] = ef, ["transport_kg_co2e"] = R2(legCo2eKg),
            });
        }

        // --- handling emissions (GLEC HOC, Section 4.7) ---
        double eHandling = req.HandlingEvents?.Sum(h => h switch
        {
            "port" => PortHandlingKgCo2ePerUnit,
            "dc"   => DcHandlingKgCo2ePerUnit,
            "plant"=> PlantHandlingKgCo2ePerUnit,
            _      => DcHandlingKgCo2ePerUnit,
        }) ?? (PortHandlingKgCo2ePerUnit + DcHandlingKgCo2ePerUnit);

        // --- packaging emissions (spec Section 4.8) ---
        double corr = req.CorrugateMassKg   > 0 ? req.CorrugateMassKg   : 0.94;
        double foam = req.EpsFoamMassKg     > 0 ? req.EpsFoamMassKg     : 0.45;
        double pall = req.WoodPalletMassKg  > 0 ? req.WoodPalletMassKg  : 0.14;
        double ldpe = req.LdpeMassKg        > 0 ? req.LdpeMassKg        : 0.10;
        double strp = req.SteelStrappingKg  > 0 ? req.SteelStrappingKg  : 0.05;

        double ePackaging = corr * PackagingFactors["corrugated_cardboard"]
                          + foam * PackagingFactors["eps_foam"]
                          + pall * PackagingFactors["wood_pallet"]
                          + ldpe * PackagingFactors["ldpe_wrap"]
                          + strp * PackagingFactors["steel_strapping"];

        double eTotalKg = eTransport + eHandling + ePackaging;
        double eTotalT  = eTotalKg / 1000.0;

        // capacity
        int upcVol = fam.UnitsPerContainer;
        int upcWt  = pkgKg > 0 ? (int)(26_000.0 / pkgKg) : upcVol; // ~26t container payload
        int upc    = Math.Min(upcVol, upcWt);
        int upcEff = Math.Max(1, (int)(upc * fillPct));

        double annualVol = req.AnnualVolume > 0 ? req.AnnualVolume : 50000;
        double costPerUnit = req.FreightPerShipment > 0 ? req.FreightPerShipment / Math.Max(1, upcEff) : 0;

        return new Dictionary<string, object?>
        {
            ["product_family"] = req.ProductFamily,
            ["per_unit"] = new Dictionary<string, object?>
            {
                ["bare_weight_kg"]      = R2(bareKg),
                ["packaged_weight_kg"]  = R2(pkgKg),
                ["load_factor"]         = R2(loadFact),
                ["transport_kg_co2e"]   = R2(eTransport),
                ["handling_kg_co2e"]    = R2(eHandling),
                ["packaging_kg_co2e"]   = R2(ePackaging),
                ["total_kg_co2e"]       = R2(eTotalKg),
                ["total_t_co2e"]        = R2(eTotalT),
                ["cost_usd"]            = R2(costPerUnit),
            },
            ["annual"] = new Dictionary<string, object?>
            {
                ["volume"] = annualVol,
                ["total_kg_co2e"] = R2(eTotalKg * annualVol),
                ["total_t_co2e"]  = R2(eTotalT  * annualVol),
                ["total_cost_usd"]= R2(costPerUnit * annualVol),
            },
            ["capacity"] = new Dictionary<string, object?>
            {
                ["units_per_container_volume"] = upcVol,
                ["units_per_container_weight"] = upcWt,
                ["units_per_container"]        = upc,
                ["binding_constraint"]         = upcVol <= upcWt ? "volume" : "weight",
                ["effective_units_at_fill"]    = upcEff,
                ["container_fill_pct"]         = R2(fillPct * 100),
            },
            ["leg_details"] = legDetails,
            ["data_quality"] = "GLEC default (Level 2)",
        };
    }

    // Build a representative multi-TCE product journey
    /// <summary>
    /// All representative end-to-end flows for a product family (spec §2 Module 5):
    /// each flow is a Supplier→Port→Plant→DC path with per-segment cost/emission
    /// attribution, load factor and container apportioning.
    /// </summary>
    public static object ProductFlows(List<Row> lanes, string productFamily, int n = 6)
    {
        var fam = ProductFamilies.TryGetValue(productFamily, out var f) ? f : ProductFamilies.Values.First();
        bool IsP(Row l) => string.Equals(l.GetString("Product_Category"), productFamily, StringComparison.OrdinalIgnoreCase);
        var pLanes = lanes.Where(IsP).ToList();
        int upcWt = (int)Math.Floor(26000.0 / Math.Max(1, fam.PkgKg));
        int upc = Math.Min(fam.UnitsPerContainer, upcWt);

        // Final legs: distinct destination DCs for this product, top N by annual freight.
        var finalLegs = pLanes.Where(l => l.GetString("Segment") == "Plant→DC")
            .OrderByDescending(LaneAnnualFreight)
            .GroupBy(l => l.GetString("Destination")).Select(g => g.First())
            .Take(n).ToList();

        Row? Best(string seg, Func<Row, bool> match) =>
            pLanes.Where(l => l.GetString("Segment") == seg && match(l)).OrderByDescending(LaneAnnualFreight).FirstOrDefault()
            ?? pLanes.Where(l => l.GetString("Segment") == seg).OrderByDescending(LaneAnnualFreight).FirstOrDefault();

        var flows = new List<object>();
        int fid = 1;
        foreach (var fin in finalLegs)
        {
            string plant = fin.GetString("Origin");
            var mid = Best("Port→Plant", l => l.GetString("Destination") == plant);
            var inl = mid is null ? null : Best("Supplier→Port", l => l.GetString("Destination") == mid.GetString("Origin"));
            var segLanes = new[] { inl, mid, fin }.Where(l => l != null).Cast<Row>().ToList();

            double totCost = segLanes.Sum(LaneFreightPerShipment);
            double totCo2 = segLanes.Sum(LaneCo2ePerShipment);
            double totTransit = segLanes.Sum(l => l.GetDouble("Transit_Time_Days"));

            var segs = segLanes.Select(l =>
            {
                double cost = LaneFreightPerShipment(l), co2 = LaneCo2ePerShipment(l);
                return (object)new Dictionary<string, object?>
                {
                    ["segment"] = l.GetString("Segment"), ["mode"] = l.GetString("Mode"),
                    ["carrier"] = l.GetString("Carrier"),
                    ["origin"] = l.GetString("Origin"), ["destination"] = l.GetString("Destination"),
                    ["distance_km"] = R2(LaneDistance(l)), ["transit_days"] = R2(l.GetDouble("Transit_Time_Days")),
                    ["weight_kg"] = R2(LaneWeightKg(l)),
                    ["load_factor"] = R2(fam.LoadFactor), ["units_per_container"] = upc,
                    ["cost_per_shipment"] = R2(cost), ["co2e_per_shipment_t"] = R3(co2),
                    ["cost_per_unit"] = R2(SafeDiv(cost, upc)), ["co2e_per_unit_kg"] = R3(SafeDiv(co2 * 1000.0, upc)),
                    ["cost_share_pct"] = R2(SafeDiv(cost, totCost) * 100),
                    ["emission_share_pct"] = R2(SafeDiv(co2, totCo2) * 100),
                };
            }).ToList();

            flows.Add(new Dictionary<string, object?>
            {
                ["flow_id"] = $"FLOW-{fid:00}",
                ["origin"] = segLanes.Count > 0 ? segLanes[0].GetString("Origin") : "",
                ["plant"] = plant,
                ["destination"] = fin.GetString("Destination"),
                ["segment_count"] = segLanes.Count,
                ["total_cost_per_shipment"] = R2(totCost),
                ["total_co2e_per_shipment_t"] = R3(totCo2),
                ["total_transit_days"] = R2(totTransit),
                ["units_per_container"] = upc, ["load_factor"] = R2(fam.LoadFactor),
                ["cost_per_unit"] = R2(SafeDiv(totCost, upc)),
                ["co2e_per_unit_kg"] = R3(SafeDiv(totCo2 * 1000.0, upc)),
                ["segments"] = segs,
            });
            fid++;
        }
        return new Dictionary<string, object?>
        {
            ["product"] = productFamily,
            ["units_per_container"] = upc, ["load_factor"] = R2(fam.LoadFactor),
            ["packaged_weight_kg"] = R2(fam.PkgKg),
            ["flows"] = flows,
        };
    }

    public static object ProductJourney(List<Row> lanes, string productFamily, string destinationDc)
    {
        var fam = ProductFamilies.TryGetValue(productFamily, out var f)
            ? f : ProductFamilies["Medium HVAC-class"];

        var inScope = Config.AllowedSegments;

        // Find representative lanes for each journey step
        var supToPort = lanes
            .Where(l => l.GetString("Segment") == "Supplier→Port")
            .OrderByDescending(LaneAnnualFreight).FirstOrDefault();
        var portToPlant = lanes
            .Where(l => l.GetString("Segment") == "Port→Plant")
            .OrderByDescending(LaneAnnualFreight).FirstOrDefault();
        var plantToDc = lanes
            .Where(l => l.GetString("Segment") == "Plant→DC" &&
                (destinationDc == "" || l.GetString("Destination").Contains(destinationDc, StringComparison.OrdinalIgnoreCase)))
            .OrderByDescending(LaneAnnualFreight).FirstOrDefault();
        // Fallback if no DC match
        plantToDc ??= lanes.Where(l => l.GetString("Segment") == "Plant→DC")
                           .OrderByDescending(LaneAnnualFreight).FirstOrDefault();

        var candidateLanes = new[] { supToPort, portToPlant, plantToDc }
            .Where(l => l != null).Cast<Row>().ToList();

        if (candidateLanes.Count == 0)
            return new Dictionary<string, object?> { ["tces"] = new List<object>(), ["kpis"] = new Dictionary<string, object?>() };

        double pkgKg = fam.PkgKg;
        double unitsPerShip = fam.UnitsPerContainer;

        var tces = new List<object>();
        double cumCost = 0, cumCo2eKg = 0, cumTransit = 0;
        var legModes = new HashSet<string>();
        int crossings = 0;

        var segOrder = new Dictionary<string, int>
        {
            ["Supplier→Port"] = 0, ["Port→Plant"] = 1,
            ["Supplier→Plant"] = 2, ["Plant→DC"] = 3, ["DC→DC"] = 4,
        };

        var orderedLanes = candidateLanes.OrderBy(l => segOrder.TryGetValue(l.GetString("Segment"), out var o) ? o : 99).ToList();

        foreach (var lane in orderedLanes)
        {
            string seg    = lane.GetString("Segment");
            string mode   = lane.GetString("Mode");
            string carrier= lane.GetString("Carrier");
            double dist   = lane.GetDouble("Distance_KM");
            int transit   = (int)lane.GetDouble("Transit_Time_Days");
            double freightPerShip = LaneFreightPerShipment(lane);
            double costPerUnit = freightPerShip / Math.Max(1, unitsPerShip);

            double ef = Config.EmissionFactors.TryGetValue(mode.ToLowerInvariant(), out var ef0) ? ef0 : 86.0;
            double tkm = (pkgKg / 1000.0) * dist;
            double transportKgCo2e = tkm * ef / 1_000_000.0 * 1000.0;
            double handlingKgCo2e = seg.Contains("Port") ? PortHandlingKgCo2ePerUnit : (seg.Contains("DC") ? DcHandlingKgCo2ePerUnit : PlantHandlingKgCo2ePerUnit);

            cumCost    += costPerUnit;
            cumCo2eKg  += transportKgCo2e + handlingKgCo2e;
            cumTransit += transit;
            legModes.Add(mode);
            if (lane.GetString("Origin_Country") != lane.GetString("Destination_Country")) crossings++;

            tces.Add(new Dictionary<string, object?>
            {
                ["segment"]        = seg,
                ["mode"]           = mode,
                ["carrier"]        = carrier,
                ["origin"]         = lane.GetString("Origin"),
                ["destination"]    = lane.GetString("Destination"),
                ["distance_km"]    = R2(dist),
                ["transit_days"]   = transit,
                ["per_unit_cost_usd"]        = R2(costPerUnit),
                ["per_unit_transport_kg_co2e"] = R2(transportKgCo2e),
                ["per_unit_handling_kg_co2e"]  = R2(handlingKgCo2e),
                ["cumulative_cost_usd"]      = R2(cumCost),
                ["cumulative_kg_co2e"]       = R2(cumCo2eKg),
                ["data_quality"]   = "GLEC default (Level 2)",
            });
        }

        // Packaging emissions
        double ePackKg = fam.PkgKg > fam.BareKg
            ? (fam.PkgKg - fam.BareKg) * 0.94  // approximate from corrugated dominant
            : 0.8;

        double totalTransportCo2Kg = tces.Sum(t => (double)((Dictionary<string, object?>)t)["per_unit_transport_kg_co2e"]!);
        double totalHandlingCo2Kg  = tces.Sum(t => (double)((Dictionary<string, object?>)t)["per_unit_handling_kg_co2e"]!);
        double totalCo2Kg = totalTransportCo2Kg + totalHandlingCo2Kg + ePackKg;

        var waterfall = tces.Select(t =>
        {
            var d = (Dictionary<string, object?>)t;
            return (object)new Dictionary<string, object?>
            {
                ["label"] = $"{d["segment"]} ({d["mode"]})",
                ["transport"] = d["per_unit_transport_kg_co2e"],
                ["handling"]  = d["per_unit_handling_kg_co2e"],
            };
        }).Append(new Dictionary<string, object?> { ["label"] = "Packaging", ["transport"] = 0.0, ["handling"] = R2(ePackKg) })
          .ToList();

        int annualVol = 50_000;

        return new Dictionary<string, object?>
        {
            ["product_family"] = productFamily,
            ["destination_dc"] = destinationDc,
            ["tces"] = tces,
            ["packaging"] = new Dictionary<string, object?>
            {
                ["kg_co2e_per_unit"] = R2(ePackKg),
                ["note"] = "Packaging embodied CO2e (corrugated + foam + pallet)",
            },
            ["emissions_waterfall"] = waterfall,
            ["kpis"] = new Dictionary<string, object?>
            {
                ["total_per_unit_cost_usd"]   = R2(cumCost),
                ["total_per_unit_kg_co2e"]    = R2(totalCo2Kg),
                ["total_per_unit_t_co2e"]     = R2(totalCo2Kg / 1000.0),
                ["transport_kg_co2e"]         = R2(totalTransportCo2Kg),
                ["handling_kg_co2e"]          = R2(totalHandlingCo2Kg),
                ["packaging_kg_co2e"]         = R2(ePackKg),
                ["total_transit_days"]        = (int)cumTransit,
                ["legs"]                      = tces.Count,
                ["modes"]                     = legModes.Count,
                ["border_crossings"]          = crossings,
                ["annual_volume_default"]     = annualVol,
                ["annual_total_t_co2e"]       = R2(totalCo2Kg / 1000.0 * annualVol),
                ["annual_total_cost_usd"]     = R2(cumCost * annualVol),
                ["data_quality"]              = "GLEC default (Level 2)",
            },
        };
    }

    // Product families list for selector
    public static IReadOnlyList<string> FamilyNames =>
        ProductFamilies.Keys.ToList();
}

// ── Request model ────────────────────────────────────────────────────────────
public sealed class UnitComputeRequest
{
    public string ProductFamily    { get; set; } = "Medium HVAC-class";
    public double BareWeightKg     { get; set; }
    public double PackagedWeightKg { get; set; }
    public double ContainerFillPct { get; set; } = 0.85;
    public double CorrugateMassKg  { get; set; }
    public double EpsFoamMassKg    { get; set; }
    public double WoodPalletMassKg { get; set; }
    public double LdpeMassKg       { get; set; }
    public double SteelStrappingKg { get; set; }
    public double AnnualVolume     { get; set; }
    public double FreightPerShipment { get; set; }
    public List<string>?  HandlingEvents { get; set; }
    public List<LegInput> Legs          { get; set; } = new();
}

public sealed class LegInput
{
    public string Mode       { get; set; } = "road";
    public double DistanceKm { get; set; }
    public string Carrier    { get; set; } = "";
}
