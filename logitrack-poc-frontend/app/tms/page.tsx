"use client";

import { useEffect, useMemo, useState } from "react";
import { api, fmtUSD, fmtCO2, fmtNum, fmtPct } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardBody, KPI, PageHeader, Spinner, Badge, Segmented } from "@/components/ui";
import { BarChartCard } from "@/components/charts";

export default function TMSPage() {
  const [tms, setTms] = useState<any>(null);
  const [modeFilter, setModeFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => { api.tms().then(setTms).catch(() => {}); }, []);
  if (!tms) return <Spinner label="Loading transportation layer..." />;

  const lanes = useMemo(() => {
    return tms.lane_performance.filter((l: any) =>
      (modeFilter === "all" || l.mode === modeFilter) &&
      (!search || l.lane.toLowerCase().includes(search.toLowerCase()) || l.carrier.toLowerCase().includes(search.toLowerCase()))
    );
  }, [tms, modeFilter, search]);

  const carrierChart = tms.carrier_scorecards.slice(0, 8).map((c: any) => ({ name: c.carrier, cost: c.cost_usd, otif: c.avg_otif_pct }));

  return (
    <>
      <PageHeader eyebrow="Digital Twin" title="Transportation Management"
        desc="Lane-level operational visibility: carrier performance, freight cost, OTIF, and service reliability." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPI label="Total Freight Cost" value={fmtUSD(tms.total_freight_cost_usd)} accent="blue" />
        <KPI label="Avg OTIF" value={fmtPct(tms.avg_otif_pct)} accent={tms.avg_otif_pct >= 95 ? "green" : "amber"} />
        <KPI label="SLA Breaches" value={fmtNum(tms.sla_breaches)} sub="lanes below 95% OTIF" accent={tms.sla_breaches > 0 ? "red" : "green"} />
        <KPI label="Active Lanes" value={fmtNum(tms.lane_count)} accent="default" />
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Carrier Scorecards</CardTitle><Badge variant="blue">{tms.carrier_scorecards.length} carriers</Badge></CardHeader>
        <CardBody>
          <BarChartCard data={carrierChart} x="name" bars={[{ key: "cost", name: "Freight Cost $", color: "#1d4ed8" }]} currency height={260} />
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Carrier Performance</CardTitle></CardHeader>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-left">
              {["Carrier", "Lanes", "Shipments", "Cost", "CO₂e", "Avg OTIF", "Modes"].map((h, i) => (
                <th key={h} className={`px-5 py-2.5 text-xs font-semibold text-slate-500 ${i > 0 && i < 6 ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {tms.carrier_scorecards.map((c: any) => (
                <tr key={c.carrier} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-ink-900">{c.carrier}</td>
                  <td className="px-5 py-3 text-right font-mono">{c.lanes}</td>
                  <td className="px-5 py-3 text-right font-mono">{fmtNum(c.shipments)}</td>
                  <td className="px-5 py-3 text-right font-mono">{fmtUSD(c.cost_usd)}</td>
                  <td className="px-5 py-3 text-right font-mono">{fmtCO2(c.co2e)}</td>
                  <td className="px-5 py-3 text-right font-mono"><span className={c.avg_otif_pct >= 95 ? "text-positive" : "text-warning"}>{fmtPct(c.avg_otif_pct)}</span></td>
                  <td className="px-5 py-3"><div className="flex gap-1">{c.modes.map((m: string) => <Badge key={m} variant="slate">{m}</Badge>)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lane Performance</CardTitle>
          <div className="flex items-center gap-3">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search lane / carrier"
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-brand/40" />
            <Segmented value={modeFilter} onChange={setModeFilter}
              options={[{ value: "all", label: "All" }, { value: "ocean", label: "Ocean" }, { value: "road", label: "Road" }, { value: "air", label: "Air" }, { value: "rail", label: "Rail" }]} />
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b border-slate-100 text-left">
                {["Lane", "Carrier", "Mode", "Segment", "Cost/Ship", "Transit", "OTIF"].map((h, i) => (
                  <th key={h} className={`px-5 py-2.5 text-xs font-semibold text-slate-500 ${i >= 4 ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {lanes.map((l: any) => (
                  <tr key={l.lane_id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-5 py-2.5 font-medium text-ink-900">{l.lane}</td>
                    <td className="px-5 py-2.5 text-slate-600">{l.carrier}</td>
                    <td className="px-5 py-2.5"><Badge variant="slate">{l.mode}</Badge></td>
                    <td className="px-5 py-2.5 text-slate-500 capitalize">{l.segment === "intra" ? "internal" : l.segment}</td>
                    <td className="px-5 py-2.5 text-right font-mono">{fmtUSD(l.cost_per_shipment)}</td>
                    <td className="px-5 py-2.5 text-right font-mono">{l.transit_days}d</td>
                    <td className="px-5 py-2.5 text-right font-mono"><span className={l.otif_pct >= 95 ? "text-positive" : "text-warning"}>{fmtPct(l.otif_pct)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
