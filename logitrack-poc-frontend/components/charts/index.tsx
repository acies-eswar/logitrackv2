"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ScatterChart, Scatter, ReferenceLine, ComposedChart, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { CHART, SERIES, fmtUSD, fmtNum, fmtCO2 } from "@/lib/api";

// ─── Hooks ─────────────────────────────────────────────────────────────────
function useIsDark() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

// ─── Color helpers ──────────────────────────────────────────────────────────
function clr(isDark: boolean) {
  return {
    grid:          isDark ? "#1e293b"  : "#f1f5f9",
    axis:          isDark ? "#64748b"  : "#94a3b8",
    text:          isDark ? "#cbd5e1"  : "#475569",
    subText:       isDark ? "#475569"  : "#94a3b8",
    tooltipBg:     isDark ? "#0f172a"  : "#ffffff",
    tooltipBorder: isDark ? "#1e293b"  : "#e2e8f0",
    track:         isDark ? "rgba(255,255,255,0.07)" : "#f1f5f9",
    divider:       isDark ? "#1e293b"  : "#e2e8f0",
  };
}

const axisCfg = (isDark: boolean) => ({
  stroke: clr(isDark).axis,
  fontSize: 10,
  tickLine: false,
  axisLine: { stroke: clr(isDark).divider },
  tick: { fill: clr(isDark).text, fontSize: 10 },
});

const gridEl = (isDark: boolean) => (
  <CartesianGrid strokeDasharray="4 4" stroke={clr(isDark).grid} vertical={false} />
);

const tipStyle = (isDark: boolean) => {
  const c = clr(isDark);
  return {
    contentStyle: {
      background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`,
      borderRadius: 6, fontSize: 11, padding: "5px 10px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
    },
    labelStyle:  { color: c.text, fontWeight: 600, fontSize: 11, marginBottom: 2 },
    itemStyle:   { color: c.text, fontSize: 11, padding: "1px 0" },
    cursor:      { fill: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" },
  };
};

// ─── Verdict palette ────────────────────────────────────────────────────────
const VERDICT_COLOR: Record<string, string> = {
  APPROVE:     "#10b981",
  PILOT:       "#3b82f6",
  CONDITIONAL: "#f59e0b",
  DECLINE:     "#ef4444",
};
function verdictColor(v: string) { return VERDICT_COLOR[v] ?? "#94a3b8"; }

// ─── NPV Chart - HTML bars ──────────────────────────────────────────────────
export function NPVChart({
  data,
}: {
  data: { name: string; npv: number; verdict: string; p10?: number; p90?: number; prob?: number }[];
}) {
  const isDark = useIsDark();
  const c = clr(isDark);
  const [hovered, setHovered] = useState<number | null>(null);

  if (!data.length) return null;
  const maxAbs = Math.max(...data.map(d => Math.abs(d.npv)), 1);
  const hasNeg = data.some(d => d.npv < 0);

  return (
    <div style={{ padding: "2px 0" }}>
      <div className="space-y-2.5">
        {data.map((item, i) => {
          const pct   = (Math.abs(item.npv) / maxAbs) * 100;
          const isNeg = item.npv < 0;
          const vc    = verdictColor(item.verdict);
          const isHov = hovered === i;
          return (
            <div key={i}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
              style={{ cursor: "default" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: c.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
                  {item.name.length > 32 ? item.name.slice(0, 30) + "…" : item.name}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: vc, whiteSpace: "nowrap" }}>
                  {fmtUSD(item.npv)}
                </span>
              </div>
              <div style={{ position: "relative", height: 14, background: c.track, borderRadius: 4 }}>
                {hasNeg && <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: c.axis, zIndex: 2 }} />}
                <div style={{
                  position: "absolute", top: 2, bottom: 2,
                  left:  hasNeg ? (isNeg ? `${50 - pct / 2}%` : "50%") : 0,
                  width: `${Math.max(0.5, pct / (hasNeg ? 2 : 1))}%`,
                  minWidth: 4, background: vc, borderRadius: 3,
                  opacity: isHov ? 1 : 0.82, transition: "opacity 0.1s",
                }} />
              </div>
              {isHov && (
                <div style={{ fontSize: 10, color: c.axis, marginTop: 3 }}>
                  {item.p10 != null && `P10 ${fmtUSD(item.p10)} → P90 ${item.p90 != null ? fmtUSD(item.p90) : "N/A"}`}
                  {item.prob != null && `  ·  ${item.prob.toFixed(0)}% prob positive`}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${c.divider}`, flexWrap: "wrap" }}>
        {Object.entries(VERDICT_COLOR).map(([v, col]) => (
          <span key={v} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: c.axis }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: col, display: "inline-block", flexShrink: 0 }} />
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Horizontal Bar List - HTML-based (reliable for ranked lists) ───────────
export function HBarList({
  data, valueKey, nameKey = "name",
  currency = false, color = CHART.blue, maxItems,
}: {
  data: any[]; valueKey: string; nameKey?: string;
  currency?: boolean; color?: string; maxItems?: number;
}) {
  const isDark = useIsDark();
  const c = clr(isDark);
  const [hovered, setHovered] = useState<number | null>(null);

  const rows = maxItems ? data.slice(0, maxItems) : data;
  if (!rows.length) return null;

  const maxVal = Math.max(...rows.map(d => Number(d[valueKey]) || 0), 1);

  return (
    <div>
      {/* axis hint */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${c.divider}` }}>
        <span style={{ fontSize: 10, color: c.axis }}>Name</span>
        <span style={{ fontSize: 10, color: c.axis }}>{currency ? "Annual Spend" : "Value"}</span>
      </div>
      <div className="space-y-2">
        {rows.map((item, i) => {
          const val  = Number(item[valueKey]) || 0;
          const pct  = (val / maxVal) * 100;
          const name = String(item[nameKey] ?? "");
          const isHov = hovered === i;
          return (
            <div key={i}
              style={{ display: "flex", alignItems: "center", gap: 8, cursor: "default" }}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
            >
              <div style={{ fontSize: 10.5, color: c.text, width: "38%", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {name.length > 22 ? name.slice(0, 20) + "…" : name}
              </div>
              <div style={{ flex: 1, height: 16, background: c.track, borderRadius: 4, position: "relative" }}>
                <div style={{
                  position: "absolute", top: 2, left: 0, bottom: 2,
                  width: `${Math.max(1, pct)}%`, minWidth: 5,
                  background: color, borderRadius: 3,
                  opacity: isHov ? 1 : 0.82, transition: "opacity 0.12s",
                }} />
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: isHov ? color : c.text, whiteSpace: "nowrap", width: "22%", textAlign: "right" }}>
                {currency ? fmtUSD(val) : fmtNum(val, 1)}
              </div>
            </div>
          );
        })}
      </div>
      {/* x-axis scale hint */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6, paddingTop: 4, borderTop: `1px solid ${c.divider}` }}>
        <span style={{ fontSize: 10, color: c.axis }}>← 0 - {currency ? fmtUSD(maxVal) : fmtNum(maxVal)} →</span>
      </div>
    </div>
  );
}

// ─── Waterfall Bar - HTML-based ─────────────────────────────────────────────
export function WaterfallBar({
  data,
}: {
  data: { name: string; value: number }[]; height?: number;
}) {
  const isDark = useIsDark();
  const c = clr(isDark);
  const [hovered, setHovered] = useState<number | null>(null);

  if (!data.length) return null;
  const maxAbs = Math.max(...data.map(d => Math.abs(d.value)), 1);
  const hasNeg = data.some(d => d.value < 0);

  return (
    <div style={{ padding: "2px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${c.divider}` }}>
        <span style={{ fontSize: 10, color: c.axis }}>Component</span>
        <span style={{ fontSize: 10, color: c.axis }}>← savings (green) · cost (red) →</span>
      </div>
      <div className="space-y-2.5">
        {data.map((item, i) => {
          const pct   = (Math.abs(item.value) / maxAbs) * 100;
          const isNeg = item.value < 0;
          const fill  = isNeg ? CHART.positive : CHART.danger;
          const isHov = hovered === i;
          return (
            <div key={i}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
              style={{ cursor: "default" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                <span style={{ fontSize: 11, color: c.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
                  {item.name.length > 30 ? item.name.slice(0, 28) + "…" : item.name}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: fill, whiteSpace: "nowrap" }}>
                  {isNeg ? "−" : "+"}{fmtUSD(Math.abs(item.value))}
                </span>
              </div>
              <div style={{ position: "relative", height: 14, background: c.track, borderRadius: 4 }}>
                {hasNeg && <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: c.axis, zIndex: 2 }} />}
                <div style={{
                  position: "absolute", top: 2, bottom: 2,
                  left:  hasNeg ? (isNeg ? `${50 - pct / 2}%` : "50%") : 0,
                  width: `${Math.max(0.5, pct / (hasNeg ? 2 : 1))}%`,
                  minWidth: 6, background: fill, borderRadius: 3,
                  opacity: isHov ? 1 : 0.82, transition: "opacity 0.1s",
                }} />
              </div>
              {isHov && (
                <div style={{ fontSize: 10, color: c.axis, marginTop: 2, fontStyle: "italic" }}>
                  {isNeg ? "cost saving / recurring benefit" : "cost addition / one-time spend"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Alias for pages that use WaterfallTooltipBar
export function WaterfallTooltipBar({
  data,
}: {
  data: { name: string; value: number; label?: string }[];
}) {
  return <WaterfallBar data={data.map(d => ({ name: d.label ?? d.name, value: d.value }))} />;
}

// ─── Vertical Bar Chart ─────────────────────────────────────────────────────
export function BarChartCard({
  data, x, bars, height = 200, currency = false,
}: {
  data: any[]; x: string; bars: { key: string; name: string; color?: string }[];
  height?: number; currency?: boolean;
  xLabel?: string; yLabel?: string; horizontal?: boolean; yAxisWidth?: number;
}) {
  const isDark = useIsDark();
  const c = clr(isDark);
  const fmt = (v: number) => (currency ? fmtUSD(v) : fmtNum(v, 1));
  const max = Math.max(...data.flatMap((d) => bars.map((b) => Number(d[b.key]) || 0)), 1);
  return (
    <div style={{ width: "100%", height }} className="flex flex-col">
      <div className="flex-1 flex items-end gap-2 px-1" style={{ minHeight: 0 }}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" style={{ minWidth: 0 }}>
            <div className="flex items-end justify-center gap-0.5 w-full" style={{ height: "calc(100% - 16px)" }}>
              {bars.map((b, bi) => {
                const v = Number(d[b.key]) || 0;
                return (
                  <div key={bi} title={`${b.name}: ${fmt(v)}`}
                    style={{ height: `${Math.max(1, (v / max) * 100)}%`,
                      width: bars.length > 1 ? `${Math.max(10, 44 / bars.length)}%` : "60%",
                      minWidth: 4, background: b.color || SERIES[bi % SERIES.length],
                      borderRadius: "3px 3px 0 0" }} />
                );
              })}
            </div>
            <div className="text-[9px] text-center truncate w-full mt-1" style={{ color: c.text }}>
              {String(d[x] ?? "").length > 11 ? String(d[x]).slice(0, 10) + "…" : d[x]}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-1" style={{ borderTop: `1px solid ${c.divider}`, paddingTop: 3 }}>
        {bars.length > 1 ? (
          <div className="flex gap-3 flex-wrap">
            {bars.map((b, bi) => (
              <span key={bi} className="flex items-center gap-1 text-[10px]" style={{ color: c.text }}>
                <span className="w-2 h-2 rounded-sm" style={{ background: b.color || SERIES[bi % SERIES.length] }} />{b.name}
              </span>
            ))}
          </div>
        ) : <span />}
        <span className="text-[9px]" style={{ color: c.axis }}>max {fmt(max)}</span>
      </div>
    </div>
  );
}
export function LineChartCard({
  data, x, lines, height = 200, currency = false, refZero = false,
}: {
  data: any[]; x: string; lines: { key: string; name: string; color?: string }[];
  height?: number; currency?: boolean; refZero?: boolean;
}) {
  const isDark = useIsDark();
  const c = clr(isDark);
  const vals = data.flatMap((d) => lines.map((l) => Number(d[l.key]) || 0));
  let min = Math.min(...vals, 0), max = Math.max(...vals, 1);
  if (min === max) max = min + 1;
  const X = (i: number) => (data.length <= 1 ? 0 : (i / (data.length - 1)) * 100);
  const Y = (v: number) => 100 - ((v - min) / (max - min)) * 100;
  return (
    <div style={{ width: "100%", height }} className="flex flex-col">
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ flex: 1, minHeight: 0 }}>
        {refZero && min < 0 && <line x1={0} x2={100} y1={Y(0)} y2={Y(0)} stroke={c.axis} strokeWidth={0.4} strokeDasharray="2 2" />}
        {lines.map((l, li) => (
          <polyline key={li}
            points={data.map((d, i) => `${X(i)},${Y(Number(d[l.key]) || 0)}`).join(" ")}
            fill="none" stroke={l.color || SERIES[li % SERIES.length]} strokeWidth={1.5}
            vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        ))}
      </svg>
      <div className="flex justify-between text-[9px] mt-1" style={{ color: c.axis, borderTop: `1px solid ${c.divider}`, paddingTop: 3 }}>
        <span>{data.length ? String(data[0][x]) : ""}</span>
        <span>max {currency ? fmtUSD(max) : fmtNum(max, 1)}</span>
        <span>{data.length ? String(data[data.length - 1][x]) : ""}</span>
      </div>
    </div>
  );
}
export function AreaChartCard({
  data, x, area, height = 200, currency = false, color = CHART.blue,
}: {
  data: any[]; x: string; area: string; height?: number; currency?: boolean; color?: string;
}) {
  const isDark = useIsDark();
  const c = clr(isDark);
  const vals = data.map((d) => Number(d[area]) || 0);
  let min = Math.min(...vals, 0), max = Math.max(...vals, 1);
  if (min === max) max = min + 1;
  const X = (i: number) => (data.length <= 1 ? 0 : (i / (data.length - 1)) * 100);
  const Y = (v: number) => 100 - ((v - min) / (max - min)) * 100;
  const line = data.map((d, i) => `${X(i)},${Y(Number(d[area]) || 0)}`).join(" ");
  const fill = `0,100 ${line} 100,100`;
  return (
    <div style={{ width: "100%", height }} className="flex flex-col">
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ flex: 1, minHeight: 0 }}>
        <polygon points={fill} fill={color} fillOpacity={0.16} />
        {min < 0 && <line x1={0} x2={100} y1={Y(0)} y2={Y(0)} stroke={c.axis} strokeWidth={0.4} strokeDasharray="2 2" />}
        <polyline points={line} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <div className="flex justify-between text-[9px] mt-1" style={{ color: c.axis, borderTop: `1px solid ${c.divider}`, paddingTop: 3 }}>
        <span>{data.length ? String(data[0][x]) : ""}</span>
        <span>{currency ? fmtUSD(max) : fmtNum(max, 1)}</span>
        <span>{data.length ? String(data[data.length - 1][x]) : ""}</span>
      </div>
    </div>
  );
}
// ─── Donut - SVG composition (share of total), reliable without recharts ─────
export function DonutCard({
  data, height = 240, currency = false,
}: {
  data: { name: string; value: number }[]; height?: number; currency?: boolean;
}) {
  const isDark = useIsDark();
  const c = clr(isDark);
  const fmt = (v: number) => (currency ? fmtUSD(v, false) : fmtNum(v, 1));
  const rows = data.filter((d) => (Number(d.value) || 0) > 0).sort((a, b) => b.value - a.value);
  const total = rows.reduce((a, d) => a + (Number(d.value) || 0), 0) || 1;
  // build stroke-dash arcs on a 100-circumference circle (r = 100/2π)
  const R = 15.915;
  let offset = 25; // start at top
  const arcs = rows.map((d, i) => {
    const pct = (Number(d.value) / total) * 100;
    const seg = { color: SERIES[i % SERIES.length], dash: pct, gap: 100 - pct, off: offset };
    offset -= pct;
    return seg;
  });
  return (
    <div style={{ width: "100%", height }} className="flex items-center gap-4">
      <svg viewBox="0 0 42 42" width={height - 40} height={height - 40} style={{ flexShrink: 0, maxWidth: "45%" }}>
        <circle cx="21" cy="21" r={R} fill="transparent" stroke={c.track} strokeWidth="6" />
        {arcs.map((a, i) => (
          <circle key={i} cx="21" cy="21" r={R} fill="transparent" stroke={a.color} strokeWidth="6"
            strokeDasharray={`${a.dash} ${a.gap}`} strokeDashoffset={a.off} transform="rotate(-90 21 21)" />
        ))}
        <text x="21" y="20" textAnchor="middle" fontSize="3.2" fontWeight="700" fill={c.text}>{rows.length}</text>
        <text x="21" y="24" textAnchor="middle" fontSize="2.2" fill={c.axis}>parts</text>
      </svg>
      <div className="flex-1 space-y-1 min-w-0">
        {rows.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: SERIES[i % SERIES.length] }} />
            <span className="truncate flex-1" style={{ color: c.text }}>{d.name}</span>
            <span className="font-semibold numeric" style={{ color: c.text }}>{Math.round((d.value / total) * 100)}%</span>
            <span className="numeric text-[10px]" style={{ color: c.axis }}>{fmt(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Dual Axis Bar ─────────────────────────────────────────────────────────
export function DualAxisBarChart({
  data, x, leftKey, rightKey, leftName, rightName, height = 200,
}: {
  data: any[]; x: string;
  leftKey: string; rightKey: string;
  leftName: string; rightName: string;
  height?: number;
}) {
  const isDark = useIsDark();
  const c = clr(isDark);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="99%" height="100%" minWidth={0} debounce={50}>
        <ComposedChart
          data={data}
          margin={{ top: 30, right: 50, left: 0, bottom: 4 }}
          barCategoryGap="28%"
        >
          {gridEl(isDark)}
          <XAxis dataKey={x} {...axisCfg(isDark)} />
          <YAxis
            yAxisId="left" {...axisCfg(isDark)} tickFormatter={(v) => fmtUSD(v)} width={60}
          />
          <YAxis
            yAxisId="right" orientation="right" {...axisCfg(isDark)} tickFormatter={(v) => fmtCO2(v)} width={55}
          />
          <Tooltip
            {...tipStyle(isDark)}
            formatter={(v: number, n: string) => [n === leftName ? fmtUSD(v, false) : fmtCO2(v), n]}
          />
          <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 10, color: c.text }} iconSize={8} />
          <Bar yAxisId="left"  dataKey={leftKey}  name={leftName}  fill={CHART.blue}     radius={[3,3,0,0]} minPointSize={0} isAnimationActive={false} />
          <Bar yAxisId="right" dataKey={rightKey} name={rightName} fill={CHART.positive} radius={[3,3,0,0]} minPointSize={0} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Scatter - explicit domain so all points across multiple <Scatter> show ─
export function ScatterCard({
  data, height = 280, xLabel = "Cost / unit (USD)", yLabel = "Emissions / unit", yUnit = "t",
}: {
  data: { x: number; y: number; name: string; size?: number }[];
  height?: number; xLabel?: string; yLabel?: string; yUnit?: string;
}) {
  const isDark = useIsDark();
  const c = clr(isDark);
  if (!data.length) return null;
  const xs = data.map((d) => d.x), ys = data.map((d) => d.y);
  let xMin = Math.min(...xs), xMax = Math.max(...xs), yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xp = ((xMax - xMin) || xMax || 1) * 0.18, yp = ((yMax - yMin) || yMax || 1) * 0.18;
  xMin -= xp; xMax += xp; yMin = Math.max(0, yMin - yp); yMax += yp;
  const X = (v: number) => ((v - xMin) / ((xMax - xMin) || 1)) * 100;
  const Y = (v: number) => 100 - ((v - yMin) / ((yMax - yMin) || 1)) * 100;
  return (
    <div style={{ width: "100%", height }} className="flex flex-col">
      <div className="relative flex-1 rounded-lg" style={{ minHeight: 0, border: `1px solid ${c.divider}`, background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)" }}>
        {data.map((d, i) => (
          <div key={i} className="absolute" style={{ left: `${X(d.x)}%`, top: `${Y(d.y)}%`, transform: "translate(-50%,-50%)" }}>
            <div className="rounded-full" style={{ width: 11, height: 11, background: SERIES[i % SERIES.length], opacity: 0.85, border: "1px solid rgba(255,255,255,0.5)" }}
              title={`${d.name}: ${fmtUSD(d.x, false)} / ${fmtNum(d.y, 2)} ${yUnit}`} />
            <div className="absolute left-1/2 -translate-x-1/2 text-[9px] whitespace-nowrap" style={{ top: -13, color: c.text }}>{d.name}</div>
          </div>
        ))}
        <span className="absolute left-2 top-1 text-[9px] font-semibold" style={{ color: "#0e9f6e" }}>best</span>
        <span className="absolute right-2 bottom-1 text-[9px]" style={{ color: "#ef4444" }}>worst</span>
      </div>
      <div className="flex justify-between text-[9px] mt-1" style={{ color: c.axis }}>
        <span>{xLabel} →</span><span>↑ {yLabel}</span>
      </div>
    </div>
  );
}
export function CoverageBar({ coverage }: { coverage: { measured_pct?: number; estimated_pct?: number; unknown_pct?: number } | null | undefined }) {
  const m = coverage?.measured_pct ?? 0, e = coverage?.estimated_pct ?? 0, u = coverage?.unknown_pct ?? 0;
  const seg = [
    { label: "Measured", v: m, c: "#0e9f6e", note: "supplier-provided · high confidence" },
    { label: "Estimated", v: e, c: "#1d4ed8", note: "GLEC factor-based · medium" },
    { label: "Unknown", v: u, c: "#94a3b8", note: "no data · low" },
  ];
  return (
    <div>
      <div className="flex h-3 w-full rounded-full overflow-hidden">
        {seg.map((s) => <div key={s.label} style={{ width: `${s.v}%`, background: s.c }} title={`${s.label} ${s.v}%`} />)}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {seg.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.c }} />
            <span className="font-semibold text-ink-900 dark:text-white">{s.label} {s.v}%</span>
            <span className="text-slate-400 hidden md:inline">· {s.note}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Radar / Spider (scenario lever comparison, FDD Module 3) ────────────────
export function RadarCard({
  data, series, height = 260,
}: {
  data: { axis: string; [k: string]: any }[];
  series: { key: string; name: string; color?: string }[];
  height?: number;
}) {
  const isDark = useIsDark();
  const c = clr(isDark);
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="99%" height="100%" minWidth={0} debounce={50}>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke={c.grid} />
          <PolarAngleAxis dataKey="axis" tick={{ fill: c.text, fontSize: 10 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fill: c.subText, fontSize: 9 }} axisLine={false} />
          {series.map((s, i) => (
            <Radar key={s.key} name={s.name} dataKey={s.key}
              stroke={s.color || SERIES[i % SERIES.length]} fill={s.color || SERIES[i % SERIES.length]}
              fillOpacity={0.18} isAnimationActive={false} />
          ))}
          <Legend wrapperStyle={{ fontSize: 10, color: c.text }} iconSize={8} />
          <Tooltip {...tipStyle(isDark)} formatter={(v: number) => [fmtNum(v, 0)]} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
