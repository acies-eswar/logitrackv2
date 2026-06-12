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
  xLabel, yLabel,
}: {
  data: any[]; x: string; bars: { key: string; name: string; color?: string }[];
  height?: number; currency?: boolean;
  xLabel?: string; yLabel?: string;
  // keep horizontal as no-op for API compat
  horizontal?: boolean; yAxisWidth?: number;
}) {
  const isDark = useIsDark();
  const c = clr(isDark);
  const hasLegend = bars.length > 1;
  const topMargin = hasLegend ? 30 : 6;
  const bottomHeight = data.length > 5 ? 60 : 28;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="99%" height="100%" minWidth={0} debounce={50}>
        <BarChart
          data={data}
          margin={{ top: topMargin, right: 10, left: 0, bottom: 4 }}
          barCategoryGap="28%"
        >
          {gridEl(isDark)}
          <XAxis
            dataKey={x} {...axisCfg(isDark)} interval={0}
            angle={data.length > 5 ? -35 : 0}
            textAnchor={data.length > 5 ? "end" : "middle"}
            height={bottomHeight}
            tickFormatter={(v: string) => v && v.length > 14 ? v.slice(0, 12) + "…" : v}
            label={xLabel ? { value: xLabel, position: "insideBottom", offset: -4, fontSize: 10, fill: c.axis } : undefined}
          />
          <YAxis
            {...axisCfg(isDark)}
            tickFormatter={(v) => currency ? fmtUSD(v) : fmtNum(v)}
            width={currency ? 60 : 40}
            label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", offset: 14, fontSize: 10, fill: c.axis } : undefined}
          />
          <Tooltip
            {...tipStyle(isDark)}
            labelFormatter={(label: any) => {
              if (typeof label === "number" && data[label] !== undefined) {
                return String(data[label][x] ?? label);
              }
              return String(label ?? "");
            }}
            formatter={(v: number, name: string) => [currency ? fmtUSD(v, false) : fmtNum(v, 1), name]}
          />
          {hasLegend && (
            <Legend
              verticalAlign="top" align="right"
              wrapperStyle={{ fontSize: 10, color: c.text, paddingBottom: 6 }}
              iconSize={8}
            />
          )}
          {bars.map((b, i) => (
            <Bar
              key={b.key} dataKey={b.key} name={b.name}
              fill={b.color || SERIES[i % SERIES.length]}
              radius={[3, 3, 0, 0]}
              minPointSize={0} isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Line Chart ────────────────────────────────────────────────────────────
export function LineChartCard({
  data, x, lines, height = 200, currency = false, refZero = false,
}: {
  data: any[]; x: string; lines: { key: string; name: string; color?: string }[];
  height?: number; currency?: boolean; refZero?: boolean;
}) {
  const isDark = useIsDark();
  const c = clr(isDark);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="99%" height="100%" minWidth={0} debounce={50}>
        <LineChart
          data={data}
          margin={{ top: 6, right: 10, left: 0, bottom: 4 }}
        >
          {gridEl(isDark)}
          <XAxis dataKey={x} {...axisCfg(isDark)} />
          <YAxis {...axisCfg(isDark)} tickFormatter={(v) => currency ? fmtUSD(v) : fmtNum(v)} width={currency ? 60 : 40} />
          <Tooltip
            {...tipStyle(isDark)}
            formatter={(v: number) => [currency ? fmtUSD(v, false) : fmtNum(v, 1)]}
          />
          {lines.length > 1 && (
            <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 10, color: c.text }} iconSize={8} />
          )}
          {refZero && <ReferenceLine y={0} stroke={c.axis} strokeDasharray="3 3" />}
          {lines.map((l, i) => (
            <Line
              key={l.key} type="monotone" dataKey={l.key} name={l.name}
              stroke={l.color || SERIES[i % SERIES.length]} strokeWidth={2}
              dot={false} isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Area Chart ────────────────────────────────────────────────────────────
export function AreaChartCard({
  data, x, area, height = 200, currency = false, color = CHART.blue,
}: {
  data: any[]; x: string; area: string; height?: number; currency?: boolean; color?: string;
}) {
  const isDark = useIsDark();
  const c = clr(isDark);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="99%" height="100%" minWidth={0} debounce={50}>
        <AreaChart
          data={data}
          margin={{ top: 6, right: 10, left: 0, bottom: 4 }}
        >
          <defs>
            <linearGradient id={`ag-${area}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.28} />
              <stop offset="95%" stopColor={color} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          {gridEl(isDark)}
          <XAxis dataKey={x} {...axisCfg(isDark)} />
          <YAxis {...axisCfg(isDark)} tickFormatter={(v) => currency ? fmtUSD(v) : fmtNum(v)} width={currency ? 60 : 40} />
          <Tooltip
            {...tipStyle(isDark)}
            formatter={(v: number) => [currency ? fmtUSD(v, false) : fmtNum(v, 1)]}
          />
          <ReferenceLine y={0} stroke={c.axis} strokeDasharray="3 3" />
          <Area
            type="monotone" dataKey={area} stroke={color} strokeWidth={1.5}
            fill={`url(#ag-${area})`} isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Donut ─────────────────────────────────────────────────────────────────
export function DonutCard({
  data, height = 240, currency = false,
}: {
  data: { name: string; value: number }[]; height?: number; currency?: boolean;
}) {
  const isDark = useIsDark();
  const c = clr(isDark);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="99%" height="100%" minWidth={0} debounce={50}>
        <PieChart>
          <Pie
            data={data} dataKey="value" nameKey="name"
            cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}
            isAnimationActive={false}
          >
            {data.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
          </Pie>
          <Tooltip
            {...tipStyle(isDark)}
            formatter={(v: number) => [currency ? fmtUSD(v, false) : fmtNum(v, 1)]}
          />
          <Legend wrapperStyle={{ fontSize: 10, color: c.text }} iconSize={8} />
        </PieChart>
      </ResponsiveContainer>
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
  data, height = 280,
  xLabel = "Cost / unit (USD)",
  yLabel = "Emissions / unit",
  yUnit = "t",
}: {
  data: { x: number; y: number; name: string; size?: number }[];
  height?: number; xLabel?: string; yLabel?: string; yUnit?: string;
}) {
  const isDark = useIsDark();
  const c = clr(isDark);

  // Compute global domain so all Scatter components are within range
  const xs = data.map(d => d.x);
  const ys = data.map(d => d.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xPad = ((xMax - xMin) || xMax) * 0.18;
  const yPad = ((yMax - yMin) || yMax) * 0.18;
  const xDomain: [number, number] = [Math.max(0, xMin - xPad), xMax + xPad];
  const yDomain: [number, number] = [Math.max(0, yMin - yPad), yMax + yPad];

  const CustomTip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload ?? {};
    return (
      <div style={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 6, padding: "6px 10px", fontSize: 11 }}>
        <div style={{ fontWeight: 600, color: c.text, marginBottom: 3 }}>{d.name}</div>
        <div style={{ color: CHART.blue }}>Cost/unit: {fmtUSD(d.x, false)}</div>
        <div style={{ color: CHART.positive }}>CO₂e/unit: {fmtNum(d.y, 2)} {yUnit}</div>
        {d.size && <div style={{ color: c.axis }}>Annual volume: {fmtNum(d.size)}</div>}
      </div>
    );
  };

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="99%" height="100%" minWidth={0} debounce={50}>
        <ScatterChart
          margin={{ top: 8, right: 20, left: 10, bottom: 36 }}
        >
          {gridEl(isDark)}
          <XAxis
            type="number" dataKey="x" name="cost"
            domain={xDomain} {...axisCfg(isDark)}
            tickFormatter={(v) => fmtUSD(v)}
            label={{ value: xLabel, position: "insideBottom", offset: -22, fontSize: 10, fill: c.axis }}
          />
          <YAxis
            type="number" dataKey="y" name="emissions"
            domain={yDomain} {...axisCfg(isDark)}
            tickFormatter={(v) => fmtNum(v, 1)}
            label={{ value: yLabel, angle: -90, position: "insideLeft", offset: 16, fontSize: 10, fill: c.axis }}
          />
          <Tooltip content={<CustomTip />} cursor={{ strokeDasharray: "3 3", stroke: c.axis }} />
          <Legend
            verticalAlign="bottom" align="center"
            wrapperStyle={{ fontSize: 10, color: c.text, paddingTop: 8 }}
            iconSize={10} iconType="circle"
          />
          {data.map((item, i) => (
            <Scatter
              key={item.name} name={item.name}
              data={[item]} fill={SERIES[i % SERIES.length]}
              isAnimationActive={false}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Carbon Coverage Bar (FDD Emissions Confidence Model) ────────────────────
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
