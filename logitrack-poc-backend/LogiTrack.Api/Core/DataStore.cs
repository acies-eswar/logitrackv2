namespace LogiTrack.Api.Core;

/// <summary>
/// In-memory data store: default bundle + uploaded dataset overrides.
/// Registered as a singleton; mirrors Python's app/core/store.py.
/// </summary>
public sealed class DataStore
{
    private readonly string _dataDir;
    private readonly object _lock = new();
    private Dictionary<string, object?> _data = new();

    public DataStore(IWebHostEnvironment env)
        : this(Path.Combine(env.ContentRootPath, "Data")) { }

    /// <summary>Test-friendly constructor: load directly from a Data directory path.</summary>
    public DataStore(string dataDir)
    {
        _dataDir = dataDir;
        Reset();
    }

    public void Reset()
    {
        var generated = DataGenerator.Generate();
        lock (_lock)
        {
            _data = generated;
        }
    }

    public void Replace(string key, List<Row> rows)
    {
        lock (_lock)
        {
            _data[key] = rows.Cast<object?>().ToList();
        }
    }

    public List<Row> GetRows(string key)
    {
        lock (_lock)
        {
            if (_data.TryGetValue(key, out var v) && v is List<object?> list)
                return list.OfType<Row>().ToList();
            return new List<Row>();
        }
    }

    public Row GetObject(string key)
    {
        lock (_lock)
        {
            if (_data.TryGetValue(key, out var v) && v is Row r)
                return r;
            return new Row();
        }
    }

    /// <summary>Snapshot of the whole dataset for entity-count style reads.</summary>
    public IReadOnlyDictionary<string, object?> Data
    {
        get { lock (_lock) { return new Dictionary<string, object?>(_data); } }
    }

    /// <summary>Only lanes within the allowed supply chain coverage segments.</summary>
    public List<Row> LanesInScope()
    {
        return GetRows("lanes")
            .Where(l => Config.AllowedSegments.Contains(l.GetString("Segment")))
            .ToList();
    }

    public string DataDir => _dataDir;
}
