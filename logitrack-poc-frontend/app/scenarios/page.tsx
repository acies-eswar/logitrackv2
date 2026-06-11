"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, fmtUSD, fmtCO2, fmtNum, fmtPct } from "@/lib/api";
import {
  Card, CardHeader, CardTitle, CardBody, PageHeader, Spinner, ApiError,
  Badge, Button, Segmented, Select, KPI,
} from "@/components/ui";
import { BarChartCard } from "@/components/charts";
import { useApprovals, setApproval } from "@/lib/approvals";

/* ─────────────────────────────────────────────────────────────────────────────
   Module 3 — Scenario Planning & Recommendation Workbench (LogiTrack V3.0)
   "An interactive decision laboratory": evaluate current vs many future states,
   rank by Decision Score, explain why one wins and why others were rejected.
   ──────────────────────────────────────────────────────────────────────────── */

const CARBON_PRICES = [0, 50, 75, 100, 150, 250];
const PRODUCTS = ["Refrigerator", "Washing Machine", "Air Conditioner", "Microwave Oven", "Dishwasher"];

const CAT_VARIANT: Record<string, "green" | "blue" | "amber" | "red" | "slate"> = {
  "Win-Win": "green",
  "Sustainability First": "blue",
  "Cost Optimized": "blue",
  "Strategic Transition": "amber",
  "Balanced": "slate",
  "Rejected": "red",
};
const VERDICT_VARIANT: Record<string, "green" | "blue" | "amber" | "red"> = {
  APPROVE: "green", PILOT: "blue", CONDITIONAL: "amber", DECLINE: "red",
};
const VERDICT_LABEL: Record<string, string> = {
  APPROVE: "Approve", PILOT: "Pilot", CONDITIONAL: "Conditional", DECLINE: "Reject",
};
// decision-family labels (spec §26 categories) used to group "alternatives considered"
const TYPE_LABEL: Record<string, string> = {
  route: "Route optimization", carrier: "Carrier optimization", modal_shift: "Modal optimization",
  supplier: "Supplier optimization", plant_allocation: "Manufacturing relocation",
  dc_allocation: "Distribution optimization", hybrid: "Hybrid optimization",
};

function scoreColor(s: number) {
  return s >= 80 ? "text-positive" : s >= 65 ? "text-brand dark:text-cyan-400" : s >= 50 ? "text-warning" : "text-danger";
}

// What the recommendation changes in the end-to-end flow (parsed from the scenario name).
function changeOf(rec: any): { lever: string; from?: string; to?: string } {
  const lever = ({
    route: "Route", carrier: "Carrier", modal_shift: "Mode", supplier: "Supplier",
    plant_allocation: "Plant", dc_allocation: "Distribution", hybrid: "Supplier + Mode + Carrier",
  } as Record<string, string>)[rec?.type] ?? "Network";
  const m = (rec?.name ?? "").match(/([A-Za-z .()→\-]+?)\s*(?:→|->)\s*([A-Za-z .()]+)/);
  if (m) return { lever, from: m[1].trim(), to: m[2].replace(/\(.*$/, "").trim() };
  return { lever };
}

const APPROVAL_VARIANT: Record<string, "green" | "blue" | "red" | "slate"> = {
  APPROVE: "green", PILOT: "blue", DECLINE: "red", "": "slate",
};
function ApprovalBar({ id, value, onSet, size = "sm" }: { id: string; value?: string; onSet: (id: string, v: string) => void; size?: "sm" | "xs" }) {
  const opts: { v: string; label: string; cls: string }[] = [
    { v: "APPROVE", label: "Approve", cls: "text-positive border-positive/40 hover:bg-positive/10" },
    { v: "PILOT", label: "Pilot", cls: "text-brand dark:text-cyan-400 border-brand/40 hover:bg-brand/10" },
    { v: "DECLINE", label: "Reject", cls: "text-danger border-danger/40 hover:bg-danger/10" },
  ];
  const pad = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  return (
    <div className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
      {opts.map((o) => (
        <button key={o.v} onClick={() => onSet(id, o.v)}
          className={`${pad} rounded-md border font-medium transition-colors ${value === o.v ? "bg-current/10 " + o.cls : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300"} ${value === o.v ? o.cls : ""}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

type SortKey = "rank" | "decision_score" | "emissions_reduction_pct" | "cost_impact_pct" | "transit_impact_days" | "risk_score" | "investment_usd";

export default function ScenariosPage() {
  const [carbon, setCarbon] = useState(75);
  const [product, setProduct] = useState(PRODUCTS[0]);
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [journey, setJourney] = useState<any>(null);
  const [err, setErr] = useState(false);

  // constraints engine (spec §32 / §147–148)
  const [maxLead, setMaxLead] = useState(99);     // max lead-time increase (days)
  const [maxCost, setMaxCost] = useState(99);      // max cost increase (%)
  const [minEm, setMinEm] = useState(0);           // min emission reduction (%)
  const [hideInfeasible, setHideInfeasible] = useState(false);

  // Emissions-first by default (spec §13/§94) — emissions reduction leads the ranking.
  const [sortKey, setSortKey] = useState<SortKey>("emissions_reduction_pct");
  const [catFilter, setCatFilter] = useState("All");
  // manual approval workflow — shared across the app (Transition Economics & Executive Hub)
  const approvals = useApprovals();
  const setApprove = (id: string, v: string) => setApproval(id, v);

  const load = useCallback(() => {
    setErr(false); setData(null);
    api.recommendations(carbon)
      .then((d) => {
        setData(d);
        const top = d.recommended?.scenario_id ?? d.recommendations?.[0]?.scenario_id ?? null;
        setSelected(top);
      })
      .catch(() => setErr(true));
  }, [carbon]);

  useEffect(() => { load(); }, [load]);

  // selected scenario detail (baseline / future / landed)
  useEffect(() => {
    if (!selected) return;
    setDetail(null);
    api.evaluate(selected, { carbon_price: carbon }).then(setDetail).catch(() => setDetail(null));
  }, [selected, carbon]);

  // representative end-to-end journey for the comparison timeline
  useEffect(() => {
    setJourney(null);
    api.networkJourney(product).then(setJourney).catch(() => setJourney(null));
  }, [product]);

  const recs: any[] = data?.recommendations ?? [];
  const selRec = useMemo(() => recs.find((r) => r.scenario_id === selected) ?? null, [recs, selected]);
  const recommended = data?.recommended ?? null;

  const feasible = useCallback((r: any) =>
    r.transit_impact_days <= maxLead &&
    r.cost_impact_pct <= maxCost &&
    r.emissions_reduction_pct >= minEm,
  [maxLead, maxCost, minEm]);

  const constrainedTop = useMemo(() => recs.filter(feasible)[0] ?? null, [recs, feasible]);
  const constraintsActive = maxLead < 99 || maxCost < 99 || minEm > 0;

  const categories = useMemo(() => ["All", ...Object.keys(data?.by_category ?? {})], [data]);

  const rows = useMemo(() => {
    let list = recs.slice();
    if (catFilter !== "All") list = list.filter((r) => r.category === catFilter);
    if (hideInfeasible) list = list.filter(feasible);
    const dir = sortKey === "rank" || sortKey === "cost_impact_pct" || sortKey === "transit_impact_days" || sortKey === "risk_score" ? 1 : -1;
    list.sort((a, b) => (a[sortKey] - b[sortKey]) * dir);
    return list;
  }, [recs, catFilter, hideInfeasible, feasible, sortKey]);

  if (err) return <ApiError retry={load} />;

  return (
    <>
      <PageHeader
        eyebrow="Module 3 · Decision Workbench"
        title="Scenario Planning & Optimization"
        desc="Evaluate future-state logistics and sustainability strategies before committing capital. Every alternative is scored on cost, emissions, lead time, risk and working capital — then ranked by a single Decision Score."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={product} onChange={(e) => setProduct(e.target.value)} aria-label="Product family">
              {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
            <Segmented
              options={CARBON_PRICES.map((c) => ({ value: String(c), label: `$${c}` }))}
              value={String(carbon)} onChange={(v) => setCarbon(Number(v))}
            />
          </div>
        }
      />

      {!data ? <Spinner label="Generating and ranking alternatives…" /> : (
        <div className="space-y-5">
          <RecommendationSummary rec={recommended} total={recs.length} approval={recommended ? approvals[recommended.scenario_id] : ""} onApprove={setApprove} />

          {selRec && <ScenarioContext rec={selRec} detail={detail} />}

          <ConstraintsPanel
            maxLead={maxLead} setMaxLead={setMaxLead}
            maxCost={maxCost} setMaxCost={setMaxCost}
            minEm={minEm} setMinEm={setMinEm}
            hideInfeasible={hideInfeasible} setHideInfeasible={setHideInfeasible}
            active={constraintsActive} constrainedTop={constrainedTop}
            onPick={(id: string) => setSelected(id)} feasibleCount={recs.filter(feasible).length}
          />

          <Workbench
            rows={rows} selected={selected} onSelect={setSelected}
            sortKey={sortKey} setSortKey={setSortKey}
            categories={categories} catFilter={catFilter} setCatFilter={setCatFilter}
            feasible={feasible} constraintsActive={constraintsActive}
          />

          {selRec && (
            <div className="grid lg:grid-cols-[1fr_1.1fr] gap-5">
              <DecisionScoreBreakdown rec={selRec} />
              <WhyWon rec={selRec} recommended={recommended} />
            </div>
          )}

          {selRec && <AlternativesConsidered recs={recs} selRec={selRec} onSelect={setSelected} approvals={approvals} onApprove={setApprove} />}

          <JourneyComparison journey={journey} rec={selRec} product={product} />

          {detail && selRec && <BaselineVsFuture detail={detail} />}

          <AlternativesEvaluated recs={recs} selected={selected} onSelect={setSelected} />

          {selRec && (
            <Card>
              <CardBody className="flex items-center justify-between flex-wrap gap-3">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Build the full financial case for <span className="font-semibold text-ink-900 dark:text-white">{selRec.name}</span>:
                  true cost of switching, working capital, risk-adjusted NPV and payback.
                </div>
                <Link href={`/transition?s=${selRec.scenario_id}`}>
                  <Button>Open Financial Case →</Button>
                </Link>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

/* ── Recommendation Summary (spec §141) ─────────────────────────────────────── */
function RecommendationSummary({ rec, total, approval, onApprove }: { rec: any; total: number; approval?: string; onApprove: (id: string, v: string) => void }) {
  if (!rec) return null;
  const b = rec.baseline, f = rec.future_state;
  const chg = changeOf(rec);
  return (
    <Card className="border-brand/30 dark:border-cyan-400/30 bg-gradient-to-br from-brand-50/60 to-transparent dark:from-cyan-500/5">
      <CardBody>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="green">★ Recommended (emissions-first)</Badge>
              <Badge variant={CAT_VARIANT[rec.category] ?? "slate"}>{rec.category}</Badge>
              <Badge variant={VERDICT_VARIANT[rec.verdict]}>{VERDICT_LABEL[rec.verdict]}</Badge>
            </div>
            <div className="text-xl font-bold text-ink-900 dark:text-white">{rec.name}</div>
            <div className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">{rec.rationale}</div>
          </div>
          <div className="text-center shrink-0">
            <div className={`text-5xl font-extrabold numeric ${scoreColor(rec.decision_score)}`}>{Math.round(rec.decision_score)}</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mt-1">Decision Score</div>
          </div>
        </div>

        {/* what we're changing in the end-to-end flow + approval action */}
        <div className="flex items-center justify-between gap-3 flex-wrap mt-3 rounded-lg border border-slate-200/70 dark:border-slate-700/60 px-3 py-2 bg-white/60 dark:bg-slate-900/40">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Change</span>
            <Badge variant="slate">{chg.lever}</Badge>
            {chg.from && chg.to && (
              <span className="font-medium text-ink-900 dark:text-white">{chg.from} <span className="text-brand dark:text-cyan-400">→</span> {chg.to}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Your decision:</span>
            <ApprovalBar id={rec.scenario_id} value={approval} onSet={onApprove} />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          <MiniStat label="Annual Savings" value={fmtUSD(rec.annual_savings_usd)} good={rec.annual_savings_usd >= 0} />
          <MiniStat label="Emissions" value={`${rec.emissions_reduction_pct >= 0 ? "−" : "+"}${fmtNum(Math.abs(rec.emissions_reduction_pct), 1)}%`} good={rec.emissions_reduction_pct >= 0} />
          <MiniStat label="Lead Time" value={`${rec.transit_impact_days >= 0 ? "+" : ""}${fmtNum(rec.transit_impact_days, 1)} d`} good={rec.transit_impact_days <= 0} />
          <MiniStat label="Investment" value={fmtUSD(rec.investment_usd)} good={rec.investment_usd === 0} neutral />
          <MiniStat label="Risk Score" value={`${fmtNum(rec.risk_score)} · ${rec.risk_rating}`} good={rec.risk_score < 35} neutral={rec.risk_score >= 35 && rec.risk_score < 65} />
        </div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">
          Selected as the best balanced outcome among {total} evaluated alternatives · baseline {fmtUSD(b?.annual_freight_usd)} freight / {fmtCO2(b?.annual_co2e)} → future {fmtUSD(f?.annual_freight_usd)} / {fmtCO2(f?.annual_co2e)}.
        </div>
      </CardBody>
    </Card>
  );
}

/* ── Scenario Context (spec §140) ───────────────────────────────────────────── */
function ScenarioContext({ rec, detail }: { rec: any; detail: any }) {
  const b = rec.baseline;
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
        Scenario Context · {rec.name}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <KPI label="Current Freight" value={fmtUSD(b.annual_freight_usd)} accent="blue" />
        <KPI label="Current Emissions" value={fmtCO2(b.annual_co2e)} accent="green" />
        <KPI label="Lead Time" value={`${fmtNum(b.weighted_transit_days, 1)} d`} />
        <KPI label="OTIF" value={fmtPct(b.weighted_otif_pct)} />
        <KPI label="Annual Savings" value={fmtUSD(rec.annual_savings_usd)} accent={rec.annual_savings_usd >= 0 ? "green" : "red"} />
        <KPI label="Emission Reduction" value={fmtPct(rec.emissions_reduction_pct)} accent="green" />
        <KPI label="Investment" value={fmtUSD(rec.investment_usd)} accent="amber" />
        <KPI label="Decision Score" value={`${Math.round(rec.decision_score)}/100`} accent="blue" desc={rec.category} />
      </div>
    </div>
  );
}

/* ── Constraints Engine (spec §32 / §147–148) ───────────────────────────────── */
function ConstraintsPanel(props: any) {
  const { maxLead, setMaxLead, maxCost, setMaxCost, minEm, setMinEm,
    hideInfeasible, setHideInfeasible, active, constrainedTop, onPick, feasibleCount } = props;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Optimization Constraints</CardTitle>
        <div className="text-[11px] text-slate-400">Filter alternatives to those that respect the business guardrails</div>
      </CardHeader>
      <CardBody className="grid md:grid-cols-4 gap-4 items-end">
        <Field label={`Max lead-time increase: ${maxLead >= 99 ? "any" : `${maxLead} d`}`}>
          <input type="range" min={0} max={20} value={Math.min(maxLead, 20)} onChange={(e) => setMaxLead(Number(e.target.value) >= 20 ? 99 : Number(e.target.value))} className="w-full accent-brand" />
        </Field>
        <Field label={`Max cost increase: ${maxCost >= 99 ? "any" : `${maxCost}%`}`}>
          <input type="range" min={-10} max={20} value={Math.min(maxCost, 20)} onChange={(e) => setMaxCost(Number(e.target.value) >= 20 ? 99 : Number(e.target.value))} className="w-full accent-brand" />
        </Field>
        <Field label={`Min emission reduction: ${minEm}%`}>
          <input type="range" min={0} max={40} value={minEm} onChange={(e) => setMinEm(Number(e.target.value))} className="w-full accent-brand" />
        </Field>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
            <input type="checkbox" checked={hideInfeasible} onChange={(e) => setHideInfeasible(e.target.checked)} className="accent-brand" />
            Hide infeasible alternatives
          </label>
          <Button size="sm" variant="secondary" onClick={() => { setMaxLead(99); setMaxCost(99); setMinEm(0); setHideInfeasible(false); }}>Reset</Button>
        </div>
      </CardBody>
      {active && (
        <div className="px-5 pb-4 -mt-1">
          {constrainedTop ? (
            <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2 flex-wrap">
              <Badge variant="green">Constrained pick</Badge>
              <span className="font-semibold text-ink-900 dark:text-white">{constrainedTop.name}</span>
              <span>(score {Math.round(constrainedTop.decision_score)}, {fmtPct(constrainedTop.emissions_reduction_pct)} emissions, {fmtUSD(constrainedTop.annual_savings_usd)} savings)</span>
              <button className="text-brand dark:text-cyan-400 underline" onClick={() => onPick(constrainedTop.scenario_id)}>select</button>
              <span className="text-slate-400">· {feasibleCount} of alternatives feasible</span>
            </div>
          ) : (
            <div className="text-xs text-danger">No alternative satisfies all constraints — relax a guardrail.</div>
          )}
        </div>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1.5">{label}</div>
      {children}
    </div>
  );
}

/* ── Alternative Comparison Workbench (spec §143) ───────────────────────────── */
function Workbench({ rows, selected, onSelect, sortKey, setSortKey, categories, catFilter, setCatFilter, feasible, constraintsActive }: any) {
  const cols: { key: SortKey; label: string; align?: string }[] = [
    { key: "rank", label: "#" },
    { key: "decision_score", label: "Score", align: "right" },
    { key: "cost_impact_pct", label: "Cost Δ", align: "right" },
    { key: "emissions_reduction_pct", label: "Emissions", align: "right" },
    { key: "transit_impact_days", label: "Lead Δ", align: "right" },
    { key: "risk_score", label: "Risk", align: "right" },
    { key: "investment_usd", label: "Investment", align: "right" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alternative Comparison Workbench</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="py-1.5 text-xs">
            {categories.map((c: string) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-slate-950 z-10">
              <tr className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                {cols.map((c) => (
                  <th key={c.key} className={`px-3 py-2.5 ${c.align === "right" ? "text-right" : "text-left"} cursor-pointer hover:text-ink-900 dark:hover:text-white ${sortKey === c.key ? "text-brand dark:text-cyan-400" : ""}`} onClick={() => setSortKey(c.key)}>
                    {c.label}{sortKey === c.key ? " ↓" : ""}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left">Scenario</th>
                <th className="px-3 py-2.5 text-left">Category</th>
                <th className="px-3 py-2.5 text-center">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => {
                const ok = feasible(r);
                const sel = r.scenario_id === selected;
                return (
                  <tr key={r.scenario_id}
                    onClick={() => onSelect(r.scenario_id)}
                    className={`border-b border-slate-50 dark:border-slate-900 cursor-pointer transition-colors ${
                      sel ? "bg-brand-50 dark:bg-cyan-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-900/60"
                    } ${constraintsActive && !ok ? "opacity-40" : ""}`}>
                    <td className="px-3 py-2.5 text-slate-400 numeric">{r.rank}</td>
                    <td className={`px-3 py-2.5 text-right font-bold numeric ${scoreColor(r.decision_score)}`}>{Math.round(r.decision_score)}</td>
                    <td className={`px-3 py-2.5 text-right numeric ${r.cost_impact_pct <= 0 ? "text-positive" : "text-danger"}`}>{r.cost_impact_pct > 0 ? "+" : ""}{fmtNum(r.cost_impact_pct, 1)}%</td>
                    <td className={`px-3 py-2.5 text-right numeric ${r.emissions_reduction_pct >= 0 ? "text-positive" : "text-danger"}`}>{r.emissions_reduction_pct >= 0 ? "−" : "+"}{fmtNum(Math.abs(r.emissions_reduction_pct), 1)}%</td>
                    <td className={`px-3 py-2.5 text-right numeric ${r.transit_impact_days <= 0 ? "text-positive" : "text-slate-500 dark:text-slate-400"}`}>{r.transit_impact_days > 0 ? "+" : ""}{fmtNum(r.transit_impact_days, 1)}d</td>
                    <td className="px-3 py-2.5 text-right numeric text-slate-600 dark:text-slate-400">{fmtNum(r.risk_score)}</td>
                    <td className="px-3 py-2.5 text-right numeric text-slate-600 dark:text-slate-400">{fmtUSD(r.investment_usd)}</td>
                    <td className="px-3 py-2.5 font-medium text-ink-900 dark:text-white max-w-[230px] truncate">{r.name}</td>
                    <td className="px-3 py-2.5"><Badge variant={CAT_VARIANT[r.category] ?? "slate"}>{r.category}</Badge></td>
                    <td className="px-3 py-2.5 text-center"><Badge variant={VERDICT_VARIANT[r.verdict]}>{VERDICT_LABEL[r.verdict]}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

/* ── Decision Score breakdown (spec §155–160) ───────────────────────────────── */
function DecisionScoreBreakdown({ rec }: { rec: any }) {
  const s = rec.sub_scores ?? {};
  const dims = [
    { k: "sustainability", label: "Sustainability", w: "35%" },
    { k: "financial", label: "Financial", w: "25%" },
    { k: "operational", label: "Operational", w: "15%" },
    { k: "risk", label: "Risk", w: "15%" },
    { k: "strategic", label: "Strategic", w: "10%" },
  ];
  return (
    <Card>
      <CardHeader><CardTitle>Decision Score Composition</CardTitle><div className="text-[11px] text-slate-400">0–100 weighted</div></CardHeader>
      <CardBody className="space-y-3">
        {dims.map((d) => {
          const v = s[d.k] ?? 0;
          return (
            <div key={d.k}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 dark:text-slate-400">{d.label} <span className="text-slate-400">· {d.w}</span></span>
                <span className="font-semibold numeric text-ink-900 dark:text-white">{fmtNum(v)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-600 dark:from-cyan-400 dark:to-cyan-600" style={{ width: `${Math.max(2, Math.min(100, v))}%` }} />
              </div>
            </div>
          );
        })}
        <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-sm font-semibold text-ink-900 dark:text-white">Composite Decision Score</span>
          <span className={`text-2xl font-bold numeric ${scoreColor(rec.decision_score)}`}>{Math.round(rec.decision_score)}</span>
        </div>
      </CardBody>
    </Card>
  );
}

/* ── Why This Scenario Won (spec §144) ──────────────────────────────────────── */
function WhyWon({ rec, recommended }: { rec: any; recommended: any }) {
  const isTop = recommended && rec.scenario_id === recommended.scenario_id;
  return (
    <Card>
      <CardHeader><CardTitle>{isTop ? "Why This Scenario Won" : "Why This Ranks #" + rec.rank}</CardTitle></CardHeader>
      <CardBody className="space-y-3 text-sm">
        <p className="text-slate-700 dark:text-slate-300">{rec.rationale}</p>
        <ul className="space-y-1.5 text-slate-600 dark:text-slate-400">
          <li className="flex justify-between"><span>Emissions reduction</span><span className={`font-semibold ${rec.emissions_reduction_pct >= 0 ? "text-positive" : "text-danger"}`}>{fmtPct(rec.emissions_reduction_pct)}</span></li>
          <li className="flex justify-between"><span>Cost impact</span><span className={`font-semibold ${rec.cost_impact_pct <= 0 ? "text-positive" : "text-danger"}`}>{rec.cost_impact_pct > 0 ? "+" : ""}{fmtNum(rec.cost_impact_pct, 1)}%</span></li>
          <li className="flex justify-between"><span>Lead-time change</span><span className="font-semibold text-ink-900 dark:text-white">{rec.transit_impact_days > 0 ? "+" : ""}{fmtNum(rec.transit_impact_days, 1)} days</span></li>
          <li className="flex justify-between"><span>Investment required</span><span className="font-semibold text-ink-900 dark:text-white">{fmtUSD(rec.investment_usd)}</span></li>
          <li className="flex justify-between"><span>Execution risk</span><span className="font-semibold text-ink-900 dark:text-white">{rec.risk_rating} ({fmtNum(rec.risk_score)})</span></li>
        </ul>
        {!isTop && (
          <div className="text-xs bg-danger/5 dark:bg-danger/10 border border-danger/20 rounded-lg p-3 text-danger">
            Not the default recommendation — {rec.rejected_reason}.
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* ── End-to-End Journey Comparison (spec §149–150) ──────────────────────────── */
function JourneyComparison({ journey, rec, product }: { journey: any; rec: any; product: string }) {
  const tces: any[] = journey?.tces ?? [];
  const redFrac = rec ? rec.emissions_reduction_pct / 100 : 0;
  const costFrac = rec ? rec.cost_impact_pct / 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>End-to-End Journey — what we're changing</CardTitle>
        <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
          <span>Representative {product} journey · {rec?.name ?? "selected scenario"}</span>
          {rec && (() => { const c = changeOf(rec); return c.from && c.to ? <Badge variant="blue">{c.lever}: {c.from} → {c.to}</Badge> : <Badge variant="slate">{c.lever} change</Badge>; })()}
        </div>
      </CardHeader>
      <CardBody>
        {tces.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-sm">Loading representative journey…</div>
        ) : (
          <div className="space-y-4">
            <JourneyRow label="Current" tces={tces} redFrac={0} costFrac={0} tone="slate" />
            <JourneyRow label="Future" tces={tces} redFrac={redFrac} costFrac={costFrac} tone="brand" />
            <div className="text-[11px] text-slate-400 dark:text-slate-500">
              Transport-leg cost and emissions re-scaled by the selected scenario's headline deltas; handling and packaging held constant. Stage deltas shown per leg.
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function JourneyRow({ label, tces, redFrac, costFrac, tone }: { label: string; tces: any[]; redFrac: number; costFrac: number; tone: "slate" | "brand" }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">{label} state</div>
      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {tces.map((t, i) => {
          const co2 = (t.per_unit_transport_kg_co2e ?? 0) * (1 - redFrac) + (t.per_unit_handling_kg_co2e ?? 0);
          const cost = (t.per_unit_cost_usd ?? 0) * (1 + costFrac);
          return (
            <div key={i} className="flex items-center gap-1 shrink-0">
              <div className={`rounded-lg border px-3 py-2 min-w-[140px] ${tone === "brand" ? "border-brand/30 bg-brand-50/50 dark:border-cyan-400/30 dark:bg-cyan-500/5" : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50"}`}>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">{t.segment}</div>
                <div className="text-xs font-semibold text-ink-900 dark:text-white truncate max-w-[150px]">{t.origin} → {t.destination}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{t.mode} · {fmtNum(t.transit_days, 1)}d</div>
                <div className="flex justify-between text-[11px] mt-1">
                  <span className="text-brand dark:text-cyan-400 numeric">{fmtUSD(cost)}</span>
                  <span className="text-positive numeric">{fmtNum(co2, 2)} kg</span>
                </div>
              </div>
              {i < tces.length - 1 && <span className="text-slate-300 dark:text-slate-600">→</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Baseline vs Future charts ──────────────────────────────────────────────── */
function BaselineVsFuture({ detail }: { detail: any }) {
  const b = detail.baseline, f = detail.future_state;
  const cost = [
    { name: "Freight $", Baseline: b.annual_freight_usd, Future: f.annual_freight_usd },
    { name: "Landed $", Baseline: b.annual_landed_cost_usd, Future: f.annual_landed_cost_usd },
  ];
  const co2 = [{ name: "CO₂e (t)", Baseline: b.annual_co2e, Future: f.annual_co2e }];
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card>
        <CardHeader><CardTitle>Cost: Baseline vs Future</CardTitle></CardHeader>
        <CardBody>
          <BarChartCard data={cost} x="name" currency height={200}
            bars={[{ key: "Baseline", name: "Baseline", color: "#94a3b8" }, { key: "Future", name: "Future State", color: "#1d4ed8" }]} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader><CardTitle>Emissions: Baseline vs Future</CardTitle></CardHeader>
        <CardBody>
          <BarChartCard data={co2} x="name" height={200}
            bars={[{ key: "Baseline", name: "Baseline", color: "#94a3b8" }, { key: "Future", name: "Future State", color: "#0e9f6e" }]} />
        </CardBody>
      </Card>
    </div>
  );
}

// Five lever sub-scores as a compact sparkline (Sustainability·Financial·Operational·Risk·Strategic).
function LeverBars({ s }: { s: any }) {
  const dims = [
    { k: "sustainability", c: "#0e9f6e" }, { k: "financial", c: "#1d4ed8" },
    { k: "operational", c: "#6366f1" }, { k: "risk", c: "#d97706" }, { k: "strategic", c: "#8b5cf6" },
  ];
  return (
    <div className="flex items-end justify-center gap-0.5 h-7" title="Sustainability · Financial · Operational · Risk · Strategic">
      {dims.map((d) => {
        const v = Math.max(0, Math.min(100, s?.[d.k] ?? 0));
        return <div key={d.k} className="w-1.5 rounded-sm" style={{ height: `${Math.max(8, v)}%`, background: d.c, opacity: 0.85 }} />;
      })}
    </div>
  );
}

/* ── Alternatives Considered for THIS recommendation (same decision family) ──
   e.g. when "Ocean → Rail Modal Shift" is selected, every other modal-shift option
   (Ocean → Air, Road → Rail, Air → Ocean …) is shown, best floated to the top. ── */
function AlternativesConsidered({ recs, selRec, onSelect, approvals, onApprove }: { recs: any[]; selRec: any; onSelect: (id: string) => void; approvals: Record<string, string>; onApprove: (id: string, v: string) => void }) {
  // emissions-first within the family (spec §13) — best emissions reduction floats to top.
  const family = useMemo(
    () => recs.filter((r) => r.type === selRec.type).sort((a, b) => b.emissions_reduction_pct - a.emissions_reduction_pct),
    [recs, selRec.type],
  );
  if (family.length <= 1) return null;
  const best = family[0];
  const label = TYPE_LABEL[selRec.type] ?? "Optimization";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alternatives Considered — {label}</CardTitle>
        <div className="text-[11px] text-slate-400">{family.length} options in this decision family · best floated to top</div>
      </CardHeader>
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <th className="px-3 py-2.5 text-left">Option · flow change</th>
              <th className="px-3 py-2.5 text-center">Levers (S·F·O·R·St)</th>
              <th className="px-3 py-2.5 text-right">Emissions</th>
              <th className="px-3 py-2.5 text-right">Cost Δ</th>
              <th className="px-3 py-2.5 text-right">Lead Δ</th>
              <th className="px-3 py-2.5 text-right">Score</th>
              <th className="px-3 py-2.5 text-center">Decision</th>
            </tr></thead>
            <tbody>
              {family.map((r, i) => {
                const isBest = i === 0;
                const isSel = r.scenario_id === selRec.scenario_id;
                const chg = changeOf(r);
                return (
                  <tr key={r.scenario_id} onClick={() => onSelect(r.scenario_id)}
                    className={`border-b border-slate-50 dark:border-slate-900 cursor-pointer transition-colors ${isSel ? "bg-brand-50 dark:bg-cyan-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-900/60"}`}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {isBest && <span className="text-positive" title="Best in family">★</span>}
                        <span className="font-medium text-ink-900 dark:text-white">{r.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{chg.from && chg.to ? <>{chg.from} <span className="text-brand dark:text-cyan-400">→</span> {chg.to}</> : chg.lever + " change"}{!isBest && <> · {r.rejected_reason}</>}</div>
                    </td>
                    <td className="px-3 py-2.5"><LeverBars s={r.sub_scores} /></td>
                    <td className="px-3 py-2.5 text-right numeric text-positive">−{fmtNum(r.emissions_reduction_pct, 1)}%</td>
                    <td className={`px-3 py-2.5 text-right numeric ${r.cost_impact_pct <= 0 ? "text-positive" : "text-danger"}`}>{r.cost_impact_pct > 0 ? "+" : ""}{fmtNum(r.cost_impact_pct, 1)}%</td>
                    <td className="px-3 py-2.5 text-right numeric text-slate-600 dark:text-slate-400">{r.transit_impact_days > 0 ? "+" : ""}{fmtNum(r.transit_impact_days, 1)}d</td>
                    <td className={`px-3 py-2.5 text-right font-bold numeric ${scoreColor(r.decision_score)}`}>{Math.round(r.decision_score)}</td>
                    <td className="px-3 py-2.5 text-center"><ApprovalBar id={r.scenario_id} value={approvals[r.scenario_id]} onSet={onApprove} size="xs" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

/* ── Alternatives Evaluated / Rejected reasons (spec §154 / §222) ───────────── */
function AlternativesEvaluated({ recs, selected, onSelect }: { recs: any[]; selected: string | null; onSelect: (id: string) => void }) {
  const top = recs.slice(0, 6);
  const rejected = recs.filter((r) => r.category === "Rejected").slice(0, 5);
  return (
    <Card>
      <CardHeader><CardTitle>Alternatives Evaluated — Transparency</CardTitle><div className="text-[11px] text-slate-400">click any scenario to compare the options within its decision family</div></CardHeader>
      <CardBody className="grid lg:grid-cols-2 gap-6">
        <div>
          <div className="text-xs font-semibold text-positive uppercase tracking-wide mb-2">Top considered</div>
          <div className="space-y-2">
            {top.map((r) => (
              <button key={r.scenario_id} onClick={() => onSelect(r.scenario_id)}
                className={`w-full text-left flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors ${selected === r.scenario_id ? "border-brand/40 bg-brand-50 dark:bg-cyan-500/10" : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/60"}`}>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink-900 dark:text-white truncate">#{r.rank} {r.name}</div>
                  <div className="text-[11px] text-slate-400">{r.category} · {fmtPct(r.emissions_reduction_pct)} emissions · {fmtUSD(r.annual_savings_usd)} savings</div>
                </div>
                <span className={`font-bold numeric ${scoreColor(r.decision_score)}`}>{Math.round(r.decision_score)}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-danger uppercase tracking-wide mb-2">Rejected — and why</div>
          <div className="space-y-2">
            {rejected.length === 0 && <div className="text-xs text-slate-400">No alternatives were outright rejected at this carbon price.</div>}
            {rejected.map((r) => (
              <button key={r.scenario_id} onClick={() => onSelect(r.scenario_id)}
                className={`w-full text-left flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors ${selected === r.scenario_id ? "border-danger/50 bg-danger/10" : "border-danger/20 bg-danger/5 dark:bg-danger/10 hover:bg-danger/10"}`}>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink-900 dark:text-white truncate">{r.name}</div>
                  <div className="text-[11px] text-danger">{r.rejected_reason} · compare options →</div>
                </div>
                <span className="font-bold numeric text-danger">{Math.round(r.decision_score)}</span>
              </button>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function MiniStat({ label, value, good, neutral }: { label: string; value: string; good?: boolean; neutral?: boolean }) {
  const color = neutral ? "text-ink-900 dark:text-white" : good ? "text-positive" : "text-danger";
  return (
    <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`text-base font-bold numeric mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}
