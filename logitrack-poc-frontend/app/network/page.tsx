"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, fmtUSD, fmtCO2, fmtNum, fmtPct } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardBody, KPI, PageHeader, Spinner, ApiError, Badge, Segmented, Select } from "@/components/ui";
import { NetworkMap } from "@/components/charts/network-map";
import { BarChartCard } from "@/components/charts";

/* Module 1 — Network Intelligence & Journey Visibility (LogiTrack V3.0).
   "A supply chain journey explorer", not a network dashboard. */

const CARBON_PRICES = [0, 50, 75, 100, 150, 250];
const PRODUCTS = ["Refrigerator", "Washing Machine", "Air Conditioner", "Microwave Oven", "Dishwasher"];
const INBOUND_SEGS = ["Supplier→Port", "Port→Plant", "Supplier→Plant"];
const OUTBOUND_SEGS = ["Plant→Plant", "Plant→DC", "DC→DC"];

export default function NetworkPage() {
  const [carbon, setCarbon] = useState(75);
  const [sum, setSum] = useState<any>(null);
  const [graph, setGraph] = useState<any>(null);
  const [flows, setFlows] = useState<any>(null);
  const [hot, setHot] = useState<any>(null);
  const [lanes, setLanes] = useState<any[]>([]);
  const [recs, setRecs] = useState<any>(null);
  const [hotView, setHotView] = useState<"cost" | "emissions">("cost");
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    setSum(null); setGraph(null); setFlows(null); setHot(null);
    Promise.all([api.networkSummary(), api.networkGraph(), api.networkFlows(), api.networkHotspots(), api.lanes(), api.recommendations(carbon)])
      .then(([s, g, f, h, l, r]) => { setSum(s); setGraph(g); setFlows(f); setHot(h); setLanes(l); setRecs(r); })
      .catch(() => setError(true));
  }, [carbon]);

  useEffect(() => { load(); }, [load]);

  const derived = useMemo(() => {
    if (!sum) return null;
    const totShip = lanes.reduce((a, l) => a + (l.shipments ?? 0), 0) || 1;
    const avgLead = lanes.reduce((a, l) => a + (l.transit_days ?? 0) * (l.shipments ?? 0), 0) / totShip;
    const carbonExposure = (sum.total_annual_co2e ?? 0) * carbon;
    const best = recs?.recommendations?.[0]?.emissions_reduction_pct ?? 0; // best single-lever reduction
    const crossBorder = (graph?.edges ?? []).filter((e: any) => e.cross_border).length;
    const cbPct = (graph?.edges?.length ? crossBorder / graph.edges.length : 0) * 100;
    const byMode = (sum.by_mode ?? {}) as Record<string, any>;
    const totCo2 = Object.values(byMode).reduce((a: number, v: any) => a + (v.co2e ?? 0), 0) || 1;
    const airShare = ((byMode.air?.co2e ?? 0) / totCo2) * 100;
    const netRisk = Math.min(100, Math.round(28 + cbPct * 0.4 + airShare * 0.6 + (sum.network_intensity_g_per_tkm > 40 ? 12 : 0)));
    return { avgLead, carbonExposure, best, crossBorder, cbPct, airShare, netRisk };
  }, [sum, lanes, recs, graph, carbon]);

  if (error) return <ApiError retry={load} />;
  if (!sum || !graph || !flows || !hot || !derived) return <Spinner label="Building network intelligence…" />;

  const byMode = (sum.by_mode ?? {}) as Record<string, any>;
  const modeData = Object.entries(byMode).filter(([, v]: any) => v && (v.freight > 0 || v.co2e > 0))
    .map(([k, v]: any) => ({ name: k[0].toUpperCase() + k.slice(1), freight: v.freight ?? 0, co2e: v.co2e ?? 0 }));
  const hotspots: any[] = hotView === "cost" ? hot.cost : hot.emissions;
  const flowRows: any[] = flows.flows ?? [];
  const inbound = flowRows.filter((f) => INBOUND_SEGS.includes(f.segment));
  const outbound = flowRows.filter((f) => OUTBOUND_SEGS.includes(f.segment));

  return (
    <>
      <PageHeader
        eyebrow="Module 1 · Journey Explorer"
        title="Network Intelligence"
        desc="Understand how products move through your supply chain and where emissions, cost and risk originate — before changing the future state."
        actions={<Segmented options={CARBON_PRICES.map((c) => ({ value: String(c), label: `$${c}` }))} value={String(carbon)} onChange={(v) => setCarbon(Number(v))} />}
      />

      {/* 8-KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
        <KPI label="Total Journeys" value={fmtNum(sum.entity_counts.lanes)} desc="active lanes" />
        <KPI label="Annual Freight" value={fmtUSD(sum.total_annual_freight_usd)} accent="blue" />
        <KPI label="Annual Emissions" value={fmtCO2(sum.total_annual_co2e)} accent="green" />
        <KPI label="Emission Intensity" value={`${fmtNum(sum.network_intensity_g_per_tkm, 1)}`} desc="gCO₂e/tkm" />
        <KPI label="Avg Lead Time" value={`${fmtNum(derived.avgLead, 1)} d`} />
        <KPI label="Carbon Cost Exposure" value={fmtUSD(derived.carbonExposure)} accent="amber" desc={`@ $${carbon}/t`} />
        <KPI label="Reduction Potential" value={fmtPct(derived.best)} accent="green" desc="best lever" />
        <KPI label="Network Risk" value={`${derived.netRisk}`} accent={derived.netRisk < 40 ? "green" : derived.netRisk < 65 ? "amber" : "red"} desc="0–100" />
      </div>

      {/* Journey Explorer — flagship */}
      <JourneyExplorer carbon={carbon} best={derived.best} />

      {/* Network map */}
      <Card className="mb-6">
        <CardHeader><CardTitle>End-to-End Network Visualization</CardTitle><Badge variant="blue">{graph.nodes.length} nodes · {graph.edges.length} lanes</Badge></CardHeader>
        <CardBody><NetworkMap nodes={graph.nodes} edges={graph.edges} /></CardBody>
      </Card>

      {/* by-mode */}
      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <Card><CardHeader><CardTitle>Emissions by Mode</CardTitle></CardHeader><CardBody>
          <BarChartCard data={modeData} x="name" height={220} bars={[{ key: "co2e", name: "Annual CO₂e (t)", color: "#0e9f6e" }]} />
        </CardBody></Card>
        <Card><CardHeader><CardTitle>Cost by Mode</CardTitle></CardHeader><CardBody>
          <BarChartCard data={modeData} x="name" currency height={220} bars={[{ key: "freight", name: "Annual Freight (USD)", color: "#1d4ed8" }]} />
        </CardBody></Card>
      </div>

      {/* flows + hotspots */}
      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <Card>
          <CardHeader><CardTitle>Flow Analysis by Segment</CardTitle></CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 dark:border-slate-700 text-left bg-slate-50 dark:bg-slate-900/50">
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Segment</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 text-right">Material (t)</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 text-right">Freight</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 text-right">CO₂e</th>
              </tr></thead>
              <tbody>
                <tr className="bg-brand/5 dark:bg-brand/10"><td className="px-4 py-1.5 text-xs font-bold text-brand dark:text-cyan-400 uppercase" colSpan={4}>Inbound</td></tr>
                {inbound.map((f) => <FlowRow key={f.segment} f={f} />)}
                <tr className="bg-positive/5 dark:bg-positive/10"><td className="px-4 py-1.5 text-xs font-bold text-positive uppercase" colSpan={4}>Outbound</td></tr>
                {outbound.map((f) => <FlowRow key={f.segment} f={f} />)}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>{hotView === "cost" ? "Cost" : "Emissions"} Hotspots: Top 10</CardTitle>
            <Segmented value={hotView} onChange={setHotView} options={[{ value: "cost", label: "Cost" }, { value: "emissions", label: "Emissions" }]} /></CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 dark:border-slate-700 text-left bg-slate-50 dark:bg-slate-900/50">
                <th className="px-5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Lane</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Mode</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 text-right">{hotView === "cost" ? "Freight" : "CO₂e"}</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 w-1/4">Share</th>
              </tr></thead>
              <tbody>
                {hotspots.map((h, i) => {
                  const val = hotView === "cost" ? h.annual_freight_usd : h.annual_co2e;
                  const max = hotView === "cost" ? hotspots[0].annual_freight_usd : hotspots[0].annual_co2e;
                  return (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-5 py-2.5 font-medium text-ink-900 dark:text-white">{h.lane}</td>
                      <td className="px-5 py-2.5 capitalize text-slate-600 dark:text-slate-300">{h.mode}</td>
                      <td className="px-5 py-2.5 text-right numeric text-ink-900 dark:text-white">{hotView === "cost" ? fmtUSD(val) : fmtCO2(val)}</td>
                      <td className="px-5 py-2.5"><div className="flex items-center gap-2">
                        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full flex-1"><div className="h-full bg-gradient-to-r from-brand to-brand-600 dark:from-cyan-400 dark:to-cyan-600 rounded-full" style={{ width: `${(val / max) * 100}%` }} /></div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 numeric w-10">{fmtPct(h.pct_of_total)}</span>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>

      {/* Opportunity insights */}
      <OpportunityInsights modeData={modeData} hot={hot} sum={sum} />
    </>
  );
}

/* ── Journey Explorer (spec §84–89) ─────────────────────────────────────────── */
function JourneyExplorer({ carbon, best }: { carbon: number; best: number }) {
  const [product, setProduct] = useState(PRODUCTS[0]);
  const [journey, setJourney] = useState<any>(null);
  const [stage, setStage] = useState<number | null>(null);
  const [attr, setAttr] = useState<"emissions" | "cost" | "lead">("emissions");

  useEffect(() => { setJourney(null); setStage(null); api.networkJourney(product).then(setJourney).catch(() => setJourney(null)); }, [product]);

  const tces: any[] = journey?.tces ?? [];
  const k = journey?.kpis ?? {};
  const attrVal = (t: any) => attr === "emissions" ? (t.per_unit_transport_kg_co2e ?? 0) + (t.per_unit_handling_kg_co2e ?? 0) : attr === "cost" ? (t.per_unit_cost_usd ?? 0) : (t.transit_days ?? 0);
  const attrTotal = tces.reduce((a, t) => a + attrVal(t), 0) || 1;

  const currentT = k.total_per_unit_t_co2e ?? 0;
  const bestT = currentT * (1 - best / 100);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Journey Explorer — how a {product} arrives</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={product} onChange={(e) => setProduct(e.target.value)} className="py-1.5 text-xs">
            {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
          <Segmented value={attr} onChange={(v) => setAttr(v as any)} options={[{ value: "emissions", label: "Emissions" }, { value: "cost", label: "Cost" }, { value: "lead", label: "Lead time" }]} />
        </div>
      </CardHeader>
      <CardBody>
        {tces.length === 0 ? <Spinner label="Tracing journey…" /> : (
          <>
            {/* journey KPI bar */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <Mini label="Journey Cost / unit" value={fmtUSD(k.total_per_unit_cost_usd)} />
              <Mini label="Journey Emissions / unit" value={`${fmtNum(k.total_per_unit_kg_co2e, 1)} kg`} />
              <Mini label="Lead Time" value={`${fmtNum(k.total_transit_days, 1)} d`} />
              <Mini label="Legs / Modes" value={`${k.legs ?? tces.length} · ${k.modes ?? "—"}`} />
              <Mini label="Border Crossings" value={String(k.border_crossings ?? "—")} />
            </div>

            {/* horizontal stage timeline */}
            <div className="flex items-stretch gap-1 overflow-x-auto pb-2">
              {tces.map((t, i) => {
                const share = (attrVal(t) / attrTotal) * 100;
                return (
                  <div key={i} className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setStage(stage === i ? null : i)}
                      className={`rounded-lg border px-3 py-2 min-w-[150px] text-left transition-all ${stage === i ? "border-brand/50 bg-brand-50 dark:border-cyan-400/50 dark:bg-cyan-500/10" : "border-slate-200 dark:border-slate-700 hover:border-brand/30 bg-white dark:bg-slate-900/50"}`}>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">{t.segment}</div>
                      <div className="text-xs font-semibold text-ink-900 dark:text-white truncate max-w-[150px]">{t.origin} → {t.destination}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{t.mode} · {t.carrier}</div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-600 dark:from-cyan-400 dark:to-cyan-600" style={{ width: `${Math.max(3, share)}%` }} />
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">{fmtNum(share, 0)}% of {attr}</div>
                    </button>
                    {i < tces.length - 1 && <span className="text-slate-300 dark:text-slate-600">→</span>}
                  </div>
                );
              })}
            </div>

            {/* stage breakdown */}
            {stage !== null && tces[stage] && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <Mini label="Distance" value={`${fmtNum(tces[stage].distance_km)} km`} />
                <Mini label="Mode" value={tces[stage].mode} />
                <Mini label="Carrier" value={tces[stage].carrier} />
                <Mini label="Transit" value={`${fmtNum(tces[stage].transit_days, 1)} d`} />
                <Mini label="Transport CO₂e" value={`${fmtNum(tces[stage].per_unit_transport_kg_co2e, 2)} kg`} />
                <Mini label="Cost / unit" value={fmtUSD(tces[stage].per_unit_cost_usd)} />
              </div>
            )}

            {/* current vs best state */}
            <div className="mt-4 grid md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Current</div>
                <div className="text-lg font-bold text-ink-900 dark:text-white numeric">{fmtNum(currentT, 3)} t/unit</div>
              </div>
              <div className="rounded-lg border border-positive/30 bg-positive/5 dark:bg-positive/10 p-3">
                <div className="text-[11px] uppercase tracking-wide text-positive">Best achievable</div>
                <div className="text-lg font-bold text-positive numeric">{fmtNum(bestT, 3)} t/unit</div>
              </div>
              <div className="rounded-lg border border-brand/30 bg-brand-50/50 dark:bg-cyan-500/5 p-3 flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-brand dark:text-cyan-400">Reduction potential</div>
                  <div className="text-lg font-bold text-brand dark:text-cyan-400 numeric">{fmtPct(best)}</div>
                </div>
                <Link href="/scenarios"><span className="text-xs text-brand dark:text-cyan-400 underline">Investigate →</span></Link>
              </div>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

/* ── Opportunity Insights (spec §92–94) ─────────────────────────────────────── */
function OpportunityInsights({ modeData, hot, sum }: { modeData: any[]; hot: any; sum: any }) {
  const insights = useMemo(() => {
    const out: { text: string; priority: "High" | "Medium" | "Low"; emissions: boolean }[] = [];
    const totCo2 = modeData.reduce((a, m) => a + m.co2e, 0) || 1;
    const totFreight = modeData.reduce((a, m) => a + m.freight, 0) || 1;
    const air = modeData.find((m) => m.name === "Air");
    if (air && air.co2e > 0) {
      out.push({ text: `Air freight is ${fmtPct((air.freight / totFreight) * 100)} of cost but ${fmtPct((air.co2e / totCo2) * 100)} of emissions — the highest-leverage modal-shift opportunity.`, priority: "High", emissions: true });
    }
    const topEm = hot.emissions?.[0];
    if (topEm) out.push({ text: `Lane "${topEm.lane}" (${topEm.mode}) alone contributes ${fmtPct(topEm.pct_of_total)} of network emissions.`, priority: "High", emissions: true });
    const ocean = modeData.find((m) => m.name === "Ocean");
    if (ocean) out.push({ text: `Ocean carries ${fmtPct((ocean.co2e / totCo2) * 100)} of emissions at ${fmtPct((ocean.freight / totFreight) * 100)} of cost — efficient backbone; focus optimization on carrier/route, not mode.`, priority: "Medium", emissions: true });
    const topCost = hot.cost?.[0];
    if (topCost) out.push({ text: `Highest-cost lane "${topCost.lane}" is ${fmtPct(topCost.pct_of_total)} of freight spend — review carrier and consolidation.`, priority: "Medium", emissions: false });
    out.push({ text: `Network emission intensity is ${fmtNum(sum.network_intensity_g_per_tkm, 1)} gCO₂e/tkm — benchmark against GLEC class factors in Sustainability.`, priority: "Low", emissions: true });
    return out;
  }, [modeData, hot, sum]);

  const pv: Record<string, "red" | "amber" | "slate"> = { High: "red", Medium: "amber", Low: "slate" };
  return (
    <Card className="mb-2">
      <CardHeader><CardTitle>Opportunity Insights</CardTitle><div className="text-[11px] text-slate-400">sustainability-first · ranked by potential</div></CardHeader>
      <CardBody className="space-y-2">
        {insights.map((ins, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
            <Badge variant={pv[ins.priority]}>{ins.priority}</Badge>
            <div className="text-sm text-slate-700 dark:text-slate-300 flex-1">{ins.text}</div>
            <Link href="/scenarios"><span className="text-xs text-brand dark:text-cyan-400 underline whitespace-nowrap">Investigate →</span></Link>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function FlowRow({ f }: { f: any }) {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <td className="px-4 py-2 pl-7 font-medium text-ink-900 dark:text-white text-sm">{f.segment}</td>
      <td className="px-4 py-2 text-right numeric text-ink-900 dark:text-white">{fmtNum(f.material_tonnes)}</td>
      <td className="px-4 py-2 text-right numeric text-ink-900 dark:text-white">{fmtUSD(f.freight_usd)}</td>
      <td className="px-4 py-2 text-right numeric text-ink-900 dark:text-white">{fmtCO2(f.co2e)}</td>
    </tr>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-sm font-bold text-ink-900 dark:text-white numeric mt-0.5 capitalize">{value}</div>
    </div>
  );
}
