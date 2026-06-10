using System.Text.Json;

namespace LogiTrack.Api.Core;

/// <summary>A dataset row, mirroring Python's dict[str, Any].</summary>
public sealed class Row : Dictionary<string, object?>
{
    public Row() { }
    public Row(IDictionary<string, object?> src) : base(src) { }
}

/// <summary>
/// Typed accessors over loosely-typed rows. These centralize the null/format
/// tolerance that Python's .get(...) + float(...) provided.
/// </summary>
public static class RowExtensions
{
    public static double GetDouble(this Row row, string key, double dflt = 0.0)
    {
        if (!row.TryGetValue(key, out var v) || v is null) return dflt;
        return ToDouble(v, dflt);
    }

    public static int GetInt(this Row row, string key, int dflt = 0)
        => (int)Math.Round(row.GetDouble(key, dflt));

    public static double? GetNullableDouble(this Row row, string key)
    {
        if (!row.TryGetValue(key, out var v) || v is null) return null;
        try { return ToDouble(v, double.NaN); } catch { return null; }
    }

    public static string GetString(this Row row, string key, string dflt = "")
    {
        if (!row.TryGetValue(key, out var v) || v is null) return dflt;
        return v as string ?? v.ToString() ?? dflt;
    }

    public static object? GetRaw(this Row row, string key)
        => row.TryGetValue(key, out var v) ? v : null;

    private static double ToDouble(object v, double dflt)
    {
        switch (v)
        {
            case double d: return d;
            case float f: return f;
            case int i: return i;
            case long l: return l;
            case decimal m: return (double)m;
            case bool b: return b ? 1 : 0;
            case string s:
                return double.TryParse(s, System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var r) ? r : dflt;
            case JsonElement je:
                return je.ValueKind switch
                {
                    JsonValueKind.Number => je.GetDouble(),
                    JsonValueKind.String => double.TryParse(je.GetString(),
                        System.Globalization.NumberStyles.Any,
                        System.Globalization.CultureInfo.InvariantCulture, out var jr) ? jr : dflt,
                    JsonValueKind.True => 1,
                    JsonValueKind.False => 0,
                    _ => dflt,
                };
            default:
                return double.TryParse(v.ToString(), System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var rr) ? rr : dflt;
        }
    }
}

public static class NumberUtil
{
    /// <summary>Round half-away-from-zero to match Python's round() on typical magnitudes here.</summary>
    public static double R2(double n) => Math.Round(n, 2, MidpointRounding.AwayFromZero);
    public static double R3(double n) => Math.Round(n, 3, MidpointRounding.AwayFromZero);
    public static double SafeDiv(double a, double b) => b != 0 ? a / b : 0.0;
}
