"use client";

import { useEffect, useState } from "react";
import { api, fmtUSD, fmtCO2, fmtNum, fmtPct } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardBody, KPI, PageHeader, Spinner, Badge, Segmented } from "@/components/ui";
import { BarChartCard, DonutCard } from "@/components/charts";

export default function EmissionsPage() {
  const [em, setEm] = useState<any>(null);
  const [view, setView] = useState<"source" | "scope" | "mode">("source");

  useEffect(() => { api.emissions().then(setEm).catch(() => {}); }, []);
  if (!em) return <Spinner label="Computing emissions intelligence..." />;

  const sourceData = Object.entries(em.by_source).map(([name, value]: any) => ({ name, value }));
  const scopeData = Object.entries(em.by_scope).map(([name, value]: any) => ({ name, value }));
  const modeData = Object.entries(em.by_mode).map(([name, value]: any) => ({ name: name[0].toUpperCase() + name.slice(1), value }));
  const active = view === "source" ? sourceData : view === "scope" ? scopeData : modeData;

  return (
    <>
      <PageHeader eyebrow="Digital Twin" title="Emissions Intelligence"
        desc="End-to-end logistics emissions across suppliers, manufacturing, warehousing, transportation, packaging, and reverse logistics." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPI label="Total Footprint" value={fmtCO2(em.total_tco2e)} accent="blue" />
        <KPI label="Carbon Cost Exposure" value={fmtUSD(em.carbon_cost_exposure_usd)} sub="at internal carbon price" accent="amber" />
        <KPI label="Emissions / $1k Revenue" value={`${fmtNum(em.emissions_per_revenue_dollar, 1)} kg`} accent="default" />
        <KPI label="Scope 3 Share" value={fmtPct(em.by_scope["Scope 3"] / em.total_tco2e * 100, 0)} sub="supply-chain emissions" accent="default" />
      </div>

      <div className="grid lg:grid-cols-5 gap-5 mb-6">
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Emissions Breakdown</CardTitle>
            <Segmented value={view} onChange={setView} options={[{ value: "source", label: "By Source" }, { value: "scope", label: "By Scope" }, { value: "mode", label: "By Mode" }]} /></CardHeader>
          <CardBody><BarChartCard data={active} x="name" bars={[{ key: "value", name: "tCO₂e", color: "#1d4ed8" }]} horizontal height={300} /></CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{view === "source" ? "Source" : view === "scope" ? "Scope" : "Mode"} Distribution</CardTitle></CardHeader>
          <CardBody><DonutCard data={active} /></CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Top Emissions Hotspots</CardTitle><Badge variant="amber">Lane-level</Badge></CardHeader>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-left">
              <th className="px-5 py-2.5 text-xs font-semibold text-slate-500">Lane</th>
              <th className="px-5 py-2.5 text-xs font-semibold text-slate-500">Mode</th>
              <th className="px-5 py-2.5 text-xs font-semibold text-slate-500">Segment</th>
              <th className="px-5 py-2.5 text-xs font-semibold text-slate-500 text-right">Emissions</th>
            </tr></thead>
            <tbody>
              {em.hotspots.map((h: any, i: number) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-ink-900">{h.lane}</td>
                  <td className="px-5 py-3"><Badge variant="slate">{h.mode}</Badge></td>
                  <td className="px-5 py-3 text-slate-500 capitalize">{h.segment === "intra" ? "internal" : h.segment}</td>
                  <td className="px-5 py-3 text-right font-mono font-semibold">{fmtCO2(h.co2e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  );
}
