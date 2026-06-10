namespace LogiTrack.Api.Models;

/// <summary>POST body for scenario / transition evaluation. Matches Python EvalReq.</summary>
public sealed class EvalRequest
{
    public string ScenarioId { get; set; } = "";
    public double CarbonPrice { get; set; } = Core.Config.DefaultInternalCarbonPriceUsd;
    public double WaccPct { get; set; } = Core.Config.DefaultWaccPct;
    public int HorizonYears { get; set; } = Core.Config.DefaultHorizonYears;

    // Optional lever-tweak overrides (decimal fractions; if set, replace the scenario's built-in deltas)
    public double? FreightDeltaPct { get; set; }
    public double? Co2eDeltaPct { get; set; }
    public double? OtifDeltaPts { get; set; }
    public int? TransitDeltaDays { get; set; }
}

public sealed class IngestResult
{
    public string Dataset { get; set; } = "";
    public int Rows { get; set; }
    public string Message { get; set; } = "";
}
