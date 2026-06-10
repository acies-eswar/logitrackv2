export const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api";

async function get<T>(p: string): Promise<T> {
  const url = `${API}${p}`;
  try {
    console.log("[API GET] ->", url);
    const r = await fetch(url, { cache: "no-store" });
    const txt = await r.text();
    let json: any = null;
    try { json = txt ? JSON.parse(txt) : null; } catch (e) { json = txt; }
    console.log("[API GET] <-", url, r.status, json);
    if (!r.ok) throw new Error(`${r.status}: ${txt}`);
    return json as T;
  } catch (err) {
    console.error("[API GET] ERROR", url, err);
    throw err;
  }
}
async function post<T>(p: string, body: unknown): Promise<T> {
  const url = `${API}${p}`;
  try {
    console.log("[API POST] ->", url, body);
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const txt = await r.text();
    let json: any = null;
    try { json = txt ? JSON.parse(txt) : null; } catch (e) { json = txt; }
    console.log("[API POST] <-", url, r.status, json);
    if (!r.ok) throw new Error(`${r.status}: ${txt}`);
    return json as T;
  } catch (err) {
    console.error("[API POST] ERROR", url, err);
    throw err;
  }
}

export const api = {
  health: () => get<any>("/health"),
  // Module 1
  networkSummary: () => get<any>("/network/summary"),
  networkGraph: () => get<any>("/network/graph"),
  networkFlows: () => get<any>("/network/flows"),
  networkHotspots: () => get<any>("/network/hotspots"),
  // Module 2
  transportSummary: () => get<any>("/transportation/summary"),
  carriers: () => get<any[]>("/transportation/carriers"),
  lanes: () => get<any[]>("/transportation/lanes"),
  transit: () => get<any[]>("/transportation/transit"),
  // Module 5
  sustSummary: (cp = 75) => get<any>(`/sustainability/summary?carbon_price=${cp}`),
  sustByLane: (cp = 75) => get<any[]>(`/sustainability/by-lane?carbon_price=${cp}`),
  sustByRegion: (cp = 75) => get<any[]>(`/sustainability/by-region?carbon_price=${cp}`),
  sustByFacility: (cp = 75) => get<any[]>(`/sustainability/by-facility?carbon_price=${cp}`),
  sustByCategory: (cp = 75) => get<any[]>(`/sustainability/by-category?carbon_price=${cp}`),
  matrix: (cp = 75) => get<any[]>(`/sustainability/matrix?carbon_price=${cp}`),
  // Module 3 + 6
  scenarios: () => get<any[]>("/scenarios"),
  // V3.0 — ranked alternatives with Decision Score, categories, rationale, funnel
  recommendations: (cp = 75) => get<any>(`/recommendations?carbon_price=${cp}`),
  evaluate: (scenario_id: string, p: any = {}) => post<any>("/scenarios/evaluate", { scenario_id, ...p }),
  transition: (scenario_id: string, p: any = {}) => post<any>("/transition/evaluate", { scenario_id, ...p }),
  workbench: (scenario_id: string, p: any = {}) => post<any>("/workbench/evaluate", { scenario_id, ...p }),
  // Landed Cost vs Emissions (product family / SKU)
  landed: () => get<any>("/landed"),
  // Emissions intelligence (by scope / source / mode)
  emissions: (cp = 75) => get<any>(`/emissions?carbon_price=${cp}`),
  // TMS - aggregated transportation management
  tms: () => get<any>("/tms"),
  // Module 4
  decisionHub: (cp = 75, wacc = 8.5, h = 5) => get<any>(`/decision-hub?carbon_price=${cp}&wacc_pct=${wacc}&horizon_years=${h}`),
  // v2.0 — Network Journey
  networkJourney: (product = "Medium HVAC-class", dc = "") =>
    get<any>(`/network/journey?product=${encodeURIComponent(product)}&dc=${encodeURIComponent(dc)}`),
  // v2.0 — Carrier Decision Pack
  carrierPack: (carrier: string) =>
    get<any>(`/transportation/carrier-pack?carrier=${encodeURIComponent(carrier)}`),
  // v2.0 — Unit engine
  unitDefaults: () => get<any>("/unit/defaults"),
  unitCompute: (body: any) => post<any>("/unit/compute", body),
  // v2.0 — Emissions factors
  emissionsFactors: () => get<any>("/emissions/factors"),
  // Data
  master: (k: string) => get<any[]>(`/master/${k}`),
  financial: () => get<any>("/financial"),
  samples: () => get<any[]>("/ingest/samples"),
  sampleUrl: (k: string) => `${API}/ingest/sample/${k}`,
  uploadUrl: () => `${API}/ingest/upload`,
  reset: () => post<any>("/ingest/reset", {}),
};

export const fmtUSD = (n: number | null | undefined, compact = true) => {
  if (n == null || !isFinite(n)) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD",
    notation: compact && Math.abs(n) >= 1000 ? "compact" : "standard", maximumFractionDigits: compact ? 1 : 0 }).format(n);
};
export const fmtNum = (n: number | null | undefined, d = 0) =>
  n == null || !isFinite(n) ? "N/A" : new Intl.NumberFormat("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);
export const fmtPct = (n: number | null | undefined, d = 1) => n == null || !isFinite(n) ? "N/A" : `${n.toFixed(d)}%`;
export const fmtCO2 = (n: number | null | undefined) => {
  if (n == null || !isFinite(n)) return "N/A";
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M t`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}k t`;
  return `${n.toFixed(1)} t`;
};

export const CHART = { blue: "#1d4ed8", blueLight: "#5a82f7", navy: "#0f2150", slate: "#64748b",
  positive: "#0e9f6e", warning: "#d97706", danger: "#dc2626", grid: "#e2e8f0", axis: "#94a3b8" };
export const SERIES = ["#1d4ed8", "#5a82f7", "#0f2150", "#0e9f6e", "#d97706", "#94a3b8", "#8aabff", "#143596"];
export const VERDICT: Record<string, { bg: string; text: string; label: string }> = {
  APPROVE: { bg: "bg-positive/10", text: "text-positive", label: "Approve" },
  PILOT: { bg: "bg-brand/10", text: "text-brand", label: "Pilot" },
  CONDITIONAL: { bg: "bg-warning/10", text: "text-warning", label: "Conditional" },
  DECLINE: { bg: "bg-danger/10", text: "text-danger", label: "Decline" },
};
export const VERDICT_STYLE = VERDICT;
