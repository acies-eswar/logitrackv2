"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, fmtUSD, fmtCO2, fmtNum } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardBody, PageHeader, Spinner, ApiError, Badge, Button } from "@/components/ui";
import { BarChartCard } from "@/components/charts";

const CARBON_PRICE_PER_TONNE = 75;

export default function ScenariosPage() {
  const [list,    setList]    = useState<any[]>([]);
  const [active,  setActive]  = useState<string | null>(null);
  const [result,  setResult]  = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [listErr, setListErr] = useState(false);
  const [evalErr, setEvalErr] = useState(false);

  const loadList = useCallback(() => {
    setListErr(false);
    api.scenarios()
      .then((l) => { setList(l); if (l[0]) select(l[0].scenario_id); })
      .catch(() => setListErr(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadList(); }, [loadList]);

  function select(id: string) {
    setActive(id);
    setLoading(true);
    setResult(null);
    setEvalErr(false);
    api.evaluate(id)
      .then((r) => { setResult(r); setLoading(false); })
      .catch(() => { setEvalErr(true); setLoading(false); });
  }

  if (listErr) return <ApiError retry={loadList} />;

  return (
    <>
      <PageHeader
        eyebrow="Scenario Planning"
        title="Scenario Planning"
        desc="Evaluate future-state logistics strategies before implementation. Compare current vs future across cost, service, emissions, and risk."
      />

      {list.length === 0 && !listErr ? (
        <Spinner label="Loading scenarios..." />
      ) : (
        <div className="grid lg:grid-cols-[320px_1fr] gap-5">
          <div className="space-y-2">
            {list.map((s) => (
              <button
                key={s.scenario_id}
                onClick={() => select(s.scenario_id)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  active === s.scenario_id
                    ? "border-brand/20 bg-brand-50 text-ink-900 shadow-sm shadow-brand/10 dark:border-cyan-400/30 dark:bg-white/5 dark:text-white"
                    : "border-slate-200 bg-white hover:border-brand-300 text-ink-900 dark:border-slate-700 dark:bg-slate-950/70 dark:hover:border-cyan-400/40 dark:hover:bg-slate-900/80 dark:text-slate-300"
                }`}
              >
                <div className="font-semibold text-sm text-ink-900">{s.name}</div>
                <div className="text-xs text-slate-500 mt-1">{s.lever}</div>
                <Badge variant="slate" className="mt-2">{s.type}</Badge>
              </button>
            ))}
          </div>

          <div>
            {loading && <Spinner label="Evaluating scenario..." />}
            {evalErr && <ApiError retry={() => active && select(active)} />}
            {result && !loading && !evalErr && <ScenarioDetail r={result} />}
          </div>
        </div>
      )}
    </>
  );
}

function ScenarioDetail({ r }: { r: any }) {
  const b = r.baseline, f = r.future_state, im = r.impact;

  const emissionImpactUsd = (im.emissions_impact_co2e ?? 0) * CARBON_PRICE_PER_TONNE;

  const compare = [
    { name: "Freight $",  Baseline: b.annual_freight_usd,      Future: f.annual_freight_usd },
    { name: "Landed $",   Baseline: b.annual_landed_cost_usd,  Future: f.annual_landed_cost_usd },
  ];
  const compareCo2 = [
    { name: "CO₂e (t)", Baseline: b.annual_co2e, Future: f.annual_co2e },
  ];

  return (
    <div className="space-y-5">
      <Card>
        <CardBody>
          <div className="text-lg font-bold text-ink-900">{r.scenario.name}</div>
          <div className="text-sm text-slate-500 mt-1">{r.scenario.description}</div>
          <div className="text-xs text-slate-400 mt-2">{r.affected_lane_count} affected lanes</div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Impact label="Annual Savings"          value={fmtUSD(im.annual_savings_usd)}                    good={im.annual_savings_usd >= 0} />
        <Impact label="Emissions Reductions"    value={fmtCO2(im.emissions_impact_co2e)}                 good={im.emissions_impact_co2e <= 0} sub="kgCO₂e" />
        <Impact label="Service (OTIF)"          value={`${im.service_impact_otif_pts >= 0 ? "+" : ""}${fmtNum(im.service_impact_otif_pts, 1)} pts`} good={im.service_impact_otif_pts >= 0} />
        <Impact label="Transit Impact"          value={`${im.transit_impact_days >= 0 ? "+" : ""}${fmtNum(im.transit_impact_days, 1)} d`}           good={im.transit_impact_days <= 0} />
        <Impact label="Emission Impact ($)"     value={fmtUSD(emissionImpactUsd)}                        good={emissionImpactUsd <= 0} sub={`@ $${CARBON_PRICE_PER_TONNE}/t CO₂e`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader><CardTitle>Cost: Baseline vs Future</CardTitle></CardHeader>
          <CardBody>
            {r.affected_lane_count > 0
              ? <BarChartCard
                  data={compare} x="name" currency height={200}
                  bars={[
                    { key: "Baseline", name: "Baseline",    color: "#94a3b8" },
                    { key: "Future",   name: "Future State", color: "#1d4ed8" },
                  ]}
                />
              : <div className="py-8 text-center text-slate-400 text-sm">No lanes affected by this scenario</div>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Emissions: Baseline vs Future</CardTitle></CardHeader>
          <CardBody>
            {r.affected_lane_count > 0
              ? <BarChartCard
                  data={compareCo2} x="name" height={200}
                  bars={[
                    { key: "Baseline", name: "Baseline",    color: "#94a3b8" },
                    { key: "Future",   name: "Future State", color: "#0e9f6e" },
                  ]}
                />
              : <div className="py-8 text-center text-slate-400 text-sm">No lanes affected by this scenario</div>}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm text-slate-600">
            See the full financial case: true cost of switching, working capital, risk-adjusted NPV, and value realization.
          </div>
          <Link href={`/transition?s=${r.scenario.scenario_id}`}>
            <Button>Open Transition Economics</Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}

function Impact({ label, value, good, sub }: { label: string; value: string; good: boolean; sub?: string }) {
  return (
    <Card>
      <CardBody className="p-3">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide leading-tight">{label}</div>
        {sub && <div className="text-[9px] text-slate-400 mt-0.5 leading-tight">{sub}</div>}
        <div className={`text-base font-bold mt-1.5 numeric leading-none ${good ? "text-positive" : "text-danger"}`}>{value}</div>
      </CardBody>
    </Card>
  );
}
