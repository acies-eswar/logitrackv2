using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration;
using LogiTrack.Api.Core;

namespace LogiTrack.Api.Engines;

/// <summary>Ingestion - map an uploaded CSV to a dataset key by its column signature.</summary>
public static class IngestionEngine
{
    // Required-field signatures per the scope's dataset definitions
    public static readonly Dictionary<string, string[]> Signatures = new()
    {
        ["suppliers"] = new[] { "Supplier_ID", "Supplier_Name" },
        ["plants"] = new[] { "Plant_ID", "Capacity_Units_Year" },
        ["dcs"] = new[] { "DC_ID", "Location" },
        ["lanes"] = new[] { "Lane_ID", "Origin", "Destination" },
        ["categories"] = new[] { "Product_Category", "Annual_Volume_Units" },
        ["contracts"] = new[] { "Contract_ID", "Carrier" },
        ["trade"] = new[] { "Origin_Country", "Destination_Country", "Duty_Rate_Pct" },
        ["packaging"] = new[] { "Product_Family", "Corrugate_KG" },
        ["capacity"] = new[] { "Product_Family", "Units_Per_Container" },
    };

    // Sample download keys → (dataset, filename)
    public static readonly Dictionary<string, (string dataset, string file)> SampleFiles = new()
    {
        ["supplier_master"] = ("suppliers", "supplier_master.csv"),
        ["plant_master"] = ("plants", "plant_master.csv"),
        ["dc_master"] = ("dcs", "dc_master.csv"),
        ["transportation_master"] = ("lanes", "transportation_master.csv"),
        ["product_category_master"] = ("categories", "product_category_master.csv"),
        ["contract_master"] = ("contracts", "contract_master.csv"),
        ["trade_dataset"] = ("trade", "trade_dataset.csv"),
        ["financial_dataset"] = ("financial", "financial_dataset.csv"),
        ["packaging_master"] = ("packaging", "packaging_master.csv"),
        ["capacity_master"] = ("capacity", "capacity_master.csv"),
    };

    public static string? DetectDataset(IReadOnlyList<string> columns)
    {
        var cols = new HashSet<string>(columns);
        string? best = null; int bestN = 0;
        foreach (var (key, sig) in Signatures)
            if (sig.All(cols.Contains) && sig.Length > bestN) { best = key; bestN = sig.Length; }
        return best;
    }

    /// <summary>Parse CSV bytes → (datasetKey, rows). Throws on empty/unknown.</summary>
    public static (string key, List<Row> rows) ParseCsv(Stream stream)
    {
        using var reader = new StreamReader(stream);
        using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            MissingFieldFound = null,
            HeaderValidated = null,
            BadDataFound = null,
        });

        if (!csv.Read() || !csv.ReadHeader())
            throw new ArgumentException("CSV is empty.");

        var headers = csv.HeaderRecord?.ToList() ?? new List<string>();
        if (headers.Count == 0)
            throw new ArgumentException("CSV is empty.");

        var key = DetectDataset(headers);
        if (key is null)
            throw new ArgumentException(
                "Could not match the CSV to a known dataset. Columns seen: " +
                string.Join(", ", headers.Take(10)));

        var rows = new List<Row>();
        while (csv.Read())
        {
            var row = new Row();
            foreach (var h in headers)
            {
                var raw = csv.GetField(h);
                row[h] = Coerce(raw);
            }
            rows.Add(row);
        }
        if (rows.Count == 0)
            throw new ArgumentException("CSV is empty.");
        return (key, rows);
    }

    /// <summary>Numeric strings → double/long; blanks → null; else string. Mirrors pandas read_csv typing.</summary>
    private static object? Coerce(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var s = raw.Trim();
        if (long.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var l))
            return l;
        if (double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var d))
            return d;
        return s;
    }
}
