"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api, fmtUSD, fmtNum, fmtPct, fmtCO2, VERDICT } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardBody, KPI, PageHeader, Spinner, ApiError, Badge, Select } from "@/components/ui";
import { WaterfallBar, AreaChartCard, LineChartCard, BarChartCard } from "@/components/charts";

function TransitionInner() {
  const params  = useSearchParams();
  const [list,    setList]    = useState<any[]>([]);
  const [sid,     setSid]     = useState<string>("");
  const [r,       setR]       = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [listErr, setListErr] = useState(false);
  const [evalErr, setEvalErr] = useState(false);

  const runEval = useCallback((id: string) => {
    if (!id) return;
    setLoading(true);
    setR(null);
    setEvalErr(false);
    api.transition(id)
      .then((res) => { setR(res); setLoading(false); })
      .catch(() => { setEvalErr(true); setLoading(false); });
  }, []);

  useEffect(() => {
    setListErr(false);
    api.scenarios()
      .then((l) => {
        setList(l);
        const initial = params.get("s") || (l[0]?.scenario_id ?? "");
        setSid(initial);
        if (initial) runEval(initial);
      })
      .catch(() => setListErr(true));
  }, [params, runEval]);

  function onChange(id: string) { setSid(id); runEval(id); }

  if (listErr) return <ApiError retry={() => window.location.reload()} />;

  return (
    <>
      <PageHeader
        eyebrow="Transition Economics"
        title="Transition Economics"
        desc="Quantify the financial effort to achieve future-state benefits: true cost of switching, working capital, tariff exposure, risk, and value realization."
        actions={
          <Select value={sid} onChange={(e) => onChange(e.target.value)} className="min-w-[260px]">
            {list.map((s) => (
              <option key={s.scenario_id} value={s.scenario_id}>{s.name}</option>
            ))}
          </Select>
        }
      />
      {loading && <Spinner label="Running transition economics..." />}
      {evalErr && !loading && <ApiError retry={() => runEval(sid)} />}
      {r && !loading && !evalErr && <Detail r={r} />}
    </>
  );
}

function Detail({ r }: { r: any }) {
  const tcs  = r.true_cost_of_switching;
  const wcb  = r.working_capital_bridge;
  const tte  = r.tariff_duty_analysis;
  const npv  = r.risk_adjusted_npv;
  const risk = r.scenario_risk;
  const vrt  = r.value_realization;
  const cc   = r.carbon_credit;
  const v    = VERDICT[r.verdict] ?? VERDICT["PILOT"];

  const tcsWaterfall = tcs.components.map((c: any) => ({ name: c.label, value: c.amount }));
  const wcbSeries    = wcb.snapshots.map((s: any) => ({ month: `M${s.month}`, nwc: s.nwc_delta_usd }));
  const vrtAll       = vrt.timeline.map((t: any) => ({ month: `M${t.month}`, cumulative: t.cumulative_cash_flow_usd }));
  const vrtSeries    = vrtAll.filter((_: any, i: number) => i % 2 === 0);
  const npvDist      = npv.distribution.map((d: any) => ({ name: `P${d.percentile}`, npv: d.npv_usd }));

  // Computed metrics
  const roi = tcs.one_time_investment_usd > 0
    ? npv.p50_npv_usd / tcs.one_time_investment_usd
    : 0;
  const annualSavingsEst = vrt.steady_monthly_benefit_usd * 12;
  const savingsMultiple  = tcs.one_time_investment_usd > 0 ? annualSavingsEst / tcs.one_time_investment_usd : 0;
  const vrtM12 = vrtAll.find((t: any) => t.month === "M12")?.cumulative ?? null;
  const vrtM24 = vrtAll.find((t: any) => t.month === "M24")?.cumulative ?? null;
  const vrtM36 = vrtAll.find((t: any) => t.month === "M36")?.cumulative ?? null;
  const npvSwing = npv.p90_npv_usd - npv.p10_npv_usd;
  const nwcAsInvestmentPct = tcs.one_time_investment_usd > 0
    ? Math.abs(wcb.peak_nwc_delta_usd) / tcs.one_time_investment_usd
    : 0;

  return (
    <div className="space-y-5">
      {/* Verdict card */}
      <Card className="border-l-4 border-l-brand">
        <CardBody>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-lg font-bold text-ink-900">{r.scenario.name}</div>
              <div className="text-sm text-slate-500 mt-1 max-w-2xl">{r.decision_summary}</div>
            </div>
            <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${v.bg} ${v.text}`}>{v.label}</span>
          </div>
        </CardBody>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPI label="Investment Required"     value={fmtUSD(tcs.one_time_investment_usd)} accent="amber" />
        <KPI label="Peak Cash Requirement"   value={fmtUSD(Math.abs(wcb.peak_nwc_delta_usd))} sub={`month ${wcb.peak_month}`} accent="default" />
        <KPI label="Risk-Adjusted NPV (P50)" value={fmtUSD(npv.p50_npv_usd)} accent={npv.p50_npv_usd >= 0 ? "green" : "red"} />
        <KPI label="Payback"                 value={vrt.breakeven_month ? `Month ${vrt.breakeven_month}` : "Beyond horizon"} accent="blue" />
        <KPI label="Risk Score"              value={`${risk.risk_score}/100`} sub={risk.risk_rating}
          accent={risk.risk_score < 35 ? "green" : risk.risk_score < 65 ? "amber" : "red"} />
      </div>

      {/* TCS */}
      <Card>
        <CardHeader>
          <CardTitle>True Cost of Switching</CardTitle>
          <Badge variant="slate">Total {fmtUSD(tcs.total_switching_cost_usd)}</Badge>
        </CardHeader>
        <CardBody>
          <div className="grid lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
              <WaterfallBar data={tcsWaterfall} height={320} />
            </div>
            <div className="space-y-4 min-w-0">
              <div className="space-y-2.5">
                <SectionLabel>Cost Structure</SectionLabel>
                <Split label="One-time investment"    value={fmtUSD(tcs.one_time_investment_usd)} />
                <Split label="Recurring annual delta" value={fmtUSD(tcs.recurring_annual_delta_usd)} />
                <Split label="Total switching cost"   value={fmtUSD(tcs.total_switching_cost_usd)} />
              </div>
              <div className="space-y-2.5">
                <SectionLabel>Return Ratios</SectionLabel>
                <Split label="P50 NPV / Investment"   value={`${fmtNum(roi, 2)}×`} good={roi > 1} />
                <Split label="Annual savings multiple" value={`${fmtNum(savingsMultiple, 2)}×`} good={savingsMultiple > 1} />
                <Split label="Peak NWC as % invest."  value={fmtPct(nwcAsInvestmentPct * 100, 0)} />
              </div>
              <div className="space-y-2">
                <SectionLabel>Top cost drivers</SectionLabel>
                {tcs.top_drivers.map((d: any) => (
                  <div key={d.label} className="flex justify-between items-center text-sm py-0.5">
                    <span className="text-slate-600">{d.label}</span>
                    <span className="font-mono font-medium text-ink-900">{fmtUSD(d.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* WCB + VRT */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Working Capital Bridge</CardTitle>
            <Badge variant="slate">CCC {fmtNum(wcb.baseline_ccc_days, 0)}d baseline</Badge>
          </CardHeader>
          <CardBody>
            <AreaChartCard data={wcbSeries} x="month" area="nwc" currency color="#1d4ed8" height={260} />
            <div className="grid grid-cols-2 gap-3 mt-4">
              <StatBox label="Peak NWC Delta"         value={fmtUSD(wcb.peak_nwc_delta_usd)} highlight={wcb.peak_nwc_delta_usd < 0} />
              <StatBox label="Peak Month"             value={wcb.peak_month ? `M${wcb.peak_month}` : "N/A"} />
              <StatBox label="Recovery Month"         value={wcb.months_to_recovery ? `M${wcb.months_to_recovery}` : "N/A"} />
              <StatBox label="Credit Facility"        value={fmtUSD(wcb.credit_facility_required_usd)} />
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-1.5">
              <SectionLabel>Baseline Cash Cycle</SectionLabel>
              <Split label="Cash conversion cycle"    value={`${fmtNum(wcb.baseline_ccc_days, 0)} days`} />
              <Split label="NWC as % of investment"   value={fmtPct(nwcAsInvestmentPct * 100, 0)} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Value Realization Timeline</CardTitle>
            <Badge variant="slate">{vrt.breakeven_month ? `Breakeven M${vrt.breakeven_month}` : "No breakeven in horizon"}</Badge>
          </CardHeader>
          <CardBody>
            <LineChartCard data={vrtSeries} x="month" currency refZero
              lines={[{ key: "cumulative", name: "Cumulative cash flow", color: "#0e9f6e" }]} height={260} />
            <div className="grid grid-cols-2 gap-3 mt-4">
              <StatBox label="Peak Cash Burn"         value={fmtUSD(vrt.peak_cash_burn_usd)} highlight />
              <StatBox label="Monthly Benefit"        value={fmtUSD(vrt.steady_monthly_benefit_usd)} />
              <StatBox label="Annual Benefit (est.)"  value={fmtUSD(annualSavingsEst)} />
              <StatBox label="Payback Period"         value={vrt.payback_period_months ? `${vrt.payback_period_months} mo` : "N/A"} />
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
              <SectionLabel>Cumulative Milestones</SectionLabel>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {vrtM12 !== null && <StatBox label="M12"  value={fmtUSD(vrtM12)}  highlight={vrtM12 >= 0} small />}
                {vrtM24 !== null && <StatBox label="M24"  value={fmtUSD(vrtM24)}  highlight={vrtM24 >= 0} small />}
                {vrtM36 !== null && <StatBox label="M36"  value={fmtUSD(vrtM36)}  highlight={vrtM36 >= 0} small />}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* NPV + Tariff + Risk */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Risk-Adjusted NPV</CardTitle>
            <Badge variant="blue">{fmtPct(npv.probability_positive_pct, 0)} positive · {npv.trials} trials</Badge>
          </CardHeader>
          <CardBody>
            <BarChartCard data={npvDist} x="name" currency
              bars={[{ key: "npv", name: "NPV", color: "#1d4ed8" }]} height={240} />
            <div className="grid grid-cols-3 gap-3 mt-4">
              <StatBox label="P10 (downside)" value={fmtUSD(npv.p10_npv_usd)} highlight={npv.p10_npv_usd >= 0} />
              <StatBox label="P50 (median)"   value={fmtUSD(npv.p50_npv_usd)} highlight={npv.p50_npv_usd >= 0} />
              <StatBox label="P90 (upside)"   value={fmtUSD(npv.p90_npv_usd)} highlight={npv.p90_npv_usd >= 0} />
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-2">
              <div className="flex justify-between items-center">
                <SectionLabel>Sensitivity Ranking</SectionLabel>
                <span className="text-xs text-slate-400">Total swing {fmtUSD(npvSwing)}</span>
              </div>
              {npv.sensitivity.map((s: any) => (
                <div key={s.factor} className="flex justify-between text-sm py-0.5">
                  <span className="text-slate-600">{s.factor}</span>
                  <span className="font-mono text-ink-900">{fmtUSD(s.swing_usd)}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Tariff &amp; Duty Analysis</CardTitle>
              {tte.section_232_exposed && <Badge variant="red">Section 232</Badge>}
            </CardHeader>
            <CardBody className="space-y-2.5">
              <Split label="Baseline annual tariff"  value={fmtUSD(tte.baseline_annual_tariff_usd)} />
              <Split label="Baseline annual duty"    value={fmtUSD(tte.baseline_annual_duty_usd)} />
              <Split label="Combined tariff + duty"  value={fmtUSD(tte.baseline_annual_tariff_usd + tte.baseline_annual_duty_usd)} />
              <div className="border-t border-slate-100 dark:border-slate-700 pt-2 space-y-2">
                <Split label="Tariff savings"         value={fmtUSD(tte.tariff_savings_usd)} good />
                <Split label="FTA eligible"           value={tte.fta_eligible ? "Yes" : "No"} good={tte.fta_eligible} />
                <Split label="Section 232 exposed"    value={tte.section_232_exposed ? "Yes" : "No"} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scenario Risk</CardTitle>
              <Badge variant={risk.risk_score < 35 ? "green" : risk.risk_score < 65 ? "amber" : "red"}>
                {risk.risk_rating}
              </Badge>
            </CardHeader>
            <CardBody className="space-y-2.5">
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-500">Risk score</span>
                  <span className="font-mono font-semibold text-ink-900">{risk.risk_score} / 100</span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full">
                  <div
                    className={`h-full rounded-full transition-all ${risk.risk_score < 35 ? "bg-positive" : risk.risk_score < 65 ? "bg-amber-400" : "bg-danger"}`}
                    style={{ width: `${risk.risk_score}%` }}
                  />
                </div>
              </div>
              <Split label="Reversibility"           value={fmtPct(risk.reversibility_pct, 0)} />
              <Split label="Asset specificity"       value={fmtNum(risk.asset_specificity, 2)} />
              <Split label="Supplier concentration"  value={fmtNum(risk.concentration.supplier, 2)} />
              <Split label="Geographic concentration" value={fmtNum(risk.concentration.geographic, 2)} />
              <Split label="Prob. of negative NPV"   value={fmtPct(risk.probability_negative_pct, 0)} />
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Carbon Credit Card */}
      {cc && (
        <Card>
          <CardHeader>
            <CardTitle>Carbon Credit &amp; Emissions Financial Impact</CardTitle>
            <Badge variant={cc.delta_co2e <= 0 ? "green" : "red"}>
              {cc.delta_co2e <= 0 ? "Emissions reduce" : "Emissions increase"}
            </Badge>
          </CardHeader>
          <CardBody>
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="space-y-2.5">
                <SectionLabel>Emissions Comparison</SectionLabel>
                <Split label="Baseline annual CO₂e"  value={fmtCO2(cc.baseline_annual_co2e)} />
                <Split label="Future annual CO₂e"    value={fmtCO2(cc.future_annual_co2e)} />
                <Split label="Delta CO₂e"            value={`${cc.delta_co2e <= 0 ? "" : "+"}${fmtNum(cc.delta_co2e, 1)} t`} good={cc.delta_co2e <= 0} />
              </div>
              <div className="space-y-2.5">
                <SectionLabel>Carbon Credit Financials</SectionLabel>
                <Split label="Carbon price ($/t)"         value={fmtUSD(cc.carbon_price_usd_per_tonne, false)} />
                <Split label="Annual offset value"         value={fmtUSD(cc.annual_offset_value_usd)} good={cc.annual_offset_value_usd > 0} />
                <Split label="Carbon NPV contribution"     value={fmtUSD(cc.carbon_npv_contribution_usd)} good={cc.carbon_npv_contribution_usd > 0} />
                <Split label="Offset as % of invest."      value={fmtPct(tcs.one_time_investment_usd > 0 ? (cc.annual_offset_value_usd * 5 / tcs.one_time_investment_usd) * 100 : 0, 0)} />
              </div>
              <div>
                <SectionLabel>Methodology</SectionLabel>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{cc.methodology}</p>
                {cc.note && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 italic">{cc.note}</p>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">{children}</div>;
}

function StatBox({ label, value, highlight = false, small = false }: { label: string; value: string; highlight?: boolean; small?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${small ? "p-2" : "p-3"} bg-slate-50 dark:bg-slate-800/50`}>
      <div className="text-[10px] uppercase tracking-wide text-slate-400 leading-tight">{label}</div>
      <div className={`font-bold numeric mt-1 ${small ? "text-sm" : "text-base"} ${highlight ? "text-positive" : "text-ink-900 dark:text-white"}`}>{value}</div>
    </div>
  );
}

function Split({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      <span className={`font-mono font-medium ${good ? "text-positive" : "text-ink-900 dark:text-white"}`}>{value}</span>
    </div>
  );
}

export default function TransitionPage() {
  return <Suspense fallback={<Spinner />}><TransitionInner /></Suspense>;
}
