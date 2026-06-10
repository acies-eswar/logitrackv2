using LogiTrack.Api.Core;
using static LogiTrack.Api.Core.NumberUtil;
using static LogiTrack.Api.Engines.Metrics;

namespace LogiTrack.Api.Engines;

/// <summary>Module 2 — Transportation Performance Management.</summary>
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
            string disp = Disposition(otif, intensity, netIntensity, cps, avgCostPerShip, savings, 250_000.0);
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
                ["carrier_score"] = R2(CarrierScore(otif, intensity, cps, netIntensity, avgCostPerShip)),
                ["modes"] = a.modes.Cast<object>().ToList(),
                ["sla_breach"] = otif < Config.OtifTargetPct,
                ["disposition"] = disp,
            });
        }
        return outRows.OrderByDescending(x => (double)((Dictionary<string, object?>)x)["annual_freight_usd"]!).ToList();
    }

    // Carrier Score: w1=0.40 cost, w2=0.35 service, w3=0.25 emissions (0–100, higher=better)
    private static double CarrierScore(double otif, double intensity, double costPerShip,
        double netIntensity, double avgCostPerShip)
    {
        double costNorm  = Math.Max(0, 1.0 - (costPerShip  / Math.Max(1, avgCostPerShip) - 0.5));
        double svcNorm   = Math.Min(1.0, otif / 100.0);
        double emitNorm  = Math.Max(0, 1.0 - (intensity / Math.Max(1, netIntensity) - 0.5));
        return R2(Math.Min(100, (costNorm * 0.40 + svcNorm * 0.35 + emitNorm * 0.25) * 100));
    }

    private static string Disposition(double otif, double intensity, double netIntensity,
        double costPerShip, double avgCostPerShip, double annualSavings, double exitPenalty)
    {
        bool costLow  = costPerShip <= avgCostPerShip * 1.05;
        bool svcOk    = otif >= Config.OtifTargetPct;
        bool emitOk   = intensity <= netIntensity * 1.10;

        if (costLow && svcOk && emitOk)   return "GROW";
        if (costLow && svcOk)              return "RETAIN";
        if (!svcOk || !emitOk)
        {
            // EXIT only if savings exceed exit cost
            if (annualSavings > exitPenalty * 0.2) return "EXIT";
            return "FIX";
        }
        return "RETAIN";
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

        // exit analysis – estimate alternative carrier
        double altRate = netCostPerShip * 0.93; // 7% improvement assumption
        double annualSavingsIfExit = (cCostPerShip - altRate) * ship;
        double exitPenalty = 250_000.0; // typical contract exit
        double netAnnualEffect = annualSavingsIfExit - exitPenalty * 0.20;
        double paybackMonths = annualSavingsIfExit > 0 ? 12.0 * exitPenalty / annualSavingsIfExit : 99;

        string disp = Disposition(otifW, intensity, netIntensity, cCostPerShip, netCostPerShip,
            annualSavingsIfExit, exitPenalty);

        double score = CarrierScore(otifW, intensity, cCostPerShip, netIntensity, netCostPerShip);

        // component scores (0-100 each)
        double costComp  = Math.Min(100, Math.Max(0, (1.0 - (cCostPerShip / Math.Max(1, netCostPerShip) - 0.5)) * 100));
        double svcComp   = Math.Min(100, otifW);
        double emitComp  = Math.Min(100, Math.Max(0, (1.0 - (intensity / Math.Max(1, netIntensity) - 0.5)) * 100));

        string narrative = disp switch
        {
            "GROW"   => $"{carrierName} is a high-performing partner: cost {fmtK(cCostPerShip)}/ship vs benchmark {fmtK(netCostPerShip)}/ship, OTIF {otifW:0.1}%, intensity {intensity:0} g/tkm. Recommended to consolidate volume.",
            "RETAIN" => $"{carrierName} meets service and cost targets. OTIF {otifW:0.1}% vs 95% target; intensity {intensity:0} g/tkm vs network {netIntensity:0} g/tkm. Maintain current volume.",
            "FIX"    => $"{carrierName} underperforms on {'s' + (otifW < 95 ? "ervice (OTIF " + otifW.ToString("0.1") + "%)" : "ustainability (intensity " + intensity.ToString("0") + " g/tkm)")}. Issue corrective SLA within 90 days or escalate.",
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
        var scorecards = CarrierScorecards(lanes);
        double netCostPerShip = SafeDiv(lanes.Sum(LaneAnnualFreight), lanes.Sum(LaneShipments));
        double netIntensity   = SafeDiv(lanes.Sum(LaneAnnualCo2e) * 1_000_000, lanes.Sum(LaneAnnualTonneKm));

        var disp = new Dictionary<string, List<string>>();
        double spendAtRisk = 0, savingsOpportunity = 0;

        foreach (var sc in scorecards)
        {
            var d = (Dictionary<string, object?>)sc;
            string name = (string)d["carrier"]!;
            double otif = d["avg_otif_pct"] is double od ? od : Convert.ToDouble(d["avg_otif_pct"] ?? 0.0);
            double intens = d["emission_intensity_g_per_tkm"] is double id ? id : Convert.ToDouble(d["emission_intensity_g_per_tkm"] ?? 0.0);
            double cps = d["cost_per_shipment"] is double cd ? cd : Convert.ToDouble(d["cost_per_shipment"] ?? 0.0);

            // shipments may be stored as int or double depending on source; handle both safely
            object shipObj = d["shipments"]!;
            int ships;
            if (shipObj is int si) ships = si;
            else if (shipObj is long sl) ships = (int)sl;
            else if (shipObj is double sd) ships = (int)Math.Round(sd);
            else if (int.TryParse(shipObj?.ToString() ?? "0", out var parsed)) ships = parsed;
            else ships = 0;

            double freight = d["annual_freight_usd"] is double fd ? fd : Convert.ToDouble(d["annual_freight_usd"] ?? 0.0);

            double altRate  = netCostPerShip * 0.93;
            double savings  = (cps - altRate) * ships;
            double exitPen  = 250_000.0;

            string disposition = Disposition(otif, intens, netIntensity, cps, netCostPerShip, savings, exitPen);
            if (!disp.ContainsKey(disposition)) disp[disposition] = new List<string>();
            disp[disposition].Add(name);

            if (disposition is "EXIT" or "FIX") spendAtRisk += freight;
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
                ["FIX"]    = (disp.TryGetValue("FIX",    out var fx) ? fx.Count : 0),
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
}
