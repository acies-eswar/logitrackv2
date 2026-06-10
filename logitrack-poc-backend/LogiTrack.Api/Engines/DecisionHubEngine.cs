using LogiTrack.Api.Core;
using static LogiTrack.Api.Core.NumberUtil;

namespace LogiTrack.Api.Engines;

/// <summary>Module 4 — Executive Decision Hub.</summary>
public static class DecisionHubEngine
{
    public static object Build(List<Row> lanes, List<Row> trade, Row fin,
        double carbonPrice, double waccPct, int horizonYears, int trials)
    {
        var rows = new List<Dictionary<string, object?>>();
        foreach (var s in ScenarioLibrary.All)
        {
            var ev = (Dictionary<string, object?>)EconomicsEngine.EvaluateScenario(s, lanes, trade, carbonPrice, waccPct, horizonYears);
            var te = (Dictionary<string, object?>)EconomicsEngine.TransitionEconomics(s, lanes, trade, fin, carbonPrice, waccPct, horizonYears, trials);
            var impact = (Dictionary<string, object?>)ev["impact"]!;
            var tcs = (Dictionary<string, object?>)te["true_cost_of_switching"]!;
            var ranpv = (Dictionary<string, object?>)te["risk_adjusted_npv"]!;
            var vrt = (Dictionary<string, object?>)te["value_realization"]!;
            var risk = (Dictionary<string, object?>)te["scenario_risk"]!;

            rows.Add(new Dictionary<string, object?>
            {
                ["scenario_id"] = s.ScenarioId, ["name"] = s.Name, ["type"] = s.Type, ["lever"] = s.Lever,
                ["annual_savings_usd"] = impact["annual_savings_usd"],
                ["emissions_impact_co2e"] = impact["emissions_impact_co2e"],
                ["service_impact_otif_pts"] = impact["service_impact_otif_pts"],
                ["investment_usd"] = tcs["one_time_investment_usd"],
                ["p50_npv_usd"] = ranpv["p50_npv_usd"],
                ["p10_npv_usd"] = ranpv["p10_npv_usd"],
                ["prob_positive_pct"] = ranpv["probability_positive_pct"],
                ["payback_month"] = vrt["breakeven_month"],
                ["risk_score"] = risk["risk_score"],
                ["risk_rating"] = risk["risk_rating"],
                ["verdict"] = te["verdict"],
            });
        }

        var ranked = rows.OrderByDescending(r => (double)r["p50_npv_usd"]!).ToList();
        var approved = ranked.Where(r => (string)r["verdict"]! is "APPROVE" or "PILOT").ToList();
        var recommended = ranked.Count > 0 ? (object)ranked[0] : null;

        var carrierDispositions = TransportationEngine.AllCarrierDispositions(lanes);

        return new Dictionary<string, object?>
        {
            ["recommended_scenario"] = recommended,
            ["scenarios"] = ranked.Cast<object>().ToList(),
            ["portfolio"] = new Dictionary<string, object?>
            {
                ["total_potential_savings_usd"] = R2(approved.Sum(r => Math.Max(0, (double)r["annual_savings_usd"]!))),
                ["total_emissions_reduction_co2e"] = R2(-approved.Sum(r => Math.Min(0, (double)r["emissions_impact_co2e"]!))),
                ["total_investment_usd"] = R2(approved.Sum(r => (double)r["investment_usd"]!)),
                ["approved_count"] = approved.Count, ["evaluated_count"] = ranked.Count,
            },
            ["carrier_dispositions"] = carrierDispositions,
        };
    }
}
