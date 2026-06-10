# LogiTrack — C# / .NET 8 Backend

A drop-in replacement for the Python (FastAPI) LogiTrack backend, written in ASP.NET Core.
It exposes the **same routes**, the **same JSON shapes** (snake_case), reads the **same data
files**, and reproduces the **same calculations** — so the existing Next.js frontend works
against it with **no changes**.

Point the frontend at it the usual way:

```
NEXT_PUBLIC_API_BASE=http://localhost:8000/api
```

## Run

Requires the **.NET 8 SDK**.

```bash
cd LogiTrack.Api
dotnet restore
dotnet run            # serves http://localhost:8000  (Swagger at /api/docs)
```

Tests:

```bash
dotnet test           # from the solution root
```

## Endpoints (identical to the Python backend)

| Method | Route | Module |
|--------|-------|--------|
| GET  | `/api/health` | — |
| GET  | `/api/network/summary` `/graph` `/flows` `/hotspots` | 1 — Network Intelligence |
| GET  | `/api/transportation/summary` `/carriers` `/lanes` `/transit` | 2 — Transportation |
| GET  | `/api/sustainability/summary` `/by-lane` `/by-region` `/by-facility` `/by-category` `/matrix` | 5 — Cost & Sustainability |
| GET  | `/api/scenarios` | 3 — Scenario Planning |
| POST | `/api/scenarios/evaluate` | 3 |
| POST | `/api/transition/evaluate` | 6 — Transition Economics |
| GET  | `/api/decision-hub` | 4 — Executive Decision Hub |
| GET  | `/api/master/{key}` · `/api/financial` | Master data |
| GET  | `/api/ingest/samples` · `/api/ingest/sample/{key}` | Ingestion |
| POST | `/api/ingest/upload` · `/api/ingest/reset` | Ingestion |

`carbon_price`, `wacc_pct`, `horizon_years` are query params on the relevant GETs; the POST
bodies are `{ "scenario_id": "...", "carbon_price": 75, "wacc_pct": 8.5, "horizon_years": 5 }`.

## Project layout

```
LogiTrack.Api/
  Core/
    Config.cs        constants (emission factors, scope, defaults)
    Row.cs           loosely-typed row + typed accessors + rounding/safe-div
    JsonLoader.cs    JSON → CLR objects (double/long/string/Row/list)
    DataStore.cs     singleton store: default bundle + uploaded overrides + scope filter
    PyRandom.cs      MT19937 port of CPython random.Random (random/gauss/uniform)
  Engines/
    Metrics.cs               lane cost/emissions primitives (GLEC physics)
    NetworkEngine.cs         Module 1
    TransportationEngine.cs  Module 2
    SustainabilityEngine.cs  Module 5 (+ LaneLanded used by economics)
    ScenarioLibrary.cs       8 scenarios + filters
    EconomicsEngine.cs       Modules 3 & 6 (TCS, WCB, TTE, RANPV, risk, VRT)
    DecisionHubEngine.cs     Module 4
    IngestionEngine.cs       CSV auto-detection (CsvHelper)
  Controllers/               CoreController, DecisionController, IngestController
  Data/                      bundle.json + the 8 sample CSVs (copied to output)
LogiTrack.Tests/             xUnit: RNG parity, metrics, landed-cost sum, scenarios, hub
```

## Calculation fidelity

- **Deterministic engines (Modules 1–5, TCS, WCB, TTE, VRT, risk):** byte-for-byte equal to
  the Python output. Same formulas, same rounding (`Math.Round(..., AwayFromZero)` matches
  Python's `round()` on these magnitudes), same ordering and aggregation.
- **Risk-Adjusted NPV (Monte Carlo):** `PyRandom` is a faithful port of CPython's MT19937 and
  its `random()` / `gauss()` / `uniform()` algorithms. Seeded with `11` (as in Python), it
  produces the **identical random sequence**, so P10/P50/P90, probability-positive, and the
  distribution match number-for-number. (`RngTests` asserts the first draws against CPython's
  reference values.)
- **Scope enforcement:** `DataStore.LanesInScope()` filters to the six allowed Tier 1/2
  segments, exactly like the Python store.

## Ingestion

CSV uploads are auto-classified by column signature (e.g. `Supplier_ID` → Suppliers) and
replace that dataset in the live store; numeric strings are coerced to numbers like pandas
did. `POST /api/ingest/reset` restores the bundled dataset.

## Notes / caveats

- One cosmetic difference: the `decision_summary` / `rationale` **strings** format millions
  with `0.0` (round-half-away-from-zero) vs Python f-strings' round-half-to-even. This only
  affects the *displayed text* on exact `.x5` millions, never any numeric field the frontend
  charts or sorts on.
- `InvariantGlobalization` is on so number parsing/formatting is culture-independent.
