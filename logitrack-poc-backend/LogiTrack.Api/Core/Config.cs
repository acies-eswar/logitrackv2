namespace LogiTrack.Api.Core;

/// <summary>
/// Application configuration and economic constants.
/// Mirrors the Python backend's app/core/config.py exactly.
/// </summary>
public static class Config
{
    // GLEC-style Well-to-Wheel emission factors (gCO2e per tonne-km)
    public static readonly IReadOnlyDictionary<string, double> EmissionFactors = new Dictionary<string, double>
    {
        ["ocean"] = 9.7, ["road"] = 86.0, ["rail"] = 28.0, ["air"] = 600.0,
    };

    // Allowed supply chain coverage segments (excludes retail, customer, last-mile, reverse)
    public static readonly string[] AllowedSegments =
    {
        "Supplier\u2192Port", "Port\u2192Plant", "Supplier\u2192Plant",
        "Plant\u2192Plant", "Plant\u2192DC", "DC\u2192DC",
    };

    // Analysis levels permitted by scope
    public static readonly string[] AnalysisLevels =
    {
        "supplier", "facility", "carrier", "lane", "region", "product_category",
    };

    // OTIF service threshold
    public const double OtifTargetPct = 95.0;

    // Transition economics defaults (module 6 — assumption-based)
    public const double DefaultWaccPct = 8.5;
    public const double DefaultInternalCarbonPriceUsd = 75.0;
    public const int DefaultHorizonYears = 5;
    public const int DefaultMonteCarloTrials = 1500;
    public const double DefaultDioDays = 48.0;
    public const double DefaultDsoDays = 41.0;
    public const double DefaultDpoDays = 36.0;

    public const string AppName = "LogiTrack";
    public const string AppDescription = "Finance-Native Logistics Intelligence Platform";
    public const string Version = "1.0.0";
}
