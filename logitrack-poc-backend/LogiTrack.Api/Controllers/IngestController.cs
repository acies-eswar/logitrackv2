using LogiTrack.Api.Core;
using LogiTrack.Api.Engines;
using LogiTrack.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace LogiTrack.Api.Controllers;

[ApiController]
[Route("api/ingest")]
public sealed class IngestController : ControllerBase
{
    private readonly DataStore _store;
    public IngestController(DataStore store) => _store = store;

    [HttpGet("samples")]
    public object Samples()
    {
        var labels = new Dictionary<string, string>
        {
            ["supplier_master"] = "Supplier Master",
            ["plant_master"] = "Plant Master",
            ["dc_master"] = "Distribution Center Master",
            ["transportation_master"] = "Transportation Master",
            ["product_category_master"] = "Product Category Master",
            ["contract_master"] = "Contract Master",
            ["trade_dataset"] = "Trade Dataset",
            ["financial_dataset"] = "Financial Dataset",
            ["packaging_master"] = "Packaging Master",
            ["capacity_master"] = "Capacity Master",
        };
        return labels.Select(kv => (object)new Dictionary<string, object?>
        { ["key"] = kv.Key, ["label"] = kv.Value }).ToList();
    }

    [HttpGet("sample/{key}")]
    public IActionResult Sample(string key)
    {
        if (!IngestionEngine.SampleFiles.TryGetValue(key, out var entry))
            return NotFound(new { detail = "Unknown sample" });
        var path = Path.Combine(_store.DataDir, entry.file);
        if (!System.IO.File.Exists(path))
            return NotFound(new { detail = "File missing" });
        var bytes = System.IO.File.ReadAllBytes(path);
        return File(bytes, "text/csv", entry.file);
    }

    [HttpPost("upload")]
    public IActionResult Upload(IFormFile? file)
    {
        if (file is null || !file.FileName.ToLowerInvariant().EndsWith(".csv"))
            return BadRequest(new { detail = "Upload a .csv file" });
        try
        {
            using var stream = file.OpenReadStream();
            var (key, rows) = IngestionEngine.ParseCsv(stream);
            _store.Replace(key, rows);
            return Ok(new IngestResult { Dataset = key, Rows = rows.Count, Message = $"Ingested {rows.Count} rows into '{key}'." });
        }
        catch (ArgumentException e)
        {
            return UnprocessableEntity(new { detail = e.Message });
        }
    }

    [HttpPost("reset")]
    public object Reset()
    {
        _store.Reset();
        return new Dictionary<string, object?> { ["status"] = "reset to default dataset" };
    }
}
