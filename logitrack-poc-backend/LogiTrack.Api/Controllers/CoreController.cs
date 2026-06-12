using LogiTrack.Api.Core;
using LogiTrack.Api.Engines;
using Microsoft.AspNetCore.Mvc;

namespace LogiTrack.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class CoreController : ControllerBase
{
    private readonly DataStore _store;
    public CoreController(DataStore store) => _store = store;

    [HttpGet("health")]
    public object Health() => new Dictionary<string, object?>
    {
        ["status"] = "ok", ["version"] = Config.Version, ["app"] = Config.AppName,
    };

    // ── Module 1: Network Intelligence ──
    [HttpGet("network/summary")]
    public object NetworkSummary() => NetworkEngine.Summary(_store, _store.LanesInScope());

    [HttpGet("network/graph")]
    public object NetworkGraph() => NetworkEngine.Graph(_store.LanesInScope(), _store.GetRows("nodes"));

    [HttpGet("network/flows")]
    public object NetworkFlows() => NetworkEngine.Flows(_store.LanesInScope());

    [HttpGet("network/hotspots")]
    public object NetworkHotspots() => NetworkEngine.Hotspots(_store.LanesInScope());

    [HttpGet("network/journey")]
    public object NetworkJourney(
        [FromQuery(Name = "product")] string product = "Medium HVAC-class",
        [FromQuery(Name = "dc")] string dc = "")
        => UnitEngine.ProductJourney(_store.LanesInScope(), product, dc);

    // ── Module 2: Transportation Performance ──
    [HttpGet("transportation/summary")]
    public object TransportSummary() => TransportationEngine.PerformanceSummary(_store.LanesInScope());

    [HttpGet("transportation/carriers")]
    public object Carriers() => TransportationEngine.CarrierScorecards(_store.LanesInScope());

    [HttpGet("transportation/lanes")]
    public object Lanes() => TransportationEngine.LanePerformance(_store.LanesInScope());

    [HttpGet("transportation/transit")]
    public object Transit() => TransportationEngine.TransitTimeDistribution(_store.LanesInScope());

    [HttpGet("transportation/ports")]
    public object Ports() => TransportationEngine.PortCongestion(_store.LanesInScope());

    [HttpGet("sustainability/product-flows")]
    public object ProductFlows([FromQuery(Name = "product")] string product = "Refrigerator")
        => UnitEngine.ProductFlows(_store.LanesInScope(), product);

    [HttpGet("sustainability/dual-cost")]
    public object DualCost([FromQuery(Name = "product")] string product = "Refrigerator")
        => DualCostEngine.Build(_store.LanesInScope(), _store.GetRows("trade"), _store.GetRows("categories"), product);

    [HttpGet("transportation/carrier-pack")]
    public IActionResult CarrierPack([FromQuery(Name = "carrier")] string carrier = "")
    {
        if (string.IsNullOrWhiteSpace(carrier))
            return BadRequest(new { detail = "carrier query parameter required" });
        return Ok(TransportationEngine.CarrierPack(_store.LanesInScope(), carrier));
    }

    // ── Module 5: Cost & Sustainability ──
    [HttpGet("sustainability/summary")]
    public object SustSummary([FromQuery(Name = "carbon_price")] double carbonPrice = Config.DefaultInternalCarbonPriceUsd)
        => SustainabilityEngine.Summary(_store.LanesInScope(), _store.GetRows("trade"), carbonPrice);

    [HttpGet("sustainability/by-lane")]
    public object SustByLane([FromQuery(Name = "carbon_price")] double carbonPrice = Config.DefaultInternalCarbonPriceUsd)
        => SustainabilityEngine.ByLane(_store.LanesInScope(), _store.GetRows("trade"), carbonPrice);

    [HttpGet("sustainability/by-region")]
    public object SustByRegion([FromQuery(Name = "carbon_price")] double carbonPrice = Config.DefaultInternalCarbonPriceUsd)
        => SustainabilityEngine.ByRegion(_store.LanesInScope(), _store.GetRows("trade"), carbonPrice);

    [HttpGet("sustainability/by-facility")]
    public object SustByFacility([FromQuery(Name = "carbon_price")] double carbonPrice = Config.DefaultInternalCarbonPriceUsd)
        => SustainabilityEngine.ByFacility(_store.LanesInScope(), _store.GetRows("trade"), carbonPrice);

    [HttpGet("sustainability/by-category")]
    public object SustByCategory([FromQuery(Name = "carbon_price")] double carbonPrice = Config.DefaultInternalCarbonPriceUsd)
        => SustainabilityEngine.ByCategory(_store.LanesInScope(), _store.GetRows("trade"), carbonPrice);

    [HttpGet("sustainability/matrix")]
    public object SustMatrix([FromQuery(Name = "carbon_price")] double carbonPrice = Config.DefaultInternalCarbonPriceUsd)
        => SustainabilityEngine.CostEmissionsMatrix(_store.LanesInScope(), _store.GetRows("trade"), carbonPrice);

    // ── Unit-level engine (v2.0) ──
    [HttpGet("unit/defaults")]
    public object UnitDefaults() => UnitEngine.Defaults();

    [HttpPost("unit/compute")]
    public object UnitCompute([FromBody] UnitComputeRequest req) => UnitEngine.ComputeUnit(req);

    [HttpGet("emissions/factors")]
    public object EmissionsFactors() => UnitEngine.EmissionsFactors();

    // ── Master data ──
    [HttpGet("master/{key}")]
    public IActionResult Master(string key)
    {
        var valid = new[] { "suppliers", "plants", "dcs", "lanes", "categories", "contracts", "trade", "nodes", "packaging", "capacity" };
        if (!valid.Contains(key))
            return NotFound(new { detail = $"Unknown dataset '{key}'" });
        return Ok(_store.GetRows(key));
    }

    [HttpGet("financial")]
    public object Financial() => _store.GetObject("financial");

    // ── Landed Cost vs Emissions (product family / SKU) ──
    [HttpGet("landed")]
    public object Landed(
        [FromQuery(Name = "carbon_price")] double carbonPrice = Config.DefaultInternalCarbonPriceUsd)
        => LandedEngine.Build(
            _store.LanesInScope(),
            _store.GetRows("trade"),
            _store.GetRows("categories"),
            _store.GetRows("skus"),
            carbonPrice,
            _store.GetObject("financial"));

    // ── Emissions Intelligence (by source / scope / mode) ──
    [HttpGet("emissions")]
    public object Emissions(
        [FromQuery(Name = "carbon_price")] double carbonPrice = Config.DefaultInternalCarbonPriceUsd)
        => EmissionsEngine.Build(_store.LanesInScope(), _store.GetObject("financial"), carbonPrice);

    // ── TMS - Transportation Management System (aggregated) ──
    [HttpGet("tms")]
    public object Tms()
    {
        var lanes = _store.LanesInScope();
        var summary = TransportationEngine.PerformanceSummary(lanes);
        var sum = (Dictionary<string, object?>)summary;
        var carriers = TransportationEngine.CarrierScorecards(lanes)
            .Select(c =>
            {
                var d = (Dictionary<string, object?>)c;
                // normalise field names for TMS page (cost_usd, co2e)
                return (object)new Dictionary<string, object?>
                {
                    ["carrier"]       = d["carrier"],
                    ["lanes"]         = d["lanes"],
                    ["shipments"]     = d["shipments"],
                    ["cost_usd"]      = d["annual_freight_usd"],
                    ["co2e"]          = d["annual_co2e"],
                    ["avg_otif_pct"]  = d["avg_otif_pct"],
                    ["avg_transit_days"] = d["avg_transit_days"],
                    ["cost_per_shipment"] = d["cost_per_shipment"],
                    ["modes"]         = d["modes"],
                    ["sla_breach"]    = d["sla_breach"],
                };
            }).ToList();

        return new Dictionary<string, object?>
        {
            ["total_freight_cost_usd"] = sum["total_freight_usd"],
            ["avg_otif_pct"]           = sum["weighted_avg_otif_pct"],
            ["otif_target_pct"]        = sum["otif_target_pct"],
            ["sla_breaches"]           = sum["sla_breaches"],
            ["lane_count"]             = sum["lane_count"],
            ["carrier_count"]          = sum["carrier_count"],
            ["avg_cost_per_shipment"]  = sum["avg_cost_per_shipment"],
            ["carrier_scorecards"]     = carriers,
            ["lane_performance"]       = TransportationEngine.LanePerformance(lanes),
        };
    }
}
