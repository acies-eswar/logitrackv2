"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, fmtUSD, fmtCO2, fmtNum, fmtPct, VERDICT } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardBody, KPI, PageHeader, Spinner, ApiError, Badge } from "@/components/ui";
import { NPVChart } from "@/components/charts";

export default function DecisionHub() {
  const [hub, setHub] = useState<any>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    setHub(null);
    api.decisionHub().then(setHub).catch(() => setError(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) return <ApiError retry={load} />;
  if (!hub) return <Spinner label="Consolidating scenario economics..." />;

  const rec = hub.recommended_scenario;
  const v = VERDICT[rec?.verdict] ?? VERDICT["PILOT"];
  const chart = hub.scenarios.map((s: any) => ({
    name: s.name,
    npv: s.p50_npv_usd ?? 0,
    verdict: s.verdict ?? "PILOT",
    p10: s.p10_npv_usd,
    p90: s.p90_npv_usd,
    prob: s.prob_positive_pct,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Executive Decision Hub"
        title="Logistics Investment Decisions"
        desc="A leadership-ready view that consolidates every scenario into recommended action, expected savings, emissions impact, risk, investment, and payback."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPI label="Potential Annual Savings" desc="if approved" value={fmtUSD(hub.portfolio.total_potential_savings_usd)} sub="approved scenarios" accent="green" />
        <KPI label="Emissions Reduction" desc="annual CO₂e" value={fmtCO2(hub.portfolio.total_emissions_reduction_co2e)} sub="approved scenarios" accent="blue" />
        <KPI label="Investment Required" desc="one-time capex" value={fmtUSD(hub.portfolio.total_investment_usd)} sub="all approved" accent="amber" />
        <KPI label="Scenarios Approved" desc="of 8 evaluated" value={`${hub.portfolio.approved_count} / ${hub.portfolio.evaluated_count}`} accent="default" />
      </div>

      {rec && (
        <Card className="mb-6 border-l border-l-brand/30 dark:border-l-brand-400/40">
          <CardBody className="bg-gradient-to-r from-brand/5 to-blue-600/5 dark:from-brand-900/20 dark:to-blue-900/20">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs font-semibold text-brand dark:text-brand-300 uppercase tracking-wider mb-1">Recommended Scenario</div>
                <div className="text-2xl font-bold text-ink-900 dark:text-white">{rec.name}</div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">{rec.lever} · {rec.type}</div>
              </div>
              <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${v.bg} ${v.text}`}>{v.label}</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
              <Mini label="Annual Savings" value={fmtUSD(rec.annual_savings_usd)} />
              <Mini label="P50 NPV" value={fmtUSD(rec.p50_npv_usd)} />
              <Mini label="Investment" value={fmtUSD(rec.investment_usd)} />
              <Mini label="Payback" value={rec.payback_month ? `Month ${rec.payback_month}` : "N/A"} />
              <Mini label="Risk" value={`${rec.risk_rating} (${rec.risk_score})`} />
            </div>
            <Link href={`/transition?s=${rec.scenario_id}`} className="inline-block mt-5 text-sm text-brand dark:text-brand-300 font-semibold hover:text-brand-600 dark:hover:text-brand-200 transition-colors">
              View full transition economics →
            </Link>
          </CardBody>
        </Card>
      )}

      <div className="grid lg:grid-cols-5 gap-5 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Risk-Adjusted NPV by Scenario</CardTitle></CardHeader>
          <CardBody>
            {chart.length > 0
              ? <NPVChart data={chart} />
              : <div className="py-8 text-center text-slate-400 text-sm">No scenario data</div>}
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Scenario Portfolio</CardTitle>
            <Badge variant="blue">{hub.scenarios.length} evaluated</Badge>
          </CardHeader>
          <CardBody className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-left bg-slate-50 dark:bg-slate-900/50">
                  {["Scenario", "Savings", "P50 NPV", "Payback", "Risk", "Verdict"].map((h, i) => (
                    <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 ${i > 0 && i < 5 ? "text-right" : ""} ${h === "Verdict" ? "text-center" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hub.scenarios.map((s: any) => {
                  const vv = VERDICT[s.verdict] ?? VERDICT["PILOT"];
                  return (
                    <tr key={s.scenario_id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <Link href={`/transition?s=${s.scenario_id}`} className="font-medium text-ink-900 dark:text-white hover:text-brand dark:hover:text-brand-300 transition-colors">{s.name}</Link>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{s.lever}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-ink-900 dark:text-white">{fmtUSD(s.annual_savings_usd)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-brand dark:text-brand-400">{fmtUSD(s.p50_npv_usd)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">{s.payback_month ? `M${s.payback_month}` : "N/A"}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-ink-900 dark:text-white">{s.risk_score}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${vv.bg} ${vv.text}`}>{vv.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-base font-bold text-ink-900 dark:text-white numeric mt-1">{value}</div>
    </div>
  );
}
