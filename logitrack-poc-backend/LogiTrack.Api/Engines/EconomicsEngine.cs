using System.Globalization;
using LogiTrack.Api.Core;
using static LogiTrack.Api.Core.NumberUtil;
using static LogiTrack.Api.Engines.Metrics;

namespace LogiTrack.Api.Engines;

/// <summary>Module 3 (Scenario Planning) + Module 6 (Transition Economics).</summary>
public static class EconomicsEngine
{
    private sealed record Baseline(double Freight, double Co2, int Ship,
        double Otif, double Transit, double Landed, int LaneCount);

    private static Baseline ComputeBaseline(List<Row> lanes, List<Row> trade, double carbonPrice)
    {
        double freight = lanes.Sum(LaneAnnualFreight);
        double co2 = lanes.Sum(LaneAnnualCo2e);
        int ship = lanes.Sum(LaneShipments);
        if (ship == 0) ship = 1;
        double otif = SafeDiv(lanes.Sum(l => l.GetDouble("OTIF_Pct") * LaneShipments(l)), ship);
        double transit = SafeDiv(lanes.Sum(l => l.GetDouble("Transit_Time_Days") * LaneShipments(l)), ship);
        double landed = lanes.Sum(l => (double)SustainabilityEngine.LaneLanded(l, trade, carbonPrice)["landed_cost_per_shipment"]! * LaneShipments(l));
        return new Baseline(freight, co2, ship, otif, transit, landed, lanes.Count);
    }

    // ─────────── Module 3: scenario evaluation ───────────
    public static object EvaluateScenario(Scenario s, List<Row> lanes, List<Row> trade,
        double carbonPrice, double waccPct, int horizonYears,
        double? freightDeltaPct = null, double? co2eDeltaPct = null,
        double? otifDeltaPts = null, int? transitDeltaDays = null)
    {
        var aff = s.AffectedLanes(lanes);
        var b = ComputeBaseline(aff, trade, carbonPrice);

        double fd = freightDeltaPct ?? s.FreightDeltaPct;
        double cd = co2eDeltaPct ?? s.Co2eDeltaPct;
        double od = otifDeltaPts ?? s.OtifDeltaPts;
        int td = transitDeltaDays ?? s.TransitDeltaDays;

        double futFreight = b.Freight * (1 + fd);
        double futCo2 = b.Co2 * (1 + cd);
        double futOtif = Math.Min(100.0, b.Otif + od);
        double futTransit = Math.Max(0.0, b.Transit + td);
        double futLanded = b.Landed * (1 + fd * 0.6 + s.TariffDeltaPct * 0.15);

        return new Dictionary<string, object?>
        {
            ["scenario"] = ScenarioBrief(s),
            ["affected_lane_count"] = aff.Count,
            ["base_deltas"] = new Dictionary<string, object?>
            {
                ["freight_delta_pct"] = R2(s.FreightDeltaPct),
                ["co2e_delta_pct"] = R2(s.Co2eDeltaPct),
                ["otif_delta_pts"] = R2(s.OtifDeltaPts),
                ["transit_delta_days"] = s.TransitDeltaDays,
            },
            ["active_deltas"] = new Dictionary<string, object?>
            {
                ["freight_delta_pct"] = R2(fd),
                ["co2e_delta_pct"] = R2(cd),
                ["otif_delta_pts"] = R2(od),
                ["transit_delta_days"] = td,
            },
            ["baseline"] = new Dictionary<string, object?>
            {
                ["annual_freight_usd"] = R2(b.Freight), ["annual_co2e"] = R2(b.Co2),
                ["weighted_otif_pct"] = R2(b.Otif), ["weighted_transit_days"] = R2(b.Transit),
                ["annual_landed_cost_usd"] = R2(b.Landed),
            },
            ["future_state"] = new Dictionary<string, object?>
            {
                ["annual_freight_usd"] = R2(futFreight), ["annual_co2e"] = R2(futCo2),
                ["weighted_otif_pct"] = R2(futOtif), ["weighted_transit_days"] = R2(futTransit),
                ["annual_landed_cost_usd"] = R2(futLanded),
            },
            ["impact"] = new Dictionary<string, object?>
            {
                ["cost_impact_usd"] = R2(futFreight - b.Freight),
                ["annual_savings_usd"] = R2(b.Freight - futFreight),
                ["emissions_impact_co2e"] = R2(futCo2 - b.Co2),
                ["service_impact_otif_pts"] = R2(futOtif - b.Otif),
                ["transit_impact_days"] = R2(futTransit - b.Transit),
                ["landed_cost_impact_usd"] = R2(futLanded - b.Landed),
            },
        };
    }

    private static Dictionary<string, object?> ScenarioBrief(Scenario s) => new()
    {
        ["scenario_id"] = s.ScenarioId, ["name"] = s.Name, ["type"] = s.Type,
        ["lever"] = s.Lever, ["description"] = s.Description,
    };

    // ─────────── Module 6: components ───────────

    public sealed record Tcs(double Total, double OneTime, double Recurring,
        List<Dictionary<string, object?>> Components, List<Dictionary<string, object?>> TopDrivers);

    public static Tcs TrueCostOfSwitching(Scenario s, double baseFreight, double baseCo2, double carbonPrice)
    {
        double freightDelta = baseFreight * s.FreightDeltaPct;
        double wcOneTime = Math.Abs(baseFreight * s.WcDeltaPct) * 0.5;
        double contractExit = s.ContractExitUsd;
        double itIntegration = s.ItIntegrationUsd;
        double customs = s.CustomsSetupUsd;
        double productivity = Math.Abs(baseFreight) * 0.025;
        double carbonDelta = baseCo2 * s.Co2eDeltaPct * carbonPrice;
        double slaExposure = Math.Abs(baseFreight) * Math.Max(0.0, -s.OtifDeltaPts / 100.0) * 2.0;

        var components = new List<Dictionary<string, object?>>
        {
            new() { ["label"] = "Freight cost delta (recurring)", ["amount"] = R2(freightDelta), ["one_time"] = false },
            new() { ["label"] = "Working capital impact (one-time)", ["amount"] = R2(wcOneTime), ["one_time"] = true },
            new() { ["label"] = "Contract exit penalties", ["amount"] = R2(contractExit), ["one_time"] = true },
            new() { ["label"] = "IT / EDI integration", ["amount"] = R2(itIntegration), ["one_time"] = true },
            new() { ["label"] = "Customs / broker setup", ["amount"] = R2(customs), ["one_time"] = true },
            new() { ["label"] = "Productivity loss (ramp)", ["amount"] = R2(productivity), ["one_time"] = true },
            new() { ["label"] = "Carbon cost delta (recurring)", ["amount"] = R2(carbonDelta), ["one_time"] = false },
            new() { ["label"] = "SLA breach exposure", ["amount"] = R2(slaExposure), ["one_time"] = true },
        };
        double oneTime = components.Where(c => (bool)c["one_time"]!).Sum(c => (double)c["amount"]!);
        double recurring = components.Where(c => !(bool)c["one_time"]!).Sum(c => (double)c["amount"]!);
        var topDrivers = components.OrderByDescending(c => Math.Abs((double)c["amount"]!)).Take(3).ToList();
        return new Tcs(R2(oneTime + recurring), R2(oneTime), R2(recurring), components, topDrivers);
    }

    public static object WorkingCapitalBridge(Scenario s, double baseFreight, Row fin)
    {
        double dio0 = fin.GetDouble("DIO_Days", Config.DefaultDioDays);
        double dso0 = fin.GetDouble("DSO_Days", Config.DefaultDsoDays);
        double dpo0 = fin.GetDouble("DPO_Days", Config.DefaultDpoDays);
        double ccc0 = dio0 + dso0 - dpo0;
        double dioT = dio0 + s.WcDeltaPct * 90.0;
        double dpoT = dpo0 - s.WcDeltaPct * 10.0;

        var snaps = new List<Dictionary<string, object?>>();
        double peak = 0.0; int peakM = 0; int? recovery = null;

        for (int m = 0; m <= 24; m++)
        {
            double dio, dso, dpo;
            if (m == 0) { dio = dio0; dso = dso0; dpo = dpo0; }
            else if (m <= 3)
            {
                double r = m / 3.0;
                dio = dio0 + (dioT - dio0) * 1.4 * r; dso = dso0;
                dpo = dpo0 + (dpoT - dpo0) * 1.3 * r;
            }
            else if (m <= 9)
            {
                double dec = Math.Max(0.0, (9 - m) / 6.0);
                dio = dio0 + (dioT - dio0) * (1 + 0.4 * dec); dso = dso0;
                dpo = dpo0 + (dpoT - dpo0) * (1 + 0.3 * dec);
            }
            else { dio = dioT; dso = dso0; dpo = dpoT; }

            double ccc = dio + dso - dpo;
            double nwc = (ccc - ccc0) / 365.0 * baseFreight;
            double prev = snaps.Count > 0 ? (double)snaps[^1]["nwc_delta_usd"]! : 0.0;
            snaps.Add(new Dictionary<string, object?>
            {
                ["month"] = m, ["dio"] = R2(dio), ["dso"] = R2(dso), ["dpo"] = R2(dpo),
                ["ccc"] = R2(ccc), ["nwc_delta_usd"] = R2(nwc), ["cash_flow_usd"] = R2(-(nwc - prev)),
            });
            if (Math.Abs(nwc) > Math.Abs(peak)) { peak = nwc; peakM = m; }
        }
        foreach (var snap in snaps)
        {
            int mm = (int)snap["month"]!;
            double nwc = (double)snap["nwc_delta_usd"]!;
            if (mm > peakM && Math.Abs(nwc) < Math.Abs(peak) * 0.25 && recovery is null)
                recovery = mm;
        }
        return new Dictionary<string, object?>
        {
            ["baseline_ccc_days"] = R2(ccc0), ["peak_nwc_delta_usd"] = R2(peak), ["peak_month"] = peakM,
            ["steady_state_nwc_usd"] = snaps[^1]["nwc_delta_usd"], ["months_to_recovery"] = recovery,
            ["credit_facility_required_usd"] = R2(Math.Abs(peak) * 1.2), ["snapshots"] = snaps.Cast<object>().ToList(),
        };
    }

    public sealed record Tte(double BaseTariff, double BaseDuty, double TariffSavings,
        bool FtaEligible, bool Section232, Dictionary<string, object?> Dict);

    public static Tte TariffDutyAnalysis(Scenario s, List<Row> aff, List<Row> trade, double carbonPrice)
    {
        double baseTariff = 0, baseDuty = 0;
        foreach (var l in aff)
        {
            var d = SustainabilityEngine.LaneLanded(l, trade, carbonPrice);
            int sh = LaneShipments(l);
            baseTariff += (double)d["tariff"]! * sh;
            baseDuty += (double)d["duty"]! * sh;
        }
        double tariffSavings = -baseTariff * s.TariffDeltaPct;
        bool section232 = aff.Any(l => l.GetString("Origin_Country") == "CN" && l.GetString("Destination_Country") == "US");
        var dict = new Dictionary<string, object?>
        {
            ["baseline_annual_tariff_usd"] = R2(baseTariff),
            ["baseline_annual_duty_usd"] = R2(baseDuty),
            ["tariff_savings_usd"] = R2(tariffSavings),
            ["fta_eligible"] = s.TariffDeltaPct < -0.1,
            ["section_232_exposed"] = section232,
        };
        return new Tte(baseTariff, baseDuty, R2(tariffSavings), s.TariffDeltaPct < -0.1, section232, dict);
    }

    public sealed record Ranpv(double P10, double P50, double P90, double BaseCase,
        double ProbPositive, Dictionary<string, object?> Dict);

    public static Ranpv RiskAdjustedNpv(Scenario s, Tcs tcs, double baseFreight,
        double tariffSavings, double waccPct, int horizonYears, int trials)
    {
        var rng = new PyRandom(11);
        double annualBenefit = -tcs.Recurring + tariffSavings;
        double upfront = -tcs.OneTime;

        double Disc(int y) => 1.0 / Math.Pow(1 + waccPct / 100.0, y);

        var npvs = new List<double>(trials);
        for (int t = 0; t < trials; t++)
        {
            double demand = rng.Gauss(1.0, 0.10);
            double fuel = rng.Gauss(1.0, 0.12);
            double tariff = rng.Gauss(1.0, 0.20);
            double npv = upfront;
            for (int y = 1; y <= horizonYears; y++)
            {
                double disruption = rng.NextDouble() < 0.10 ? baseFreight * rng.Uniform(0.04, 0.15) : 0.0;
                double cf = annualBenefit * demand * fuel + tariffSavings * (tariff - 1) * 0.5 - disruption;
                npv += cf * Disc(y);
            }
            npvs.Add(npv);
        }
        npvs.Sort();
        int n = npvs.Count;
        double Pick(double q) => R2(npvs[Math.Min(n - 1, (int)(n * q))]);

        double baseNpv = upfront;
        for (int y = 1; y <= horizonYears; y++) baseNpv += annualBenefit * Disc(y);
        double pos = 100.0 * npvs.Count(v => v > 0) / n;

        var sens = new List<Dictionary<string, object?>>
        {
            new() { ["factor"] = "Tariff regime", ["swing_usd"] = R2(Math.Abs(tariffSavings) * 0.5) },
            new() { ["factor"] = "Demand variability", ["swing_usd"] = R2(Math.Abs(annualBenefit) * 0.10) },
            new() { ["factor"] = "Fuel price", ["swing_usd"] = R2(Math.Abs(annualBenefit) * 0.12) },
            new() { ["factor"] = "Disruption events", ["swing_usd"] = R2(baseFreight * 0.10) },
        }.OrderByDescending(x => (double)x["swing_usd"]!).ToList();

        int[] percentiles = { 5, 10, 25, 50, 75, 90, 95 };
        var distribution = percentiles.Select(q => (object)new Dictionary<string, object?>
        {
            ["percentile"] = q, ["npv_usd"] = Pick(q / 100.0),
        }).ToList();

        var dict = new Dictionary<string, object?>
        {
            ["p10_npv_usd"] = Pick(0.10), ["p50_npv_usd"] = Pick(0.50), ["p90_npv_usd"] = Pick(0.90),
            ["base_case_npv_usd"] = R2(baseNpv), ["probability_positive_pct"] = R2(pos),
            ["downside_exposure_usd"] = Pick(0.05), ["wacc_pct"] = waccPct,
            ["horizon_years"] = horizonYears, ["trials"] = trials,
            ["sensitivity"] = sens.Cast<object>().ToList(), ["distribution"] = distribution,
        };
        return new Ranpv(Pick(0.10), Pick(0.50), Pick(0.90), R2(baseNpv), R2(pos), dict);
    }

    public static object ScenarioRisk(Scenario s, Ranpv ranpv)
    {
        double asset = s.AssetSpecificity, sup = s.SupplierConcentration, geo = s.GeoConcentration;
        double reversibility = 1 - (asset * 0.5 + sup * 0.25 + geo * 0.25);
        double downside = Math.Max(0.0, -ranpv.P10);
        double baseAbs = Math.Abs(ranpv.BaseCase) + 1;
        double riskScore = Math.Min(100, Math.Round(
            (1 - reversibility) * 45 + (downside / baseAbs) * 35 + (100 - ranpv.ProbPositive) * 0.20,
            MidpointRounding.AwayFromZero));
        string rating = riskScore < 35 ? "Low" : riskScore < 65 ? "Moderate" : "High";
        return new Dictionary<string, object?>
        {
            ["risk_score"] = riskScore, ["risk_rating"] = rating,
            ["reversibility_pct"] = R2(reversibility * 100),
            ["asset_specificity"] = R2(asset),
            ["concentration"] = new Dictionary<string, object?>
            { ["supplier"] = R2(sup), ["carrier"] = R2(sup * 0.8), ["geographic"] = R2(geo) },
            ["probability_negative_pct"] = R2(100 - ranpv.ProbPositive),
        };
    }

    public sealed record Vrt(int? Breakeven, Dictionary<string, object?> Dict);

    public static Vrt ValueRealization(Scenario s, Tcs tcs, double baseFreight, double tariffSavings)
    {
        double annualBenefit = -tcs.Recurring + tariffSavings;
        double monthly = annualBenefit / 12.0;
        double oneTime = tcs.OneTime;
        var timeline = new List<Dictionary<string, object?>>();
        double cum = -oneTime, peakBurn = -oneTime;
        int? breakeven = null;
        for (int m = 0; m <= 36; m++)
        {
            double cf;
            if (m == 0) cf = -oneTime;
            else { double ramp = Math.Min(1.0, m / 6.0); cf = monthly * ramp; cum += cf; }
            timeline.Add(new Dictionary<string, object?>
            {
                ["month"] = m, ["monthly_cash_flow_usd"] = R2(m != 0 ? cf : -oneTime),
                ["cumulative_cash_flow_usd"] = R2(cum),
            });
            if (cum < peakBurn) peakBurn = cum;
            if (cum >= 0 && breakeven is null && m > 0) breakeven = m;
        }
        var dict = new Dictionary<string, object?>
        {
            ["breakeven_month"] = breakeven, ["payback_period_months"] = breakeven,
            ["peak_cash_burn_usd"] = R2(peakBurn), ["steady_monthly_benefit_usd"] = R2(monthly),
            ["timeline"] = timeline.Cast<object>().ToList(),
        };
        return new Vrt(breakeven, dict);
    }

    // ─────────── Module 6: composer ───────────
    public static object TransitionEconomics(Scenario s, List<Row> lanes, List<Row> trade, Row fin,
        double carbonPrice, double waccPct, int horizonYears, int trials)
    {
        var aff = s.AffectedLanes(lanes);
        var b = ComputeBaseline(aff, trade, carbonPrice);
        double bf = b.Freight, bc = b.Co2;

        var tcs = TrueCostOfSwitching(s, bf, bc, carbonPrice);
        var wcb = (Dictionary<string, object?>)WorkingCapitalBridge(s, bf, fin);
        var tte = TariffDutyAnalysis(s, aff, trade, carbonPrice);
        var ranpv = RiskAdjustedNpv(s, tcs, bf, tte.TariffSavings, waccPct, horizonYears, trials);
        var risk = (Dictionary<string, object?>)ScenarioRisk(s, ranpv);
        var vrt = ValueRealization(s, tcs, bf, tte.TariffSavings);

        double reversibilityPct = (double)risk["reversibility_pct"]!;
        string verdict, why;
        if (ranpv.P10 > 0)
        { verdict = "APPROVE"; why = $"Positive NPV across the distribution (P10 ${ranpv.P10 / 1e6:0.0}M)."; }
        else if (ranpv.P50 > 0 && reversibilityPct > 50)
        { verdict = "PILOT"; why = $"Median NPV positive (P50 ${ranpv.P50 / 1e6:0.0}M); largely reversible."; }
        else if (ranpv.P50 > 0)
        { verdict = "CONDITIONAL"; why = $"P50 positive but low reversibility ({reversibilityPct:0}%)."; }
        else
        { verdict = "DECLINE"; why = $"P50 NPV negative (${ranpv.P50 / 1e6:0.0}M)."; }

        double riskScore = (double)risk["risk_score"]!;
        string ratingLower = ((string)risk["risk_rating"]!).ToLowerInvariant();
        int? be = vrt.Breakeven;
        double peakNwc = (double)wcb["peak_nwc_delta_usd"]!;
        int peakMonth = (int)wcb["peak_month"]!;

        string decisionSummary =
            $"{verdict}. Investment ${tcs.OneTime / 1e6:0.0}M; " +
            $"peak cash ${Math.Abs(peakNwc) / 1e6:0.0}M (month {peakMonth}); " +
            $"risk-adjusted NPV P50 ${ranpv.P50 / 1e6:0.0}M, " +
            $"{ranpv.ProbPositive:0}% positive; " +
            $"breakeven {(be is not null ? "month " + be : "beyond horizon")}; " +
            $"risk {ratingLower} ({riskScore:0}/100).";

        var tcsDict = new Dictionary<string, object?>
        {
            ["total_switching_cost_usd"] = tcs.Total,
            ["one_time_investment_usd"] = tcs.OneTime,
            ["recurring_annual_delta_usd"] = tcs.Recurring,
            ["components"] = tcs.Components.Cast<object>().ToList(),
            ["top_drivers"] = tcs.TopDrivers.Cast<object>().ToList(),
        };

        // Carbon-credit / emissions-financial card (v2.0 spec Section 12.3)
        double co2Delta = bc * s.Co2eDeltaPct;           // negative = reduction
        double co2OffsetValue = -co2Delta * carbonPrice;  // positive when emissions fall
        double annualCarbonLine = co2OffsetValue;          // recurring NPV line
        double carbonNpvLine = 0;
        for (int y = 1; y <= horizonYears; y++)
            carbonNpvLine += annualCarbonLine / Math.Pow(1 + waccPct / 100.0, y);

        var carbonCredit = new Dictionary<string, object?>
        {
            ["baseline_annual_co2e"] = R2(bc),
            ["future_annual_co2e"]   = R2(bc * (1 + s.Co2eDeltaPct)),
            ["delta_co2e"]           = R2(co2Delta),
            ["carbon_price_usd_per_tonne"] = carbonPrice,
            ["annual_offset_value_usd"]    = R2(annualCarbonLine),
            ["carbon_npv_contribution_usd"]= R2(carbonNpvLine),
            ["methodology"] = "GLEC v3.x / ISO 14083:2023 WTW basis",
            ["note"] = co2Delta < 0
                ? $"Emissions reduction of {Math.Abs(co2Delta):0.1} t CO₂e/yr generates offset value at ${carbonPrice}/t."
                : $"Emissions increase of {co2Delta:0.1} t CO₂e/yr incurs carbon cost at ${carbonPrice}/t.",
        };

        return new Dictionary<string, object?>
        {
            ["scenario"] = ScenarioBrief(s),
            ["affected_lane_count"] = aff.Count,
            ["true_cost_of_switching"] = tcsDict,
            ["working_capital_bridge"] = wcb,
            ["tariff_duty_analysis"] = tte.Dict,
            ["risk_adjusted_npv"] = ranpv.Dict,
            ["scenario_risk"] = risk,
            ["value_realization"] = vrt.Dict,
            ["carbon_credit"] = carbonCredit,
            ["verdict"] = verdict, ["rationale"] = why,
            ["decision_summary"] = decisionSummary,
        };
    }
}
