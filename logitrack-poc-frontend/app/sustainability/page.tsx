"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, fmtUSD, fmtNum, fmtCO2 } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardBody, KPI, PageHeader, Spinner, ApiError, Segmented, Badge, Select } from "@/components/ui";
import { ScatterCard, HBarList, LineChartCard } from "@/components/charts";

// ─── Real Whirlpool product specs (Qingdao factory → Chicago DC supply chain) ──
const WHIRLPOOL_SPECS = {
  "Refrigerator":    { pkgKg: 100, bareKg: 85,  upc: 60,  lastMileCost: 50.00, annualVol: 800_000,  oceanCarrier: "Maersk" },
  "Washing Machine": { pkgKg: 88,  bareKg: 75,  upc: 95,  lastMileCost: 40.00, annualVol: 1_200_000, oceanCarrier: "Evergreen" },
  "Air Conditioner": { pkgKg: 28,  bareKg: 22,  upc: 250, lastMileCost: 12.00, annualVol: 1_500_000, oceanCarrier: "COSCO Shipping" },
  "Microwave Oven":  { pkgKg: 17,  bareKg: 13,  upc: 840, lastMileCost: 1.00,  annualVol: 2_000_000, oceanCarrier: "MSC" },
  "Dishwasher":      { pkgKg: 60,  bareKg: 50,  upc: 110, lastMileCost: 30.00, annualVol: 600_000,  oceanCarrier: "CMA CGM" },
} as const;

type ProductName = keyof typeof WHIRLPOOL_SPECS;

// GLEC WTW emission factors (g/tonne·km)
const EF = { ocean: 9.7, road: 86, rail: 28 };

// Standard legs: Qingdao factory → Qingdao port → LA port → Chicago DC → Customer
const LEGS = [
  { segment: "1", mode: "road" as const,  origin: "Qingdao Factory",    destination: "Qingdao Port",      distKm: 200,   transitDays: 1,  carrier1: "Sinotrans",     handling: 0.010 },
  { segment: "2", mode: "ocean" as const, origin: "Qingdao Port",        destination: "Los Angeles Port",  distKm: 10800, transitDays: 18, carrier1: "",              handling: 0.030 },
  { segment: "3", mode: "rail" as const,  origin: "Los Angeles Port",    destination: "Chicago DC",        distKm: 3200,  transitDays: 5,  carrier1: "Union Pacific", handling: 0.015 },
  { segment: "4", mode: "road" as const,  origin: "Chicago DC",          destination: "Customer",          distKm: 600,   transitDays: 2,  carrier1: "FedEx Freight", handling: 0.010 },
];
const CONTAINER_RATES = { leg1Truck: 500, oceanFEU: 4400, railIntermodal: 2800 };

function computeJourney(productName: ProductName) {
  const spec = WHIRLPOOL_SPECS[productName];
  const { pkgKg, upc, lastMileCost, annualVol, oceanCarrier } = spec;
  const tonne = pkgKg / 1000;

  function co2kg(distKm: number, ef: number) {
    return Math.round(tonne * distKm * ef / 1e6 * 1e3 * 1000) / 1000;
  }

  const legCosts = [
    CONTAINER_RATES.leg1Truck / upc,
    CONTAINER_RATES.oceanFEU / upc,
    CONTAINER_RATES.railIntermodal / upc,
    lastMileCost,
  ];
  const legCo2 = [
    co2kg(LEGS[0].distKm, EF.road),
    co2kg(LEGS[1].distKm, EF.ocean),
    co2kg(LEGS[2].distKm, EF.rail),
    co2kg(LEGS[3].distKm, EF.road),
  ];

  const packagingCo2 = Math.round(pkgKg * 0.10 * 0.94 * 1000) / 1000;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const r3 = (n: number) => Math.round(n * 1000) / 1000;

  let cumCost = 0, cumCo2 = 0;
  const tces = LEGS.map((leg, i) => {
    cumCost = r2(cumCost + legCosts[i]);
    cumCo2  = r3(cumCo2 + legCo2[i] + leg.handling);
    const carrier = i === 1 ? oceanCarrier : leg.carrier1;
    return {
      segment:    leg.segment,
      mode:       leg.mode,
      carrier,
      origin:     leg.origin,
      destination: leg.destination,
      distance_km: leg.distKm,
      transit_days: leg.transitDays,
      per_unit_cost_usd:              r2(legCosts[i]),
      per_unit_transport_kg_co2e:     r3(legCo2[i]),
      per_unit_handling_kg_co2e:      leg.handling,
      cumulative_cost_usd:            cumCost,
      cumulative_kg_co2e:             cumCo2,
      data_quality: i === 0 || i === 3 ? "Modeled (GLEC §3)" : "GLEC WTW",
    };
  });

  const transportCo2 = legCo2.reduce((a, b) => a + b, 0);
  const handlingCo2  = LEGS.reduce((a, l) => a + l.handling, 0);
  const totalCo2     = r3(transportCo2 + handlingCo2 + packagingCo2);
  const totalCost    = r2(legCosts.reduce((a, b) => a + b, 0));

  return {
    tces,
    packaging: { kg_co2e_per_unit: packagingCo2 },
    kpis: {
      total_per_unit_cost_usd:  totalCost,
      total_per_unit_kg_co2e:   totalCo2,
      transport_kg_co2e:        r3(transportCo2),
      handling_kg_co2e:         r3(handlingCo2),
      packaging_kg_co2e:        packagingCo2,
      total_transit_days:       LEGS.reduce((a, l) => a + l.transitDays, 0),
      annual_volume_default:    annualVol,
    },
  };
}

// Pre-compute journeys for all products
const PRODUCT_JOURNEYS: Record<string, ReturnType<typeof computeJourney>> = Object.fromEntries(
  (Object.keys(WHIRLPOOL_SPECS) as ProductName[]).map((p) => [p, computeJourney(p)])
);

// Scatter: x=cost, y=emissions in kg CO2e per unit
const PRODUCT_MATRIX = (Object.keys(WHIRLPOOL_SPECS) as ProductName[]).map((p) => ({
  x: PRODUCT_JOURNEYS[p].kpis.total_per_unit_cost_usd,
  y: Math.round(PRODUCT_JOURNEYS[p].kpis.total_per_unit_kg_co2e * 100) / 100,
  name: p,
  size: WHIRLPOOL_SPECS[p].annualVol,
}));

const PRODUCTS = Object.keys(WHIRLPOOL_SPECS) as ProductName[];

export default function SustainabilityPage() {
  const [cp,      setCp]      = useState(75);
  const [sum,     setSum]     = useState<any>(null);
  const [agg,     setAgg]     = useState<any[]>([]);
  const [level,   setLevel]   = useState<"region" | "facility" | "category">("region");
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  // Product preselected upfront (spec Module 5) — flows table shows every journey for it.
  const [selectedProduct, setSelectedProduct] = useState<string>("Refrigerator");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const expandRow = useCallback((key: string) => {
    setExpandedKey((current) => (current === key ? null : key));
  }, []);

  const load = useCallback((carbonPrice: number, lvl: typeof level) => {
    setLoading(true);
    setError(false);
    const aggCall =
      lvl === "region"   ? api.sustByRegion(carbonPrice) :
      lvl === "facility" ? api.sustByFacility(carbonPrice) :
                           api.sustByCategory(carbonPrice);
    Promise.all([api.sustSummary(carbonPrice), aggCall])
      .then(([s, a]) => { setSum(s); setAgg(a); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  useEffect(() => { load(cp, level); }, [cp, level, load]);


  if (error) return <ApiError retry={() => load(cp, level)} />;
  if (!sum && loading) return <Spinner label="Computing landed cost & emissions..." />;

  // Journey data for selected product (null when none selected)
  const journey = selectedProduct ? PRODUCT_JOURNEYS[selectedProduct] : null;
  const jKpis = journey?.kpis;
  const mult = 1;

  // Hotspots bar chart — sorted by cost descending
  const hotspotData = [...PRODUCT_MATRIX]
    .sort((a, b) => b.x - a.x)
    .map((m) => ({ name: m.name, cost: m.x }));

  // Drill data for per-unit view (derived from agg). Provide sensible defaults so UI renders.
  const drillData: Record<string, any> = {};
  (agg || []).forEach((a) => {
    const key = a.key || "(unassigned)";
    const per_unit_cost = a.avg_landed_cost_per_shipment ?? 0;
    const per_unit_co2 = a.avg_landed_emissions_per_shipment ?? 0;
    drillData[key] = {
      per_unit: {
        transport_kg_co2e: per_unit_co2 * 0.85,
        handling_kg_co2e: per_unit_co2 * 0.10,
        packaging_kg_co2e: per_unit_co2 * 0.05,
        total_kg_co2e: per_unit_co2,
        bare_weight_kg: a.avg_weight_kg ?? 1,
        packaged_weight_kg: (a.avg_weight_kg ?? 1) * 1.08,
        load_factor: a.load_factor ?? 0.85,
        cost_usd: per_unit_cost,
      },
      capacity: {
        units_per_container_volume: a.units_per_container_volume ?? 100,
        units_per_container_weight: a.units_per_container_weight ?? 1000,
        binding_constraint: a.binding_constraint ?? "volume",
        container_fill_pct: a.container_fill_pct ?? 80,
      },
    };
  });

  return (
    <>
      <PageHeader
        eyebrow="Cost &amp; Sustainability Intelligence"
        title="Landed Cost vs Landed Emissions"
        desc="Landed cost and logistics emissions at product, lane, region, and facility levels."
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 whitespace-nowrap">Product</span>
              <Select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="min-w-[180px]">
                <option value="" disabled>— Select a product —</option>
                {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 whitespace-nowrap">Carbon price</span>
              <Segmented
                value={String(cp)}
                onChange={(v) => setCp(Number(v))}
                options={[{ value: "0", label: "$0" }, { value: "75", label: "$75" }, { value: "150", label: "$150" }]}
              />
            </div>
          </div>
        }
      />

      {/* V3.0 — Emissions Intelligence: attribution, carbon economics, benchmarking */}
      <EmissionsIntelligence cp={cp} />

      {/* V3.0 — All end-to-end flows for the selected product (segments + attribution + apportioning) */}
      {selectedProduct && <ProductFlowsTable product={selectedProduct} />}

      {/* Summary KPIs — per-unit only when product is selected */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {selectedProduct && jKpis ? (
          <>
            <KPI label="Avg Landed Cost / Unit" desc={selectedProduct}         value={fmtUSD(jKpis.total_per_unit_cost_usd, false)}         accent="blue" />
            <KPI label="Avg Emissions / Unit"   desc="kgCO₂e (GLEC WTW)"      value={`${fmtNum(jKpis.total_per_unit_kg_co2e, 2)} kg`}      accent="default" />
            <KPI label="Total Annual Landed Cost" value={fmtUSD(sum?.total_annual_landed_cost)} accent="amber" />
            <KPI label="Transit (Full Supply Chain)" value={`${jKpis.total_transit_days} days`} />
          </>
        ) : (
          <>
            <KPI label="Total Annual Landed Cost" value={fmtUSD(sum?.total_annual_landed_cost)} accent="blue" />
            <KPI label="Lanes Analyzed"           value={fmtNum(sum?.lanes_analyzed)} />
            <KPI label="Avg Cost / Shipment"      value={fmtUSD(sum?.avg_landed_cost_per_shipment)} accent="amber" />
            <KPI label="Avg Emissions / Shipment" value={fmtCO2(sum?.avg_landed_emissions_per_shipment)} />
          </>
        )}
      </div>

      {/* Product-level charts — always visible (show all 5 products) */}
      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Cost vs Emissions Matrix · by Product</CardTitle>
            <Badge variant="blue">Lower-left = best</Badge>
          </CardHeader>
          <CardBody>
            <ScatterCard
              data={PRODUCT_MATRIX}
              xLabel="Landed Cost / unit (USD)"
              yLabel="Emissions / unit (kgCO₂e)"
              yUnit="kg"
              height={280}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 Cost Hotspots by Product</CardTitle>
          </CardHeader>
          <CardBody>
            <HBarList data={hotspotData} valueKey="cost" nameKey="name" currency color="#f59e0b" />
          </CardBody>
        </Card>
      </div>


      {/* Landed Cost & Emissions Breakdown by Region/Facility/Category */}
      <Card>
        <CardHeader>
          <CardTitle>Landed Cost &amp; Emissions Breakdown</CardTitle>
          <Segmented
            value={level} onChange={setLevel}
            options={[
              { value: "region",   label: "By Region" },
              { value: "facility", label: "By Facility" },
              { value: "category", label: "By Category" },
            ]}
          />
        </CardHeader>
        <CardBody className="p-0">
          {loading
            ? <Spinner />
            : (
              <div className="max-h-[620px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-slate-950">
                    <tr className="border-b border-slate-100 dark:border-slate-700 text-left">
                      <th className="px-5 py-2.5 text-xs font-semibold text-slate-500">
                        {level === "region" ? "Region" : level === "facility" ? "Facility" : "Product Category"}
                      </th>
                      <th className="px-5 py-2.5 text-xs font-semibold text-slate-500 text-right">Lanes</th>
                      <th className="px-5 py-2.5 text-xs font-semibold text-slate-500 text-right">Shipments</th>
                      <th className="px-5 py-2.5 text-xs font-semibold text-slate-500 text-right">Avg Landed Cost</th>
                      <th className="px-5 py-2.5 text-xs font-semibold text-slate-500 text-right">Avg Emissions</th>
                      <th className="px-5 py-2.5 text-xs font-semibold text-slate-500 text-right">Total Landed Cost</th>
                      <th className="px-5 py-2.5 text-xs font-semibold text-slate-500 text-center">Per-Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agg.map((a) => (
                      <React.Fragment key={a.key || "unassigned"}>
                        <tr
                          className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                          onClick={() => expandRow(a.key || "(unassigned)")}
                        >
                          <td className="px-5 py-2.5 font-medium text-ink-900 dark:text-white">{a.key || "(unassigned)"}</td>
                          <td className="px-5 py-2.5 text-right font-mono">{a.lanes}</td>
                          <td className="px-5 py-2.5 text-right font-mono">{fmtNum(a.shipments)}</td>
                          <td className="px-5 py-2.5 text-right font-mono">{fmtUSD(a.avg_landed_cost_per_shipment, false)}</td>
                          <td className="px-5 py-2.5 text-right font-mono">{fmtNum(a.avg_landed_emissions_per_shipment, 3)} t</td>
                          <td className="px-5 py-2.5 text-right font-mono font-semibold">{fmtUSD(a.total_landed_cost)}</td>
                          <td className="px-5 py-2.5 text-center">
                            <span className={`text-xs font-medium ${expandedKey === (a.key || "(unassigned)") ? "text-brand" : "text-slate-400"}`}>
                              {expandedKey === (a.key || "(unassigned)") ? "▲" : "▼"}
                            </span>
                          </td>
                        </tr>
                        {expandedKey === (a.key || "(unassigned)") && (
                          <tr key={`${a.key || "unassigned"}-drill`} className="border-b border-slate-100 dark:border-slate-700 bg-brand-50/50 dark:bg-brand/5">
                            <td colSpan={7} className="px-5 py-4">
                              <PerUnitDrill data={drillData[a.key || "(unassigned)"]} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </CardBody>
      </Card>
    </>
  );
}

function PerUnitDrill({ data }: { data: any }) {
  if (!data) return <Spinner label="Computing per-unit breakdown..." />;
  const pu = data.per_unit;
  // ensure sensible total for percent calculations
  if (!pu.total_kg_co2e || !isFinite(pu.total_kg_co2e)) {
    pu.total_kg_co2e = (pu.transport_kg_co2e || 0) + (pu.handling_kg_co2e || 0) + (pu.packaging_kg_co2e || 0);
  }
  const cap = data.capacity;
  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <div>
        <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-2">Per-Unit Emissions (GLEC WTW)</div>
        <div className="space-y-1.5">
          <DrillRow label="Transport" val={`${fmtNum(pu.transport_kg_co2e, 3)} kg`} pct={pu.total_kg_co2e ? (pu.transport_kg_co2e / pu.total_kg_co2e * 100) : 0} color="brand" />
          <DrillRow label="Handling"  val={`${fmtNum(pu.handling_kg_co2e, 3)} kg`}  pct={pu.total_kg_co2e ? (pu.handling_kg_co2e  / pu.total_kg_co2e * 100) : 0} color="blue" />
          <DrillRow label="Packaging" val={`${fmtNum(pu.packaging_kg_co2e, 3)} kg`} pct={pu.total_kg_co2e ? (pu.packaging_kg_co2e / pu.total_kg_co2e * 100) : 0} color="amber" />
          <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 flex justify-between text-sm font-bold">
            <span>Total</span><span className="font-mono">{fmtNum(pu.total_kg_co2e, 3)} kg</span>
          </div>
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-2">Per-Unit Cost & Weight</div>
        <div className="space-y-1.5 text-sm">
          <KV label="Bare weight"     val={`${fmtNum(pu.bare_weight_kg, 1)} kg`} />
          <KV label="Packaged weight" val={`${fmtNum(pu.packaged_weight_kg, 1)} kg`} />
          <KV label="Load factor"     val={fmtNum(pu.load_factor, 2)} />
          <KV label="Per-unit cost"   val={fmtUSD(pu.cost_usd, false)} />
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-2">Capacity</div>
        <div className="space-y-1.5 text-sm">
          <KV label="Units/container (vol)" val={fmtNum(cap.units_per_container_volume)} />
          <KV label="Units/container (wt)"  val={fmtNum(cap.units_per_container_weight)} />
          <KV label="Binding constraint"    val={cap.binding_constraint} />
          <KV label="Fill %"                val={`${fmtNum(cap.container_fill_pct, 1)}%`} />
        </div>
      </div>
    </div>
  );
}

function DrillRow({ label, val, pct, color }: { label: string; val: string; pct: number; color: string }) {
  const barColor = color === "brand" ? "bg-brand" : color === "blue" ? "bg-blue-400" : "bg-amber-400";
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-slate-600 dark:text-slate-300">{label}</span>
        <span className="font-mono text-slate-900 dark:text-white">{val}</span>
      </div>
      <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full">
        <div className={`h-full ${barColor} rounded-full`} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}

function KV({ label, val }: { label: string; val: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono font-medium text-slate-900 dark:text-white">{val}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Module 5 — Emissions Intelligence (LogiTrack V3.0)
   Where emissions originate, what they cost, how they can be reduced.
   ──────────────────────────────────────────────────────────────────────────── */
const CP_CURVE = [0, 50, 75, 100, 150, 250];
const GLEC_FACTORS: Record<string, number> = { ocean: 9.7, road: 86, rail: 28, air: 600 };
const SUST_CAT_VARIANT: Record<string, "green" | "blue" | "amber" | "red" | "slate"> = {
  "Win-Win": "green", "Sustainability First": "blue", "Cost Optimized": "blue",
  "Strategic Transition": "amber", "Balanced": "slate", "Rejected": "red",
};

function EmissionsIntelligence({ cp }: { cp: number }) {
  const [em, setEm] = useState<any>(null);
  const [recs, setRecs] = useState<any>(null);
  useEffect(() => {
    api.emissions(cp).then(setEm).catch(() => setEm(null));
    api.recommendations(cp).then(setRecs).catch(() => setRecs(null));
  }, [cp]);

  const attribution = useMemo(() => {
    const src = (em?.by_source ?? {}) as Record<string, number>;
    return Object.entries(src).map(([name, v]) => ({ name, value: Math.round(v) })).sort((a, b) => b.value - a.value);
  }, [em]);
  const byMode = useMemo(() => {
    const m = (em?.by_mode ?? {}) as Record<string, number>;
    return Object.entries(m).map(([name, v]) => ({ name: name[0].toUpperCase() + name.slice(1), value: Math.round(v) })).sort((a, b) => b.value - a.value);
  }, [em]);
  const total = em?.total_tco2e ?? 0;
  const sensitivity = useMemo(() => CP_CURVE.map((p) => ({ price: p, cost: Math.round(total * p) })), [total]);
  const best = recs?.recommendations?.[0]?.emissions_reduction_pct ?? 0;
  const avoidance = total * (best / 100) * cp;
  const topLevers = (recs?.recommendations ?? []).slice(0, 5);

  if (!em) return <Card className="mb-6"><CardBody><Spinner label="Loading emissions intelligence…" /></CardBody></Card>;

  return (
    <div className="mb-6 space-y-5">
      {/* attribution + transport sub-attribution */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader><CardTitle>Emissions Attribution — where they originate</CardTitle><Badge variant="green">{fmtCO2(total)} total</Badge></CardHeader>
          <CardBody><HBarList data={attribution} valueKey="value" nameKey="name" /></CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Transport Sub-Attribution by Mode</CardTitle></CardHeader>
          <CardBody><HBarList data={byMode} valueKey="value" nameKey="name" color="#0e9f6e" /></CardBody>
        </Card>
      </div>

      {/* carbon economics */}
      <Card>
        <CardHeader><CardTitle>Carbon Economics</CardTitle><div className="text-[11px] text-slate-400">emissions translated into financial exposure</div></CardHeader>
        <CardBody className="grid lg:grid-cols-[1fr_1.3fr] gap-5 items-center">
          <div className="grid grid-cols-2 gap-3">
            <SMini label={`Carbon Cost Exposure @ $${cp}`} value={fmtUSD(em.carbon_cost_exposure_usd)} accent="amber" />
            <SMini label="Emissions / $1k Revenue" value={`${fmtNum(em.emissions_per_revenue_dollar, 2)} kg`} />
            <SMini label="Reduction Potential" value={`${fmtNum(best, 1)}%`} accent="green" />
            <SMini label="Carbon Avoidance Potential" value={fmtUSD(avoidance)} accent="green" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Carbon cost sensitivity (price per tonne)</div>
            <LineChartCard data={sensitivity} x="price" currency height={200} lines={[{ key: "cost", name: "Carbon cost exposure", color: "#d97706" }]} />
          </div>
        </CardBody>
      </Card>

      {/* benchmarking + alternatives */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader><CardTitle>GLEC Benchmarking & Methodology</CardTitle><Badge variant="blue">GLEC v3 · ISO 14083 · WTW</Badge></CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 dark:border-slate-700 text-left bg-slate-50 dark:bg-slate-900/50">
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Mode</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 text-right">GLEC factor (gCO₂e/tkm)</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 text-right">Network emissions</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 text-right">Share</th>
              </tr></thead>
              <tbody>
                {byMode.map((m) => (
                  <tr key={m.name} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="px-4 py-2 font-medium text-ink-900 dark:text-white">{m.name}</td>
                    <td className="px-4 py-2 text-right numeric text-slate-600 dark:text-slate-400">{GLEC_FACTORS[m.name.toLowerCase()] ?? "—"}</td>
                    <td className="px-4 py-2 text-right numeric text-ink-900 dark:text-white">{fmtCO2(m.value)}</td>
                    <td className="px-4 py-2 text-right numeric text-positive">{fmtNum(total ? (m.value / total) * 100 : 0, 1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Reduction Alternatives Evaluated</CardTitle><div className="text-[11px] text-slate-400">what alternatives exist & which win (spec §222)</div></CardHeader>
          <CardBody className="space-y-2">
            {topLevers.map((r: any) => (
              <div key={r.scenario_id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink-900 dark:text-white truncate">{r.name}</div>
                  <div className="text-[11px] text-slate-400">{r.category} · {fmtUSD(r.annual_savings_usd)} savings</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={SUST_CAT_VARIANT[r.category] ?? "slate"}>−{fmtNum(r.emissions_reduction_pct, 1)}%</Badge>
                  <span className="text-sm font-bold numeric text-ink-900 dark:text-white">{Math.round(r.decision_score)}</span>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function SMini({ label, value, accent }: { label: string; value: string; accent?: "green" | "amber" }) {
  const c = accent === "green" ? "text-positive" : accent === "amber" ? "text-warning" : "text-ink-900 dark:text-white";
  return (
    <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 leading-tight">{label}</div>
      <div className={`text-base font-bold numeric mt-0.5 ${c}`}>{value}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   All end-to-end flows for the selected product (spec Module 5):
   every journey, its segments, cost & emission attribution, load factor & apportioning.
   ──────────────────────────────────────────────────────────────────────────── */
function ProductFlowsTable({ product }: { product: string }) {
  const [data, setData] = useState<any>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { setData(null); setOpen(null); api.productFlows(product).then(setData).catch(() => setData(null)); }, [product]);

  const flows: any[] = data?.flows ?? [];
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>End-to-End Flows — {product}</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {data && <Badge variant="blue">{flows.length} flows</Badge>}
          {data && <Badge variant="slate">UPC {data.units_per_container} · load factor {data.load_factor}</Badge>}
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {!data ? <div className="p-5"><Spinner label="Tracing product flows…" /></div> : flows.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">No flows found for {product}.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 dark:border-slate-700 text-left bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <th className="px-4 py-2.5">Flow</th>
                <th className="px-4 py-2.5">Origin → Destination</th>
                <th className="px-4 py-2.5 text-right">Segments</th>
                <th className="px-4 py-2.5 text-right">Cost / unit</th>
                <th className="px-4 py-2.5 text-right">CO₂e / unit</th>
                <th className="px-4 py-2.5 text-right">Transit</th>
                <th className="px-4 py-2.5 text-right">UPC</th>
                <th className="px-4 py-2.5 text-right">Load f.</th>
              </tr></thead>
              <tbody>
                {flows.map((f) => (
                  <FlowGroup key={f.flow_id} f={f} open={open === f.flow_id} onToggle={() => setOpen(open === f.flow_id ? null : f.flow_id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function FlowGroup({ f, open, onToggle }: { f: any; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-2.5 font-medium text-brand dark:text-cyan-400">{open ? "▾ " : "▸ "}{f.flow_id}</td>
        <td className="px-4 py-2.5 text-ink-900 dark:text-white">{f.origin} → {f.destination}</td>
        <td className="px-4 py-2.5 text-right numeric text-slate-600 dark:text-slate-400">{f.segment_count}</td>
        <td className="px-4 py-2.5 text-right numeric text-ink-900 dark:text-white">{fmtUSD(f.cost_per_unit, false)}</td>
        <td className="px-4 py-2.5 text-right numeric text-positive">{fmtNum(f.co2e_per_unit_kg, 2)} kg</td>
        <td className="px-4 py-2.5 text-right numeric text-slate-600 dark:text-slate-400">{fmtNum(f.total_transit_days, 0)} d</td>
        <td className="px-4 py-2.5 text-right numeric text-slate-600 dark:text-slate-400">{f.units_per_container}</td>
        <td className="px-4 py-2.5 text-right numeric text-slate-600 dark:text-slate-400">{f.load_factor}</td>
      </tr>
      {open && (
        <tr className="bg-slate-50/60 dark:bg-slate-900/40">
          <td colSpan={8} className="px-4 py-3">
            <table className="w-full text-xs">
              <thead><tr className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="px-2 py-1.5 text-left">Segment</th><th className="px-2 py-1.5 text-left">Mode</th>
                <th className="px-2 py-1.5 text-left">Carrier</th><th className="px-2 py-1.5 text-left">Lane</th>
                <th className="px-2 py-1.5 text-right">Distance</th><th className="px-2 py-1.5 text-right">Weight</th>
                <th className="px-2 py-1.5 text-right">Load f.</th><th className="px-2 py-1.5 text-right">UPC</th>
                <th className="px-2 py-1.5 text-right">Cost/ship</th><th className="px-2 py-1.5 text-right">Cost share</th>
                <th className="px-2 py-1.5 text-right">CO₂e/ship</th><th className="px-2 py-1.5 text-right">Em. share</th>
              </tr></thead>
              <tbody>
                {f.segments.map((s: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-2 py-1.5 font-medium text-ink-900 dark:text-white">{s.segment}</td>
                    <td className="px-2 py-1.5 capitalize text-slate-600 dark:text-slate-300">{s.mode}</td>
                    <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">{s.carrier}</td>
                    <td className="px-2 py-1.5 text-slate-500 dark:text-slate-400">{s.origin} → {s.destination}</td>
                    <td className="px-2 py-1.5 text-right numeric">{fmtNum(s.distance_km)} km</td>
                    <td className="px-2 py-1.5 text-right numeric">{fmtNum(s.weight_kg)} kg</td>
                    <td className="px-2 py-1.5 text-right numeric">{s.load_factor}</td>
                    <td className="px-2 py-1.5 text-right numeric">{s.units_per_container}</td>
                    <td className="px-2 py-1.5 text-right numeric text-ink-900 dark:text-white">{fmtUSD(s.cost_per_shipment)}</td>
                    <td className="px-2 py-1.5 text-right numeric text-brand dark:text-cyan-400">{fmtNum(s.cost_share_pct, 1)}%</td>
                    <td className="px-2 py-1.5 text-right numeric">{fmtNum(s.co2e_per_shipment_t, 2)} t</td>
                    <td className="px-2 py-1.5 text-right numeric text-positive">{fmtNum(s.emission_share_pct, 1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
