using LogiTrack.Api.Core;
using static LogiTrack.Api.Core.NumberUtil;
using static LogiTrack.Api.Engines.Metrics;

namespace LogiTrack.Api.Engines;

/// <summary>Module 2 - Transportation Performance Management.</summary>
public static class TransportationEngine
{
    public static List<object> CarrierScorecards(List<Row> lanes)
    {
        var acc = new Dictionary<string, (int lanes, int ship, double freight, double co2,
            double tkm, double otifW, double transitW, SortedSet<string> modes)>();

        foreach (var l in lanes)
        {
            int sh = LaneShipments(l);
            var name = l.GetString("Carrier");
            if (!acc.TryGetValue(name, out var a))
                a = (0, 0, 0, 0, 0, 0, 0, new SortedSet<string>(StringComparer.Ordinal));
            a.lanes += 1; a.ship += sh;
            a.freight += LaneAnnualFreight(l); a.co2 += LaneAnnualCo2e(l);
            a.tkm += LaneAnnualTonneKm(l);
            a.otifW += l.GetDouble("OTIF_Pct") * sh;
            a.transitW += l.GetDouble("Transit_Time_Days") * sh;
            a.modes.Add(l.GetString("Mode"));
            acc[name] = a;
        }

        // network benchmarks
        double netIntensity = SafeDiv(lanes.Sum(LaneAnnualCo2e) * 1_000_000, lanes.Sum(LaneAnnualTonneKm));
        double avgCostPerShip = SafeDiv(lanes.Sum(LaneAnnualFreight), lanes.Sum(LaneShipments));
        double unitsPerShip = 50.0; // reference; unit spine

        var outRows = new List<object>();
        foreach (var (name, a) in acc)
        {
            double otif = SafeDiv(a.otifW, a.ship);
            double intensity = SafeDiv(a.co2 * 1_000_000, a.tkm);
            double costPerUnit = SafeDiv(a.freight, a.ship * unitsPerShip);
            double cps = SafeDiv(a.freight, a.ship);
            double altRate = avgCostPerShip * 0.93;
            double savings = (cps - altRate) * a.ship;
            double score = CarrierScore(otif, intensity, cps, netIntensity, avgCostPerShip);
            outRows.Add(new Dictionary<string, object?>
            {
                ["carrier"] = name, ["lanes"] = a.lanes, ["shipments"] = a.ship,
                ["annual_freight_usd"] = R2(a.freight), ["annual_co2e"] = R2(a.co2),
                ["avg_otif_pct"] = R2(otif),
                ["avg_transit_days"] = R2(SafeDiv(a.transitW, a.ship)),
                ["cost_per_shipment"] = R2(cps),
                ["cost_per_unit"] = R2(costPerUnit),
                ["emission_intensity_g_per_tkm"] = R2(intensity),
                ["intensity_vs_benchmark"] = R2(SafeDiv(intensity, netIntensity) - 1.0),
                ["carrier_score"] = R2(score),
                ["modes"] = a.modes.Cast<object>().ToList(),
                ["sla_breach"] = otif < Config.OtifTargetPct,
                ["_savings"] = savings,
            });
        }

        // Second pass: assign Grow/Retain/Improve/Exit by score percentile so every
        // band is populated (spec §109). Exit only when switching pays for itself.
        AssignDispositions(outRows);
        foreach (var o in outRows) ((Dictionary<string, object?>)o).Remove("_savings");
        return outRows.OrderByDescending(x => (double)((Dictionary<string, object?>)x)["annual_freight_usd"]!).ToList();
    }

    private static void AssignDispositions(List<object> rows)
    {
        var scores = rows.Select(o => (double)((Dictionary<string, object?>)o)["carrier_score"]!).OrderBy(s => s).ToList();
        double p70 = Pctile(scores, 0.70), p40 = Pctile(scores, 0.40), p15 = Pctile(scores, 0.15);
        foreach (var o in rows)
        {
            var d = (Dictionary<string, object?>)o;
            double sc = (double)d["carrier_score"]!;
            double sv = d.TryGetValue("_savings", out var s) && s is double sd ? sd : 0.0;
            d["disposition"] = DispositionByBand(sc, p70, p40, p15, sv, 250_000.0);
        }
    }

    private static double Pctile(List<double> sorted, double q)
    {
        if (sorted.Count == 0) return 0;
        double pos = q * (sorted.Count - 1);
        int lo = (int)Math.Floor(pos), hi = (int)Math.Ceiling(pos);
        return lo == hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
    }

    private static string DispositionByBand(double score, double p70, double p40, double p15,
        double annualSavings, double exitPenalty)
    {
        if (score >= p70) return "GROW";
        if (score >= p40) return "RETAIN";
        if (score >= p15) return "IMPROVE";
        return annualSavings > exitPenalty * 0.2 ? "EXIT" : "IMPROVE";
    }

    // Carrier Score: w1=0.40 cost, w2=0.35 service, w3=0.25 emissions (0-100, higher=better)
    private static double CarrierScore(double otif, double intensity, double costPerShip,
        double netIntensity, double avgCostPerShip)
    {
        double costNorm  = Math.Max(0, 1.0 - (costPerShip  / Math.Max(1, avgCostPerShip) - 0.5));
        double svcNorm   = Math.Min(1.0, otif / 100.0);
        double emitNorm  = Math.Max(0, 1.0 - (intensity / Math.Max(1, netIntensity) - 0.5));
        return R2(Math.Min(100, (costNorm * 0.40 + svcNorm * 0.35 + emitNorm * 0.25) * 100));
    }

    public static object CarrierPack(List<Row> lanes, string carrierName)
    {
        var cLanes = lanes.Where(l => l.GetString("Carrier") == carrierName).ToList();
        if (cLanes.Count == 0)
            return new Dictionary<string, object?> { ["error"] = "Carrier not found" };

        double freight  = cLanes.Sum(LaneAnnualFreight);
        double co2      = cLanes.Sum(LaneAnnualCo2e);
        double tkm      = cLanes.Sum(LaneAnnualTonneKm);
        int    ship     = cLanes.Sum(LaneShipments);
        double otifW    = SafeDiv(cLanes.Sum(l => l.GetDouble("OTIF_Pct") * LaneShipments(l)), ship);
        double transitW = SafeDiv(cLanes.Sum(l => l.GetDouble("Transit_Time_Days") * LaneShipments(l)), ship);
        double intensity = SafeDiv(co2 * 1_000_000, tkm);

        double netFreight  = lanes.Sum(LaneAnnualFreight);
        double netCo2      = lanes.Sum(LaneAnnualCo2e);
        double netTkm      = lanes.Sum(LaneAnnualTonneKm);
        int    netShip     = lanes.Sum(LaneShipments);
        double netOtif     = SafeDiv(lanes.Sum(l => l.GetDouble("OTIF_Pct") * LaneShipments(l)), netShip);
        double netIntensity = SafeDiv(netCo2 * 1_000_000, netTkm);
        double netCostPerShip = SafeDiv(netFreight, netShip);
        double cCostPerShip = SafeDiv(freight, ship);
        double unitsPerShip = 50.0;
        double costPerUnit  = SafeDiv(freight, ship * unitsPerShip);

        // exit analysis - estimate alternative carrier
        double altRate = netCostPerShip * 0.93; // 7% improvement assumption
        double annualSavingsIfExit = (cCostPerShip - altRate) * ship;
        double exitPenalty = 250_000.0; // typical contract exit
        double netAnnualEffect = annualSavingsIfExit - exitPenalty * 0.20;
        double paybackMonths = annualSavingsIfExit > 0 ? 12.0 * exitPenalty / annualSavingsIfExit : 99;

        double score = CarrierScore(otifW, intensity, cCostPerShip, netIntensity, netCostPerShip);
        // disposition consistent with the population-percentile bands used in the scorecards
        string disp = CarrierScorecards(lanes)
            .Select(s => (Dictionary<string, object?>)s)
            .FirstOrDefault(s => (string)s["carrier"]! == carrierName)?["disposition"] as string ?? "RETAIN";

        // component scores (0-100 each)
        double costComp  = Math.Min(100, Math.Max(0, (1.0 - (cCostPerShip / Math.Max(1, netCostPerShip) - 0.5)) * 100));
        double svcComp   = Math.Min(100, otifW);
        double emitComp  = Math.Min(100, Math.Max(0, (1.0 - (intensity / Math.Max(1, netIntensity) - 0.5)) * 100));

        string narrative = disp switch
        {
            "GROW"   => $"{carrierName} is a high-performing partner: cost {fmtK(cCostPerShip)}/ship vs benchmark {fmtK(netCostPerShip)}/ship, OTIF {otifW:0.1}%, intensity {intensity:0} g/tkm. Recommended to consolidate volume.",
            "RETAIN" => $"{carrierName} meets service and cost targets. OTIF {otifW:0.1}% vs 95% target; intensity {intensity:0} g/tkm vs network {netIntensity:0} g/tkm. Maintain current volume.",
            "IMPROVE"    => $"{carrierName} underperforms on {'s' + (otifW < 95 ? "ervice (OTIF " + otifW.ToString("0.1") + "%)" : "ustainability (intensity " + intensity.ToString("0") + " g/tkm)")}. Issue corrective SLA within 90 days or escalate.",
            "EXIT"   => $"Exiting {carrierName} saves an estimated {fmtK(annualSavingsIfExit)}/yr after exit costs of {fmtK(exitPenalty)}. Reallocate {ship:N0} shipments to higher-scoring carriers.",
            _ => "",
        };

        return new Dictionary<string, object?>
        {
            ["carrier"] = carrierName,
            ["disposition"] = disp,
            ["carrier_score"] = R2(score),
            ["score_components"] = new Dictionary<string, object?>
            {
                ["cost_efficiency"] = R2(costComp),
                ["service_otif"]    = R2(svcComp),
                ["emissions"]       = R2(emitComp),
            },
            ["stats"] = new Dictionary<string, object?>
            {
                ["annual_freight_usd"]   = R2(freight),
                ["shipments"]            = ship,
                ["lanes"]                = cLanes.Count,
                ["avg_otif_pct"]         = R2(otifW),
                ["avg_transit_days"]     = R2(transitW),
                ["cost_per_shipment"]    = R2(cCostPerShip),
                ["cost_per_unit"]        = R2(costPerUnit),
                ["emission_intensity_g_per_tkm"] = R2(intensity),
            },
            ["benchmark"] = new Dictionary<string, object?>
            {
                ["network_cost_per_shipment"]    = R2(netCostPerShip),
                ["network_emission_intensity"]   = R2(netIntensity),
                ["otif_target_pct"]              = Config.OtifTargetPct,
                ["cost_vs_benchmark_pct"]        = R2((cCostPerShip / Math.Max(1, netCostPerShip) - 1.0) * 100),
                ["intensity_vs_benchmark_pct"]   = R2((intensity / Math.Max(1, netIntensity) - 1.0) * 100),
            },
            ["narrative"] = narrative,
            ["exit_analysis"] = new Dictionary<string, object?>
            {
                ["volume_to_reallocate"] = ship,
                ["estimated_alt_rate"]   = R2(altRate),
                ["annual_savings_usd"]   = R2(annualSavingsIfExit),
                ["exit_penalty_usd"]     = R2(exitPenalty),
                ["net_annual_effect_usd"]= R2(netAnnualEffect),
                ["payback_months"]       = R2(paybackMonths),
            },
        };
    }

    // Aggregate dispositions for the decision hub roll-up
    public static object AllCarrierDispositions(List<Row> lanes)
    {
        var scorecards = CarrierScorecards(lanes);   // dispositions already assigned by band
        double netCostPerShip = SafeDiv(lanes.Sum(LaneAnnualFreight), lanes.Sum(LaneShipments));

        var disp = new Dictionary<string, List<string>>();
        double spendAtRisk = 0, savingsOpportunity = 0;

        foreach (var sc in scorecards)
        {
            var d = (Dictionary<string, object?>)sc;
            string name = (string)d["carrier"]!;
            double cps = d["cost_per_shipment"] is double cd ? cd : Convert.ToDouble(d["cost_per_shipment"] ?? 0.0);
            int ships = d["shipments"] is int si ? si : (int)Math.Round(Convert.ToDouble(d["shipments"] ?? 0));
            double freight = d["annual_freight_usd"] is double fd ? fd : Convert.ToDouble(d["annual_freight_usd"] ?? 0.0);
            double savings = (cps - netCostPerShip * 0.93) * ships;

            string disposition = (string)(d["disposition"] ?? "RETAIN");
            if (!disp.ContainsKey(disposition)) disp[disposition] = new List<string>();
            disp[disposition].Add(name);

            if (disposition is "EXIT" or "IMPROVE") spendAtRisk += freight;
            if (disposition == "EXIT") savingsOpportunity += Math.Max(0, savings);
        }

        return new Dictionary<string, object?>
        {
            ["dispositions"] = disp.ToDictionary(kv => kv.Key, kv => (object)new Dictionary<string, object?>
            {
                ["count"] = kv.Value.Count,
                ["carriers"] = kv.Value.Cast<object>().ToList(),
            }),
            ["counts"] = new Dictionary<string, object?>
            {
                ["GROW"]   = (disp.TryGetValue("GROW",   out var g) ? g.Count : 0),
                ["RETAIN"] = (disp.TryGetValue("RETAIN", out var r) ? r.Count : 0),
                ["IMPROVE"]    = (disp.TryGetValue("IMPROVE",    out var fx) ? fx.Count : 0),
                ["EXIT"]   = (disp.TryGetValue("EXIT",   out var e) ? e.Count : 0),
            },
            ["spend_at_risk_usd"]       = R2(spendAtRisk),
            ["savings_opportunity_usd"] = R2(savingsOpportunity),
        };
    }

    private static string fmtK(double v) => $"${v / 1_000.0:0.0}k";

    public static List<object> LanePerformance(List<Row> lanes)
    {
        return lanes.Select(l => (object)new Dictionary<string, object?>
        {
            ["lane_id"] = l.GetString("Lane_ID"),
            ["lane"] = $"{l.GetString("Origin")} \u2192 {l.GetString("Destination")}",
            ["origin"] = l.GetString("Origin"), ["destination"] = l.GetString("Destination"),
            ["segment"] = l.GetString("Segment"), ["mode"] = l.GetString("Mode"),
            ["carrier"] = l.GetString("Carrier"),
            ["product_category"] = l.GetString("Product_Category"),
            ["distance_km"] = l.GetRaw("Distance_KM"),
            ["transit_days"] = l.GetRaw("Transit_Time_Days"),
            ["cost_per_shipment"] = R2(LaneFreightPerShipment(l)),
            ["annual_freight_usd"] = R2(LaneAnnualFreight(l)),
            ["shipments"] = LaneShipments(l),
            ["otif_pct"] = l.GetDouble("OTIF_Pct"),
            ["annual_co2e"] = R2(LaneAnnualCo2e(l)),
            ["sla_breach"] = l.GetDouble("OTIF_Pct") < Config.OtifTargetPct,
        }).OrderByDescending(x => (double)((Dictionary<string, object?>)x)["annual_freight_usd"]!).ToList();
    }

    public static List<object> TransitTimeDistribution(List<Row> lanes)
    {
        var byMode = new Dictionary<string, List<double>>();
        var order = new List<string>();
        foreach (var l in lanes)
        {
            var m = l.GetString("Mode");
            if (!byMode.ContainsKey(m)) { byMode[m] = new List<double>(); order.Add(m); }
            byMode[m].Add(l.GetDouble("Transit_Time_Days"));
        }
        return order.Select(m =>
        {
            var v = byMode[m];
            return (object)new Dictionary<string, object?>
            {
                ["mode"] = m, ["avg_days"] = R2(v.Sum() / v.Count),
                ["min_days"] = v.Min(), ["max_days"] = v.Max(), ["lanes"] = v.Count,
            };
        }).ToList();
    }

    public static object PerformanceSummary(List<Row> lanes)
    {
        int totalShip = lanes.Sum(LaneShipments);
        if (totalShip == 0) totalShip = 1;
        double weightedOtif = lanes.Sum(l => l.GetDouble("OTIF_Pct") * LaneShipments(l)) / totalShip;
        int breaches = lanes.Count(l => l.GetDouble("OTIF_Pct") < Config.OtifTargetPct);
        return new Dictionary<string, object?>
        {
            ["total_freight_usd"] = R2(lanes.Sum(LaneAnnualFreight)),
            ["weighted_avg_otif_pct"] = R2(weightedOtif),
            ["otif_target_pct"] = Config.OtifTargetPct,
            ["sla_breaches"] = breaches, ["lane_count"] = lanes.Count,
            ["carrier_count"] = lanes.Select(l => l.GetString("Carrier")).Distinct().Count(),
            ["avg_cost_per_shipment"] = R2(SafeDiv(lanes.Sum(LaneAnnualFreight), totalShip)),
        };
    }

    // ── Module 2 - Port Congestion Intelligence (spec §116-119) ──────────────────
    // Idle Emissions = Waiting Days × Daily Fuel Burn × Emission Factor (spec §118),
    // displayed separately from transport emissions. Deterministic per-port congestion.
    public static List<object> PortCongestion(List<Row> lanes)
    {
        const double dailyIdleCo2ePerCall = 15.5;   // tCO2e/day hotelling (≈5 t fuel × 3.1)
        const double demurragePerContainerDay = 165; // USD/container/day

        // A port appears as the destination of Supplier→Port or the origin of Port→Plant.
        var ports = new Dictionary<string, (string country, int journeys, int ship, double freight)>();
        void Add(string name, string country, Row l)
        {
            if (string.IsNullOrWhiteSpace(name)) return;
            var cur = ports.TryGetValue(name, out var v) ? v : (country: country, journeys: 0, ship: 0, freight: 0.0);
            ports[name] = (string.IsNullOrEmpty(cur.country) ? country : cur.country,
                cur.journeys + 1, cur.ship + LaneShipments(l), cur.freight + LaneAnnualFreight(l));
        }
        foreach (var l in lanes)
        {
            var seg = l.GetString("Segment");
            if (seg == "Supplier→Port") Add(l.GetString("Destination"), l.GetString("Destination_Country"), l);
            else if (seg == "Port→Plant") Add(l.GetString("Origin"), l.GetString("Origin_Country"), l);
        }

        var rows = new List<(Dictionary<string, object?> row, double idle)>();
        foreach (var (name, v) in ports)
        {
            // deterministic wait time 4-13 days from a stable name hash
            uint h = 2166136261;
            foreach (char c in name) { h ^= c; h *= 16777619; }
            double wait = 4.0 + (h % 900) / 100.0;                  // 4.00-12.99 days
            double congestionIndex = Math.Round(wait / 13.0 * 100, MidpointRounding.AwayFromZero);
            double callsPerYear = Math.Max(1, v.journeys);
            double idle = R2(wait * dailyIdleCo2ePerCall * callsPerYear);
            double delayCost = R2(wait * v.ship * demurragePerContainerDay);

            rows.Add((new Dictionary<string, object?>
            {
                ["port"] = name, ["country"] = v.country,
                ["avg_wait_time_days"] = R2(wait),
                ["congestion_index"] = congestionIndex,
                ["affected_journeys"] = v.journeys,
                ["affected_shipments"] = v.ship,
                ["annual_freight_usd"] = R2(v.freight),
                ["delay_cost_usd"] = delayCost,
                ["idle_emissions_tco2e"] = idle,
                ["status"] = wait >= 10 ? "Critical" : wait >= 7 ? "Elevated" : "Normal",
            }, idle));
        }

        return rows.OrderByDescending(r => r.idle).Take(15).Select(r => (object)r.row).ToList();
    }
}
