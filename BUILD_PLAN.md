# LogiTrack V3.0 — PDF Compliance Build Plan

Execution mode: **module-by-module, prioritized**. Extra pages (emissions, landed,
workbench, tms) left as-is. Full demo dataset generated to PDF targets. Existing modular
naming conventions preserved (snake_case JSON, engine-per-module, Recharts UI kit).

Toolchain verified: .NET 8 SDK (apt) builds backend + 15 tests green; Node 22 builds/typechecks
frontend green.

## Phase 0 — Journey + Recommendation Foundation (backend)
- Product families = the 5 appliances (Refrigerator, Washing Machine, Air Conditioner,
  Microwave Oven, Dishwasher) as first-class, mapped onto the existing component lane network.
- Ports as first-class with congestion (avg wait, congestion index, idle-emission fuel factor).
- Journey/TCE model surfaced per product family (Supplier→Plant→Port→Ocean→Port→Road→DC).
- RecommendationEngine: Decision Score = 35% Sustainability + 25% Financial + 15% Operational
  + 15% Risk + 10% Strategic (0–100); categories Win-Win / Sustainability First / Strategic
  Transition / Rejected; alternatives ranking with "why won" + rejected reasons; verdict
  Approve/Pilot/Conditional/Reject thresholds (80 / 65 / 50).
- Scenario library expanded toward ~50 entries across the 6 PDF categories.

## Phase 1 — Module 3 Scenario Planning (`/scenarios`)  [most important]
8-KPI context, recommendation summary card w/ category badge, alternative comparison
workbench (decision score), "why this scenario won", rejected-reason transparency,
end-to-end current-vs-future journey comparison w/ deltas, constraints filtering.

## Phase 2 — Module 4 Executive Hub (`/`)
8 executive KPIs, portfolio opportunity funnel, top initiative banner + "why #1",
investment prioritization matrix (bubble), scenario portfolio ranking, sustainability +
financial waterfalls, execution roadmap, decision queue with approve/pilot/reject.

## Phase 3 — Module 1 Network Intelligence (`/network`)
8-KPI strip, journey explorer (per family, clickable stages), current-state vs best-state,
emissions/cost by mode, opportunity insights w/ priority.

## Phase 4 — Module 5 Sustainability (`/sustainability`)
Emissions attribution waterfall (transport/packaging/supplier/mfg), transport sub-attribution,
carbon economics + sensitivity, GLEC benchmarking, traceability, alternatives comparison.

## Phase 5 — Module 2 Transportation (`/transportation`)
Port congestion intelligence + idle emissions, transportation decarbonization opportunity
cards w/ tradeoff transparency.

Each phase: implement → `dotnet build` + `dotnet test` + `tsc --noEmit`/`next build` → commit → push.
