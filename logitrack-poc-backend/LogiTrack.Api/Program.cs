using System.Text.Json;
using System.Text.Json.Serialization;
using LogiTrack.Api.Core;

var builder = WebApplication.CreateBuilder(args);

// CORS — wide open to match the Python backend (frontend runs on :3000)
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

// Controllers + snake_case JSON (matches FastAPI's response/request shape)
builder.Services.AddControllers().AddJsonOptions(opts =>
{
    opts.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
    opts.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    opts.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
    // Dictionary<string, object?> keys are already snake_case literals; don't transform them.
    opts.JsonSerializerOptions.DictionaryKeyPolicy = null;
    opts.JsonSerializerOptions.NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals;
});

builder.Services.AddSingleton<DataStore>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c => c.SwaggerDoc("v1",
    new Microsoft.OpenApi.Models.OpenApiInfo { Title = "LogiTrack API", Version = Config.Version }));

var app = builder.Build();

app.UseSwagger(c => c.RouteTemplate = "api/{documentName}/swagger.json");
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/api/v1/swagger.json", "LogiTrack API v1");
    c.RoutePrefix = "api/docs";
});

app.UseCors();
app.MapControllers();

app.Run();

// Exposed for integration tests
public partial class Program { }
