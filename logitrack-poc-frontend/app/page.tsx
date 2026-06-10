"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, fmtUSD, fmtCO2, fmtNum, fmtPct } from "@/lib/api";
import {
  Card, CardHeader, CardTitle, CardBody, KPI, PageHeader, Spinner, ApiError, Badge, Button, Segmented,
} from "@/components/ui";
import { BarChartCard, WaterfallBar } from "@/components/charts";

/* ─────────────────────────────────────────────────────────────────────────────
   Module 4 — Executive Decision Hub (LogiTrack V3.0)
   A capital-allocation & decarbonization-prioritization engine. Every card
   answers: "where should we invest next?"
   ──────────────────────────────────────────────────────────────────────────── */

const CARBON_PRICES = [0, 50, 75, 100, 150, 250];

const CAT_VARIANT: Record<string, "green" | "blue" | "amber" | "red" | "slate"> = {
  "Win-Win": "green", "Sustainability First": "blue", "Cost Optimized": "blue",
  "Strategic Transition": "amber", "Balanced": "slate", "Rejected": "red",
};
const VERDICT_VARIANT: Record<string, "green" | "blue" | "amber" | "red"> = {
  APPROVE: "green", PILOT: "blue", CONDITIONAL: "amber", DECLINE: "red",
};
const VERDICT_LABEL: Record<string, string> = {
  APPROVE: "Approve", PILOT: "Pilot", CONDITIONAL: "Conditional", DECLINE: "Reject",
};
const QUEUE_NEXT: Record<string, string> = { APPROVE: "PILOT", PILOT: "DECLINE", CONDITIONAL: "APPROVE", DECLINE: "APPROVE" };

function scoreColor(s: number) {
  return s >= 80 ? "text-positive" : s >= 65 ? "text-brand dark:text-cyan-400" : s >= 50 ? "text-warning" : "text-danger";
}

export default function DecisionHub() {
  const [carbon, setCarbon] = useState(75);
  const [hub, setHub] = useState<any>(null);
  const [error, setError] = useState(false);
  const [queue, setQueue] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setError(false); setHub(null);
    api.decisionHub(carbon).then((h) => {
      setHub(h);
      const q: Record<string, string> = {};
      h.scenarios.forEach((s: any) => { q[s.scenario_id] = s.verdict; });
      setQueue(q);
    }).catch(() => setError(true));
  }, [carbon]);

  useEffect(() => { load(); }, [load]);

  const scen: any[] = hub?.scenarios ?? [];
  const approved = useMemo(() => scen.filter((s) => s.verdict === "APPROVE" || s.verdict === "PILOT"), [scen]);

  const metrics = useMemo(() => {
    const savings = hub?.portfolio?.total_potential_savings_usd ?? 0;
    const invest = hub?.portfolio?.total_investment_usd ?? 0;
    const emRed = hub?.portfolio?.total_emissions_reduction_co2e ?? 0;
    const npv = approved.reduce((a, s) => a + (s.p50_npv_usd ?? 0), 0);
    const roi = invest > 0 ? (savings / invest) * 100 : 0;
    const carbonAvoided = emRed * carbon;
    const readiness = approved.length ? approved.reduce((a, s) => a + (s.decision_score ?? 0), 0) / approved.length : 0;
    return { savings, invest, emRed, npv, roi, carbonAvoided, readiness };
  }, [hub, approved, carbon]);

  if (error) return <ApiError retry={load} />;
  if (!hub) return <Spinner label="Consolidating portfolio economics across 50 alternatives…" />;

  const rec = hub.recommended_scenario;

  return (
    <>
      <PageHeader
        eyebrow="Module 4 · Capital Allocation"
        title="Executive Decision Hub"
        desc="Prioritize logistics and sustainability investments by business impact, emissions reduction and financial return. Every opportunity competes against every other."
        actions={
          <Segmented options={CARBON_PRICES.map((c) => ({ value: String(c), label: `$${c}` }))} value={String(carbon)} onChange={(v) => setCarbon(Number(v))} />
        }
      />

      {/* Executive KPI strip — 8 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
        <KPI label="Portfolio Savings" value={fmtUSD(metrics.savings)} accent="green" desc="annual, approved" />
        <KPI label="Emissions Reduction" value={fmtCO2(metrics.emRed)} accent="green" desc="annual CO₂e" />
        <KPI label="Investment Required" value={fmtUSD(metrics.invest)} accent="amber" desc="one-time" />
        <KPI label="Portfolio ROI" value={fmtPct(metrics.roi, 0)} accent="blue" desc="benefit ÷ invest" />
        <KPI label="Portfolio NPV" value={fmtUSD(metrics.npv)} accent="blue" desc="Σ P50 NPV" />
        <KPI label="Carbon Cost Avoided" value={fmtUSD(metrics.carbonAvoided)} accent="green" desc={`@ $${carbon}/t`} />
        <KPI label="Scenarios Approved" value={`${approved.length} / ${scen.length}`} desc="approve + pilot" />
        <KPI label="Strategic Readiness" value={fmtNum(metrics.readiness)} accent="blue" desc="avg decision score" />
      </div>

      {/* Opportunity funnel */}
      <Funnel funnel={hub.funnel} />

      {/* Top initiative */}
      {rec && <TopInitiative rec={rec} carbon={carbon} />}

      {/* Prioritization matrix + portfolio sustainability */}
      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-5 mb-6">
        <PrioritizationMatrix scen={scen} />
        <SustainabilityImpact scen={scen} approved={approved} metrics={metrics} carbon={carbon} />
      </div>

      {/* Financial bridge + roadmap */}
      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <FinancialBridge metrics={metrics} />
        <ExecutionRoadmap approved={approved} />
      </div>

      {/* Portfolio ranking */}
      <PortfolioRanking scen={scen} />

      {/* Decision queue */}
      <DecisionQueue scen={scen} queue={queue} setQueue={setQueue} />

      {/* Narrative */}
      <ExecutiveNarrative scen={scen} approved={approved} metrics={metrics} rec={rec} />
    </>
  );
}

/* ── Portfolio Opportunity Funnel (spec §173) ───────────────────────────────── */
function Funnel({ funnel }: { funnel: any }) {
  if (!funnel) return null;
  const stages = [
    { k: "all_opportunities", label: "All opportunities" },
    { k: "viable", label: "Viable" },
    { k: "recommended", label: "Recommended" },
    { k: "approved", label: "Approved" },
    { k: "in_execution", label: "In execution" },
  ];
  const max = funnel.all_opportunities || 1;
  return (
    <Card className="mb-6">
      <CardHeader><CardTitle>Portfolio Opportunity Funnel</CardTitle><div className="text-[11px] text-slate-400">How 50 evaluated alternatives narrow to a fundable set</div></CardHeader>
      <CardBody className="grid grid-cols-5 gap-2">
        {stages.map((s, i) => {
          const v = funnel[s.k] ?? 0;
          const w = Math.max(18, (v / max) * 100);
          return (
            <div key={s.k} className="flex flex-col items-center">
              <div className="w-full flex justify-center" style={{ height: 64 }}>
                <div className="rounded-lg bg-gradient-to-b from-brand to-brand-600 dark:from-cyan-400 dark:to-cyan-600 flex items-center justify-center text-white font-bold text-lg transition-all" style={{ width: `${w}%`, opacity: 1 - i * 0.13 }}>
                  {v}
                </div>
              </div>
              <div className="text-[11px] text-center text-slate-500 dark:text-slate-400 mt-2">{s.label}</div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

/* ── Top Recommended Initiative (spec §174–175) ─────────────────────────────── */
function TopInitiative({ rec, carbon }: { rec: any; carbon: number }) {
  return (
    <Card className="mb-6 border-brand/30 dark:border-cyan-400/30 bg-gradient-to-br from-brand-50/60 to-transparent dark:from-cyan-500/5">
      <CardBody>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="green">★ Best Portfolio Opportunity</Badge>
              <Badge variant={CAT_VARIANT[rec.category] ?? "slate"}>{rec.category}</Badge>
              <Badge variant={VERDICT_VARIANT[rec.verdict]}>{VERDICT_LABEL[rec.verdict]}</Badge>
            </div>
            <div className="text-2xl font-bold text-ink-900 dark:text-white">{rec.name}</div>
            <div className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">{rec.rationale}</div>
          </div>
          <div className="text-center shrink-0">
            <div className={`text-5xl font-extrabold numeric ${scoreColor(rec.decision_score)}`}>{Math.round(rec.decision_score)}</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mt-1">Decision Score</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-4">
          <Mini label="Annual Savings" value={fmtUSD(rec.annual_savings_usd)} />
          <Mini label="Emission Reduction" value={fmtPct(rec.emissions_reduction_pct)} />
          <Mini label="P50 NPV" value={fmtUSD(rec.p50_npv_usd)} />
          <Mini label="Investment" value={fmtUSD(rec.investment_usd)} />
          <Mini label="Payback" value={rec.payback_month ? `Month ${rec.payback_month}` : "N/A"} />
          <Mini label="Carbon Avoided" value={fmtUSD(Math.max(0, -rec.emissions_impact_co2e) * carbon)} />
        </div>
        <Link href={`/transition?s=${rec.scenario_id}`} className="inline-block mt-4 text-sm text-brand dark:text-cyan-400 font-semibold hover:underline">
          View full transition economics →
        </Link>
      </CardBody>
    </Card>
  );
}

/* ── Investment Prioritization Matrix (spec §176–177) ───────────────────────── */
function PrioritizationMatrix({ scen }: { scen: any[] }) {
  const pts = scen.filter((s) => s.investment_usd >= 0);
  const maxInv = Math.max(...pts.map((s) => s.investment_usd), 1);
  const maxBen = Math.max(...pts.map((s) => Math.max(0, s.annual_savings_usd)), 1);
  const maxEm = Math.max(...pts.map((s) => Math.max(0, -s.emissions_impact_co2e)), 1);
  const medInv = maxInv * 0.4;

  function color(s: number) {
    return s >= 80 ? "#10b981" : s >= 65 ? "#1d4ed8" : s >= 50 ? "#f59e0b" : "#ef4444";
  }

  return (
    <Card>
      <CardHeader><CardTitle>Investment Prioritization Matrix</CardTitle><div className="text-[11px] text-slate-400">benefit × investment · size = emissions · color = decision score</div></CardHeader>
      <CardBody>
        <div className="relative w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40" style={{ height: 340 }}>
          {/* quadrant guides */}
          <div className="absolute inset-0">
            <div className="absolute left-[40%] top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="absolute top-[50%] left-0 right-0 h-px bg-slate-200 dark:bg-slate-700" />
            <span className="absolute left-2 top-2 text-[10px] font-semibold text-positive">Quick Wins</span>
            <span className="absolute right-2 top-2 text-[10px] font-semibold text-warning">Strategic Bets</span>
            <span className="absolute left-2 bottom-2 text-[10px] text-slate-400">Optional</span>
            <span className="absolute right-2 bottom-2 text-[10px] text-danger">Avoid</span>
          </div>
          {pts.map((s) => {
            const x = 6 + (s.investment_usd / maxInv) * 86;
            const ben = Math.max(0, s.annual_savings_usd);
            const y = 90 - (ben / maxBen) * 82;
            const size = 8 + (Math.max(0, -s.emissions_impact_co2e) / maxEm) * 26;
            return (
              <div key={s.scenario_id} title={`${s.name}\nInvest ${fmtUSD(s.investment_usd)} · Benefit ${fmtUSD(ben)} · Score ${Math.round(s.decision_score)}`}
                className="absolute rounded-full border border-white/60 dark:border-black/40 -translate-x-1/2 -translate-y-1/2 hover:ring-2 hover:ring-brand/40 transition-all cursor-pointer"
                style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, background: color(s.decision_score), opacity: 0.78 }} />
            );
          })}
          <span className="absolute -bottom-0 right-2 text-[9px] text-slate-400">investment →</span>
        </div>
        <div className="flex gap-3 mt-2 flex-wrap text-[10px] text-slate-500 dark:text-slate-400">
          {[["#10b981", "Approve 80+"], ["#1d4ed8", "Pilot 65+"], ["#f59e0b", "Conditional 50+"], ["#ef4444", "Reject"]].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />{l}</span>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

/* ── Portfolio Sustainability Impact + reduction by lever (spec §179–180) ────── */
function SustainabilityImpact({ scen, approved, metrics, carbon }: any) {
  const byLever = useMemo(() => {
    const m: Record<string, number> = {};
    approved.forEach((s: any) => {
      const k = s.recommendation_category ?? s.lever ?? "Other";
      m[k] = (m[k] ?? 0) + Math.max(0, -s.emissions_impact_co2e);
    });
    return Object.entries(m).map(([name, v]) => ({ name, Reduction: Math.round(v) })).sort((a, b) => b.Reduction - a.Reduction);
  }, [approved]);

  return (
    <Card>
      <CardHeader><CardTitle>Portfolio Sustainability Impact</CardTitle></CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Mini label="Annual Reduction" value={fmtCO2(metrics.emRed)} />
          <Mini label="Carbon Cost Avoided" value={fmtUSD(metrics.carbonAvoided)} />
          <Mini label="Approved Levers" value={String(byLever.length)} />
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Where decarbonization comes from</div>
          {byLever.length > 0
            ? <BarChartCard data={byLever} x="name" height={190} bars={[{ key: "Reduction", name: "tCO₂e reduced", color: "#0e9f6e" }]} />
            : <div className="py-6 text-center text-slate-400 text-sm">No approved initiatives at this carbon price</div>}
        </div>
      </CardBody>
    </Card>
  );
}

/* ── Financial Bridge (spec §181) ───────────────────────────────────────────── */
function FinancialBridge({ metrics }: { metrics: any }) {
  // WaterfallBar: negative = savings (green), positive = cost (red)
  const data = [
    { name: "Freight & landed savings", value: -metrics.savings },
    { name: "Carbon cost avoided", value: -metrics.carbonAvoided },
    { name: "Transition investment (one-time)", value: metrics.invest },
  ];
  const net = metrics.savings + metrics.carbonAvoided;
  return (
    <Card>
      <CardHeader><CardTitle>Portfolio Financial Bridge</CardTitle><div className="text-[11px] text-slate-400">annual benefit vs one-time investment</div></CardHeader>
      <CardBody>
        <WaterfallBar data={data} />
        <div className="flex justify-between items-center pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-sm font-semibold text-ink-900 dark:text-white">Net annual benefit</span>
          <span className="text-xl font-bold numeric text-positive">{fmtUSD(net)}</span>
        </div>
      </CardBody>
    </Card>
  );
}

/* ── Execution Roadmap (spec §182) ──────────────────────────────────────────── */
function ExecutionRoadmap({ approved }: { approved: any[] }) {
  const quarters = ["Q1", "Q2", "Q3", "Q4"];
  // assign approved initiatives to quarters by decision score (quick wins first)
  const sorted = approved.slice().sort((a, b) => b.decision_score - a.decision_score).slice(0, 8);
  const buckets: Record<string, any[]> = { Q1: [], Q2: [], Q3: [], Q4: [] };
  sorted.forEach((s, i) => buckets[quarters[i % 4]].push(s));
  return (
    <Card>
      <CardHeader><CardTitle>Execution Roadmap</CardTitle><div className="text-[11px] text-slate-400">approved initiatives sequenced across the year</div></CardHeader>
      <CardBody className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quarters.map((q) => (
          <div key={q} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 min-h-[120px]">
            <div className="text-xs font-bold text-brand dark:text-cyan-400 mb-2">{q}</div>
            <div className="space-y-1.5">
              {buckets[q].length === 0 && <div className="text-[11px] text-slate-400">—</div>}
              {buckets[q].map((s) => (
                <div key={s.scenario_id} className="text-[11px] text-slate-700 dark:text-slate-300 leading-tight">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-slate-400"> · {fmtUSD(s.annual_savings_usd)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

/* ── Scenario Portfolio Ranking (spec §178) ─────────────────────────────────── */
function PortfolioRanking({ scen }: { scen: any[] }) {
  return (
    <Card className="mb-6">
      <CardHeader><CardTitle>Scenario Portfolio Ranking</CardTitle><Badge variant="blue">{scen.length} evaluated · ranked by Decision Score</Badge></CardHeader>
      <CardBody className="p-0">
        <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-slate-950 z-10">
              <tr className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="px-3 py-2.5 text-left">#</th>
                <th className="px-3 py-2.5 text-left">Scenario</th>
                <th className="px-3 py-2.5 text-left">Category</th>
                <th className="px-3 py-2.5 text-right">Savings</th>
                <th className="px-3 py-2.5 text-right">Emissions</th>
                <th className="px-3 py-2.5 text-right">Investment</th>
                <th className="px-3 py-2.5 text-right">P50 NPV</th>
                <th className="px-3 py-2.5 text-right">Payback</th>
                <th className="px-3 py-2.5 text-right">Score</th>
                <th className="px-3 py-2.5 text-center">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {scen.map((s, i) => (
                <tr key={s.scenario_id} className="border-b border-slate-50 dark:border-slate-900 hover:bg-slate-50 dark:hover:bg-slate-900/60">
                  <td className="px-3 py-2 text-slate-400 numeric">{i + 1}</td>
                  <td className="px-3 py-2"><Link href={`/transition?s=${s.scenario_id}`} className="font-medium text-ink-900 dark:text-white hover:text-brand dark:hover:text-cyan-400 max-w-[220px] truncate inline-block align-bottom">{s.name}</Link></td>
                  <td className="px-3 py-2"><Badge variant={CAT_VARIANT[s.category] ?? "slate"}>{s.category}</Badge></td>
                  <td className="px-3 py-2 text-right numeric text-ink-900 dark:text-white">{fmtUSD(s.annual_savings_usd)}</td>
                  <td className="px-3 py-2 text-right numeric text-positive">{fmtPct(s.emissions_reduction_pct)}</td>
                  <td className="px-3 py-2 text-right numeric text-slate-600 dark:text-slate-400">{fmtUSD(s.investment_usd)}</td>
                  <td className="px-3 py-2 text-right numeric font-semibold text-brand dark:text-cyan-400">{fmtUSD(s.p50_npv_usd)}</td>
                  <td className="px-3 py-2 text-right numeric text-slate-600 dark:text-slate-400">{s.payback_month ? `M${s.payback_month}` : "—"}</td>
                  <td className={`px-3 py-2 text-right font-bold numeric ${scoreColor(s.decision_score)}`}>{Math.round(s.decision_score)}</td>
                  <td className="px-3 py-2 text-center"><Badge variant={VERDICT_VARIANT[s.verdict]}>{VERDICT_LABEL[s.verdict]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

/* ── Executive Decision Queue (spec §183–184) ───────────────────────────────── */
function DecisionQueue({ scen, queue, setQueue }: any) {
  const pending = scen.filter((s: any) => s.decision_score >= 50).slice(0, 10);
  function cycle(id: string) {
    setQueue((q: Record<string, string>) => ({ ...q, [id]: QUEUE_NEXT[q[id]] ?? "APPROVE" }));
  }
  return (
    <Card className="mb-6">
      <CardHeader><CardTitle>Executive Decision Queue</CardTitle><div className="text-[11px] text-slate-400">click a status to set Approve / Pilot / Reject</div></CardHeader>
      <CardBody className="space-y-2">
        {pending.map((s: any) => (
          <div key={s.scenario_id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink-900 dark:text-white truncate">{s.name}</div>
              <div className="text-[11px] text-slate-400">score {Math.round(s.decision_score)} · {fmtUSD(s.investment_usd)} invest · {fmtUSD(s.p50_npv_usd)} NPV</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-semibold ${scoreColor(s.decision_score)}`}>{fmtUSD(s.annual_savings_usd)}</span>
              <button onClick={() => cycle(s.scenario_id)}>
                <Badge variant={VERDICT_VARIANT[queue[s.scenario_id]] ?? "slate"}>{VERDICT_LABEL[queue[s.scenario_id]] ?? "Pending"}</Badge>
              </button>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

/* ── Executive Narrative (spec §186) ────────────────────────────────────────── */
function ExecutiveNarrative({ scen, approved, metrics, rec }: any) {
  const text = rec
    ? `The portfolio contains ${scen.length} evaluated opportunities. The top ${approved.length} generate ${fmtUSD(metrics.savings)} in annual savings while reducing emissions by ${fmtCO2(metrics.emRed)}. The highest-ranked initiative is the ${rec.name} program (Decision Score ${Math.round(rec.decision_score)}), which ${rec.emissions_reduction_pct >= 0 ? `reduces emissions ${fmtPct(rec.emissions_reduction_pct)}` : "holds emissions"} while improving annual logistics economics by ${fmtUSD(rec.annual_savings_usd)} at a ${fmtPct(metrics.roi, 0)} portfolio ROI.`
    : "";
  return (
    <Card className="mb-2">
      <CardHeader><CardTitle>Executive Summary</CardTitle></CardHeader>
      <CardBody><p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{text}</p></CardBody>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-base font-bold text-ink-900 dark:text-white numeric mt-0.5">{value}</div>
    </div>
  );
}
