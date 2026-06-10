"use client";

import { useEffect, useMemo, useState } from "react";
import { api, fmtUSD, fmtNum } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardBody, KPI, PageHeader, Spinner, Badge, Segmented } from "@/components/ui";
import { ScatterCard, BarChartCard } from "@/components/charts";

export default function LandedPage() {
  const [landed, setLanded] = useState<any>(null);
  const [grain, setGrain] = useState<"family" | "sku">("family");

  useEffect(() => { api.landed().then(setLanded).catch(() => {}); }, []);
  if (!landed) return <Spinner label="Computing landed cost & emissions..." />;

  const rows = grain === "family" ? landed.by_family : landed.by_sku;
  const scatter = (grain === "family" ? landed.by_family : landed.by_sku).map((r: any) => ({
    x: grain === "family" ? r.avg_landed_cost : r.landed_cost_per_unit,
    y: grain === "family" ? r.avg_landed_emissions : r.landed_emissions_per_unit,
    name: grain === "family" ? r.family : r.sku,
  }));
  const cemChart = landed.by_family.map((f: any) => ({ name: f.family, value: f.carbon_efficiency_margin }));

  return (
    <>
      <PageHeader eyebrow="Strategic Trade-Off" title="Landed Cost vs Landed Emissions"
        desc="Evaluate the true delivered cost and total embedded emissions of every product, including Carbon Efficiency Margin (profit generated per ton of CO₂e)." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPI label="Product Families" value={fmtNum(landed.by_family.length)} accent="default" />
        <KPI label="SKUs Analyzed" value={fmtNum(landed.by_sku.length)} accent="default" />
        <KPI label="Avg Landed Cost" value={fmtUSD(landed.by_family.reduce((s: number, f: any) => s + f.avg_landed_cost, 0) / landed.by_family.length, false)} accent="blue" />
        <KPI label="Avg Carbon Eff. Margin" value={fmtUSD(landed.by_family.reduce((s: number, f: any) => s + f.carbon_efficiency_margin, 0) / landed.by_family.length)} sub="margin per tCO₂e" accent="green" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <Card>
          <CardHeader><CardTitle>Cost-Emissions Frontier</CardTitle>
            <Segmented value={grain} onChange={setGrain} options={[{ value: "family", label: "Family" }, { value: "sku", label: "SKU" }]} /></CardHeader>
          <CardBody><ScatterCard data={scatter} /></CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Carbon Efficiency Margin by Family</CardTitle><Badge variant="green">Gross margin / tCO₂e</Badge></CardHeader>
          <CardBody><BarChartCard data={cemChart} x="name" bars={[{ key: "value", name: "Margin / tCO₂e", color: "#0e9f6e" }]} horizontal currency height={300} /></CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{grain === "family" ? "Product Family" : "SKU"} Detail</CardTitle></CardHeader>
        <CardBody className="p-0">
          <div className="max-h-[460px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b border-slate-100 text-left">
                {(grain === "family"
                  ? ["Family", "SKUs", "Volume", "Landed Cost", "Landed Emissions", "Margin", "Carbon Eff."]
                  : ["SKU", "Family", "Volume", "Landed Cost", "Landed Emissions", "Margin", "Carbon Eff."]
                ).map((h, i) => <th key={h} className={`px-5 py-2.5 text-xs font-semibold text-slate-500 ${i >= 2 ? "text-right" : ""}`}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-5 py-2.5 font-medium text-ink-900">{grain === "family" ? r.family : r.sku}</td>
                    <td className="px-5 py-2.5 text-slate-500">{grain === "family" ? r.skus : r.family}</td>
                    <td className="px-5 py-2.5 text-right font-mono">{fmtNum(grain === "family" ? r.annual_volume : r.annual_volume)}</td>
                    <td className="px-5 py-2.5 text-right font-mono">{fmtUSD(grain === "family" ? r.avg_landed_cost : r.landed_cost_per_unit, false)}</td>
                    <td className="px-5 py-2.5 text-right font-mono">{fmtNum(grain === "family" ? r.avg_landed_emissions : r.landed_emissions_per_unit, 1)} kg</td>
                    <td className="px-5 py-2.5 text-right font-mono">{fmtUSD(grain === "family" ? r.avg_margin : r.margin_per_unit, false)}</td>
                    <td className="px-5 py-2.5 text-right font-mono text-positive">{fmtUSD(r.carbon_efficiency_margin)}</td>
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
