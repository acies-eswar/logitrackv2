using LogiTrack.Api.Core;

namespace LogiTrack.Api.Engines;

/// <summary>
/// Lane metric primitives — the single source of truth for derived lane numbers.
/// Mirrors app/engines/metrics.py. Emissions recomputed from physics so uploads
/// without a CO2e column still work; explicit CO2e_Tonnes is preferred if present.
/// </summary>
public static class Metrics
{
    public static double LaneDistance(Row lane) => lane.GetDouble("Distance_KM");
    public static int LaneShipments(Row lane) => lane.GetInt("Shipments_Per_Year");
    public static double LaneWeightKg(Row lane) => lane.GetDouble("Avg_Weight_KG");

    public static double LaneCo2ePerShipment(Row lane)
    {
        var explicitVal = lane.GetNullableDouble("CO2e_Tonnes");
        if (explicitVal is double v && !double.IsNaN(v) && v > 0)
            return v;

        var mode = lane.GetString("Mode", "road").ToLowerInvariant();
        var factor = Config.EmissionFactors.TryGetValue(mode, out var f)
            ? f : Config.EmissionFactors["road"];
        var tonneKm = (LaneWeightKg(lane) / 1000.0) * LaneDistance(lane);
        return tonneKm * factor / 1_000_000.0;
    }

    public static double LaneFreightPerShipment(Row lane) => lane.GetDouble("Freight_Cost_USD");

    public static double LaneAnnualFreight(Row lane)
        => LaneFreightPerShipment(lane) * LaneShipments(lane);

    public static double LaneAnnualCo2e(Row lane)
        => LaneCo2ePerShipment(lane) * LaneShipments(lane);

    public static double LaneAnnualTonneKm(Row lane)
        => (LaneWeightKg(lane) / 1000.0) * LaneDistance(lane) * LaneShipments(lane);

    public static double LaneIntensityGPerTkm(Row lane)
    {
        var tkm = (LaneWeightKg(lane) / 1000.0) * LaneDistance(lane);
        if (tkm <= 0) return 0.0;
        return LaneCo2ePerShipment(lane) * 1_000_000.0 / tkm;
    }
}
