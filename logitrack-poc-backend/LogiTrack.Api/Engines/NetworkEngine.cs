using LogiTrack.Api.Core;
using static LogiTrack.Api.Core.NumberUtil;
using static LogiTrack.Api.Engines.Metrics;

namespace LogiTrack.Api.Engines;

/// <summary>Module 1 - Network Intelligence &amp; Visibility.</summary>
public static class NetworkEngine
{
    private static readonly Dictionary<string, (string o, string d)> Role = new()
    {
        ["Supplier\u2192Port"] = ("supplier", "port"),
        ["Port\u2192Plant"] = ("port", "plant"),
        ["Supplier\u2192Plant"] = ("supplier", "plant"),
        ["Plant\u2192Plant"] = ("plant", "plant"),
        ["Plant\u2192DC"] = ("plant", "dc"),
        ["DC\u2192DC"] = ("dc", "dc"),
    };

    public static object Summary(DataStore store, List<Row> lanes)
    {
        double totalFreight = lanes.Sum(LaneAnnualFreight);
        double totalCo2 = lanes.Sum(LaneAnnualCo2e);
        double totalTkm = lanes.Sum(LaneAnnualTonneKm);
        int totalShip = lanes.Sum(LaneShipments);

        var seg = new Dictionary<string, double[]>();   // [lanes, freight, co2e, shipments]
        var mode = new Dictionary<string, double[]>();  // [lanes, freight, co2e]
        foreach (var l in lanes)
        {
            var s = l.GetString("Segment");
            if (!seg.ContainsKey(s)) seg[s] = new double[4];
            seg[s][0] += 1; seg[s][1] += LaneAnnualFreight(l);
            seg[s][2] += LaneAnnualCo2e(l); seg[s][3] += LaneShipments(l);

            var m = l.GetString("Mode");
            if (!mode.ContainsKey(m)) mode[m] = new double[3];
            mode[m][0] += 1; mode[m][1] += LaneAnnualFreight(l); mode[m][2] += LaneAnnualCo2e(l);
        }

        var bySegment = new Dictionary<string, object?>();
        foreach (var (k, v) in seg)
            bySegment[k] = new Dictionary<string, object?>
            { ["lanes"] = R2(v[0]), ["freight"] = R2(v[1]), ["co2e"] = R2(v[2]), ["shipments"] = R2(v[3]) };

        var byMode = new Dictionary<string, object?>();
        foreach (var (k, v) in mode)
            byMode[k] = new Dictionary<string, object?>
            { ["lanes"] = R2(v[0]), ["freight"] = R2(v[1]), ["co2e"] = R2(v[2]) };

        return new Dictionary<string, object?>
        {
            ["entity_counts"] = new Dictionary<string, object?>
            {
                ["suppliers"] = store.GetRows("suppliers").Count,
                ["plants"] = store.GetRows("plants").Count,
                ["dcs"] = store.GetRows("dcs").Count,
                ["lanes"] = lanes.Count,
                ["carriers"] = lanes.Select(l => l.GetString("Carrier")).Distinct().Count(),
                ["product_categories"] = store.GetRows("categories").Count,
            },
            ["total_annual_freight_usd"] = R2(totalFreight),
            ["total_annual_co2e"] = R2(totalCo2),
            ["total_annual_tonne_km"] = R2(totalTkm),
            ["total_shipments"] = totalShip,
            ["network_intensity_g_per_tkm"] = R2(SafeDiv(totalCo2 * 1_000_000, totalTkm)),
            ["by_segment"] = bySegment,
            ["by_mode"] = byMode,
            ["carbon_coverage"] = Metrics.CarbonCoverage(lanes),
        };
    }

    public static object Graph(List<Row> lanes, List<Row> nodes)
    {
        var meta = nodes.ToDictionary(n => n.GetString("name"), n => n);
        var nodeAcc = new Dictionary<string, Dictionary<string, object?>>();
        var order = new List<string>();

        foreach (var l in lanes)
        {
            var seg = l.GetString("Segment");
            var (oRole, dRole) = Role.TryGetValue(seg, out var rr) ? rr : ("node", "node");
            foreach (var (nm, role, latKey, lngKey) in new[]
            {
                (l.GetString("Origin"), oRole, "Origin_Lat", "Origin_Lng"),
                (l.GetString("Destination"), dRole, "Dest_Lat", "Dest_Lng"),
            })
            {
                if (!nodeAcc.ContainsKey(nm))
                {
                    meta.TryGetValue(nm, out var m);
                    nodeAcc[nm] = new Dictionary<string, object?>
                    {
                        ["id"] = nm,
                        ["role"] = role,
                        ["country"] = m?.GetString("country") ?? l.GetString("Origin_Country"),
                        ["lat"] = m?.GetNullableDouble("lat") ?? l.GetNullableDouble(latKey),
                        ["lng"] = m?.GetNullableDouble("lng") ?? l.GetNullableDouble(lngKey),
                        ["throughput_co2e"] = 0.0,
                        ["throughput_freight"] = 0.0,
                        ["shipments"] = 0,
                    };
                    order.Add(nm);
                }
            }

            double co2 = LaneAnnualCo2e(l), fr = LaneAnnualFreight(l);
            int sh = LaneShipments(l);
            var o = nodeAcc[l.GetString("Origin")];
            o["throughput_co2e"] = (double)o["throughput_co2e"]! + co2;
            o["throughput_freight"] = (double)o["throughput_freight"]! + fr;
            o["shipments"] = (int)o["shipments"]! + sh;
            var d = nodeAcc[l.GetString("Destination")];
            d["throughput_co2e"] = (double)d["throughput_co2e"]! + co2;
            d["shipments"] = (int)d["shipments"]! + sh;
        }

        foreach (var n in nodeAcc.Values)
        {
            n["throughput_co2e"] = R2((double)n["throughput_co2e"]!);
            n["throughput_freight"] = R2((double)n["throughput_freight"]!);
        }

        var edges = lanes.Select(l => (object)new Dictionary<string, object?>
        {
            ["id"] = l.GetString("Lane_ID"),
            ["from"] = l.GetString("Origin"),
            ["to"] = l.GetString("Destination"),
            ["from_lat"] = l.GetNullableDouble("Origin_Lat"),
            ["from_lng"] = l.GetNullableDouble("Origin_Lng"),
            ["to_lat"] = l.GetNullableDouble("Dest_Lat"),
            ["to_lng"] = l.GetNullableDouble("Dest_Lng"),
            ["segment"] = l.GetString("Segment"),
            ["mode"] = l.GetString("Mode"),
            ["carrier"] = l.GetString("Carrier"),
            ["co2e"] = R2(LaneAnnualCo2e(l)),
            ["freight"] = R2(LaneAnnualFreight(l)),
            ["distance"] = l.GetRaw("Distance_KM"),
            ["cross_border"] = l.GetString("Origin_Country") != l.GetString("Destination_Country"),
        }).ToList();

        return new Dictionary<string, object?>
        {
            ["nodes"] = order.Select(nm => (object)nodeAcc[nm]).ToList(),
            ["edges"] = edges,
        };
    }

    public static object Flows(List<Row> lanes)
    {
        var rows = new List<object>();
        foreach (var seg in Role.Keys)
        {
            var sl = lanes.Where(l => l.GetString("Segment") == seg).ToList();
            if (sl.Count == 0) continue;
            double weight = sl.Sum(l => LaneWeightKg(l) * LaneShipments(l));
            rows.Add(new Dictionary<string, object?>
            {
                ["segment"] = seg,
                ["lanes"] = sl.Count,
                ["material_tonnes"] = R2(weight / 1000.0),
                ["freight_usd"] = R2(sl.Sum(LaneAnnualFreight)),
                ["co2e"] = R2(sl.Sum(LaneAnnualCo2e)),
                ["shipments"] = sl.Sum(LaneShipments),
            });
        }
        return new Dictionary<string, object?> { ["flows"] = rows };
    }

    public static object Hotspots(List<Row> lanes)
    {
        double totalCost = lanes.Sum(LaneAnnualFreight);
        if (totalCost == 0) totalCost = 1.0;
        double totalCo2 = lanes.Sum(LaneAnnualCo2e);
        if (totalCo2 == 0) totalCo2 = 1.0;

        var cost = lanes.Select(l => new Dictionary<string, object?>
        {
            ["lane"] = $"{l.GetString("Origin")} \u2192 {l.GetString("Destination")}",
            ["segment"] = l.GetString("Segment"), ["mode"] = l.GetString("Mode"),
            ["carrier"] = l.GetString("Carrier"),
            ["annual_freight_usd"] = R2(LaneAnnualFreight(l)),
            ["pct_of_total"] = R2(LaneAnnualFreight(l) / totalCost * 100),
        }).OrderByDescending(x => (double)x["annual_freight_usd"]!).Take(10).Cast<object>().ToList();

        var emissions = lanes.Select(l => new Dictionary<string, object?>
        {
            ["lane"] = $"{l.GetString("Origin")} \u2192 {l.GetString("Destination")}",
            ["segment"] = l.GetString("Segment"), ["mode"] = l.GetString("Mode"),
            ["carrier"] = l.GetString("Carrier"),
            ["annual_co2e"] = R2(LaneAnnualCo2e(l)),
            ["pct_of_total"] = R2(LaneAnnualCo2e(l) / totalCo2 * 100),
        }).OrderByDescending(x => (double)x["annual_co2e"]!).Take(10).Cast<object>().ToList();

        return new Dictionary<string, object?> { ["cost"] = cost, ["emissions"] = emissions };
    }
}
