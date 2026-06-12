"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtCO2, fmtUSD, fmtNum } from "@/lib/api";
import { Segmented } from "@/components/ui";

const SEG_COLOR: Record<string, string> = {
  "Supplier→Port": "#dc2626",
  "Port→Plant": "#d97706",
  "Supplier→Plant": "#1d4ed8",
  "Plant→Plant": "#8aabff",
  "Plant→DC": "#0e9f6e",
  "DC→DC": "#64748b",
};
const MODE_COLOR: Record<string, string> = {
  ocean: "#1d4ed8",
  road: "#d97706",
  rail: "#0e9f6e",
  air: "#dc2626",
};
const ROLE_COLOR: Record<string, string> = {
  supplier: "#f87171",
  port: "#fbbf24",
  plant: "#60a5fa",
  dc: "#34d399",
  node: "#94a3b8",
};
const ROLE_SHAPE: Record<string, string> = {
  supplier: "circle",
  port: "diamond",
  plant: "square",
  dc: "circle",
};
const ROLE_LABEL: Record<string, string> = {
  supplier: "Supplier",
  port: "Port",
  plant: "Plant",
  dc: "Distribution Center",
  node: "Node",
};

const W = 1100, H = 520;

function project(lat: number, lng: number): [number, number] {
  return [((lng + 180) / 360) * W, ((90 - lat) / 180) * H];
}

// Simplified continent outlines as polygon coordinate arrays [lat, lng]
const CONTINENTS: [number, number][][] = [
  // North America
  [
    [72, -168],[72, -52],[60, -52],[50, -55],[45, -60],[42, -70],[25, -82],[18, -93],
    [15, -88],[8, -83],[8, -77],[10, -75],[10, -72],[12, -72],[18, -72],[20, -74],
    [26, -80],[30, -82],[32, -80],[35, -76],[38, -74],[42, -70],[45, -64],[47, -53],
    [50, -55],[55, -57],[58, -62],[60, -64],[62, -64],[65, -62],[68, -52],[72, -52],
    [72, -168],
  ],
  // South America
  [
    [12, -72],[12, -63],[10, -62],[8, -60],[5, -52],[2, -50],[0, -50],
    [-5, -35],[-10, -37],[-15, -39],[-23, -43],[-30, -51],[-33, -52],
    [-38, -58],[-42, -65],[-48, -66],[-52, -68],[-55, -66],[-55, -64],
    [-50, -68],[-45, -65],[-40, -62],[-33, -70],[-18, -70],[-5, -80],
    [0, -78],[5, -77],[8, -77],[10, -75],[12, -72],
  ],
  // Europe
  [
    [36, -9],[38, -9],[36, 0],[38, 4],[43, 3],[44, 8],[43, 14],[40, 18],
    [37, 16],[37, 23],[37, 28],[40, 28],[41, 30],[42, 40],[46, 40],
    [47, 30],[48, 25],[50, 22],[51, 14],[54, 10],[56, 8],[56, 6],[58, 5],
    [58, 6],[60, 5],[62, 5],[65, 14],[68, 18],[70, 28],[70, 30],[68, 32],
    [65, 28],[60, 22],[55, 22],[52, 22],[50, 18],[48, 16],[47, 13],[44, 14],
    [42, 14],[40, 18],[37, 23],[37, 28],[40, 28],[41, 30],[42, 40],[44, 35],
    [44, 28],[46, 24],[50, 18],[52, 14],[54, 10],[56, 8],[58, 5],[60, 5],
    [62, 5],[65, 14],[68, 18],[70, 28],[72, 30],[72, -10],[70, -10],[68, -18],
    [65, -18],[62, -25],[60, -25],[58, -10],[56, -6],[54, -10],[52, -10],
    [50, -5],[48, -5],[46, -2],[44, 0],[42, 0],[40, -8],[37, -9],[36, -9],
  ],
  // Africa
  [
    [37, -6],[37, 10],[35, 12],[36, 14],[33, 14],[32, 25],[28, 33],[22, 37],
    [12, 44],[12, 43],[10, 42],[5, 42],[0, 42],[-5, 39],[-12, 40],[-20, 35],
    [-25, 33],[-30, 30],[-34, 27],[-35, 20],[-30, 17],[-25, 15],[-18, 12],
    [-10, 14],[-3, 10],[0, 10],[5, 2],[5, -5],[3, -8],[5, -15],[10, -17],
    [14, -17],[18, -16],[22, -17],[26, -15],[30, -10],[35, -6],[37, -6],
  ],
  // Asia
  [
    [72, 30],[72, 140],[68, 140],[60, 140],[50, 140],[45, 135],[40, 130],
    [35, 126],[30, 122],[22, 118],[18, 110],[15, 108],[10, 106],[5, 104],
    [2, 104],[1, 104],[0, 108],[-5, 106],[0, 100],[5, 100],[10, 98],
    [13, 100],[16, 100],[20, 93],[22, 88],[18, 82],[12, 80],[8, 78],
    [8, 77],[10, 72],[18, 72],[22, 68],[25, 65],[28, 60],[30, 56],
    [35, 50],[38, 45],[40, 40],[42, 40],[42, 30],[44, 28],[46, 24],
    [50, 18],[52, 14],[54, 10],[56, 8],[58, 5],[60, 5],[62, 5],[65, 14],
    [68, 18],[70, 28],[72, 30],
  ],
  // Australia
  [
    [-15, 128],[-15, 136],[-12, 136],[-12, 143],[-18, 148],[-25, 150],
    [-33, 152],[-38, 146],[-38, 140],[-35, 136],[-32, 133],[-32, 126],
    [-26, 114],[-22, 114],[-18, 122],[-15, 128],
  ],
];

function continentPath(coords: [number, number][]): string {
  return coords.map(([lat, lng], i) => {
    const [x, y] = project(lat, lng);
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ") + " Z";
}

export function NetworkMap({ nodes, edges, onSelect, selected, highlightEdges }: { nodes: any[]; edges: any[]; onSelect?: (id: string) => void; selected?: string | null; highlightEdges?: Set<string> | null }) {
  const [mounted, setMounted] = useState(false);
  const [colorBy, setColorBy] = useState<"segment" | "mode">("segment");
  const [segFilter, setSegFilter] = useState<string>("all");
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const maxEdge = Math.max(...edges.map((e) => e.co2e ?? 0), 0.001);
  const maxNode = Math.max(...nodes.map((n) => n.throughput_co2e ?? 0), 0.001);

  const visEdges = useMemo(
    () => edges.filter((e) => segFilter === "all" || e.segment === segFilter),
    [edges, segFilter],
  );
  const nodeById = useMemo(
    () => Object.fromEntries(nodes.map((n) => [n.id, n])),
    [nodes],
  );
  const hv = hover ? nodeById[hover] : null;

  // Group edges by (from,to) for deduplication - show one representative curve per route
  const edgeGroups = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const e of visEdges) {
      const key = [e.from, e.to].sort().join("|");
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }
    return Object.values(groups);
  }, [visEdges]);

  if (!mounted) return <div className="h-[520px] bg-[#0d1629] rounded-xl border border-slate-700 animate-pulse" />;

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Color edges by</span>
          <Segmented
            value={colorBy}
            onChange={setColorBy}
            options={[
              { value: "segment", label: "Segment" },
              { value: "mode", label: "Mode" },
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Filter segment</span>
          <Segmented
            value={segFilter}
            onChange={setSegFilter}
            options={[
              { value: "all", label: "All" },
              { value: "Supplier→Port", label: "Sup→Port" },
              { value: "Port→Plant", label: "Port→Plant" },
              { value: "Supplier→Plant", label: "Sup→Plant" },
              { value: "Plant→DC", label: "Plant→DC" },
            ]}
          />
        </div>
      </div>

      {/* Map */}
      <div className="relative rounded-xl overflow-hidden border border-slate-700" style={{ boxShadow: "inset 0 0 80px rgba(0,0,0,0.5)" }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block">
          <defs>
            <radialGradient id="ocean" cx="50%" cy="42%" r="75%">
              <stop offset="0%" stopColor="#10243f" />
              <stop offset="60%" stopColor="#0b1830" />
              <stop offset="100%" stopColor="#070f1f" />
            </radialGradient>
            <linearGradient id="land" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#243449" />
              <stop offset="100%" stopColor="#1a2738" />
            </linearGradient>
            <filter id="nodeGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.2" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* Ocean background */}
          <rect width={W} height={H} fill="url(#ocean)" />

          {/* Latitude grid */}
          {[60, 30, 0, -30, -60].map((lat) => {
            const [, y] = project(lat, 0);
            return (
              <g key={lat}>
                <line x1={0} x2={W} y1={y} y2={y} stroke="#ffffff08" strokeDasharray="3 8" />
                <text x={4} y={y - 3} fontSize="8" fill="#ffffff18" fontFamily="monospace">{lat}°</text>
              </g>
            );
          })}
          {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lng) => {
            const [x] = project(0, lng);
            return <line key={lng} x1={x} x2={x} y1={0} y2={H} stroke="#ffffff06" strokeDasharray="3 8" />;
          })}

          {/* Continent fills */}
          {CONTINENTS.map((coords, i) => (
            <path key={i} d={continentPath(coords)} fill="url(#land)" stroke="#3b5474" strokeWidth={0.7} />
          ))}

          {/* Flow edges - deduplicated groups */}
          {edgeGroups.map((group, gi) => {
            const e = group[0];
            if (e.from_lat == null || e.from_lng == null || e.to_lat == null || e.to_lng == null) return null;
            const [x1, y1] = project(e.from_lat, e.from_lng);
            const [x2, y2] = project(e.to_lat, e.to_lng);
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.13;
            const totalCo2 = group.reduce((s: number, g: any) => s + (g.co2e ?? 0), 0);
            const w = Math.max(0.5, Math.min(4.5, (totalCo2 / maxEdge) * 4.5));
            const hl = hover && (e.from === hover || e.to === hover);
            const inRoute = highlightEdges ? highlightEdges.has(`${e.from}__${e.to}`) : null;
            const op = inRoute !== null
              ? (inRoute ? 0.95 : 0.04)
              : (hover ? (hl ? 0.9 : 0.06) : 0.45);
            const baseColor =
              colorBy === "segment"
                ? SEG_COLOR[e.segment] ?? "#64748b"
                : MODE_COLOR[e.mode] ?? "#64748b";
            const color = inRoute ? "#22d3ee" : baseColor;
            const sw = inRoute ? Math.max(2.4, w) : w;
            return (
              <path
                key={gi}
                d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
                fill="none"
                stroke={color}
                strokeWidth={sw}
                opacity={op}
                strokeLinecap="round"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((n) => {
            if (n.lat == null || n.lng == null) return null;
            const [x, y] = project(n.lat, n.lng);
            const frac = Math.max(0.02, (n.throughput_co2e ?? 0) / maxNode);
            const r = 3.5 + Math.sqrt(frac) * 14;
            const hl = hover === n.id;
            const color = ROLE_COLOR[n.role] ?? "#94a3b8";
            const shape = ROLE_SHAPE[n.role] ?? "circle";

            let nodeEl: React.ReactNode;
            if (shape === "diamond") {
              const s = r * 1.2;
              nodeEl = (
                <polygon
                  points={`${x},${y - s} ${x + s},${y} ${x},${y + s} ${x - s},${y}`}
                  fill={color}
                  opacity={hl ? 1 : 0.82}
                  stroke={hl ? "#fff" : "#0d1117"}
                  strokeWidth={hl ? 1.5 : 0.5}
                />
              );
            } else if (shape === "square") {
              const s = r * 0.9;
              nodeEl = (
                <rect
                  x={x - s} y={y - s} width={s * 2} height={s * 2}
                  fill={color}
                  opacity={hl ? 1 : 0.82}
                  stroke={hl ? "#fff" : "#0d1117"}
                  strokeWidth={hl ? 1.5 : 0.5}
                  rx={2}
                />
              );
            } else {
              nodeEl = (
                <circle
                  cx={x} cy={y} r={r}
                  fill={color}
                  opacity={hl ? 1 : 0.82}
                  stroke={hl ? "#fff" : "#0d1117"}
                  strokeWidth={hl ? 1.5 : 0.5}
                />
              );
            }

            const showLabel = hl || frac > 0.35;
            return (
              <g
                key={n.id}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect?.(n.id)}
                style={{ cursor: "pointer" }}
              >
                {selected === n.id && <circle cx={x} cy={y} r={r + 5} fill="none" stroke="#22d3ee" strokeWidth={2} />}
                {nodeEl}
                {showLabel && (
                  <text
                    x={x}
                    y={y - r - 5}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#e2e8f0"
                    fontFamily="monospace"
                    fontWeight={hl ? "bold" : "normal"}
                  >
                    {n.id.split(" ").slice(0, 2).join(" ")}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover tooltip */}
        {hv && (
          <div className="absolute top-3 right-3 bg-slate-900/95 border border-slate-600 rounded-xl shadow-2xl p-4 w-64 backdrop-blur">
            <div className="font-semibold text-white text-sm">{hv.id}</div>
            <div className="text-xs text-slate-400 mb-3 capitalize">
              {ROLE_LABEL[hv.role] ?? hv.role} · {hv.country}
            </div>
            <div className="space-y-1.5 text-sm">
              <TooltipRow label="Annual CO₂e" value={fmtCO2(hv.throughput_co2e)} />
              <TooltipRow label="Freight flow" value={fmtUSD(hv.throughput_freight)} />
              <TooltipRow label="Shipments / yr" value={fmtNum(hv.shipments)} />
            </div>
          </div>
        )}

        {/* Summary badge */}
        <div className="absolute bottom-3 left-3 bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-400 backdrop-blur">
          {nodes.length} nodes · {edges.length} lanes
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-4 flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">Nodes</span>
          {Object.entries(ROLE_COLOR)
            .filter(([k]) => k !== "node")
            .map(([k, c]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm inline-block"
                  style={{ background: c }}
                />
                <span className="text-slate-400">{ROLE_LABEL[k]}</span>
              </span>
            ))}
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-slate-400 font-medium uppercase tracking-wide text-[10px]">
            {colorBy === "segment" ? "Segment" : "Mode"}
          </span>
          {Object.entries(colorBy === "segment" ? SEG_COLOR : MODE_COLOR).map(([k, c]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="w-5 h-0.5 inline-block" style={{ background: c }} />
              <span className="text-slate-400 capitalize">{k}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono font-medium text-white">{value}</span>
    </div>
  );
}
