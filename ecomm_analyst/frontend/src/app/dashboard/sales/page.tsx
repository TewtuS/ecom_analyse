"use client";
/**
 * Sales Analytics page – trends, top products, returns, bundles, competitor pricing.
 */
import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { DollarSign, RotateCcw, Package, Tag, TrendingUp } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import KpiCard from "@/components/KpiCard";
import { salesApi } from "@/lib/api";
import { clsx } from "clsx";

const CHANNELS = [
  { id: "all",                  label: "All Channels",        color: "bg-slate-100 text-slate-700 border-slate-200",   logo: "🌐" },
  { id: "Taobao",               label: "淘宝 Taobao",          color: "bg-orange-50 text-orange-600 border-orange-200", logo: "🛍️" },
  { id: "JD",                   label: "京东 JD",              color: "bg-red-50 text-red-600 border-red-200",          logo: "🏪" },
  { id: "Shopee",               label: "Shopee",               color: "bg-orange-50 text-orange-500 border-orange-300", logo: "🟠" },
  { id: "Temu",                 label: "Temu",                 color: "bg-blue-50 text-blue-600 border-blue-200",       logo: "💰" },
  { id: "Facebook Marketplace", label: "Facebook Marketplace", color: "bg-indigo-50 text-indigo-600 border-indigo-200", logo: "📘" },
] as const;

type ChannelId = typeof CHANNELS[number]["id"];

export default function SalesPage() {
  const [selectedChannel, setSelectedChannel] = useState<ChannelId>("all");
  const [trends, setTrends] = useState([]);
  const [topProducts, setTopProducts] = useState<{ name: string; total_revenue: number; total_units: number }[]>([]);
  const [returned, setReturned] = useState<{ name: string; return_count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = (marketplace: string) => {
    setLoading(true);
    Promise.all([
      salesApi.trends(30, marketplace === "all" ? undefined : marketplace),
      salesApi.topProducts(6, marketplace === "all" ? undefined : marketplace),
      salesApi.mostReturned(5, marketplace === "all" ? undefined : marketplace),
    ]).then(([t, tp, r]) => {
      setTrends(t.data);
      setTopProducts(tp.data);
      setReturned(r.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData(selectedChannel);
  }, [selectedChannel]);

  const totalRevenue = trends.reduce((s: number, d: { revenue: number }) => s + d.revenue, 0);
  const totalOrders = trends.reduce((s: number, d: { orders: number }) => s + d.orders, 0);

  return (
    <div>
      <PageHeader title="Sales Analytics" description="30-day sales performance across all marketplaces" />

      {/* Channel Filter Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        {CHANNELS.map((ch) => (
          <button
            key={ch.id}
            onClick={() => setSelectedChannel(ch.id)}
            className={clsx(
              "px-4 py-2.5 rounded-xl border text-sm font-medium transition-all flex items-center gap-2",
              selectedChannel === ch.id
                ? ch.color + " border-current shadow-sm"
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
            )}
          >
            {ch.logo && <span className="text-lg">{ch.logo}</span>}
            <span>{ch.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard title="30-Day Revenue" value={`$${totalRevenue.toFixed(2)}`} icon={DollarSign} iconColor="bg-brand-500" />
            <KpiCard title="Total Orders" value={totalOrders} icon={Package} iconColor="bg-emerald-500" />
            <KpiCard title="Top Product" value={topProducts[0]?.name ?? "—"} icon={Tag} iconColor="bg-amber-500" />
            <KpiCard title="Most Returned" value={returned[0]?.name ?? "—"} icon={RotateCcw} iconColor="bg-red-500" />
          </div>

          {/* Revenue Trend */}
          <div className="card mb-6">
            <h2 className="text-base font-semibold text-slate-700 mb-4">
              Revenue Trend – Last 30 Days{selectedChannel !== "all" && ` (${selectedChannel})`}
            </h2>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f6ef7" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4f6ef7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`$${v}`, "Revenue"]} />
                <Legend />
                <Area type="monotone" dataKey="revenue" name="Revenue ($)" stroke="#4f6ef7" fill="url(#revGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="orders" name="Orders" stroke="#10b981" fill="none" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Top Products */}
            <div className="card">
              <h2 className="text-base font-semibold text-slate-700 mb-4">Top Products by Revenue</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={130} />
                  <Tooltip formatter={(v: number) => [`$${v}`, "Revenue"]} />
                  <Bar dataKey="total_revenue" name="Revenue" fill="#4f6ef7" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Most Returned */}
            <div className="card">
              <h2 className="text-base font-semibold text-slate-700 mb-4">Most Returned Products</h2>
              <div className="space-y-3">
                {returned.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">No returns data</p>
                ) : (
                  returned.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium text-slate-700">{item.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-red-500">{item.return_count} returns</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>


        </>
      )}
    </div>
  );
}
