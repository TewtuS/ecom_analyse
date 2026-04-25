"use client";

import { useEffect, useState, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { Package, DollarSign, Layers, TrendingUp } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import KpiCard from "@/components/KpiCard";
import { salesApi } from "@/lib/api";
import { clsx } from "clsx";

// ── Types ─────────────────────────────────────────────────────────────────────

type ChannelId = "all" | "Taobao" | "JD" | "Shopee" | "Temu" | "Facebook Marketplace";

const CHANNELS: { id: ChannelId; label: string; color: string; logo: string }[] = [
  { id: "all",                  label: "All Channels",        color: "bg-slate-100 text-slate-700 border-slate-200",   logo: "🌐" },
  { id: "Taobao",               label: "淘宝 Taobao",          color: "bg-orange-50 text-orange-600 border-orange-200", logo: "🛍️" },
  { id: "JD",                   label: "京东 JD",              color: "bg-red-50 text-red-600 border-red-200",          logo: "🏪" },
  { id: "Shopee",               label: "Shopee",               color: "bg-orange-50 text-orange-500 border-orange-300", logo: "🟠" },
  { id: "Temu",                 label: "Temu",                 color: "bg-blue-50 text-blue-600 border-blue-200",       logo: "💰" },
  { id: "Facebook Marketplace", label: "Facebook Marketplace", color: "bg-indigo-50 text-indigo-600 border-indigo-200", logo: "📘" },
];

type BundlePair = {
  product_a: string;
  product_b: string;
  product_a_id: number;
  product_b_id: number;
  count: number;
  revenue: number;
  avg_order_qty: number;
};

type ChartPoint = {
  name: string;
  count: number;
  revenue: number;
};

type Summary = {
  total_bundle_sales: number;
  total_bundle_revenue: number;
  unique_pairs: number;
  avg_bundle_qty: number;
  most_common_pair: string;
  most_common_count: number;
};

type SortKey = "count" | "revenue" | "avg_order_qty" | "product_a" | "product_b";

type GraphNode = { id: number; name: string; sales_count: number };
type GraphEdge = { source: number; target: number; weight: number };

type LiftRow = {
  product_a_id: number;
  product_b_id: number;
  product_a: string;
  product_b: string;
  co_count: number;
  lift: number;
  confidence_ab: number;
  confidence_ba: number;
  support: number;
};

// ── Chart colours ─────────────────────────────────────────────────────────────
const BAR_COLORS = [
  "#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd",
  "#818cf8", "#7c3aed", "#4f46e5", "#4338ca", "#3730a3", "#312e81",
];

const NODE_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#06b6d4", "#ef4444", "#3b82f6", "#84cc16", "#f97316",
  "#a855f7", "#14b8a6", "#e11d48", "#0ea5e9", "#d97706",
];

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
function BundleTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 shadow-lg rounded-xl px-4 py-3 text-sm max-w-xs">
      <p className="text-xs text-slate-500 font-medium mb-2 leading-snug">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-6 text-slate-700">
          <span className="text-slate-400">{p.name}</span>
          <span className="font-semibold">
            {p.name === "Revenue" ? `$${p.value.toFixed(2)}` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Co-purchase Network Graph ─────────────────────────────────────────────────
// Shows top MAX_GRAPH_NODES nodes by sales volume.
// Uses pure Fruchterman-Reingold: displacement capped to temperature each tick,
// NO persistent velocity (avoids overshoot / wall-pinning).
const MAX_GRAPH_NODES = 20;

// Build a flat-top hexagonal grid of N points centred at (cx, cy) with spacing s
function hexGridPositions(N: number, cx: number, cy: number, s: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  // Spiral out ring by ring: ring 0 = centre, ring r has 6r points
  pts.push({ x: cx, y: cy });
  for (let ring = 1; pts.length < N; ring++) {
    // Start at top-right corner of ring
    let hx = ring, hy = 0;
    const dirs = [
      [-1,  1], [-1,  0], [ 0, -1],
      [ 1, -1], [ 1,  0], [ 0,  1],
    ];
    for (const [dq, dr] of dirs) {
      for (let step = 0; step < ring; step++) {
        if (pts.length >= N) break;
        // axial → pixel (flat-top hex)
        pts.push({
          x: cx + s * (hx + hy * 0.5),
          y: cy + s * (hy * Math.sqrt(3) / 2),
        });
        hx += dq; hy += dr;
      }
    }
  }
  return pts.slice(0, N);
}

function CoPurchaseGraph({ nodes: rawNodes, edges: rawEdges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  // Trim to top-N by sales_count
  const nodes = [...rawNodes]
    .sort((a, b) => b.sales_count - a.sales_count)
    .slice(0, MAX_GRAPH_NODES);
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = rawEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

  const W = 860, H = 620;
  const PAD = 60;

  type Pos = { x: number; y: number };
  const posRef  = useRef<Pos[]>([]);
  const tickRef = useRef(0);
  const animRef = useRef<number>(0);
  const [, rerender] = useState(0);

  // Init: nodes placed on a hexagonal grid so they start evenly spaced
  useEffect(() => {
    if (!nodes.length) return;
    cancelAnimationFrame(animRef.current);
    tickRef.current = 0;
    const spacing = Math.min((W - PAD * 2), (H - PAD * 2)) / (Math.ceil(Math.sqrt(nodes.length)) + 1);
    posRef.current = hexGridPositions(nodes.length, W / 2, H / 2, spacing);
    rerender((n) => n + 1);
  }, [nodes.length, edges.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!nodes.length) return;
    const N = nodes.length;

    const usableW = W - PAD * 2, usableH = H - PAD * 2;
    const k = Math.sqrt((usableW * usableH) / N);

    const maxEdgeW = edges.reduce((m, e) => Math.max(m, e.weight), 1);
    const idxById  = new Map(nodes.map((n, i) => [n.id, i]));

    const T0 = usableW * 0.45;
    const MAX_TICKS = 400;

    const step = () => {
      const pos = posRef.current;
      if (pos.length !== N) return;

      const t = tickRef.current++;
      const temp = Math.max(0.5, T0 * (1 - t / MAX_TICKS));

      const dx = new Float64Array(N);
      const dy = new Float64Array(N);

      // ── Repulsion: k²/dist (FR) ───────────────────────────────────────────
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const ddx = pos[i].x - pos[j].x;
          const ddy = pos[i].y - pos[j].y;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 0.1;
          const fr = (k * k) / dist;
          dx[i] += fr * ddx / dist;  dy[i] += fr * ddy / dist;
          dx[j] -= fr * ddx / dist;  dy[j] -= fr * ddy / dist;
        }
      }

      // ── Attraction along edges ────────────────────────────────────────────
      for (const e of edges) {
        const si = idxById.get(e.source), ti = idxById.get(e.target);
        if (si === undefined || ti === undefined) continue;
        const ddx = pos[ti].x - pos[si].x;
        const ddy = pos[ti].y - pos[si].y;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 0.1;
        const wScale = 0.5 + 0.5 * (e.weight / maxEdgeW);
        const fa = (dist / k) * Math.min(dist, temp) * wScale * 0.15;
        dx[si] += fa * ddx / dist;  dy[si] += fa * ddy / dist;
        dx[ti] -= fa * ddx / dist;  dy[ti] -= fa * ddy / dist;
      }

      // ── Hexagonal gravity: pull toward nearest hex-ring anchor ────────────
      // Regular gravity keeps nodes from drifting; hex-bias shapes the outline
      const G = 0.05;
      const hexR = Math.min(usableW, usableH) * 0.42; // target hex radius
      for (let i = 0; i < N; i++) {
        // Soft pull toward centre
        dx[i] += G * (W / 2 - pos[i].x);
        dy[i] += G * (H / 2 - pos[i].y);
        // Hex-boundary repulsion: push nodes inward when they exceed hex outline
        const ox = pos[i].x - W / 2, oy = pos[i].y - H / 2;
        const od = Math.sqrt(ox * ox + oy * oy) || 1;
        if (od > hexR) {
          const over = od - hexR;
          dx[i] -= (ox / od) * over * 0.12;
          dy[i] -= (oy / od) * over * 0.12;
        }
      }

      // ── Cap displacement to temperature, clamp to SVG bounds ─────────────
      for (let i = 0; i < N; i++) {
        const mag = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 1;
        const scale = Math.min(mag, temp) / mag;
        pos[i].x = Math.max(PAD, Math.min(W - PAD, pos[i].x + dx[i] * scale));
        pos[i].y = Math.max(PAD, Math.min(H - PAD, pos[i].y + dy[i] * scale));
      }

      rerender((n) => n + 1);
      if (t < MAX_TICKS) animRef.current = requestAnimationFrame(step);
    };

    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [nodes.length, edges.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!nodes.length) {
    return (
      <div className="flex items-center justify-center h-56 text-slate-300 text-sm">
        No co-purchase data
      </div>
    );
  }

  const pos = posRef.current;
  if (pos.length !== nodes.length) return null;

  const maxW     = edges.reduce((m, e) => Math.max(m, e.weight), 1);
  const maxSales = nodes.reduce((m, n) => Math.max(m, n.sales_count), 1);
  const idxById  = new Map(nodes.map((n, i) => [n.id, i]));

  return (
    <div className="overflow-x-auto">
      {rawNodes.length > MAX_GRAPH_NODES && (
        <p className="text-xs text-slate-400 mb-2">
          Showing top {MAX_GRAPH_NODES} of {rawNodes.length} products by sales volume
        </p>
      )}
      <svg width={W} height={H} className="rounded-xl bg-slate-50/50">
        {/* Edges */}
        {edges.map((e, i) => {
          const si = idxById.get(e.source), ti = idxById.get(e.target);
          if (si === undefined || ti === undefined || !pos[si] || !pos[ti]) return null;
          const alpha = 0.15 + 0.55 * (e.weight / maxW);
          const lw    = 0.8 + 2.5 * (e.weight / maxW);
          const mx = (pos[si].x + pos[ti].x) / 2;
          const my = (pos[si].y + pos[ti].y) / 2;
          return (
            <g key={i}>
              <line
                x1={pos[si].x} y1={pos[si].y}
                x2={pos[ti].x} y2={pos[ti].y}
                stroke={`rgba(99,102,241,${alpha})`}
                strokeWidth={lw}
                strokeLinecap="round"
              />
              {e.weight > 1 && (
                <text x={mx} y={my} textAnchor="middle" dominantBaseline="central"
                  fontSize={8} fill="rgba(99,102,241,0.65)" fontWeight={600}>
                  {e.weight}
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes — smaller radii */}
        {nodes.map((n, i) => {
          if (!pos[i]) return null;
          const r     = 7 + 7 * (n.sales_count / maxSales);   // was 11+12
          const color = NODE_COLORS[i % NODE_COLORS.length];
          const label = n.name.length > 13 ? n.name.slice(0, 12) + "…" : n.name;
          return (
            <g key={n.id}>
              <circle cx={pos[i].x} cy={pos[i].y} r={r + 3}
                fill={color} opacity={0.10} />
              <circle cx={pos[i].x} cy={pos[i].y} r={r}
                fill={color} stroke="#fff" strokeWidth={1.5} />
              <text x={pos[i].x} y={pos[i].y} textAnchor="middle"
                dominantBaseline="central" fontSize={Math.max(7, r * 0.65)}
                fill="#fff" fontWeight={700}>
                {i + 1}
              </text>
              <text x={pos[i].x} y={pos[i].y + r + 9} textAnchor="middle"
                fontSize={8} fill="#64748b">
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-3">
        {nodes.map((n, i) => (
          <span
            key={n.id}
            className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-50 rounded-full px-2 py-0.5 border border-slate-100"
          >
            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
              style={{ background: NODE_COLORS[i % NODE_COLORS.length] }} />
            <span className="font-semibold">{i + 1}</span>
            <span className="truncate max-w-[100px]">{n.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Association Strength (Lift) Matrix ────────────────────────────────────────
function LiftMatrix({ rows }: { rows: LiftRow[] }) {
  // Collect unique product names (limit to top 8 for readability)
  const topRows = rows.slice(0, 28);
  const productSet = new Set<string>();
  topRows.forEach((r) => { productSet.add(r.product_a); productSet.add(r.product_b); });
  const products = Array.from(productSet).slice(0, 8);

  // Build lookup: "A||B" → confidence_ab (% of buying B given A)
  const lookup: Record<string, number> = {};
  topRows.forEach((r) => {
    lookup[`${r.product_a}||${r.product_b}`] = r.confidence_ab;
    lookup[`${r.product_b}||${r.product_a}`] = r.confidence_ba;
  });

  const maxConf = Math.max(...Object.values(lookup), 1);

  function cellColor(val: number | null): string {
    if (val === null) return "bg-slate-50 text-slate-300";
    const intensity = val / maxConf;
    if (intensity > 0.75) return "bg-indigo-600 text-white";
    if (intensity > 0.5)  return "bg-indigo-400 text-white";
    if (intensity > 0.25) return "bg-indigo-200 text-indigo-800";
    if (intensity > 0)    return "bg-indigo-50 text-indigo-600";
    return "bg-slate-50 text-slate-300";
  }

  if (!products.length) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-300 text-sm">
        No association data
      </div>
    );
  }

  // Short labels (A, B, C… or truncated names)
  const labels = products.map((p, i) => ({
    full: p,
    short: p.length > 10 ? p.slice(0, 9) + "…" : p,
    letter: String.fromCharCode(65 + i),
  }));

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr>
            <th className="w-28 text-left pr-2 pb-2 text-slate-400 font-medium align-bottom">
              Association<br />strength (%)
            </th>
            {labels.map((l) => (
              <th key={l.full} className="text-center pb-2 px-1 text-slate-500 font-semibold min-w-[52px]">
                {l.letter}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((row) => (
            <tr key={row.full}>
              <td className="pr-3 py-1 text-slate-600 font-semibold whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-slate-400">{row.letter}</span>
                  <span className="truncate max-w-[80px]">{row.short}</span>
                </span>
              </td>
              {labels.map((col) => {
                const isSelf = row.full === col.full;
                const val = isSelf ? null : (lookup[`${row.full}||${col.full}`] ?? 0);
                return (
                  <td
                    key={col.full}
                    className={clsx(
                      "text-center py-1.5 px-1 rounded font-medium transition-colors",
                      isSelf ? "bg-slate-100 text-slate-300" : cellColor(val)
                    )}
                  >
                    {isSelf ? "—" : val !== null && val > 0 ? `${val}%` : "%"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {/* Legend key */}
      <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-400">
        <span>Low</span>
        {["bg-indigo-50","bg-indigo-200","bg-indigo-400","bg-indigo-600"].map((c) => (
          <span key={c} className={clsx("w-5 h-3 rounded inline-block", c)} />
        ))}
        <span>High</span>
        <span className="ml-3 text-slate-300 italic">% = probability of buying column product given row product</span>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function BundlePage() {
  const [channel, setChannel] = useState<ChannelId>("all");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pairs, setPairs] = useState<BundlePair[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("count");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");
  const [chartMode, setChartMode] = useState<"count" | "revenue">("count");

  // Network graph + lift
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [liftRows, setLiftRows] = useState<LiftRow[]>([]);

  const mkt = channel === "all" ? undefined : channel;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      salesApi.bundleAnalytics(mkt),
      salesApi.associationLift(mkt),
    ])
      .then(([bundleRes, liftRes]) => {
        setSummary(bundleRes.data.summary);
        setPairs(bundleRes.data.pairs);
        setChartData(bundleRes.data.chart_data);
        setGraphNodes(liftRes.data.nodes);
        setGraphEdges(liftRes.data.edges);
        setLiftRows(liftRes.data.lift_matrix);
      })
      .finally(() => setLoading(false));
  }, [channel]);

  // ── Sort / filter ─────────────────────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(key === "product_a" || key === "product_b"); }
  };

  const filtered = pairs
    .filter((p) =>
      p.product_a.toLowerCase().includes(search.toLowerCase()) ||
      p.product_b.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string")
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col
      ? <span className="ml-1 text-brand-500">{sortAsc ? "↑" : "↓"}</span>
      : <span className="ml-1 text-slate-300">↕</span>;

  return (
    <div>
      <PageHeader
        title="Bundle Analytics"
        description="Discover which products are most frequently purchased together"
      />

      {/* Channel Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CHANNELS.map((ch) => (
          <button
            key={ch.id}
            onClick={() => setChannel(ch.id)}
            className={clsx(
              "px-3 py-2 rounded-xl border text-sm font-medium transition-all flex items-center gap-2",
              channel === ch.id
                ? ch.color + " border-current shadow-sm"
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
            )}
          >
            <span className="text-base">{ch.logo}</span>
            <span>{ch.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              title="Total Bundle Sales"
              value={summary?.total_bundle_sales ?? 0}
              icon={Package}
              iconColor="bg-brand-500"
            />
            <KpiCard
              title="Bundle Revenue"
              value={`$${(summary?.total_bundle_revenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={DollarSign}
              iconColor="bg-emerald-500"
            />
            <KpiCard
              title="Unique Pairs"
              value={summary?.unique_pairs ?? 0}
              icon={Layers}
              iconColor="bg-violet-500"
            />
            <KpiCard
              title="Avg Bundle Qty"
              value={summary?.avg_bundle_qty ?? 0}
              subtitle="units per bundle order"
              icon={TrendingUp}
              iconColor="bg-amber-500"
            />
          </div>

          {/* Chart + Top Pairs — side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

            {/* Bar Chart — 2/3 width */}
            <div className="card lg:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-semibold text-slate-700">Top Bundle Pairs</h2>
                <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-medium">
                  <button
                    onClick={() => setChartMode("count")}
                    className={clsx(
                      "px-3 py-1 rounded-md transition-all",
                      chartMode === "count" ? "bg-white text-brand-600 shadow-sm" : "text-slate-500"
                    )}
                  >
                    By Count
                  </button>
                  <button
                    onClick={() => setChartMode("revenue")}
                    className={clsx(
                      "px-3 py-1 rounded-md transition-all",
                      chartMode === "revenue" ? "bg-white text-brand-600 shadow-sm" : "text-slate-500"
                    )}
                  >
                    By Revenue
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400 mb-5">Top 10 most frequently bundled product pairs</p>

              {chartData.length === 0 ? (
                <div className="flex items-center justify-center h-56 text-slate-300 text-sm">No bundle data</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={chartMode === "revenue" ? (v) => `$${v}` : undefined}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      width={160}
                    />
                    <Tooltip content={<BundleTooltip />} />
                    <Bar dataKey={chartMode} name={chartMode === "count" ? "Times Bundled" : "Revenue"} radius={[0, 4, 4, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top Pairs ranked list — 1/3 width */}
            <div className="card flex flex-col">
              <h2 className="text-base font-semibold text-slate-700 mb-1">Most Common Bundles</h2>
              <p className="text-xs text-slate-400 mb-4">Ranked by times purchased together</p>

              {pairs.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-300 text-sm">No data</div>
              ) : (
                <div className="flex flex-col gap-2.5 overflow-y-auto">
                  {pairs.slice(0, 8).map((p, i) => {
                    const maxCount = pairs[0]?.count || 1;
                    const pct = Math.round((p.count / maxCount) * 100);
                    return (
                      <div key={i} className="rounded-xl border border-slate-100 p-3 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-brand-50 text-brand-600 text-xs font-bold flex items-center justify-center shrink-0">
                              {i + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-700 truncate">{p.product_a}</p>
                              <p className="text-xs text-slate-400">+ {p.product_b}</p>
                            </div>
                          </div>
                          <span className="text-xs font-bold bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full shrink-0">
                            {p.count}×
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-400 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-slate-400 mt-1">
                          <span>${p.revenue.toFixed(2)} revenue</span>
                          <span>{p.avg_order_qty} avg qty</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Co-purchase Frequency Network Graph ── */}
          <div className="card mb-6">
            <h2 className="text-base font-semibold text-slate-700 mb-1">Co-purchase Frequency</h2>
            <p className="text-xs text-slate-400 mb-5">
              Network graph — links show products bought together. Node size = sales volume. Edge thickness = co-purchase frequency.
            </p>
            <CoPurchaseGraph nodes={graphNodes} edges={graphEdges} />
          </div>

          {/* ── Association Strength (Lift) Matrix ── */}
          <div className="card mb-6">
            <h2 className="text-base font-semibold text-slate-700 mb-1">Association Strength (Lift)</h2>
            <p className="text-xs text-slate-400 mb-5">
              → probability of buying column product given row product was purchased
            </p>
            <LiftMatrix rows={liftRows} />

            {/* Top lift pairs table */}
            {liftRows.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-slate-600 mb-3">Top Association Rules by Lift Score</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 uppercase tracking-wide border-b border-slate-100">
                        <th className="py-2 pr-3 text-left font-medium">Product A</th>
                        <th className="py-2 pr-3 text-left font-medium">Product B</th>
                        <th className="py-2 pr-3 text-right font-medium">Lift</th>
                        <th className="py-2 pr-3 text-right font-medium">A→B conf.</th>
                        <th className="py-2 pr-3 text-right font-medium">B→A conf.</th>
                        <th className="py-2 text-right font-medium">Support</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {liftRows.slice(0, 10).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 pr-3 font-medium text-slate-700 max-w-[150px] truncate">{r.product_a}</td>
                          <td className="py-2.5 pr-3 text-slate-500 max-w-[150px] truncate">{r.product_b}</td>
                          <td className="py-2.5 pr-3 text-right">
                            <span className={clsx(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold tabular-nums",
                              r.lift >= 2 ? "bg-emerald-50 text-emerald-700" :
                              r.lift >= 1 ? "bg-blue-50 text-blue-700" :
                              "bg-red-50 text-red-600"
                            )}>
                              {r.lift.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-right text-slate-600 tabular-nums">{r.confidence_ab}%</td>
                          <td className="py-2.5 pr-3 text-right text-slate-600 tabular-nums">{r.confidence_ba}%</td>
                          <td className="py-2.5 text-right text-slate-400 tabular-nums">{r.support}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Full Table */}
          <div className="card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-base font-semibold text-slate-700">All Bundle Pairs</h2>
              <input
                type="text"
                placeholder="Search product..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input text-sm py-1.5 w-full sm:w-56"
              />
            </div>

            <div className="overflow-x-auto">
              {filtered.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-10">No records found</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                      {(
                        [
                          { key: "product_a",     label: "Product A",        align: "text-left" },
                          { key: "product_b",     label: "Product B",        align: "text-left" },
                          { key: "count",         label: "Times Bundled",    align: "text-right" },
                          { key: "revenue",       label: "Est. Revenue",     align: "text-right" },
                          { key: "avg_order_qty", label: "Avg Qty",          align: "text-right" },
                        ] as { key: SortKey; label: string; align: string }[]
                      ).map(({ key, label, align }) => (
                        <th
                          key={key}
                          onClick={() => handleSort(key)}
                          className={clsx(
                            "py-2.5 pr-4 font-medium cursor-pointer select-none hover:text-slate-600 transition-colors",
                            align
                          )}
                        >
                          {label}
                          <SortIcon col={key} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 pr-4 font-medium text-slate-700 max-w-[180px] truncate">
                          {p.product_a}
                        </td>
                        <td className="py-3 pr-4 text-slate-500 max-w-[180px] truncate">
                          {p.product_b}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <span className="inline-flex items-center gap-1 text-xs font-bold bg-brand-50 text-brand-600 px-2.5 py-0.5 rounded-full tabular-nums">
                            {p.count}×
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right font-medium text-slate-700 tabular-nums">
                          ${p.revenue.toFixed(2)}
                        </td>
                        <td className="py-3 text-right text-slate-500 tabular-nums">
                          {p.avg_order_qty}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {filtered.length > 0 && (
              <p className="text-xs text-slate-400 mt-3 text-right">
                {filtered.length} pair{filtered.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
