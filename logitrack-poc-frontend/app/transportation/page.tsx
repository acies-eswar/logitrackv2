"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, fmtUSD, fmtCO2, fmtNum, fmtPct } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardBody, KPI, PageHeader, Spinner, ApiError, Badge, Segmented } from "@/components/ui";
import { HBarList } from "@/components/charts";

const DISPOSITION_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  GROW:   { bg: "bg-positive/10",  text: "text-positive", border: "border-positive/30" },
  RETAIN: { bg: "bg-brand/10",     text: "text-brand",    border: "border-brand/30" },
  FIX:    { bg: "bg-warning/10",   text: "text-warning",  border: "border-warning/30" },
  EXIT:   { bg: "bg-danger/10",    text: "text-danger",   border: "border-danger/30" },
};

export default function TransportationPage() {
  const [sum,      setSum]      = useState<any>(null);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [lanes,    setLanes]    = useState<any[]>([]);
  const [transit,  setTransit]  = useState<any[]>([]);
  const [modeF,    setModeF]    = useState("all");
  const [search,   setSearch]   = useState("");
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
      (search === "" ||
        l.lane.toLowerCase().includes(search.toLowerCase()) ||
        l.carrier.toLowerCase().includes(search.toLowerCase()))
    ),
    [lanes, modeF, search],
  );

  // Must be before early returns — hooks order must be stable
  const dispositionSummary = useMemo(() => {
    const counts: Record<string, number> = { GROW: 0, RETAIN: 0, FIX: 0, EXIT: 0 };
    const groups: Record<string, string[]> = { GROW: [], RETAIN: [], FIX: [], EXIT: [] };
    let spendAtRisk = 0, savingsOpportunity = 0;
    carriers.forEach((c) => {
      const d = c.disposition as string ?? "RETAIN";
      const key = ["GROW","RETAIN","FIX","EXIT"].includes(d) ? d : "RETAIN";
      counts[key] = (counts[key] ?? 0) + 1;
      groups[key].push(c.carrier);
      if (key === "EXIT" || key === "FIX") spendAtRisk += c.annual_freight_usd ?? 0;
      if (key === "EXIT") savingsOpportunity += Math.max(0, (c.cost_per_shipment - (c.cost_per_shipment * 0.93)) * (c.shipments ?? 0));
    });
    return { counts, groups, spendAtRisk, savingsOpportunity };
  }, [carriers]);

  if (error) return <ApiError retry={load} />;
  if (!sum)  return <Spinner label="Loading transportation performance..." />;

  // Top 10 carrier freight spend
  const carrierChart = carriers.slice(0, 10).map((c) => ({ name: c.carrier, freight: c.annual_freight_usd }));

  return (
    <>
      <PageHeader
        eyebrow="Transportation Performance"
        title="Transportation Performance"
        desc="Carrier scorecards, lane performance, freight spend, transit time, and OTIF service monitoring across the network."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPI label="Total Freight Cost"   value={fmtUSD(sum.total_freight_usd)} accent="blue" />
        <KPI label="Weighted OTIF"        value={fmtPct(sum.weighted_avg_otif_pct)}
          sub={`target ${sum.otif_target_pct}%`}
          accent={sum.weighted_avg_otif_pct >= sum.otif_target_pct ? "green" : "amber"} />
        <KPI label="SLA Breaches"         value={fmtNum(sum.sla_breaches)}
          sub={`of ${sum.lane_count} lanes`}
          accent={sum.sla_breaches > 0 ? "red" : "green"} />
        <KPI label="Avg Cost / Shipment"  value={fmtUSD(sum.avg_cost_per_shipment)} />
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
            {(["GROW","RETAIN","FIX","EXIT"] as const).map((d) => {
              const st = DISPOSITION_STYLE[d];
              const names: string[] = dispositionSummary.groups[d] ?? [];
              return (
                <div key={d} className={`rounded-xl border p-4 ${st.bg} ${st.border}`}>
                  <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${st.text}`}>{d}</div>
                  <div className={`text-3xl font-bold numeric ${st.text}`}>{dispositionSummary.counts[d] ?? 0}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {names.length > 0 ? names.slice(0, 3).join(", ") + (names.length > 3 ? "…" : "") : "—"}
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
          <CardHeader><CardTitle>Carrier Freight Spend: Top 10</CardTitle></CardHeader>
          <CardBody>
            {carrierChart.length > 0
              ? <HBarList data={carrierChart} valueKey="freight" nameKey="name" currency color="#1d4ed8" />
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
                    <td className="px-4 py-2.5 text-right font-mono text-slate-500">{t.min_days}–{t.max_days}d</td>
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
                const disp = (c.disposition as string) ?? "RETAIN";
                const dispKey = ["GROW","RETAIN","FIX","EXIT"].includes(disp) ? disp : "RETAIN";
                const ds = DISPOSITION_STYLE[dispKey];
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
            <CardTitle>Carrier Decision Pack — {selectedCarrier}</CardTitle>
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
    </>
  );
}

function CarrierDecisionPack({ pack }: { pack: any }) {
  const disp = pack.disposition as string;
  const dispKey = ["GROW","RETAIN","FIX","EXIT"].includes(disp) ? disp : "RETAIN";
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
