using LogiTrack.Api.Core;
using static LogiTrack.Api.Core.NumberUtil;
using static LogiTrack.Api.Engines.Metrics;

namespace LogiTrack.Api.Engines;

/// <summary>
/// Module 5 — Cost &amp; Sustainability Intelligence.
/// Landed cost = freight + duty + tariff + handling + carbon_cost.
/// </summary>
public static class SustainabilityEngine
{
    private const double HandlingPerShipment = 120.0;

    private static (double duty, double tariff, string fta) TradeRates(List<Row> trade, string oc, string dc)
    {
        foreach (var t in trade)
            if (t.GetString("Origin_Country") == oc && t.GetString("Destination_Country") == dc)
                return (t.GetDouble("Duty_Rate_Pct"), t.GetDouble("Tariff_Rate_Pct"), t.GetString("FTA", "None"));
        return (0.0, 0.0, "None");
    }

    /// <summary>Per-shipment landed cost decomposition for a lane.</summary>
    public static Dictionary<string, object?> LaneLanded(Row lane, List<Row> trade, double carbonPrice)
    {
        double freight = LaneFreightPerShipment(lane);
        var (dutyPct, tariffPct, fta) = TradeRates(trade,
            lane.GetString("Origin_Country"), lane.GetString("Destination_Country"));
        double dutiable = freight;
        double duty = dutiable * dutyPct / 100.0;
        double tariff = dutiable * tariffPct / 100.0;
        if (fta is "USMCA" or "EU") tariff *= 0.15;
        double handling = HandlingPerShipment;
        int sh = LaneShipments(lane);
        double co2PerShip = LaneAnnualCo2e(lane) / (sh == 0 ? 1 : sh);
        double carbonCost = co2PerShip * carbonPrice;
        double landed = freight + duty + tariff + handling + carbonCost;
        return new Dictionary<string, object?>
        {
            ["freight"] = R2(freight), ["duty"] = R2(duty), ["tariff"] = R2(tariff),
            ["handling"] = R2(handling), ["carbon_cost"] = R2(carbonCost),
            ["landed_cost_per_shipment"] = R2(landed),
            ["landed_emissions_per_shipment"] = R3(co2PerShip), ["fta"] = fta,
        };
    }

    public static List<object> ByLane(List<Row> lanes, List<Row> trade, double carbonPrice)
    {
        return lanes.Select(l =>
        {
            var d = LaneLanded(l, trade, carbonPrice);
            var row = new Dictionary<string, object?>
            {
                ["lane"] = $"{l.GetString("Origin")} \u2192 {l.GetString("Destination")}",
                ["segment"] = l.GetString("Segment"), ["mode"] = l.GetString("Mode"),
                ["region"] = l.GetString("Destination_Country"),
                ["product_category"] = l.GetString("Product_Category"),
            };
            foreach (var kv in d) row[kv.Key] = kv.Value;
            return (object)row;
        }).OrderByDescending(x => (double)((Dictionary<string, object?>)x)["landed_cost_per_shipment"]!).ToList();
    }

    private static List<object> Aggregate(List<Row> lanes, List<Row> trade, double carbonPrice, Func<Row, string> keyFn)
    {
        var acc = new Dictionary<string, double[]>(); // [cost, emissions, shipments, lanes]
        var order = new List<string>();
        foreach (var l in lanes)
        {
            var d = LaneLanded(l, trade, carbonPrice);
            int sh = LaneShipments(l);
            var k = keyFn(l);
            if (!acc.ContainsKey(k)) { acc[k] = new double[4]; order.Add(k); }
            acc[k][0] += (double)d["landed_cost_per_shipment"]! * sh;
            acc[k][1] += (double)d["landed_emissions_per_shipment"]! * sh;
            acc[k][2] += sh; acc[k][3] += 1;
        }
        return order.Select(k =>
        {
            var a = acc[k];
            double sh = a[2] == 0 ? 1 : a[2];
            return (object)new Dictionary<string, object?>
            {
                ["key"] = k, ["lanes"] = (int)a[3], ["shipments"] = (int)a[2],
                ["total_landed_cost"] = R2(a[0]),
                ["total_landed_emissions"] = R2(a[1]),
                ["avg_landed_cost_per_shipment"] = R2(a[0] / sh),
                ["avg_landed_emissions_per_shipment"] = R3(a[1] / sh),
            };
        }).OrderByDescending(x => (double)((Dictionary<string, object?>)x)["total_landed_cost"]!).ToList();
    }

    public static List<object> ByRegion(List<Row> lanes, List<Row> trade, double cp)
        => Aggregate(lanes, trade, cp, l => l.GetString("Destination_Country"));

    public static List<object> ByFacility(List<Row> lanes, List<Row> trade, double cp)
        => Aggregate(lanes, trade, cp, l => l.GetString("Destination"));

    public static List<object> ByCategory(List<Row> lanes, List<Row> trade, double cp)
        => Aggregate(lanes, trade, cp, l => l.GetString("Product_Category"));

    public static List<object> CostEmissionsMatrix(List<Row> lanes, List<Row> trade, double cp)
    {
        return ByCategory(lanes, trade, cp)
            .Select(o => (Dictionary<string, object?>)o)
            .Where(a => !string.IsNullOrEmpty((string?)a["key"]))
            .Select(a => (object)new Dictionary<string, object?>
            {
                ["name"] = a["key"],
                ["x"] = a["avg_landed_cost_per_shipment"],
                ["y"] = a["avg_landed_emissions_per_shipment"],
                ["shipments"] = a["shipments"],
            }).ToList();
    }

    public static object Summary(List<Row> lanes, List<Row> trade, double cp)
    {
        double weightedCost = lanes.Sum(l => (double)LaneLanded(l, trade, cp)["landed_cost_per_shipment"]! * LaneShipments(l));
        double weightedEm = lanes.Sum(l => (double)LaneLanded(l, trade, cp)["landed_emissions_per_shipment"]! * LaneShipments(l));
        int totalShip = lanes.Sum(LaneShipments);
        if (totalShip == 0) totalShip = 1;
        return new Dictionary<string, object?>
        {
            ["avg_landed_cost_per_shipment"] = R2(weightedCost / totalShip),
            ["avg_landed_emissions_per_shipment"] = R3(weightedEm / totalShip),
            ["total_annual_landed_cost"] = R2(weightedCost),
            ["total_annual_landed_emissions"] = R2(weightedEm),
            ["lanes_analyzed"] = lanes.Count,
        };
    }
}
