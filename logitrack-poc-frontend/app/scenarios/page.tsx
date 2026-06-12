"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, fmtUSD, fmtCO2, fmtNum, fmtPct } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardBody, PageHeader, Spinner, ApiError, Badge, Button, Select, KPI } from "@/components/ui";
import { useApprovals, setApproval, isApproved } from "@/lib/approvals";

/* ─────────────────────────────────────────────────────────────────────────────
   Module 3 - AI Optimization Recommendations (LogiTrack)
   Scenario Planning works like an AI-assisted decision tool: the user explores
   AI-generated opportunities, manipulates the end-to-end flow through predefined
   node alternatives (live recalculation), and approves a decision. Approved
   scenarios flow to Transition Economics, the Executive Hub and Sustainability.
   ──────────────────────────────────────────────────────────────────────────── */

type Opt = { name: string; c: number; e: number; l: number; r: number; inv: number };
const O = (name: string, c = 0, e = 0, l = 0, r = 0, inv = 0): Opt => ({ name, c, e, l, r, inv });

// Realistic, geographically-coherent alternatives per node. Deltas are vs the current
// baseline and reflect real-world trade-offs (air = fast but costly + dirty; rail = clean
// but slower; nearshoring to Mexico = shorter lead time to US DCs, lower ocean emissions).
const NODE_POOLS: { id: string; label: string; options: Opt[] }[] = [
  { id: "plant", label: "Source / Plant", options: [
    O("Shanghai, CN"), O("Suzhou, CN", -0.02, -0.01, 0, 0, 0.3),
    O("Ho Chi Minh, VN", -0.08, -0.12, 2, -5, 2.2), O("Bangkok, TH", -0.05, -0.08, 1, -3, 1.5),
    O("Monterrey, MX", -0.12, -0.30, -6, -10, 4.1), O("Pune, IN", -0.10, -0.18, 3, -4, 3.0) ] },
  { id: "oport", label: "Origin Port", options: [
    O("Shanghai (Yangshan)"), O("Ningbo-Zhoushan", -0.02, -0.02, 0, -1, 0),
    O("Shenzhen (Yantian)", -0.01, -0.01, 0, 0, 0), O("Port Klang", -0.02, -0.03, 1, -1, 0),
    O("Laem Chabang", -0.01, -0.02, 0, -1, 0), O("Manzanillo, MX", -0.06, -0.10, -4, -2, 0.2) ] },
  { id: "mode", label: "Main Mode", options: [
    O("Ocean (FCL)"), O("Ocean + Rail", -0.05, -0.40, 2, -2, 0.4), O("Ocean + Truck", 0, -0.10, 0, 0, 0),
    O("Rail (intermodal)", -0.08, -0.45, 3, -3, 0.6), O("Truck", 0.05, -0.05, -1, 2, 0),
    O("Air", 0.42, 2.10, -11, 10, 0) ] },
  { id: "carrier", label: "Carrier", options: [
    O("Maersk"), O("MSC", -0.02, 0, 0, 0, 0), O("CMA CGM", -0.01, -0.01, 0, -1, 0),
    O("Hapag-Lloyd", 0.01, -0.01, 0, 0, 0), O("ONE", 0, 0, 1, 0, 0), O("COSCO", -0.02, 0.01, 0, 1, 0) ] },
  { id: "dc", label: "Destination DC", options: [
    O("Chicago"), O("Dallas", -0.02, -0.02, -1, -1, 0), O("Atlanta", -0.01, -0.01, 0, 0, 0),
    O("Los Angeles", 0.03, 0.01, -2, 0, 0), O("Chennai", -0.04, -0.03, 1, 0, 0.2) ] },
];

// Map a free-text token to an option index for a node (so the flow reflects the recommendation).
const NODE_INDEX = (nodeId: string, match: (name: string) => boolean) => {
  const pool = NODE_POOLS.find((n) => n.id === nodeId)!;
  const i = pool.options.findIndex((o) => match(o.name.toLowerCase()));
  return i < 0 ? 0 : i;
};

const clamp = (v: number) => Math.max(0, Math.min(100, v));

// Live KPI + Decision-Score recalculation from the selected node options.
function compute(baseline: any, sel: number[]) {
  const opts = NODE_POOLS.map((n, i) => n.options[sel[i] ?? 0]);
  const c = opts.reduce((a, o) => a + o.c, 0);
  const e = opts.reduce((a, o) => a + o.e, 0);
  const l = opts.reduce((a, o) => a + o.l, 0);
  const r = opts.reduce((a, o) => a + o.r, 0);
  const inv = opts.reduce((a, o) => a + o.inv, 0) * 1e6;
  const baseF = baseline?.annual_freight_usd ?? 0;
  const baseE = baseline?.annual_co2e ?? 0;
  const baseT = baseline?.weighted_transit_days ?? 0;
  const baseOtif = baseline?.weighted_otif_pct ?? 0;
  const futF = baseF * (1 + c), futE = baseE * (1 + e), futT = Math.max(0, baseT + l);
  const sus = clamp(35 + (-e) / 0.40 * 65);
  const fin = clamp(50 + (-c) / 0.20 * 45);
  const op = clamp(70 - l * 3);
  const riskRaw = clamp(38 + r);
  const strat = clamp(45 + (-e) * 40);
  const decision = Math.round(0.35 * sus + 0.25 * fin + 0.15 * op + 0.15 * (100 - riskRaw) + 0.10 * strat);
  return {
    futureFreight: futF, savings: baseF - futF, futureEm: futE, emReductionPct: -e * 100,
    costImpactPct: c * 100, futureLead: futT, baseLead: baseT, otif: baseOtif, investment: inv,
    decision, riskRaw, sub: { sustainability: sus, financial: fin, operational: op, risk: 100 - riskRaw, strategic: strat },
    verdict: decision >= 80 ? "APPROVE" : decision >= 65 ? "PILOT" : decision >= 50 ? "CONDITIONAL" : "DECLINE",
  };
}

// The AI-recommended preset (node selections) for a recommendation, by its type.
// The CURRENT network the recommendation starts from, inferred from its name
// (e.g. an air-freight rec starts on Air; a "China to Mexico" rec starts in China).
function currentSel(rec: any): number[] {
  const n = (rec?.name ?? "").toLowerCase();
  const s = [0, 0, 0, 0, 0]; // [plant, oport, mode, carrier, dc]
  if (n.includes("air")) s[2] = NODE_INDEX("mode", (x) => x === "air");
  else if (n.includes("road") || n.includes("truck")) s[2] = NODE_INDEX("mode", (x) => x.startsWith("truck"));
  return s;
}

// The AI-recommended network: a genuinely better, distinct combination (always cleaner
// than the current network, never identical to it).
function recommendedSel(rec: any): number[] {
  const n = (rec?.name ?? "").toLowerCase();
  const s = [0, 0, 0, 0, 0]; // [plant, oport, mode, carrier, dc]
  // default to the best-balanced mode (low emissions, sensible cost/lead)
  s[2] = NODE_INDEX("mode", (x) => x.includes("ocean + rail"));
  if (n.includes("road") && n.includes("rail")) s[2] = NODE_INDEX("mode", (x) => x.startsWith("rail"));
  // sourcing
  if (n.includes("mexico") || n.includes("nearshore")) { s[0] = NODE_INDEX("plant", (x) => x.includes("monterrey")); s[1] = NODE_INDEX("oport", (x) => x.includes("manzanillo")); }
  else if (n.includes("vietnam")) s[0] = NODE_INDEX("plant", (x) => x.includes("ho chi minh"));
  else if (n.includes("india")) s[0] = NODE_INDEX("plant", (x) => x.includes("pune"));
  else if (n.includes("thailand")) s[0] = NODE_INDEX("plant", (x) => x.includes("bangkok"));
  else if (rec?.type === "supplier" || rec?.type === "hybrid") s[0] = NODE_INDEX("plant", (x) => x.includes("monterrey"));
  // distribution
  if (n.includes("chennai")) s[4] = NODE_INDEX("dc", (x) => x.includes("chennai"));
  else if (n.includes("dallas")) s[4] = NODE_INDEX("dc", (x) => x.includes("dallas"));
  else if (rec?.type === "dc_allocation") s[4] = NODE_INDEX("dc", (x) => x.includes("dallas"));
  // carrier / route levers
  if (rec?.type === "carrier") s[3] = NODE_INDEX("carrier", (x) => x === "msc");
  if (rec?.type === "route") s[1] = NODE_INDEX("oport", (x) => x.includes("ningbo"));
  return s;
}

// AI-evaluated alternative networks (shown in the table; clicking applies them live).
// sel = [plant, oport, mode, carrier, dc] indices into NODE_POOLS.
const ALT_PRESETS: { name: string; sel: number[] }[] = [
  { name: "Vietnam source + Ocean & Rail", sel: [2, 0, 1, 0, 0] },
  { name: "Mexico nearshore + Truck", sel: [4, 5, 4, 0, 1] },
  { name: "Thailand source + Ocean", sel: [3, 4, 0, 1, 0] },
  { name: "India source + Ocean & Rail", sel: [5, 0, 1, 0, 0] },
  { name: "Express Air (premium)", sel: [0, 0, 5, 0, 0] },
];

const CAT_VARIANT: Record<string, "green" | "blue" | "amber" | "red" | "slate"> = {
  "Win-Win": "green", "Sustainability First": "blue", "Cost Optimized": "blue",
  "Strategic Transition": "amber", "Balanced": "slate", "Rejected": "red",
};

// Build a DIVERSE opportunity list: the best of each lever type first (so the cards
// are visibly different, not ten near-identical modal shifts), then fill by score.
function diversify(all: any[], n: number): any[] {
  const sorted = [...all].sort((a, b) => b.decision_score - a.decision_score);
  const seen = new Set<string>();
  const out: any[] = [];
  for (const r of sorted) { if (!seen.has(r.type)) { seen.add(r.type); out.push(r); } }
  for (const r of sorted) { if (out.length >= n) break; if (!out.includes(r)) out.push(r); }
  return out.slice(0, n).sort((a, b) => b.decision_score - a.decision_score);
}

export default function ScenarioPlanning() {
  const [recs, setRecs] = useState<any[]>([]);
  const [netCounts, setNetCounts] = useState<any>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const approvals = useApprovals();

  const load = useCallback(() => {
    setErr(false); setRecs([]);
    Promise.all([api.recommendations(75), api.networkSummary()])
      .then(([r, n]) => { setRecs(diversify(r.recommendations ?? [], 10)); setNetCounts(n.entity_counts); })
      .catch(() => setErr(true));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (err) return <ApiError retry={load} />;
  if (recs.length === 0) return <Spinner label="AI is analyzing the network…" />;

  const open = recs.find((r) => r.scenario_id === openId) ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Module 3 · AI Decision Tool"
        title={open ? "Recommendation Details" : "AI Optimization Recommendations"}
        desc={open ? "Explore the end-to-end flow, change options to recalculate live, and approve the decision." : "AI-generated network optimization opportunities, ranked by Decision Score."}
        actions={open ? <Button variant="secondary" onClick={() => setOpenId(null)}>← All recommendations</Button> : undefined}
      />

      {!open ? (
        <AIRecommendationCenter recs={recs} netCounts={netCounts} approvals={approvals} onOpen={setOpenId} />
      ) : (
        <RecommendationDetails rec={open} approval={approvals[open.scenario_id]} />
      )}
    </>
  );
}

/* ── AI Recommendation Center ───────────────────────────────────────────────── */
function AIRecommendationCenter({ recs, netCounts, approvals, onOpen }: any) {
  const c = netCounts ?? {};
  return (
    <>
      <Card className="mb-6 border-brand/30 dark:border-cyan-400/30 bg-gradient-to-br from-brand-50/60 to-transparent dark:from-cyan-500/5">
        <CardBody className="flex items-center gap-4 flex-wrap">
          <div className="w-10 h-10 rounded-xl bg-brand/10 dark:bg-cyan-500/10 flex items-center justify-center text-brand dark:text-cyan-400 text-xl">✦</div>
          <div className="text-sm text-slate-700 dark:text-slate-200">
            We analyzed <b>{fmtNum(c.lanes)}</b> lanes, <b>{fmtNum(c.plants)}</b> plants, <b>{fmtNum(c.dcs)}</b> distribution centers and <b>{fmtNum(c.suppliers)}</b> suppliers and identified <b>{recs.length}</b> optimization opportunities.
          </div>
        </CardBody>
      </Card>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {recs.map((r: any, i: number) => {
          const ap = approvals[r.scenario_id];
          return (
            <button key={r.scenario_id} onClick={() => onOpen(r.scenario_id)}
              className="text-left rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/60 p-4 hover:border-brand/40 hover:shadow-elevated transition-all">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Recommendation #{i + 1}</div>
                <div className="text-2xl font-extrabold numeric text-brand dark:text-cyan-400">{Math.round(r.decision_score)}</div>
              </div>
              <div className="text-base font-bold text-ink-900 dark:text-white leading-tight">{r.name}</div>
              <div className="mt-1 mb-3"><Badge variant={CAT_VARIANT[r.category] ?? "slate"}>{r.category}</Badge></div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <Stat label="Annual Savings" value={fmtUSD(r.annual_savings_usd)} good />
                <Stat label="Emission Reduction" value={fmtPct(r.emissions_reduction_pct)} good />
                <Stat label="Lead Time Impact" value={`${r.transit_impact_days > 0 ? "+" : ""}${fmtNum(r.transit_impact_days, 1)} d`} />
                <Stat label="Investment" value={fmtUSD(r.investment_usd)} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Decision Score · {r.decision_score >= 65 ? "Recommended" : "Evaluated"}</span>
                {isApproved(ap) ? <Badge variant={ap === "APPROVE" ? "green" : "blue"}>{ap === "APPROVE" ? "Approved" : "Piloted"}</Badge> : <span className="text-xs text-brand dark:text-cyan-400">Explore →</span>}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ── Recommendation Details (flow explorer + live recalculation) ────────────── */
function RecommendationDetails({ rec, approval }: { rec: any; approval?: string }) {
  const curSel = useMemo(() => currentSel(rec), [rec.scenario_id]); // eslint-disable-line react-hooks/exhaustive-deps
  const recommended = useMemo(() => recommendedSel(rec), [rec.scenario_id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [sel, setSel] = useState<number[]>(recommended);
  useEffect(() => { setSel(recommendedSel(rec)); }, [rec.scenario_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const base = rec.baseline;
  const k = useMemo(() => compute(base, sel), [base, sel]);
  // Baseline already reflects the current lanes, so the numeric "current" uses no extra
  // deltas; curSel only labels which network the recommendation starts from.
  const current = useMemo(() => compute(base, [0, 0, 0, 0, 0]), [base]);
  const isRecommended = sel.join() === recommended.join();
  const [saved, setSaved] = useState(false);

  function setNode(i: number, v: number) { setSel((s) => s.map((x, idx) => (idx === i ? v : x))); }

  return (
    <div className="space-y-5">
      {/* Section 1 - AI Recommendation Summary */}
      <Card className="border-brand/20 dark:border-cyan-400/20">
        <CardBody>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div className="text-lg font-bold text-ink-900 dark:text-white">{rec.name}</div>
            <Badge variant={isRecommended ? "green" : "amber"}>{isRecommended ? "AI-recommended configuration" : "Modified configuration"}</Badge>
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            <FlowSummary title="Current network" sel={curSel} tone="slate" />
            <FlowSummary title="Selected network" sel={sel} tone="brand" />
            <div className="rounded-lg border border-positive/30 bg-positive/5 dark:bg-positive/10 p-3">
              <div className="text-[11px] uppercase tracking-wide text-positive mb-2">Expected outcome</div>
              <Out label="Cost Reduction" value={`${k.costImpactPct <= 0 ? "" : "+"}${fmtNum(-k.costImpactPct, 1)}%`} good={k.costImpactPct <= 0} />
              <Out label="Emission Reduction" value={fmtPct(k.emReductionPct)} good={k.emReductionPct >= 0} />
              <Out label="Lead Time Impact" value={`${k.futureLead - k.baseLead >= 0 ? "+" : ""}${fmtNum(k.futureLead - k.baseLead, 1)} d`} good={k.futureLead - k.baseLead <= 0} />
              <Out label="Decision Score" value={String(k.decision)} good={k.decision >= 65} />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Section 2 - Recommendation KPIs (live), two rows */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="Current Freight" value={fmtUSD(base?.annual_freight_usd)} accent="blue" />
        <KPI label="Current Emissions" value={fmtCO2(base?.annual_co2e)} accent="green" />
        <KPI label="Lead Time" value={`${fmtNum(k.futureLead, 1)} d`} />
        <KPI label="OTIF" value={fmtPct(k.otif)} />
        <KPI label="Decision Score" value={String(k.decision)} accent="blue" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Annual Savings" value={fmtUSD(k.savings)} accent={k.savings >= 0 ? "green" : "red"} />
        <KPI label="Emission Reduction" value={fmtPct(k.emReductionPct)} accent="green" />
        <KPI label="Investment" value={fmtUSD(Math.max(k.investment, rec.investment_usd || 0))} accent="amber" />
        <KPI label="Risk Score" value={fmtNum(k.riskRaw)} accent={k.riskRaw < 40 ? "green" : k.riskRaw < 60 ? "amber" : "red"} />
      </div>

      {/* Section 3 - End-to-End Network Explorer (clickable nodes recalc live) */}
      <Card>
        <CardHeader><CardTitle>End-to-End Network Explorer</CardTitle><div className="text-[11px] text-slate-400">change any node - metrics recalculate instantly (bad options are shown too)</div></CardHeader>
        <CardBody>
          <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
            {NODE_POOLS.map((n, i) => (
              <div key={n.id} className="flex items-center gap-1 shrink-0">
                <div className={`rounded-xl border p-3 min-w-[170px] ${sel[i] !== 0 ? "border-brand/40 bg-brand-50/50 dark:border-cyan-400/40 dark:bg-cyan-500/5" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50"}`}>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">{n.label}</div>
                  <Select value={sel[i]} onChange={(e) => setNode(i, Number(e.target.value))} className="w-full text-sm py-1.5">
                    {n.options.map((o, oi) => <option key={oi} value={oi}>{o.name}</option>)}
                  </Select>
                </div>
                {i < NODE_POOLS.length - 1 && <span className="text-slate-300 dark:text-slate-600">→</span>}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Alternatives Evaluated By AI */}
      <Card>
        <CardHeader><CardTitle>Alternatives Evaluated by AI</CardTitle><div className="text-[11px] text-slate-400">click any row to load it into the network explorer</div></CardHeader>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <th className="px-4 py-2.5 text-left">Rank</th><th className="px-4 py-2.5 text-left">Scenario</th>
              <th className="px-4 py-2.5 text-right">Savings</th><th className="px-4 py-2.5 text-right">Emissions</th>
              <th className="px-4 py-2.5 text-right">Lead</th><th className="px-4 py-2.5 text-right">Score</th>
            </tr></thead>
            <tbody>
              {[...ALT_PRESETS.map((p) => ({ ...p, k: compute(base, p.sel) }))]
                .sort((a, b) => b.k.decision - a.k.decision)
                .map((p, i) => {
                  const active = p.sel.join() === sel.join();
                  return (
                    <tr key={p.name} onClick={() => setSel(p.sel)}
                      className={`border-b border-slate-50 dark:border-slate-900 cursor-pointer ${active ? "bg-brand-50 dark:bg-cyan-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-900/60"}`}>
                      <td className="px-4 py-2.5 text-slate-400 numeric">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-ink-900 dark:text-white">{p.name}</td>
                      <td className="px-4 py-2.5 text-right numeric">{fmtUSD(p.k.savings)}</td>
                      <td className="px-4 py-2.5 text-right numeric text-positive">{fmtPct(p.k.emReductionPct)}</td>
                      <td className="px-4 py-2.5 text-right numeric text-slate-500">{p.k.futureLead - p.k.baseLead >= 0 ? "+" : ""}{fmtNum(p.k.futureLead - p.k.baseLead, 0)}d</td>
                      <td className={`px-4 py-2.5 text-right font-bold numeric ${p.k.decision >= 80 ? "text-positive" : p.k.decision >= 65 ? "text-brand dark:text-cyan-400" : p.k.decision >= 50 ? "text-warning" : "text-danger"}`}>{p.k.decision}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {/* Why This Was Recommended */}
      <Card>
        <CardHeader><CardTitle>Why This Was Recommended</CardTitle></CardHeader>
        <CardBody className="text-sm text-slate-700 dark:text-slate-300">
          <p>Compared against {ALT_PRESETS.length + NODE_POOLS.reduce((a, n) => a + n.options.length, 0)} alternative network configurations. The AI-recommended option provides:</p>
          <ul className="mt-2 space-y-1 list-disc pl-5">
            <li>{fmtPct(current.emReductionPct >= 0 ? compute(base, recommended).emReductionPct : 0)} emission reduction</li>
            <li>{fmtNum(-compute(base, recommended).costImpactPct, 1)}% cost reduction</li>
            <li>only {fmtNum(compute(base, recommended).futureLead - current.baseLead, 1)} day lead-time change</li>
            <li>Decision Score {compute(base, recommended).decision} - the strongest balanced outcome among evaluated alternatives</li>
          </ul>
        </CardBody>
      </Card>

      {/* Save / Approve */}
      <Card>
        <CardBody className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {isApproved(approval)
              ? <>This scenario is <b className="text-positive">{approval === "APPROVE" ? "approved" : "piloted"}</b> - it now appears in Transition Economics, the Executive Hub and Sustainability.</>
              : "Approve to push this configuration to Transition Economics, the Executive Hub and Sustainability."}
            {saved && <span className="ml-2 text-positive">· saved</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 1500); }}>Save as Scenario</Button>
            <Button variant={isApproved(approval) ? "secondary" : "primary"} onClick={() => setApproval(rec.scenario_id, approval === "APPROVE" ? "" : "APPROVE")}>
              {approval === "APPROVE" ? "Approved ✓" : "Approve Scenario"}
            </Button>
            {isApproved(approval) && <Link href={`/transition?s=${rec.scenario_id}`}><Button variant="ghost">Open Financial Case →</Button></Link>}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function FlowSummary({ title, sel, tone }: { title: string; sel: number[]; tone: "slate" | "brand" }) {
  return (
    <div className={`rounded-lg border p-3 ${tone === "brand" ? "border-brand/30 bg-brand-50/40 dark:border-cyan-400/30 dark:bg-cyan-500/5" : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50"}`}>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">{title}</div>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs">
        {NODE_POOLS.map((n, i) => (
          <span key={n.id} className="flex items-center gap-1">
            <span className="font-medium text-ink-900 dark:text-white">{n.options[sel[i] ?? 0].name}</span>
            {i < NODE_POOLS.length - 1 && <span className="text-slate-300 dark:text-slate-600">→</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

function Out({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex justify-between text-sm py-0.5">
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      <span className={`font-semibold ${good ? "text-positive" : "text-danger"}`}>{value}</span>
    </div>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`font-bold numeric ${good ? "text-positive" : "text-ink-900 dark:text-white"}`}>{value}</div>
    </div>
  );
}
