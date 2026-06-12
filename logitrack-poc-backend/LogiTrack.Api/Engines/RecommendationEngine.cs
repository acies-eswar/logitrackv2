using LogiTrack.Api.Core;
using static LogiTrack.Api.Core.NumberUtil;
using static LogiTrack.Api.Engines.Metrics;

namespace LogiTrack.Api.Engines;

/// <summary>
/// LogiTrack V3.0 recommendation ranking engine.
///
/// Implements the platform Decision Score (spec §66, §155, §187):
///   Decision Score = 35% Sustainability + 25% Financial + 15% Operational
///                  + 15% Risk + 10% Strategic   (0-100)
///
/// Plus recommendation categories (§27/§67/§142), executive verdict thresholds
/// (§38/§68/§161 - Approve 80+, Pilot 65-80, Conditional 50-65, Reject &lt;50),
/// "why this won" rationale (§144) and rejected-scenario reasons (§154/§257).
///
/// Scores are deterministic functions of the scenario levers + the live baseline,
/// so the alternatives ranking is stable and fast (no Monte-Carlo needed here -
/// the full risk-adjusted NPV stays in EconomicsEngine for the detail views).
/// </summary>
public static class RecommendationEngine
{
    private const double Clamp0 = 0.0, Clamp100 = 100.0;
    private static double Clamp(double v) => Math.Max(Clamp0, Math.Min(Clamp100, v));

    public sealed record Rec(
        string ScenarioId, string Name, string Type, string Lever, string Category,
        double DecisionScore, string Verdict,
        double SusScore, double FinScore, double OpScore, double RiskScore, double StratScore,
        double AnnualSavingsUsd, double EmissionsImpactCo2e, double EmissionsReductionPct,
        double CostImpactPct, double TransitImpactDays, double OtifImpactPts,
        double InvestmentUsd, double RiskRaw, string RiskRating,
        int AffectedLaneCount,
        Dictionary<string, object?> Baseline, Dictionary<string, object?> Future,
        string Rationale, string RejectedReason);

    /// <summary>Score every library scenario against the live lane baseline and rank them.</summary>
    public static List<Rec> Rank(List<Row> lanes, List<Row> trade, double carbonPrice)
    {
        var recs = new List<Rec>();
        foreach (var s in ScenarioLibrary.All)
        {
            var aff = s.AffectedLanes(lanes);
            if (aff.Count == 0) continue;

            double baseFreight = aff.Sum(LaneAnnualFreight);
            double baseCo2 = aff.Sum(LaneAnnualCo2e);
            int ship = Math.Max(1, aff.Sum(LaneShipments));
            double baseOtif = SafeDiv(aff.Sum(l => l.GetDouble("OTIF_Pct") * LaneShipments(l)), ship);
            double baseTransit = SafeDiv(aff.Sum(l => l.GetDouble("Transit_Time_Days") * LaneShipments(l)), ship);

            double fd = s.FreightDeltaPct, cd = s.Co2eDeltaPct, td = s.TransitDeltaDays;
            double od = s.OtifDeltaPts, tariff = s.TariffDeltaPct;

            double futFreight = baseFreight * (1 + fd);
            double futCo2 = baseCo2 * (1 + cd);
            double annualSavings = baseFreight - futFreight;
            double emImpact = futCo2 - baseCo2;
            double reductionPct = -cd;                                  // fraction, +ve = reduction

            // ── five-dimension sub-scores (0-100) ──
            double sus = Clamp(35 + reductionPct / 0.40 * 65);
            double costGain = -fd + (-tariff) * 0.15;
            double fin = Clamp(50 + costGain / 0.20 * 45);
            double op = Clamp(70 - td * 3 + od * 4);

            double reversibility = 1 - (s.AssetSpecificity * 0.5 + s.SupplierConcentration * 0.25 + s.GeoConcentration * 0.25);
            double riskRaw = Clamp(Math.Round((1 - reversibility) * 70 + s.AssetSpecificity * 15, MidpointRounding.AwayFromZero));
            double risk = 100 - riskRaw;
            string riskRating = riskRaw < 35 ? "Low" : riskRaw < 65 ? "Moderate" : "High";

            double strat = Clamp(40 + reversibility * 25 + reductionPct * 40 + (-tariff) * 20 - s.GeoConcentration * 15);

            double decision = Math.Round(0.35 * sus + 0.25 * fin + 0.15 * op + 0.15 * risk + 0.10 * strat,
                MidpointRounding.AwayFromZero);

            string verdict = decision >= 80 ? "APPROVE" : decision >= 65 ? "PILOT" : decision >= 50 ? "CONDITIONAL" : "DECLINE";
            string category = Categorize(decision, fd, cd, s);

            // investment = one-time switching cost (no Monte-Carlo)
            var tcs = EconomicsEngine.TrueCostOfSwitching(s, baseFreight, baseCo2, carbonPrice);

            var baseline = new Dictionary<string, object?>
            {
                ["annual_freight_usd"] = R2(baseFreight), ["annual_co2e"] = R2(baseCo2),
                ["weighted_otif_pct"] = R2(baseOtif), ["weighted_transit_days"] = R2(baseTransit),
            };
            var future = new Dictionary<string, object?>
            {
                ["annual_freight_usd"] = R2(futFreight), ["annual_co2e"] = R2(futCo2),
                ["weighted_otif_pct"] = R2(Math.Min(100.0, baseOtif + od)),
                ["weighted_transit_days"] = R2(Math.Max(0.0, baseTransit + td)),
            };

            string rationale = Rationale(reductionPct, fd, td, riskRating, ScenarioLibrary.All.Count);
            string rejected = RejectedReason(cd, fd, td, riskRating, tcs.OneTime, annualSavings);

            recs.Add(new Rec(s.ScenarioId, s.Name, s.Type, s.Lever, category, decision, verdict,
                R2(sus), R2(fin), R2(op), R2(risk), R2(strat),
                R2(annualSavings), R2(emImpact), R2(reductionPct * 100),
                R2(fd * 100), td, R2(od),
                R2(tcs.OneTime), riskRaw, riskRating, aff.Count,
                baseline, future, rationale, rejected));
        }

        return recs
            .OrderByDescending(r => r.DecisionScore)
            .ThenByDescending(r => r.EmissionsReductionPct)
            .ToList();
    }

    private static string Categorize(double decision, double fd, double cd, Scenario s)
    {
        if (decision < 50) return "Rejected";
        bool costDown = fd < -0.005, emDown = cd < -0.005;
        if (costDown && emDown) return "Win-Win";
        if (cd <= -0.15) return "Sustainability First";
        if (fd <= -0.10 && cd > -0.05) return "Cost Optimized";
        double invest = s.ContractExitUsd + s.ItIntegrationUsd + s.CustomsSetupUsd;
        if (emDown && (invest > 700_000 || s.AssetSpecificity >= 0.5)) return "Strategic Transition";
        return "Balanced";
    }

    private static string Pct(double frac) => $"{Math.Abs(frac) * 100:0.#}%";

    private static string Rationale(double reductionPct, double fd, double td, string riskRating, int n)
    {
        string em = reductionPct > 0 ? $"cuts emissions {Pct(reductionPct)}" : $"raises emissions {Pct(reductionPct)}";
        string cost = fd < 0 ? $"lowers cost {Pct(fd)}" : fd > 0 ? $"adds {Pct(fd)} cost" : "holds cost flat";
        string lead = td == 0 ? "no lead-time change" : td > 0 ? $"+{td:0}-day lead time" : $"{td:0}-day lead time";
        return $"Best balanced outcome of {n} evaluated alternatives: {em} and {cost} with {lead} and {riskRating.ToLowerInvariant()} execution risk.";
    }

    private static string RejectedReason(double cd, double fd, double td, string riskRating, double oneTime, double annualSavings)
    {
        if (cd > -0.03) return "Emission reduction too small";
        if (td >= 6) return "Lead-time increase too high";
        if (fd > 0.03) return "Cost increase too high";
        if (oneTime > Math.Max(1, annualSavings) * 3) return "Investment too high for the return";
        if (riskRating == "High") return "Execution / country risk too high";
        return "Outranked on balanced decision score";
    }

    // ── Portfolio funnel (spec §173): All → Viable → Recommended → Approved → In Execution ──
    public static Dictionary<string, object?> Funnel(List<Rec> ranked)
    {
        int evaluated = ranked.Count;
        int viable = ranked.Count(r => r.DecisionScore >= 50);
        int recommended = ranked.Count(r => r.DecisionScore >= 60);
        int approved = ranked.Count(r => r.Verdict is "APPROVE" or "PILOT");
        int inExecution = (int)Math.Round(approved * 0.4, MidpointRounding.AwayFromZero);
        return new Dictionary<string, object?>
        {
            ["all_opportunities"] = evaluated,
            ["viable"] = viable,
            ["recommended"] = recommended,
            ["approved"] = approved,
            ["in_execution"] = inExecution,
        };
    }

    /// <summary>
    /// Emissions-first default recommendation (spec §13/§34/§94): among options with
    /// acceptable business impact (Approve/Pilot and cost not materially up), pick the
    /// highest emissions reduction; tie-break on Decision Score. Falls back to the
    /// highest-emission option, then the top-ranked, so a pick always exists.
    /// </summary>
    public static int EmissionsFirstPick(List<Rec> ranked)
    {
        if (ranked.Count == 0) return 0;
        bool Acceptable(Rec r) => (r.Verdict is "APPROVE" or "PILOT") && r.CostImpactPct <= 3.0;
        var pool = ranked.Where(Acceptable).ToList();
        if (pool.Count == 0) pool = ranked;
        var best = pool
            .OrderByDescending(r => r.EmissionsReductionPct)
            .ThenByDescending(r => r.DecisionScore)
            .First();
        return ranked.FindIndex(r => r.ScenarioId == best.ScenarioId);
    }

    /// <summary>Scenario id of the emissions-first default recommendation.</summary>
    public static string? RecommendedScenarioId(List<Row> lanes, List<Row> trade, double carbonPrice)
    {
        var ranked = Rank(lanes, trade, carbonPrice);
        return ranked.Count == 0 ? null : ranked[EmissionsFirstPick(ranked)].ScenarioId;
    }

    /// <summary>Full payload for the /recommendations endpoint and the executive hub.</summary>
    public static object Build(List<Row> lanes, List<Row> trade, double carbonPrice)
    {
        var ranked = Rank(lanes, trade, carbonPrice);
        int recIdx = EmissionsFirstPick(ranked);
        var rows = new List<object>();
        for (int i = 0; i < ranked.Count; i++)
        {
            var r = ranked[i];
            rows.Add(new Dictionary<string, object?>
            {
                ["rank"] = i + 1,
                ["scenario_id"] = r.ScenarioId, ["name"] = r.Name, ["type"] = r.Type, ["lever"] = r.Lever,
                ["category"] = r.Category, ["decision_score"] = r.DecisionScore, ["verdict"] = r.Verdict,
                ["recommended_flag"] = i == recIdx,
                ["sub_scores"] = new Dictionary<string, object?>
                {
                    ["sustainability"] = r.SusScore, ["financial"] = r.FinScore,
                    ["operational"] = r.OpScore, ["risk"] = r.RiskScore, ["strategic"] = r.StratScore,
                },
                ["annual_savings_usd"] = r.AnnualSavingsUsd,
                ["emissions_impact_co2e"] = r.EmissionsImpactCo2e,
                ["emissions_reduction_pct"] = r.EmissionsReductionPct,
                ["cost_impact_pct"] = r.CostImpactPct,
                ["transit_impact_days"] = r.TransitImpactDays,
                ["otif_impact_pts"] = r.OtifImpactPts,
                ["investment_usd"] = r.InvestmentUsd,
                // Abatement cost (FDD §Executive): cost change ÷ emissions reduction ($/tCO2e).
                // Negative = the change reduces emissions AND saves money.
                ["abatement_cost_usd_per_tco2e"] = r.EmissionsImpactCo2e < 0
                    ? R2(SafeDiv(-r.AnnualSavingsUsd, -r.EmissionsImpactCo2e)) : (object?)null,
                ["risk_score"] = r.RiskRaw, ["risk_rating"] = r.RiskRating,
                ["affected_lane_count"] = r.AffectedLaneCount,
                ["baseline"] = r.Baseline, ["future_state"] = r.Future,
                ["rationale"] = r.Rationale, ["rejected_reason"] = r.RejectedReason,
            });
        }

        var byCategory = ranked.GroupBy(r => r.Category)
            .ToDictionary(g => g.Key, g => (object?)g.Count());

        return new Dictionary<string, object?>
        {
            ["recommended"] = rows.Count > 0 ? rows[recIdx] : null,
            ["funnel"] = Funnel(ranked),
            ["by_category"] = byCategory,
            ["recommendations"] = rows,
        };
    }
}
