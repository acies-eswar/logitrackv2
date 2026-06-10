"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api, fmtUSD, fmtNum, fmtPct, fmtCO2, VERDICT_STYLE, CHART } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardBody, PageHeader, Spinner, Badge, Button } from "@/components/ui";
import { WaterfallTooltipBar, AreaChartCard, LineChartCard, BarChartCard } from "@/components/charts";

function WorkbenchInner() {
  const params = useSearchParams();
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [sel, setSel] = useState<string>("");
  const [wacc, setWacc] = useState(8.5);
  const [horizon, setHorizon] = useState(5);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.scenarios().then((s) => {
      setScenarios(s);
      const initial = params.get("s") || s[0]?.scenario_id;
      setSel(initial);
    }).catch(() => {});
  }, [params]);

  useEffect(() => {
    if (!sel) return;
    setLoading(true);
    api.workbench(sel, { wacc_pct: wacc, horizon_years: horizon })
      .then((r) => { setResult(r); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sel, wacc, horizon]);

  const ins = result?.insights;

  return (
    <>
      <PageHeader eyebrow="Decisions" title="Decision Workbench"
        desc="Eight finance-native insights for a single proposed change, with a CFO + CSO verdict." />

      <Card className="mb-6">
        <CardBody className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Scenario</label>
            <select value={sel} onChange={(e) => setSel(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/40">
              {scenarios.map((s) => <option key={s.scenario_id} value={s.scenario_id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">WACC %</label>
            <input type="number" step={0.5} value={wacc} onChange={(e) => setWacc(+e.target.value)} className="w-24 px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Horizon (yrs)</label>
            <input type="number" min={1} max={10} value={horizon} onChange={(e) => setHorizon(+e.target.value)} className="w-20 px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm" />
          </div>
        </CardBody>
      </Card>

      {loading || !result ? <Spinner label="Running 8-insight evaluation..." /> : (
        <>
          {/* Verdict banner */}
          <Card className="mb-6 overflow-hidden">
            <div className="flex items-stretch flex-wrap">
              <div className={`px-6 py-5 flex flex-col justify-center ${VERDICT_STYLE[result.verdict].bg} min-w-[180px]`}>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Verdict</div>
                <div className={`text-3xl font-bold mt-1 ${VERDICT_STYLE[result.verdict].text}`}>{VERDICT_STYLE[result.verdict].label}</div>
              </div>
              <div className="flex-1 px-6 py-5 min-w-[300px]">
                <div className="text-sm text-ink-900 font-medium mb-2">{result.rationale}</div>
                <div className="grid md:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-500">
                  <div><span className="font-semibold text-brand">CFO:</span> {result.cfo_summary}</div>
                  <div><span className="font-semibold text-positive">CSO:</span> {result.cso_summary}</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Insight 1: TCS */}
          <div className="grid lg:grid-cols-2 gap-5 mb-5">
            <Insight n={1} title="True Cost of Switching" tag="TCS" tagColor="blue"
              headline={fmtUSD(ins.tcs.total_switching_cost_usd)} headlineLabel="Total switching cost"
              sub={`One-time ${fmtUSD(ins.tcs.one_time_usd)} · Recurring ${fmtUSD(ins.tcs.recurring_annual_usd)}/yr`}>
              <WaterfallTooltipBar data={ins.tcs.components.map((c: any) => ({ name: c.label, value: c.amount }))} height={300} />
            </Insight>

            {/* Insight 2: WCB */}
            <Insight n={2} title="Working Capital Bridge" tag="WCB" tagColor="blue"
              headline={fmtUSD(ins.wcb.peak_nwc_delta_usd)} headlineLabel={`Peak NWC at month ${ins.wcb.peak_month}`}
              sub={`CCC baseline ${ins.wcb.baseline_ccc_days}d · Credit facility ${fmtUSD(ins.wcb.credit_facility_required_usd)} · Recovery ${ins.wcb.months_to_recovery ? "M" + ins.wcb.months_to_recovery : "beyond horizon"}`}>
              <AreaChartCard data={ins.wcb.snapshots.map((s: any) => ({ month: `M${s.month}`, nwc_delta_usd: s.nwc_delta_usd }))} x="month" area="nwc_delta_usd" currency height={300} color={CHART.blue} />
            </Insight>
          </div>

          {/* Insight 3: RANPV */}
          <div className="grid lg:grid-cols-2 gap-5 mb-5">
            <Insight n={3} title="Risk-Adjusted NPV" tag="RANPV" tagColor="blue"
              headline={fmtUSD(ins.ranpv.p50_npv_usd)} headlineLabel={`P50 · ${fmtPct(ins.ranpv.probability_positive_pct, 0)} positive`}
              sub={`P10 ${fmtUSD(ins.ranpv.p10_npv_usd)} · P90 ${fmtUSD(ins.ranpv.p90_npv_usd)} · ${fmtNum(ins.ranpv.trials)} Monte Carlo trials @ WACC ${ins.ranpv.wacc_pct}%`}>
              <BarChartCard data={ins.ranpv.distribution.map((d: any) => ({ name: `P${d.percentile}`, value: d.npv_usd }))} x="name" bars={[{ key: "value", name: "NPV", color: "#1d4ed8" }]} currency height={300} />
            </Insight>

            {/* Insight 6: VRT */}
            <Insight n={6} title="Value Realization Timeline" tag="VRT" tagColor="green"
              headline={ins.vrt.breakeven_month ? `Month ${ins.vrt.breakeven_month}` : "Beyond horizon"} headlineLabel="Breakeven"
              sub={`Peak cash burn ${fmtUSD(ins.vrt.peak_cash_burn_usd)} · Steady benefit ${fmtUSD(ins.vrt.monthly_benefit_steady_usd)}/mo`}>
              <AreaChartCard data={ins.vrt.timeline.filter((_: any, i: number) => i % 2 === 0).map((t: any) => ({ month: `M${t.month}`, cumulative_cash_flow_usd: t.cumulative_cash_flow_usd }))} x="month" area="cumulative_cash_flow_usd" currency height={300} color={CHART.positive} />
            </Insight>
          </div>

          {/* Insights 4, 5 */}
          <div className="grid lg:grid-cols-2 gap-5 mb-5">
            {/* Insight 4: TTE */}
            <Card>
              <CardHeader><CardTitle><InsightTag n={4} tag="TTE" color="amber" /> Tax, Tariff & Trade Economics</CardTitle></CardHeader>
              <CardBody className="space-y-3">
                <Stat label="Effective landed cost (baseline → proposed)" value={`${fmtUSD(ins.tte.baseline_effective_landed_cost_per_unit, false)} → ${fmtUSD(ins.tte.proposed_effective_landed_cost_per_unit, false)}`} />
                <Stat label="Annual tariff savings" value={fmtUSD(ins.tte.annual_tariff_savings_usd)} pos />
                <Stat label="CBAM exposure change" value={fmtUSD(ins.tte.cbam_exposure_change_usd)} />
                <Stat label="Margin impact" value={fmtUSD(ins.tte.margin_impact_usd)} pos={ins.tte.margin_impact_usd >= 0} />
                <div className="flex gap-2 flex-wrap pt-1">
                  {ins.tte.fta_eligible && <Badge variant="green">FTA eligible</Badge>}
                  {ins.tte.ftz_benefit_usd > 0 && <Badge variant="blue">FTZ benefit {fmtUSD(ins.tte.ftz_benefit_usd)}</Badge>}
                  {ins.tte.section_232_exposed && <Badge variant="red">Section 232</Badge>}
                </div>
                <ul className="text-xs text-slate-500 space-y-1 pt-1">
                  {ins.tte.tax_optimization_opportunities.map((o: string, i: number) => <li key={i}>• {o}</li>)}
                </ul>
              </CardBody>
            </Card>

            {/* Insight 5: SFO */}
            <Card>
              <CardHeader>
                <CardTitle><InsightTag n={5} tag="SFO" color="blue" /> Strategic Flexibility & Optionality</CardTitle>
                <Badge variant={ins.sfo.strategic_risk_rating === "High" ? "green" : ins.sfo.strategic_risk_rating === "Moderate" ? "amber" : "red"}>{ins.sfo.strategic_risk_rating} flexibility</Badge>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="relative w-24 h-24 shrink-0">
                    <svg viewBox="0 0 100 100" className="-rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#1d4ed8" strokeWidth="10"
                        strokeDasharray={`${ins.sfo.flexibility_score / 100 * 264} 264`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-ink-900">{ins.sfo.flexibility_score}</span>
                      <span className="text-[10px] text-slate-400">/ 100</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Stat label="Reversibility" value={fmtPct(ins.sfo.reversibility_pct, 0)} small />
                    <Stat label="Lock-in cost" value={fmtUSD(ins.sfo.lock_in_cost_usd)} small />
                    <Stat label="Reversal cost" value={fmtUSD(ins.sfo.reversal_cost_usd)} small />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {Object.entries(ins.sfo.concentration).map(([k, v]: any) => (
                    <div key={k} className="bg-slate-50 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-slate-400 uppercase">{k}</div>
                      <div className="text-sm font-bold text-ink-900">{fmtNum(v * 100, 0)}%</div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            {/* Insight 7: Landed trade-off */}
            <Card>
              <CardHeader>
                <CardTitle><InsightTag n={7} tag="L-CvE" color="green" /> Landed Cost vs Landed Emissions</CardTitle>
                <Badge variant={ins.landed.cost_efficiency_rank === "Win-Win" ? "green" : "amber"}>{ins.landed.cost_efficiency_rank}</Badge>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-400">Current</div>
                    <div className="text-lg font-bold text-ink-900">{fmtUSD(ins.landed.current.landed_cost, false)}</div>
                    <div className="text-xs text-slate-500">{fmtNum(ins.landed.current.landed_emissions, 3)} t CO₂e / shipment</div>
                  </div>
                  <div className="bg-brand-50 rounded-lg p-3">
                    <div className="text-xs text-brand">Proposed</div>
                    <div className="text-lg font-bold text-ink-900">{fmtUSD(ins.landed.proposed.landed_cost, false)}</div>
                    <div className="text-xs text-slate-500">{fmtNum(ins.landed.proposed.landed_emissions, 3)} t CO₂e / shipment</div>
                  </div>
                </div>
                <Stat label="Cost / shipment delta" value={fmtUSD(ins.landed.cost_per_unit_delta, false)} pos={ins.landed.cost_per_unit_delta < 0} />
                <Stat label="Emissions / shipment delta" value={`${fmtNum(ins.landed.emissions_per_unit_delta, 3)} t`} pos={ins.landed.emissions_per_unit_delta < 0} />
                {ins.landed.cost_per_ton_co2e_reduced !== 0 && (
                  <Stat label="Cost per ton CO₂e reduced" value={fmtUSD(ins.landed.cost_per_ton_co2e_reduced, false)} />
                )}
              </CardBody>
            </Card>

            {/* Insight 8: CEM */}
            <Card>
              <CardHeader><CardTitle><InsightTag n={8} tag="CEM" color="green" /> Carbon Efficiency Margin</CardTitle></CardHeader>
              <CardBody className="space-y-3">
                <Stat label="Baseline margin / tCO₂e" value={fmtUSD(ins.cem.baseline_margin_per_tco2e, false)} />
                <Stat label="Proposed margin / tCO₂e" value={fmtUSD(ins.cem.proposed_margin_per_tco2e, false)} pos />
                <Stat label="Carbon productivity score" value={`${fmtNum(ins.cem.carbon_productivity_score)} / 100`} />
                <Stat label="Carbon intensity improvement" value={fmtPct(ins.cem.improvement_pct)} pos={ins.cem.improvement_pct >= 0} />
                <div className="pt-2">
                  <BarChartCard height={150} data={[
                    { name: "Baseline", value: ins.cem.baseline_margin_per_tco2e },
                    { name: "Proposed", value: ins.cem.proposed_margin_per_tco2e },
                  ]} x="name" bars={[{ key: "value", name: "Margin / tCO₂e", color: "#0e9f6e" }]} currency />
                </div>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

function Insight({ n, title, tag, tagColor, headline, headlineLabel, sub, children }: any) {
  return (
    <Card>
      <CardHeader><CardTitle><InsightTag n={n} tag={tag} color={tagColor} /> {title}</CardTitle></CardHeader>
      <CardBody>
        <div className="mb-3">
          <div className="text-2xl font-bold text-ink-900 numeric">{headline}</div>
          <div className="text-xs text-slate-500">{headlineLabel}</div>
          {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
        </div>
        {children}
      </CardBody>
    </Card>
  );
}

function InsightTag({ n, tag, color }: { n: number; tag: string; color: string }) {
  const cx = { blue: "bg-brand text-white", green: "bg-positive text-white", amber: "bg-warning text-white" }[color] || "bg-slate-200";
  return <span className={`inline-flex items-center gap-1 mr-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${cx}`}>{n} · {tag}</span>;
}

function Stat({ label, value, pos, small }: { label: string; value: string; pos?: boolean; small?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-slate-500 ${small ? "text-xs" : "text-sm"}`}>{label}</span>
      <span className={`font-mono font-semibold ${small ? "text-xs" : "text-sm"} ${pos === undefined ? "text-ink-900" : pos ? "text-positive" : "text-danger"}`}>{value}</span>
    </div>
  );
}

export default function WorkbenchPage() {
  return <Suspense fallback={<Spinner />}><WorkbenchInner /></Suspense>;
}
