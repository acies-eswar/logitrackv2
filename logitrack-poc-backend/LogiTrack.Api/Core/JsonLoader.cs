using System.Text.Json;

namespace LogiTrack.Api.Core;

/// <summary>
/// Converts System.Text.Json elements into plain CLR objects (double/long/string/bool/null,
/// lists, and Row dictionaries) so engine code can treat rows like Python dicts.
/// </summary>
public static class JsonLoader
{
    public static object? Convert(JsonElement el)
    {
        switch (el.ValueKind)
        {
            case JsonValueKind.Object:
                var row = new Row();
                foreach (var p in el.EnumerateObject())
                    row[p.Name] = Convert(p.Value);
                return row;
            case JsonValueKind.Array:
                var list = new List<object?>();
                foreach (var item in el.EnumerateArray())
                    list.Add(Convert(item));
                return list;
            case JsonValueKind.String:
                return el.GetString();
            case JsonValueKind.Number:
                // Preserve integers as long, else double
                if (el.TryGetInt64(out var l)) return l;
                return el.GetDouble();
            case JsonValueKind.True: return true;
            case JsonValueKind.False: return false;
            case JsonValueKind.Null:
            case JsonValueKind.Undefined:
            default:
                return null;
        }
    }

    public static List<Row> ToRows(object? converted)
    {
        var rows = new List<Row>();
        if (converted is List<object?> list)
            foreach (var item in list)
                if (item is Row r) rows.Add(r);
        return rows;
    }
}
