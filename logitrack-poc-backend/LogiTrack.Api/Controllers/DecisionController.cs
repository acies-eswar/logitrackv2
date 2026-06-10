using LogiTrack.Api.Core;
using LogiTrack.Api.Engines;
using LogiTrack.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace LogiTrack.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class DecisionController : ControllerBase
{
    private readonly DataStore _store;
    public DecisionController(DataStore store) => _store = store;

    // ── Module 3: Scenario Planning ──
    [HttpGet("scenarios")]
    public object Scenarios() => ScenarioLibrary.Listing();

    [HttpPost("scenarios/evaluate")]
    public IActionResult EvaluateScenario([FromBody] EvalRequest req)
    {
        var sc = ScenarioLibrary.Get(req.ScenarioId);
        if (sc is null) return NotFound(new { detail = "Scenario not found" });
        return Ok(EconomicsEngine.EvaluateScenario(sc, _store.LanesInScope(),
            _store.GetRows("trade"), req.CarbonPrice, req.WaccPct, req.HorizonYears,
            req.FreightDeltaPct, req.Co2eDeltaPct, req.OtifDeltaPts, req.TransitDeltaDays));
    }

    // ── Module 3/4: Recommendation ranking (Decision Score, categories, alternatives) ──
    [HttpGet("recommendations")]
    public object Recommendations(
        [FromQuery(Name = "carbon_price")] double carbonPrice = Config.DefaultInternalCarbonPriceUsd)
        => RecommendationEngine.Build(_store.LanesInScope(), _store.GetRows("trade"), carbonPrice);

    // ── Module 6: Transition Economics ──
    [HttpPost("transition/evaluate")]
    public IActionResult Transition([FromBody] EvalRequest req)
    {
        var sc = ScenarioLibrary.Get(req.ScenarioId);
        if (sc is null) return NotFound(new { detail = "Scenario not found" });
        return Ok(EconomicsEngine.TransitionEconomics(sc, _store.LanesInScope(),
            _store.GetRows("trade"), _store.GetObject("financial"),
            req.CarbonPrice, req.WaccPct, req.HorizonYears, Config.DefaultMonteCarloTrials));
    }

    // ── Decision Workbench (8-insight deep dive) ──
    [HttpPost("workbench/evaluate")]
    public IActionResult WorkbenchEvaluate([FromBody] EvalRequest req)
    {
        var sc = ScenarioLibrary.Get(req.ScenarioId);
        if (sc is null) return NotFound(new { detail = "Scenario not found" });
        return Ok(WorkbenchEngine.Build(sc, _store.LanesInScope(),
            _store.GetRows("trade"), _store.GetObject("financial"),
            req.CarbonPrice, req.WaccPct, req.HorizonYears, Config.DefaultMonteCarloTrials));
    }

    // ── Module 4: Executive Decision Hub ──
    [HttpGet("decision-hub")]
    public object DecisionHub(
        [FromQuery(Name = "carbon_price")] double carbonPrice = Config.DefaultInternalCarbonPriceUsd,
        [FromQuery(Name = "wacc_pct")] double waccPct = Config.DefaultWaccPct,
        [FromQuery(Name = "horizon_years")] int horizonYears = Config.DefaultHorizonYears)
        => DecisionHubEngine.Build(_store.LanesInScope(), _store.GetRows("trade"),
            _store.GetObject("financial"), carbonPrice, waccPct, horizonYears, Config.DefaultMonteCarloTrials);
}
