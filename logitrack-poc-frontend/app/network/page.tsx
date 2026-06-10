"use client";

import { useCallback, useEffect, useState } from "react";
import { api, fmtUSD, fmtCO2, fmtNum, fmtPct } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardBody, KPI, PageHeader, Spinner, ApiError, Badge, Segmented } from "@/components/ui";
import { NetworkMap } from "@/components/charts/network-map";
import { DualAxisBarChart, BarChartCard } from "@/components/charts";

const INBOUND_SEGS  = ["Supplier→Port", "Port→Plant", "Supplier→Plant"];
const OUTBOUND_SEGS = ["Plant→Plant", "Plant→DC", "DC→DC"];

export default function NetworkPage() {
  const [sum, setSum]           = useState<any>(null);
  const [graph, setGraph]       = useState<any>(null);
  const [flows, setFlows]       = useState<any>(null);
  const [hot, setHot]           = useState<any>(null);
  const [hotView, setHotView]   = useState<"cost" | "emissions">("cost");
  const [error, setError]       = useState(false);

  const load = useCallback(() => {
    setError(false);
    setSum(null); setGraph(null); setFlows(null); setHot(null);
    Promise.all([
      api.networkSummary(),
      api.networkGraph(),
      api.networkFlows(),
      api.networkHotspots(),
    ])
      .then(([s, g, f, h]) => { setSum(s); setGraph(g); setFlows(f); setHot(h); })
      .catch(() => setError(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) return <ApiError retry={load} />;
  if (!sum || !graph || !flows || !hot) return <Spinner label="Building network intelligence..." />;

  const byMode = (sum.by_mode ?? {}) as Record<string, any>;
  const modeData = Object.entries(byMode)
    .filter(([, v]) => v && (v.freight > 0 || v.co2e > 0))
    .map(([k, v]) => ({
      name: k[0].toUpperCase() + k.slice(1),
      freight: v.freight ?? 0,
      co2e: v.co2e ?? 0,
    }));

  const crossBorder = graph.edges.filter((e: any) => e.cross_border).length;
  const hotspots: any[] = hotView === "cost" ? hot.cost : hot.emissions;

  const flowRows: any[] = flows.flows ?? [];
  const inbound  = flowRows.filter((f: any) => INBOUND_SEGS.includes(f.segment));
  const outbound = flowRows.filter((f: any) => OUTBOUND_SEGS.includes(f.segment));
  const inboundTotal  = { freight: inbound.reduce((a: number, f: any) => a + f.freight_usd, 0), co2e: inbound.reduce((a: number, f: any) => a + f.co2e, 0) };
  const outboundTotal = { freight: outbound.reduce((a: number, f: any) => a + f.freight_usd, 0), co2e: outbound.reduce((a: number, f: any) => a + f.co2e, 0) };

  // Prepare simple mode charts for split display instead of dual-axis
  const freightByMode = modeData.map((m) => ({ name: m.name, freight: m.freight }));
  const co2eByMode    = modeData.map((m) => ({ name: m.name, co2e: m.co2e }));

  return (
    <>
      <PageHeader
        eyebrow="Network Intelligence"
        title="Logistics Network"
        desc="Unified current-state view across suppliers, plants, distribution centers, carriers, and transportation lanes."
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KPI label="Suppliers"             desc="unique vendors"    value={fmtNum(sum.entity_counts.suppliers)} />
        <KPI label="Plants"                desc="manufacturing"     value={fmtNum(sum.entity_counts.plants)} />
        <KPI label="Distribution Centers"  desc="regional hubs"     value={fmtNum(sum.entity_counts.dcs)} />
        <KPI label="Lanes"                 desc="active routes"     value={fmtNum(sum.entity_counts.lanes)} sub={`${crossBorder} cross-border`} accent="blue" />
        <KPI label="Carriers"              desc="service providers" value={fmtNum(sum.entity_counts.carriers)} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPI label="Annual Freight"    desc="total cost"       value={fmtUSD(sum.total_annual_freight_usd)} accent="blue" />
        <KPI label="Annual Emissions"  desc="CO₂e footprint"   value={fmtCO2(sum.total_annual_co2e)} accent="default" />
        <KPI label="Network Intensity" desc="per tonne-km"     value={`${fmtNum(sum.network_intensity_g_per_tkm, 1)} g/tkm`} sub="WTW per tonne-km" />
        <KPI label="Shipments / yr"    desc="transaction count" value={fmtNum(sum.total_shipments)} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>End-to-End Network Visualization</CardTitle>
          <Badge variant="blue">{graph.nodes.length} nodes · {graph.edges.length} lanes</Badge>
        </CardHeader>
        <CardBody>
          <NetworkMap nodes={graph.nodes} edges={graph.edges} />
        </CardBody>
      </Card>

      {/* Emissions & Freight by Mode — split into two clear charts */}
      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <Card>
          <CardHeader><CardTitle>Freight by Mode</CardTitle></CardHeader>
          <CardBody>
            {freightByMode.length > 0
              ? <BarChartCard
                  data={freightByMode} x="name" currency height={220}
                  bars={[{ key: "freight", name: "Annual Freight (USD)", color: "#1d4ed8" }]}
                />
              : <div className="py-8 text-center text-slate-400 text-sm">No mode data available</div>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Emissions by Mode</CardTitle></CardHeader>
          <CardBody>
            {co2eByMode.length > 0
              ? <BarChartCard
                  data={co2eByMode} x="name" height={220}
                  bars={[{ key: "co2e", name: "Annual CO₂e (t)", color: "#0e9f6e" }]}
                />
              : <div className="py-8 text-center text-slate-400 text-sm">No emissions data available</div>}
          </CardBody>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <Card>
          <CardHeader><CardTitle>Flow Analysis by Segment</CardTitle></CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-left bg-slate-50 dark:bg-slate-900/50">
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Segment</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 text-right">Material (t)</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 text-right">Freight</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 text-right">CO₂e</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-brand/5 dark:bg-brand/10">
                  <td className="px-4 py-1.5 text-xs font-bold text-brand dark:text-brand-300 uppercase tracking-wide" colSpan={4}>Inbound</td>
                </tr>
                {inbound.map((f: any) => (
                  <tr key={f.segment} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-2 pl-7 font-medium text-ink-900 dark:text-white text-sm">{f.segment}</td>
                    <td className="px-4 py-2 text-right font-mono text-ink-900 dark:text-white">{fmtNum(f.material_tonnes)}</td>
                    <td className="px-4 py-2 text-right font-mono text-ink-900 dark:text-white">{fmtUSD(f.freight_usd)}</td>
                    <td className="px-4 py-2 text-right font-mono text-ink-900 dark:text-white">{fmtCO2(f.co2e)}</td>
                  </tr>
                ))}
                <tr className="border-b-2 border-brand/20 dark:border-brand/30 bg-brand/5 dark:bg-brand/10">
                  <td className="px-4 py-1.5 pl-7 text-xs font-semibold text-slate-600 dark:text-slate-300">Inbound total</td>
                  <td className="px-4 py-1.5 text-right text-xs font-semibold font-mono text-slate-700 dark:text-slate-200">—</td>
                  <td className="px-4 py-1.5 text-right text-xs font-semibold font-mono text-slate-700 dark:text-slate-200">{fmtUSD(inboundTotal.freight)}</td>
                  <td className="px-4 py-1.5 text-right text-xs font-semibold font-mono text-slate-700 dark:text-slate-200">{fmtCO2(inboundTotal.co2e)}</td>
                </tr>

                <tr className="bg-positive/5 dark:bg-positive/10">
                  <td className="px-4 py-1.5 text-xs font-bold text-positive uppercase tracking-wide" colSpan={4}>Outbound</td>
                </tr>
                {outbound.map((f: any) => (
                  <tr key={f.segment} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-2 pl-7 font-medium text-ink-900 dark:text-white text-sm">{f.segment}</td>
                    <td className="px-4 py-2 text-right font-mono text-ink-900 dark:text-white">{fmtNum(f.material_tonnes)}</td>
                    <td className="px-4 py-2 text-right font-mono text-ink-900 dark:text-white">{fmtUSD(f.freight_usd)}</td>
                    <td className="px-4 py-2 text-right font-mono text-ink-900 dark:text-white">{fmtCO2(f.co2e)}</td>
                  </tr>
                ))}
                <tr className="bg-positive/5 dark:bg-positive/10">
                  <td className="px-4 py-1.5 pl-7 text-xs font-semibold text-slate-600 dark:text-slate-300">Outbound total</td>
                  <td className="px-4 py-1.5 text-right text-xs font-semibold font-mono text-slate-700 dark:text-slate-200">—</td>
                  <td className="px-4 py-1.5 text-right text-xs font-semibold font-mono text-slate-700 dark:text-slate-200">{fmtUSD(outboundTotal.freight)}</td>
                  <td className="px-4 py-1.5 text-right text-xs font-semibold font-mono text-slate-700 dark:text-slate-200">{fmtCO2(outboundTotal.co2e)}</td>
                </tr>
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{hotView === "cost" ? "Cost" : "Emissions"} Hotspots: Top 10</CardTitle>
            <Segmented
              value={hotView}
              onChange={setHotView}
              options={[{ value: "cost", label: "Cost" }, { value: "emissions", label: "Emissions" }]}
            />
          </CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-left bg-slate-50 dark:bg-slate-900/50">
                  <th className="px-5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Lane</th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Mode</th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 text-right">
                    {hotView === "cost" ? "Annual Freight" : "Annual CO₂e"}
                  </th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 w-1/4">Share</th>
                </tr>
              </thead>
              <tbody>
                {hotspots.map((h: any, i: number) => {
                  const val = hotView === "cost" ? h.annual_freight_usd : h.annual_co2e;
                  const max = hotView === "cost" ? hotspots[0].annual_freight_usd : hotspots[0].annual_co2e;
                  return (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-2.5 font-medium text-ink-900 dark:text-white">{h.lane}</td>
                      <td className="px-5 py-2.5 capitalize text-slate-600 dark:text-slate-300">{h.mode}</td>
                      <td className="px-5 py-2.5 text-right font-mono text-ink-900 dark:text-white">
                        {hotView === "cost" ? fmtUSD(val) : fmtCO2(val)}
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full flex-1">
                            <div className="h-full bg-gradient-to-r from-brand to-brand-600 dark:from-brand-400 dark:to-brand-600 rounded-full" style={{ width: `${(val / max) * 100}%` }} />
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono w-10">{fmtPct(h.pct_of_total)}</span>
                        </div>
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
