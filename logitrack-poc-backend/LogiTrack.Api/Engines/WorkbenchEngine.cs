using LogiTrack.Api.Core;
using static LogiTrack.Api.Core.NumberUtil;
using static LogiTrack.Api.Engines.Metrics;

namespace LogiTrack.Api.Engines;

/// <summary>
/// Decision Workbench - 8 finance-native insights for a single proposed change.
/// Wraps EconomicsEngine outputs and adds SFO, TTE (enhanced), Landed CvE, and CEM.
/// </summary>
public static class WorkbenchEngine
{
    public static object Build(Scenario s, List<Row> lanes, List<Row> trade, Row fin,
        double carbonPrice, double waccPct, int horizonYears, int trials)
    {
        var aff = s.AffectedLanes(lanes);
        int totalShip = aff.Sum(LaneShipments);
        if (totalShip == 0) totalShip = 1;

        // ── base computations re-used from EconomicsEngine ──────────────────
        double baseFreight = aff.Sum(LaneAnnualFreight);
        double baseCo2 = aff.Sum(LaneAnnualCo2e);

        var tcsRaw = EconomicsEngine.TrueCostOfSwitching(s, baseFreight, baseCo2, carbonPrice);
        var wcbRaw = (Dictionary<string, object?>)EconomicsEngine.WorkingCapitalBridge(s, baseFreight, fin);
        var tteRaw = EconomicsEngine.TariffDutyAnalysis(s, aff, trade, carbonPrice);
        var ranpvRaw = EconomicsEngine.RiskAdjustedNpv(s, tcsRaw, baseFreight, tteRaw.TariffSavings, waccPct, horizonYears, trials);
        var riskRaw = (Dictionary<string, object?>)EconomicsEngine.ScenarioRisk(s, ranpvRaw);
        var vrtRaw = EconomicsEngine.ValueRealization(s, tcsRaw, baseFreight, tteRaw.TariffSavings);

        // ── Insight 1: TCS ───────────────────────────────────────────────────
        var tcsInsight = new Dictionary<string, object?>
        {
            ["total_switching_cost_usd"] = tcsRaw.Total,
            ["one_time_usd"] = tcsRaw.OneTime,
            ["recurring_annual_usd"] = tcsRaw.Recurring,
            ["components"] = tcsRaw.Components.Cast<object>().ToList(),
            ["top_drivers"] = tcsRaw.TopDrivers.Cast<object>().ToList(),
        };

        // ── Insight 2: WCB ───────────────────────────────────────────────────
        var wcbInsight = wcbRaw;

        // ── Insight 3: RANPV ─────────────────────────────────────────────────
        var ranpvInsight = ranpvRaw.Dict;

        // ── Insight 4: TTE (enhanced) ────────────────────────────────────────
        double avgFreightPerShip = SafeDiv(baseFreight, totalShip);
        double avgCo2PerShip = SafeDiv(baseCo2, totalShip);
        double baseLandedPerUnit = avgFreightPerShip * (1 + tteRaw.BaseTariff / Math.Max(1, baseFreight) * 0.15 + tteRaw.BaseDuty / Math.Max(1, baseFreight) * 0.10);
        double proposedLandedPerUnit = baseLandedPerUnit * (1 + s.FreightDeltaPct * 0.60 + s.TariffDeltaPct * 0.10);
        double cbamExposure = -baseCo2 * s.Co2eDeltaPct * 45.0; // EU ETS ~€45 assumption
        double ftzBenefit = tteRaw.FtaEligible ? Math.Abs(tteRaw.BaseTariff) * 0.08 : 0.0;
        double annualTariffSavings = -tteRaw.BaseTariff * s.TariffDeltaPct;
        double marginImpact = annualTariffSavings + cbamExposure;

        var taxOps = new List<string>();
        if (tteRaw.FtaEligible) taxOps.Add("Leverage USMCA / EU preferential duty rates");
        if (tteRaw.Section232) taxOps.Add("Mitigate Section 232 / 301 steel & aluminium exposure");
        if (s.TariffDeltaPct < -0.05) taxOps.Add("File for first-sale customs valuation to reduce dutiable basis");
        if (ftzBenefit > 0) taxOps.Add($"Foreign Trade Zone entry potential: {fmtK(ftzBenefit)}/yr");
        if (taxOps.Count == 0) taxOps.Add("No immediate optimization identified for this lane set");

        var tteInsight = new Dictionary<string, object?>
        {
            ["baseline_effective_landed_cost_per_unit"] = R2(baseLandedPerUnit),
            ["proposed_effective_landed_cost_per_unit"] = R2(proposedLandedPerUnit),
            ["annual_tariff_savings_usd"] = R2(annualTariffSavings),
            ["cbam_exposure_change_usd"] = R2(cbamExposure),
            ["margin_impact_usd"] = R2(marginImpact),
            ["fta_eligible"] = tteRaw.FtaEligible,
            ["ftz_benefit_usd"] = R2(ftzBenefit),
            ["section_232_exposed"] = tteRaw.Section232,
            ["tax_optimization_opportunities"] = taxOps.Cast<object>().ToList(),
        };

        // ── Insight 5: SFO (Strategic Flexibility & Optionality) ─────────────
        double asset = s.AssetSpecificity;
        double supConc = s.SupplierConcentration;
        double geoConc = s.GeoConcentration;
        double reversibilityPct = (double)riskRaw["reversibility_pct"]!;
        double lockInCost = tcsRaw.OneTime * asset;
        double reversalCost = lockInCost * 0.7;

        // flexibility score: 0-100 (higher = more flexible)
        double rawFlex = reversibilityPct - (asset * 30) - (supConc * 15) - (geoConc * 10) + 30;
        int flexScore = (int)Math.Round(Math.Max(0, Math.Min(100, rawFlex)), MidpointRounding.AwayFromZero);
        string stratRisk = flexScore >= 65 ? "High" : flexScore >= 40 ? "Moderate" : "Low";

        var conc = (Dictionary<string, object?>)riskRaw["concentration"]!;
        var sfoInsight = new Dictionary<string, object?>
        {
            ["flexibility_score"] = flexScore,
            ["strategic_risk_rating"] = stratRisk,
            ["reversibility_pct"] = reversibilityPct,
            ["lock_in_cost_usd"] = R2(lockInCost),
            ["reversal_cost_usd"] = R2(reversalCost),
            ["concentration"] = conc,
        };

        // ── Insight 7: Landed Cost vs Emissions ──────────────────────────────
        double avgLandedCurrent = aff.Sum(l =>
            (double)SustainabilityEngine.LaneLanded(l, trade, carbonPrice)["landed_cost_per_shipment"]! * LaneShipments(l));
        double avgEmCurrent = aff.Sum(l =>
            (double)SustainabilityEngine.LaneLanded(l, trade, carbonPrice)["landed_emissions_per_shipment"]! * LaneShipments(l));
        double currentLandedUnit = SafeDiv(avgLandedCurrent, totalShip);
        double currentEmUnit = SafeDiv(avgEmCurrent, totalShip);
        double proposedLandedUnit = currentLandedUnit * (1 + s.FreightDeltaPct * 0.60 + s.TariffDeltaPct * 0.10);
        double proposedEmUnit = currentEmUnit * (1 + s.Co2eDeltaPct);
        double costDelta = proposedLandedUnit - currentLandedUnit;
        double emDelta = proposedEmUnit - currentEmUnit;

        // Cost per ton CO2e reduced (negative means cost saved per ton reduced)
        double co2Reduced = currentEmUnit - proposedEmUnit;
        double costPerTonReduced = co2Reduced > 0.001 ? R2(-costDelta / co2Reduced) : 0.0;

        string effRank;
        if (costDelta < 0 && emDelta < 0) effRank = "Win-Win";
        else if (costDelta < 0) effRank = "Cost Win";
        else if (emDelta < 0) effRank = "Emissions Win";
        else effRank = "Trade-Off";

        var landedInsight = new Dictionary<string, object?>
        {
            ["cost_efficiency_rank"] = effRank,
            ["current"] = new Dictionary<string, object?>
            {
                ["landed_cost"] = R2(currentLandedUnit),
                ["landed_emissions"] = R3(currentEmUnit),
            },
            ["proposed"] = new Dictionary<string, object?>
            {
                ["landed_cost"] = R2(proposedLandedUnit),
                ["landed_emissions"] = R3(proposedEmUnit),
            },
            ["cost_per_unit_delta"] = R2(costDelta),
            ["emissions_per_unit_delta"] = R3(emDelta),
            ["cost_per_ton_co2e_reduced"] = costPerTonReduced,
        };

        // ── Insight 8: Carbon Efficiency Margin ──────────────────────────────
        double grossMarginPct = fin.GetDouble("Gross_Margin_Pct", 38.0);
        double revenuePerShip = fin.GetDouble("Revenue_Per_Shipment_USD", avgFreightPerShip * 3.5);
        double baseMargin = revenuePerShip * grossMarginPct / 100.0;
        double propRevPerShip = revenuePerShip * (1 - s.FreightDeltaPct * 0.3);
        double propMargin = propRevPerShip * (grossMarginPct / 100.0 + s.FreightDeltaPct * 0.05);

        double baseCo2tPerShip = currentEmUnit;
        double propCo2tPerShip = proposedEmUnit;
        double baseMarginPerTco2e = SafeDiv(baseMargin, Math.Max(0.001, baseCo2tPerShip));
        double propMarginPerTco2e = SafeDiv(propMargin, Math.Max(0.001, propCo2tPerShip));
        double intensityImprovement = baseCo2tPerShip > 0 ? (baseCo2tPerShip - propCo2tPerShip) / baseCo2tPerShip * 100.0 : 0.0;

        double rawScore = Math.Min(100, Math.Max(0,
            50 + (propMarginPerTco2e - baseMarginPerTco2e) / Math.Max(1, Math.Abs(baseMarginPerTco2e)) * 30
            + intensityImprovement * 0.5));

        var cemInsight = new Dictionary<string, object?>
        {
            ["baseline_margin_per_tco2e"] = R2(baseMarginPerTco2e),
            ["proposed_margin_per_tco2e"] = R2(propMarginPerTco2e),
            ["carbon_productivity_score"] = (int)Math.Round(rawScore, MidpointRounding.AwayFromZero),
            ["improvement_pct"] = R2(intensityImprovement),
        };

        // ── Verdict & narrative ───────────────────────────────────────────────
        string verdict;
        if (ranpvRaw.P10 > 0)
            verdict = "APPROVE";
        else if (ranpvRaw.P50 > 0 && reversibilityPct > 50)
            verdict = "PILOT";
        else if (ranpvRaw.P50 > 0)
            verdict = "CONDITIONAL";
        else
            verdict = "DECLINE";

        string cfoSummary = $"Investment ${tcsRaw.OneTime / 1e6:0.0}M; " +
            $"P50 NPV ${ranpvRaw.P50 / 1e6:0.0}M ({ranpvRaw.ProbPositive:0}% positive); " +
            $"breakeven {(vrtRaw.Breakeven is not null ? "month " + vrtRaw.Breakeven : "beyond horizon")}; " +
            $"peak cash ${Math.Abs((double)wcbRaw["peak_nwc_delta_usd"]!) / 1e6:0.0}M.";

        string csoSummary = $"CO₂e {(s.Co2eDeltaPct < 0 ? $"↓{Math.Abs(s.Co2eDeltaPct) * 100:0}%" : $"↑{s.Co2eDeltaPct * 100:0}%")}; " +
            $"{effRank} on landed cost vs emissions; " +
            $"carbon productivity score {cemInsight["carbon_productivity_score"]}/100; " +
            (tteRaw.FtaEligible ? "FTA eligible." : "no FTA benefit.");

        string rationale = verdict switch
        {
            "APPROVE" => $"Positive NPV across the distribution (P10 ${ranpvRaw.P10 / 1e6:0.0}M). Strong financial case with manageable transition costs.",
            "PILOT" => $"Median NPV positive (P50 ${ranpvRaw.P50 / 1e6:0.0}M); largely reversible. Recommend structured pilot with gates.",
            "CONDITIONAL" => $"P50 positive but low reversibility ({reversibilityPct:0}%). Proceed only with risk mitigants in place.",
            _ => $"P50 NPV negative (${ranpvRaw.P50 / 1e6:0.0}M). Does not meet investment threshold."
        };

        return new Dictionary<string, object?>
        {
            ["scenario"] = new Dictionary<string, object?>
            {
                ["scenario_id"] = s.ScenarioId, ["name"] = s.Name,
                ["type"] = s.Type, ["lever"] = s.Lever, ["description"] = s.Description,
            },
            ["verdict"] = verdict,
            ["rationale"] = rationale,
            ["cfo_summary"] = cfoSummary,
            ["cso_summary"] = csoSummary,
            ["insights"] = new Dictionary<string, object?>
            {
                ["tcs"] = tcsInsight,
                ["wcb"] = wcbInsight,
                ["ranpv"] = ranpvInsight,
                ["vrt"] = new Dictionary<string, object?>
                {
                    ["breakeven_month"] = vrtRaw.Breakeven,
                    ["peak_cash_burn_usd"] = vrtRaw.Dict["peak_cash_burn_usd"],
                    ["monthly_benefit_steady_usd"] = vrtRaw.Dict["steady_monthly_benefit_usd"],
                    ["timeline"] = vrtRaw.Dict["timeline"],
                },
                ["tte"] = tteInsight,
                ["sfo"] = sfoInsight,
                ["landed"] = landedInsight,
                ["cem"] = cemInsight,
            },
        };
    }

    private static string fmtK(double v) => v >= 1e6 ? $"${v / 1e6:0.0}M" : $"${v / 1e3:0}K";
}
