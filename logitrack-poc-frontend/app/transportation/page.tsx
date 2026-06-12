"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, fmtUSD, fmtCO2, fmtNum, fmtPct } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardBody, KPI, PageHeader, Spinner, ApiError, Badge, Segmented, Select } from "@/components/ui";
import { HBarList, DonutCard } from "@/components/charts";

const DISPOSITION_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  GROW:   { bg: "bg-positive/10",  text: "text-positive", border: "border-positive/30" },
  RETAIN: { bg: "bg-brand/10",     text: "text-brand",    border: "border-brand/30" },
  IMPROVE:    { bg: "bg-warning/10",   text: "text-warning",  border: "border-warning/30" },
  EXIT:   { bg: "bg-danger/10",    text: "text-danger",   border: "border-danger/30" },
};

export default function TransportationPage() {
  const [sum,      setSum]      = useState<any>(null);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [lanes,    setLanes]    = useState<any[]>([]);
  const [transit,  setTransit]  = useState<any[]>([]);
  const [modeF,    setModeF]    = useState("all");
  const [search,   setSearch]   = useState("");
  const [product,  setProduct]  = useState("Refrigerator");
  const [flows,    setFlows]    = useState<any>(null);
  // Business decision levers that drive Grow / Retain / Improve / Exit.
  const [emFocus,  setEmFocus]  = useState(25);   // % weight placed on emissions
  const [minOtif,  setMinOtif]  = useState(93);   // min acceptable OTIF %
  const [maxLead,  setMaxLead]  = useState(32);   // max acceptable transit days
  const [maxCostPrem, setMaxCostPrem] = useState(20); // max cost premium vs network avg (%)
  const [error,    setError]    = useState(false);

  const [selectedCarrier, setSelectedCarrier] = useState<string | null>(null);
  const [pack,    setPack]    = useState<any>(null);
  const [packLoading, setPackLoading] = useState(false);

  const load = useCallback(() => {
    setError(false);
    setSum(null);
    Promise.all([
      api.transportSummary(),
      api.carriers(),
      api.lanes(),
      api.transit(),
    ])
      .then(([s, c, l, t]) => { setSum(s); setCarriers(c); setLanes(l); setTransit(t); })
      .catch(() => setError(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Per-product end-to-end journey (sum of segments) for the selected product.
  useEffect(() => {
    if (product === "all") { setFlows(null); return; }
    api.productFlows(product).then(setFlows).catch(() => setFlows(null));
  }, [product]);

  const TPRODUCTS = ["Refrigerator", "Washing Machine", "Air Conditioner", "Microwave Oven", "Dishwasher"];

  // Per-product performance computed from the product's lanes (end-to-end network, not one segment).
  const prod = useMemo(() => {
    const ls = product === "all" ? lanes : lanes.filter((l) => l.product_category === product);
    const ship = ls.reduce((a, l) => a + (l.shipments ?? 0), 0) || 1;
    const freight = ls.reduce((a, l) => a + (l.annual_freight_usd ?? 0), 0);
    const co2 = ls.reduce((a, l) => a + (l.annual_co2e ?? 0), 0);
    const otif = ls.reduce((a, l) => a + (l.otif_pct ?? 0) * (l.shipments ?? 0), 0) / ship;
    const transit = ls.reduce((a, l) => a + (l.transit_days ?? 0) * (l.shipments ?? 0), 0) / ship;
    const fl: any[] = flows?.flows ?? [];
    const e2eCost = fl.length ? fl.reduce((a, f) => a + (f.total_cost_per_shipment ?? 0), 0) / fl.length : null;
    const e2eCo2 = fl.length ? fl.reduce((a, f) => a + (f.total_co2e_per_shipment_t ?? 0), 0) / fl.length : null;
    return { count: ls.length, freight, co2, otif, transit, costPerLaneShip: freight / ship, emPerLaneShip: co2 / ship, e2eCost, e2eCo2 };
  }, [lanes, product, flows]);

  const selectCarrier = useCallback((name: string) => {
    if (selectedCarrier === name) { setSelectedCarrier(null); setPack(null); return; }
    setSelectedCarrier(name);
    setPackLoading(true);
    setPack(null);
    api.carrierPack(name)
      .then((p) => { setPack(p); setPackLoading(false); })
      .catch(() => setPackLoading(false));
  }, [selectedCarrier]);

  const filtered = useMemo(() =>
    lanes.filter((l) =>
      (modeF === "all" || l.mode === modeF) &&
      (product === "all" || l.product_category === product) &&
      (search === "" ||
        l.lane.toLowerCase().includes(search.toLowerCase()) ||
        l.carrier.toLowerCase().includes(search.toLowerCase()))
    ),
    [lanes, modeF, search, product],
  );

  // Network reference points used to normalise each carrier KPI.
  const refs = useMemo(() => {
    const n = carriers.length || 1;
    const avg = (k: string) => carriers.reduce((a, c) => a + (Number(c[k]) || 0), 0) / n;
    return {
      cps: avg("cost_per_shipment") || 1,
      intensity: avg("emission_intensity_g_per_tkm") || 1,
      transit: avg("avg_transit_days") || 1,
    };
  }, [carriers]);

  // Disposition decided live from the business levers (emissions focus + service/lead/cost guardrails).
  const dispOf = useCallback((c: any) => {
    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    const cps = Number(c.cost_per_shipment) || 0;
    const otif = Number(c.avg_otif_pct) || 0;
    const intensity = Number(c.emission_intensity_g_per_tkm) || 0;
    const transit = Number(c.avg_transit_days) || 0;
    const costScore = clamp(100 * (1.5 - cps / refs.cps));
    const emitScore = clamp(100 * (1.5 - intensity / refs.intensity));
    const leadScore = clamp(100 * (1.5 - transit / refs.transit));
    const svcScore = clamp(otif);
    const eW = emFocus / 100, rest = 1 - eW;
    const score = eW * emitScore + rest * (0.45 * costScore + 0.35 * svcScore + 0.20 * leadScore);
    // hard business guardrails
    let violations = 0;
    if (otif < minOtif) violations++;
    if (transit > maxLead) violations++;
    if (cps > refs.cps * (1 + maxCostPrem / 100)) violations++;
    let disp = score >= 68 ? "GROW" : score >= 54 ? "RETAIN" : score >= 42 ? "IMPROVE" : "EXIT";
    if (violations >= 2) disp = "EXIT";
    else if (violations === 1 && (disp === "GROW" || disp === "RETAIN")) disp = "IMPROVE";
    return disp;
  }, [refs, emFocus, minOtif, maxLead, maxCostPrem]);

  const dispositionSummary = useMemo(() => {
    const counts: Record<string, number> = { GROW: 0, RETAIN: 0, IMPROVE: 0, EXIT: 0 };
    const groups: Record<string, string[]> = { GROW: [], RETAIN: [], IMPROVE: [], EXIT: [] };
    const byCarrier: Record<string, string> = {};
    let spendAtRisk = 0, savingsOpportunity = 0;
    carriers.forEach((c) => {
      const key = dispOf(c);
      byCarrier[c.carrier] = key;
      counts[key] = (counts[key] ?? 0) + 1;
      groups[key].push(c.carrier);
      if (key === "EXIT" || key === "IMPROVE") spendAtRisk += c.annual_freight_usd ?? 0;
      if (key === "EXIT") savingsOpportunity += Math.max(0, (c.cost_per_shipment - (c.cost_per_shipment * 0.93)) * (c.shipments ?? 0));
    });
    return { counts, groups, byCarrier, spendAtRisk, savingsOpportunity };
  }, [carriers, dispOf]);

  if (error) return <ApiError retry={load} />;
  if (!sum)  return <Spinner label="Loading transportation performance..." />;

  // Carrier freight-spend share: top 6 carriers + an "Other" slice (composition, not a ranking).
  const carrierShare = (() => {
    const sorted = [...carriers].sort((a, b) => (b.annual_freight_usd ?? 0) - (a.annual_freight_usd ?? 0));
    const top = sorted.slice(0, 6).map((c) => ({ name: c.carrier, value: c.annual_freight_usd ?? 0 }));
    const other = sorted.slice(6).reduce((a, c) => a + (c.annual_freight_usd ?? 0), 0);
    return other > 0 ? [...top, { name: "Other carriers", value: other }] : top;
  })();

  return (
    <>
      <PageHeader
        eyebrow="Transportation Performance"
        title="Transportation Performance"
        desc="Carrier scorecards, lane performance, freight spend, transit time, and OTIF service monitoring across the network."
        actions={
          <Select value={product} onChange={(e) => setProduct(e.target.value)} aria-label="Product">
            <option value="all">All products</option>
            {TPRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
        <KPI label="Total Freight Cost" value={fmtUSD(prod.freight)} accent="blue" desc={product === "all" ? "all products" : product} />
        <KPI label="Weighted OTIF" value={fmtPct(prod.otif)} sub={`target ${sum.otif_target_pct}%`} accent={prod.otif >= sum.otif_target_pct ? "green" : "amber"} />
        <KPI label="Avg Cost / Lane Shipment" value={fmtUSD(prod.costPerLaneShip)} desc="per-segment leg" />
        <KPI label="Avg Emissions / Lane Shipment" value={fmtCO2(prod.emPerLaneShip)} desc="per-segment leg" accent="green" />
      </div>
      {/* End-to-end per-shipment metrics (full journey, not one segment) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPI label="End-to-End Cost / Shipment" value={prod.e2eCost != null ? fmtUSD(prod.e2eCost) : "- select product"} accent="blue" desc="sum of journey legs" />
        <KPI label="End-to-End Emissions / Shipment" value={prod.e2eCo2 != null ? `${fmtNum(prod.e2eCo2, 2)} t` : "- select product"} accent="green" desc="sum of journey legs" />
        <KPI label="SLA Breaches" value={fmtNum(sum.sla_breaches)} sub={`of ${sum.lane_count} lanes`} accent={sum.sla_breaches > 0 ? "red" : "green"} />
        <KPI label="Avg Transit (lane)" value={`${fmtNum(prod.transit, 1)} d`} desc={`${prod.count} lanes`} />
      </div>

      {/* Carrier Dispositions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Carrier Dispositions</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="red">Spend at risk: {fmtUSD(dispositionSummary.spendAtRisk)}</Badge>
            <Badge variant="green">Savings opportunity: {fmtUSD(dispositionSummary.savingsOpportunity)}</Badge>
          </div>
        </CardHeader>
        <CardBody>
          {/* Business decision levers - tune what matters and re-categorise carriers live */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 mb-4">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Decision levers</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Lever label="Emissions focus" value={emFocus} unit="%" min={0} max={70} onChange={setEmFocus} color="text-positive" hint="weight on emissions vs cost/service" />
              <Lever label="Min OTIF" value={minOtif} unit="%" min={80} max={99} onChange={setMinOtif} color="text-brand dark:text-cyan-400" hint="below this is a service breach" />
              <Lever label="Max lead time" value={maxLead} unit=" d" min={5} max={60} onChange={setMaxLead} color="text-warning" hint="above this is a lead-time breach" />
              <Lever label="Max cost premium" value={maxCostPrem} unit="%" min={0} max={60} onChange={setMaxCostPrem} color="text-warning" hint="vs network average cost/shipment" />
            </div>
            <div className="text-[11px] text-slate-400 mt-2">Grow / Retain need to clear the guardrails; one breach caps a carrier at Improve, two or more force Exit.</div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
            {(["GROW","RETAIN","IMPROVE","EXIT"] as const).map((d) => {
              const st = DISPOSITION_STYLE[d];
              const names: string[] = dispositionSummary.groups[d] ?? [];
              return (
                <div key={d} className={`rounded-xl border p-4 ${st.bg} ${st.border} flex flex-col`}>
                  <div className="flex items-baseline justify-between">
                    <div className={`text-xs font-bold uppercase tracking-wider ${st.text}`}>{d}</div>
                    <div className={`text-3xl font-bold numeric ${st.text}`}>{dispositionSummary.counts[d] ?? 0}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1 max-h-40 overflow-y-auto">
                    {names.length > 0 ? names.map((n) => (
                      <span key={n} className="text-[11px] px-1.5 py-0.5 rounded bg-white/70 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/50">{n}</span>
                    )) : <span className="text-xs text-slate-400">-</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Dispositions computed from cost-per-tkm, OTIF, and emission intensity vs network benchmarks. GROW = outperforms all three; EXIT = underperforms cost &amp; one other dimension with positive net savings after exit penalties.
          </p>
        </CardBody>
      </Card>

      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Carrier Freight Spend share</CardTitle><Badge variant="blue">top {Math.min(7, carrierShare.length)} of {carriers.length}</Badge></CardHeader>
          <CardBody>
            {carrierShare.length > 0
              ? <DonutCard data={carrierShare} height={240} currency />
              : <div className="py-8 text-center text-slate-400 text-sm">No carrier data available</div>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Transit Time by Mode</CardTitle></CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-left">
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Mode</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-right">Avg</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-right">Range</th>
                </tr>
              </thead>
              <tbody>
                {transit.map((t) => (
                  <tr key={t.mode} className="border-b border-slate-50 dark:border-slate-700/50">
                    <td className="px-4 py-2.5 capitalize font-medium">{t.mode}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmtNum(t.avg_days, 1)}d</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-500">{t.min_days}-{t.max_days}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>

      {/* Carrier Scorecards */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Carrier Scorecards</CardTitle>
          <Badge variant="blue">{carriers.length} carriers</Badge>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 text-left">
                {["Carrier", "Modes", "Lanes", "Shipments", "Annual Freight", "Cost/Ship", "Cost/Unit", "Avg Transit", "OTIF", "Intensity (g/tkm)", "Score", "Disposition"].map((h, i) => (
                  <th key={h} className={`px-3 py-2.5 text-xs font-semibold text-slate-500 ${i >= 2 && i <= 10 ? "text-right" : ""} ${h === "Disposition" ? "!text-center" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {carriers.map((c) => {
                const intensityDelta = c.intensity_vs_benchmark ?? 0;
                const isSelected = selectedCarrier === c.carrier;
                const dispKey = dispositionSummary.byCarrier[c.carrier] ?? "RETAIN";
                const ds = DISPOSITION_STYLE[dispKey] ?? DISPOSITION_STYLE.RETAIN;
                return (
                  <tr
                    key={c.carrier}
                    onClick={() => selectCarrier(c.carrier)}
                    className={`border-b border-slate-50 dark:border-slate-700/50 cursor-pointer transition-colors ${isSelected ? "bg-brand-50 dark:bg-brand/10 border-brand/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
                  >
                    <td className="px-3 py-2.5 font-medium text-ink-900 dark:text-white">{c.carrier}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500 capitalize">{(c.modes as string[]).join(", ")}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{c.lanes}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmtNum(c.shipments)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmtUSD(c.annual_freight_usd)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmtUSD(c.cost_per_shipment)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">{fmtUSD(c.cost_per_unit, false)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-500">{fmtNum(c.avg_transit_days, 1)}d</td>
                    <td className={`px-3 py-2.5 text-right font-mono ${c.avg_otif_pct < 95 ? "text-danger" : "text-positive"}`}>
                      {fmtPct(c.avg_otif_pct)}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-mono text-xs ${intensityDelta > 0.1 ? "text-danger" : intensityDelta < -0.05 ? "text-positive" : "text-slate-500"}`}>
                      {fmtNum(c.emission_intensity_g_per_tkm, 0)}
                      <span className="text-[10px] ml-1">({intensityDelta >= 0 ? "+" : ""}{fmtNum(intensityDelta * 100, 0)}%)</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-brand dark:text-brand-400">{fmtNum(c.carrier_score, 0)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${ds.bg} ${ds.text}`}>{dispKey}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {/* Carrier Decision Pack */}
      {selectedCarrier && (
        <Card className="mb-6 border-brand/20 dark:border-brand/30">
          <CardHeader>
            <CardTitle>Carrier Decision Pack - {selectedCarrier}</CardTitle>
            <button onClick={() => { setSelectedCarrier(null); setPack(null); }} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕ Close</button>
          </CardHeader>
          <CardBody>
            {packLoading && <Spinner label="Loading carrier pack..." />}
            {pack && !packLoading && <CarrierDecisionPack pack={pack} />}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lane Performance ({filtered.length} shown)</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lane / carrier..."
              className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white dark:bg-slate-900 text-ink-900 dark:text-white"
            />
            <Segmented
              value={modeF} onChange={setModeF}
              options={[
                { value: "all",   label: "All" },
                { value: "ocean", label: "Ocean" },
                { value: "road",  label: "Road" },
                { value: "rail",  label: "Rail" },
                { value: "air",   label: "Air" },
              ]}
            />
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-slate-950">
                <tr className="border-b border-slate-100 dark:border-slate-700 text-left">
                  {["Lane", "Carrier", "Mode", "Segment", "Cost/Ship", "Transit", "OTIF"].map((h, i) => (
                    <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-slate-500 ${i >= 4 ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.lane_id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-2.5 font-medium text-ink-900 dark:text-white">{l.lane}</td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{l.carrier}</td>
                    <td className="px-4 py-2.5 capitalize text-slate-500 dark:text-slate-400">{l.mode}</td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 text-xs">{l.segment}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmtUSD(l.cost_per_shipment)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-500">{l.transit_days}d</td>
                    <td className={`px-4 py-2.5 text-right font-mono ${l.otif_pct < 95 ? "text-danger" : "text-positive"}`}>
                      {fmtPct(l.otif_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* V3.0 - Port congestion intelligence + transportation decarbonization */}
      <PortCongestion />
      <DecarbonizationOpportunities />
    </>
  );
}

/* ── Port Congestion Intelligence (spec §116-119) ───────────────────────────── */
function PortCongestion() {
  const [ports, setPorts] = useState<any[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => { api.ports().then(setPorts).catch(() => setPorts([])); }, []);
  if (ports.length === 0) return null;
  const sv: Record<string, "red" | "amber" | "green"> = { Critical: "red", Elevated: "amber", Normal: "green" };
  return (
    <Card className="mt-6">
      <CardHeader><CardTitle>Port Congestion Intelligence</CardTitle><div className="text-[11px] text-slate-400">waiting time → cost & idle emissions (observed constraint, shown separately from transport emissions)</div></CardHeader>
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 dark:border-slate-700 text-left bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <th className="px-4 py-2.5">Port</th><th className="px-4 py-2.5">Country</th>
              <th className="px-4 py-2.5 text-right">Avg Wait</th><th className="px-4 py-2.5 text-right">Congestion</th>
              <th className="px-4 py-2.5 text-right">Journeys</th><th className="px-4 py-2.5 text-right">Delay Cost</th>
              <th className="px-4 py-2.5 text-right">Idle Emissions</th><th className="px-4 py-2.5 text-center">Status</th>
            </tr></thead>
            <tbody>
              {ports.map((p, i) => (
                <tr key={i} onClick={() => setSel(sel === i ? null : i)} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                  <td className="px-4 py-2.5 font-medium text-ink-900 dark:text-white">{p.port}</td>
                  <td className="px-4 py-2.5 text-slate-500">{p.country}</td>
                  <td className="px-4 py-2.5 text-right numeric text-ink-900 dark:text-white">{fmtNum(p.avg_wait_time_days, 1)} d</td>
                  <td className="px-4 py-2.5 text-right"><div className="flex items-center gap-2 justify-end"><div className="h-1.5 w-16 bg-slate-200 dark:bg-slate-700 rounded-full"><div className="h-full rounded-full bg-warning" style={{ width: `${p.congestion_index}%` }} /></div><span className="numeric text-slate-500 w-8">{fmtNum(p.congestion_index)}</span></div></td>
                  <td className="px-4 py-2.5 text-right numeric text-slate-600 dark:text-slate-400">{p.affected_journeys}</td>
                  <td className="px-4 py-2.5 text-right numeric text-danger">{fmtUSD(p.delay_cost_usd)}</td>
                  <td className="px-4 py-2.5 text-right numeric text-warning">{fmtCO2(p.idle_emissions_tco2e)}</td>
                  <td className="px-4 py-2.5 text-center"><Badge variant={sv[p.status] ?? "slate"}>{p.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

/* ── Transportation Decarbonization Opportunities (spec §121-125) ───────────── */
function DecarbonizationOpportunities() {
  const [recs, setRecs] = useState<any[]>([]);
  useEffect(() => { api.recommendations(75).then((d) => setRecs(d.recommendations ?? [])).catch(() => setRecs([])); }, []);
  // transportation-only levers: route / carrier / modal - no sourcing or plant change
  const opps = recs.filter((r) => ["route", "carrier", "modal_shift"].includes(r.type)).slice(0, 6);
  if (opps.length === 0) return null;
  return (
    <Card className="mt-6 mb-2">
      <CardHeader><CardTitle>Transportation Decarbonization Opportunities</CardTitle><div className="text-[11px] text-slate-400">mode / carrier / route changes only · benefits and tradeoffs shown explicitly</div></CardHeader>
      <CardBody className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {opps.map((o) => (
          <div key={o.scenario_id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-sm font-semibold text-ink-900 dark:text-white truncate">{o.name}</div>
              <Badge variant={o.cost_impact_pct <= 0 && o.emissions_reduction_pct > 0 ? "green" : "amber"}>{o.type}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div className="rounded-lg bg-positive/5 dark:bg-positive/10 px-2 py-1.5">
                <div className="text-[10px] uppercase text-positive">Emissions</div>
                <div className="font-bold numeric text-positive">−{fmtNum(o.emissions_reduction_pct, 1)}%</div>
              </div>
              <div className={`rounded-lg px-2 py-1.5 ${o.cost_impact_pct <= 0 ? "bg-positive/5 dark:bg-positive/10" : "bg-danger/5 dark:bg-danger/10"}`}>
                <div className={`text-[10px] uppercase ${o.cost_impact_pct <= 0 ? "text-positive" : "text-danger"}`}>Cost</div>
                <div className={`font-bold numeric ${o.cost_impact_pct <= 0 ? "text-positive" : "text-danger"}`}>{o.cost_impact_pct > 0 ? "+" : ""}{fmtNum(o.cost_impact_pct, 1)}%</div>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <div className="flex justify-between"><span>Annual savings</span><span className="font-semibold text-ink-900 dark:text-white">{fmtUSD(o.annual_savings_usd)}</span></div>
              <div className="flex justify-between"><span>Lead-time tradeoff</span><span className={`font-semibold ${o.transit_impact_days > 0 ? "text-warning" : "text-positive"}`}>{o.transit_impact_days > 0 ? "+" : ""}{fmtNum(o.transit_impact_days, 1)} d</span></div>
              <div className="flex justify-between"><span>Decision score</span><span className="font-semibold text-ink-900 dark:text-white">{Math.round(o.decision_score)}</span></div>
            </div>
            <Link href={`/scenarios`}><span className="inline-block mt-3 text-xs text-brand dark:text-cyan-400 underline">Evaluate scenario →</span></Link>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function Lever({ label, value, min, max, onChange, color, unit = "", hint }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; color: string; unit?: string; hint?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{label}</span>
        <span className={`text-sm font-bold numeric ${color}`}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-brand" />
      {hint && <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div>}
    </div>
  );
}

function CarrierDecisionPack({ pack }: { pack: any }) {
  const disp = pack.disposition as string;
  const dispKey = ["GROW","RETAIN","IMPROVE","EXIT"].includes(disp) ? disp : "RETAIN";
  const st = DISPOSITION_STYLE[dispKey] ?? { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" };
  const stats = pack.stats ?? {};
  const bench = pack.benchmark ?? {};
  const exit  = pack.exit_analysis ?? {};
  const scores = pack.score_components ?? {};

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className={`inline-block px-4 py-1.5 rounded-lg text-sm font-bold ${st.bg} ${st.text}`}>{dispKey}</span>
          <div className="text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-2xl">{pack.narrative}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Carrier Score</div>
          <div className="text-3xl font-bold text-ink-900 dark:text-white numeric">{fmtNum(pack.carrier_score, 0)}</div>
          <div className="text-xs text-slate-400">/100</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Cost Efficiency", val: scores.cost_efficiency },
          { label: "Service (OTIF)",  val: scores.service_otif },
          { label: "Emissions",       val: scores.emissions },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-100 dark:border-slate-700 p-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">{s.label}</div>
            <div className="text-lg font-bold text-ink-900 dark:text-white numeric mb-2">{fmtNum(s.val, 0)}</div>
            <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full">
              <div className="h-full bg-gradient-to-r from-brand to-brand-600 dark:from-brand-400 dark:to-brand-600 rounded-full" style={{ width: `${Math.max(2, s.val)}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatBlock title="Cost" rows={[
          { label: "Annual freight",      val: fmtUSD(stats.annual_freight_usd) },
          { label: "Cost / shipment",     val: fmtUSD(stats.cost_per_shipment) },
          { label: "Cost / unit",         val: fmtUSD(stats.cost_per_unit, false) },
          { label: "Benchmark / ship",    val: fmtUSD(bench.network_cost_per_shipment) },
          { label: "vs Benchmark",        val: `${bench.cost_vs_benchmark_pct >= 0 ? "+" : ""}${fmtNum(bench.cost_vs_benchmark_pct, 1)}%`, flag: bench.cost_vs_benchmark_pct > 5 },
        ]} />
        <StatBlock title="Service" rows={[
          { label: "Shipments / yr",  val: fmtNum(stats.shipments) },
          { label: "OTIF",            val: fmtPct(stats.avg_otif_pct), flag: stats.avg_otif_pct < 95 },
          { label: "OTIF target",     val: "95.0%" },
          { label: "Avg transit",     val: `${fmtNum(stats.avg_transit_days, 1)}d` },
          { label: "Lanes",           val: fmtNum(stats.lanes) },
        ]} />
        <StatBlock title="Emissions" rows={[
          { label: "Annual CO₂e",      val: fmtCO2(stats.annual_co2e ?? 0) },
          { label: "Intensity (g/tkm)",val: `${fmtNum(stats.emission_intensity_g_per_tkm, 0)}` },
          { label: "Benchmark (g/tkm)",val: `${fmtNum(bench.network_emission_intensity, 0)}` },
          { label: "vs Benchmark",     val: `${bench.intensity_vs_benchmark_pct >= 0 ? "+" : ""}${fmtNum(bench.intensity_vs_benchmark_pct, 1)}%`, flag: bench.intensity_vs_benchmark_pct > 10 },
          { label: "Basis",            val: "GLEC WTW" },
        ]} />
      </div>

      {dispKey === "EXIT" && (
        <div className="rounded-xl border border-danger/20 bg-danger/5 p-4">
          <div className="text-xs font-bold text-danger uppercase tracking-wide mb-3">What happens if we exit?</div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <Stat label="Volume to reallocate" val={`${fmtNum(exit.volume_to_reallocate)} shipments/yr`} />
            <Stat label="Est. alternative rate" val={fmtUSD(exit.estimated_alt_rate)} />
            <Stat label="Annual savings"        val={fmtUSD(exit.annual_savings_usd)} />
            <Stat label="Exit penalty"          val={fmtUSD(exit.exit_penalty_usd)} />
            <Stat label="Net annual effect"     val={fmtUSD(exit.net_annual_effect_usd)} />
            <Stat label="Payback"               val={`${fmtNum(exit.payback_months, 1)} months`} />
          </div>
          <Link href="/transition" className="inline-block mt-3 text-xs text-danger font-semibold hover:underline">
            Run as Transition Economics →
          </Link>
        </div>
      )}
    </div>
  );
}

function StatBlock({ title, rows }: { title: string; rows: { label: string; val: string; flag?: boolean }[] }) {
  return (
    <div className="rounded-xl border border-slate-100 dark:border-slate-700 p-4">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between py-0.5 text-sm">
          <span className="text-slate-500 dark:text-slate-400">{r.label}</span>
          <span className={`font-mono font-medium ${r.flag ? "text-danger" : "text-ink-900 dark:text-white"}`}>{r.val}</span>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, val }: { label: string; val: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm font-bold text-ink-900 dark:text-white numeric mt-0.5">{val}</div>
    </div>
  );
}
