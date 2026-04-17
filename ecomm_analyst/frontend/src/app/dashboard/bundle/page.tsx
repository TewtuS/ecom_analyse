"use client";

import { useEffect, useState } from "react";
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

// ── Chart colours ─────────────────────────────────────────────────────────────
const BAR_COLORS = [
  "#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd",
  "#818cf8", "#7c3aed", "#4f46e5", "#4338ca", "#3730a3", "#312e81",
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

  const mkt = channel === "all" ? undefined : channel;

  useEffect(() => {
    setLoading(true);
    salesApi.bundleAnalytics(mkt)
      .then((res) => {
        setSummary(res.data.summary);
        setPairs(res.data.pairs);
        setChartData(res.data.chart_data);
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
                {/* Toggle count / revenue */}
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
                        {/* progress bar */}
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
