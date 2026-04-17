"use client";
/**
 * Main Dashboard – KPI cards + overview charts for all three segments.
 * KPI cards are clickable and reveal a drill-down detail panel.
 */
import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  DollarSign, ShoppingBag, RotateCcw, MousePointerClick,
  Eye, ShoppingCart, ThumbsUp, ThumbsDown, X, Star, TrendingUp, TrendingDown,
} from "lucide-react";
import KpiCard from "@/components/KpiCard";
import PageHeader from "@/components/PageHeader";
import { dashboardApi, engagementApi, commentsApi } from "@/lib/api";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { MapPin } from "lucide-react";

const COLORS = ["#4f6ef7", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

type KpiType = "revenue" | "orders" | "returns" | "ctr" | "visits" | "cart" | "positive" | "negative" | null;

const KPI_META: Record<string, { label: string; color: string; unit?: string }> = {
  revenue:  { label: "Revenue",          color: "#4f6ef7", unit: "$" },
  orders:   { label: "Orders",           color: "#10b981" },
  returns:  { label: "Returns",          color: "#f59e0b" },
  ctr:      { label: "Avg CTR",          color: "#8b5cf6", unit: "%" },
  visits:   { label: "Page Visits",      color: "#06b6d4" },
  cart:     { label: "Cart Adds",        color: "#6366f1" },
  positive: { label: "Positive Reviews", color: "#10b981" },
  negative: { label: "Negative Reviews", color: "#ef4444" },
};

function formatValue(kpi: string, val: number): string {
  if (kpi === "revenue") return `$${val.toLocaleString()}`;
  if (kpi === "ctr") return `${val}%`;
  return val.toLocaleString();
}

type CountryRow = { iso: string; name: string; orders: number; revenue: number };

type ChartOverview = {
  revenue_trend: { day: string; revenue: number; aov: number }[];
  revenue_growth: {
    wow_current: number; wow_previous: number; wow_pct: number | null;
    mom_current: number; mom_previous: number; mom_pct: number | null;
  };
  revenue_by_marketplace: { name: string; revenue: number; orders: number }[];
  top_products: { name: string; revenue: number }[];
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [sentiment, setSentiment] = useState([]);
  const [engagementTrend, setEngagementTrend] = useState([]);
  const [charts, setCharts] = useState<ChartOverview | null>(null);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Drill-down state
  const [activeKpi, setActiveKpi] = useState<KpiType>(null);
  const [drillData, setDrillData] = useState<Record<string, unknown> | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      dashboardApi.summary(),
      commentsApi.sentimentSummary(),
      engagementApi.trends(14),
      dashboardApi.chartsOverview(),
      dashboardApi.salesByCountry(),
    ]).then(([s, sent, et, co, sc]) => {
      setSummary(s.data);
      setSentiment(sent.data);
      setEngagementTrend(et.data.slice(-14));
      setCharts(co.data);
      setCountries(sc.data);
      setLoading(false);
    });
  }, []);

  const handleKpiClick = useCallback(
    (kpi: KpiType) => {
      if (activeKpi === kpi) {
        setActiveKpi(null);
        setDrillData(null);
        return;
      }
      setActiveKpi(kpi);
      setDrillData(null);
      setDrillLoading(true);
      dashboardApi
        .kpiDetail(kpi!)
        .then((res) => setDrillData(res.data))
        .finally(() => setDrillLoading(false));
    },
    [activeKpi]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
      </div>
    );
  }

  const meta = activeKpi ? KPI_META[activeKpi] : null;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your store performance across all marketplaces"
      />

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KpiCard
          title="Total Revenue"
          value={`$${summary.total_revenue?.toLocaleString()}`}
          icon={DollarSign}
          iconColor="bg-brand-500"
          trend={summary.revenue_trend != null ? { value: summary.revenue_trend, label: "vs last 30 days" } : undefined}
          onClick={() => handleKpiClick("revenue")}
          active={activeKpi === "revenue"}
        />
        <KpiCard
          title="Total Orders"
          value={summary.total_orders}
          icon={ShoppingBag}
          iconColor="bg-emerald-500"
          trend={summary.orders_trend != null ? { value: summary.orders_trend, label: "vs last 30 days" } : undefined}
          onClick={() => handleKpiClick("orders")}
          active={activeKpi === "orders"}
        />
        <KpiCard
          title="Returns"
          value={summary.total_returns}
          icon={RotateCcw}
          iconColor="bg-amber-500"
          onClick={() => handleKpiClick("returns")}
          active={activeKpi === "returns"}
        />
        <KpiCard
          title="Avg CTR"
          value={`${summary.avg_ctr}%`}
          icon={MousePointerClick}
          iconColor="bg-purple-500"
          trend={summary.ctr_trend != null ? { value: summary.ctr_trend, label: "vs last 30 days" } : undefined}
          onClick={() => handleKpiClick("ctr")}
          active={activeKpi === "ctr"}
        />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Page Visits"
          value={summary.total_page_visits?.toLocaleString()}
          icon={Eye}
          iconColor="bg-cyan-500"
          onClick={() => handleKpiClick("visits")}
          active={activeKpi === "visits"}
        />
        <KpiCard
          title="Cart Adds"
          value={summary.total_cart_adds?.toLocaleString()}
          icon={ShoppingCart}
          iconColor="bg-indigo-500"
          onClick={() => handleKpiClick("cart")}
          active={activeKpi === "cart"}
        />
        <KpiCard
          title="Positive Reviews"
          value={summary.positive_comments}
          icon={ThumbsUp}
          iconColor="bg-emerald-500"
          onClick={() => handleKpiClick("positive")}
          active={activeKpi === "positive"}
        />
        <KpiCard
          title="Negative Reviews"
          value={summary.negative_comments}
          icon={ThumbsDown}
          iconColor="bg-red-500"
          onClick={() => handleKpiClick("negative")}
          active={activeKpi === "negative"}
        />
      </div>

      {/* ── Drill-down Panel ── */}
      {activeKpi && (
        <div className="card mb-6 border border-slate-200 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-700">
              {meta?.label} — Breakdown
            </h2>
            <button
              onClick={() => { setActiveKpi(null); setDrillData(null); }}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {drillLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
            </div>
          ) : drillData ? (
            <DrillDownContent kpi={activeKpi} data={drillData} meta={meta!} />
          ) : null}
        </div>
      )}

      {/* ── New Chart Sections ── */}
      {charts && (
        <>
          {/* Total Revenue Line Chart */}
          <div className="card mt-6">
            <h2 className="text-base font-semibold text-slate-700 mb-1">Total Revenue</h2>
            <p className="text-xs text-slate-400 mb-4">Line Chart – Last 60 Days</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={charts.revenue_trend}>
                <defs>
                  <linearGradient id="revLine" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f6ef7" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#4f6ef7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]} />
                <Line type="monotone" dataKey="revenue" stroke="#4f6ef7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue Growth WoW / MoM */}
          <div className="card mt-6">
            <h2 className="text-base font-semibold text-slate-700 mb-1">Revenue Growth (WoW / MoM)</h2>
            <p className="text-xs text-slate-400 mb-4">Week-over-Week and Month-over-Month comparison</p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Stat cards */}
              <div className="flex flex-col gap-4">
                {[
                  { label: "This Week", current: charts.revenue_growth.wow_current, previous: charts.revenue_growth.wow_previous, pct: charts.revenue_growth.wow_pct, period: "vs last week" },
                  { label: "This Month", current: charts.revenue_growth.mom_current, previous: charts.revenue_growth.mom_previous, pct: charts.revenue_growth.mom_pct, period: "vs last month" },
                ].map((g, i) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-xs text-slate-500 font-medium mb-1">{g.label}</p>
                    <p className="text-2xl font-bold text-slate-800">${g.current.toLocaleString()}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {g.pct !== null && g.pct >= 0
                        ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                        : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                      <span className={`text-xs font-semibold ${g.pct !== null && g.pct >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                        {g.pct !== null ? `${g.pct > 0 ? "+" : ""}${g.pct}%` : "N/A"}
                      </span>
                      <span className="text-xs text-slate-400">{g.period}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Previous: ${g.previous.toLocaleString()}</p>
                  </div>
                ))}
              </div>
              {/* Line chart — last 30 days revenue trend */}
              <div className="lg:col-span-2">
                <p className="text-xs text-slate-400 mb-2">Daily Revenue – Last 30 Days</p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={charts.revenue_trend.slice(-30)} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      tickFormatter={(v) => v.slice(5)}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      tickFormatter={(v) => `$${v}`}
                      tickLine={false}
                      axisLine={false}
                      width={55}
                    />
                    <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]} />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* AOV Line Chart */}
          <div className="card mt-6">
            <h2 className="text-base font-semibold text-slate-700 mb-1">Average Order Value (AOV)</h2>
            <p className="text-xs text-slate-400 mb-4">Daily AOV – Last 60 Days</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={charts.revenue_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: number) => [`$${v}`, "AOV"]} />
                <Line type="monotone" dataKey="aov" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue by Marketplace (Doughnut + Bar) */}
          <div className="card mt-6">
            <h2 className="text-base font-semibold text-slate-700 mb-1">Revenue by Marketplace</h2>
            <p className="text-xs text-slate-400 mb-4">Shopee, Temu, Taobao, JD, Facebook Marketplace</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={charts.revenue_by_marketplace}
                    dataKey="revenue"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {charts.revenue_by_marketplace.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]} />
                </PieChart>
              </ResponsiveContainer>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={charts.revenue_by_marketplace} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]} />
                  {charts.revenue_by_marketplace.map((_, i) => null)}
                  <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]}>
                    {charts.revenue_by_marketplace.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Products by Revenue */}
          <div className="card mt-6 mb-6">
            <h2 className="text-base font-semibold text-slate-700 mb-1">Top Products by Revenue</h2>
            <p className="text-xs text-slate-400 mb-4">Horizontal Bar Chart</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={charts.top_products} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={160} />
                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]} />
                <Bar dataKey="revenue" fill="#4f6ef7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* ── Sales by Countries ── */}
      {countries.length > 0 && (
        <div className="card mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-700 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand-500" />
                Sales by Countries
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Orders and revenue by market region</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Map */}
            <div className="lg:col-span-2 rounded-xl overflow-hidden bg-slate-50 border border-slate-100" style={{ height: 280 }}>
              <ComposableMap projectionConfig={{ scale: 147 }} style={{ width: "100%", height: "100%" }}>
                <ZoomableGroup>
                  <Geographies geography="https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json">
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const iso3 = geo.properties?.["Alpha-3"] || geo.id;
                        const match = countries.find((c) => c.iso === iso3);
                        const maxRev = countries[0]?.revenue || 1;
                        const intensity = match ? 0.2 + (match.revenue / maxRev) * 0.8 : 0;
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={match ? `rgba(79,110,247,${intensity})` : "#e2e8f0"}
                            stroke="#fff"
                            strokeWidth={0.5}
                            style={{ default: { outline: "none" }, hover: { fill: "#4f6ef7", outline: "none" }, pressed: { outline: "none" } }}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ZoomableGroup>
              </ComposableMap>
            </div>
            {/* Country list */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Top Markets</p>
              {countries.slice(0, 6).map((c, i) => {
                const maxOrders = countries[0]?.orders || 1;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-300 w-4">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-medium text-slate-700">{c.name}</span>
                        <span className="text-xs font-semibold text-slate-500">{c.orders.toLocaleString()} orders</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${Math.round((c.orders / maxOrders) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sentiment Pie */}
        <div className="card lg:col-span-1">
          <h2 className="text-base font-semibold text-slate-700 mb-4">Sentiment Breakdown</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={sentiment}
                dataKey="count"
                nameKey="sentiment"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {sentiment.map((entry: { sentiment: string }, i) => (
                  <Cell
                    key={i}
                    fill={
                      entry.sentiment === "positive"
                        ? "#10b981"
                        : entry.sentiment === "negative"
                        ? "#ef4444"
                        : "#f59e0b"
                    }
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Engagement Trend */}
        <div className="card lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-700 mb-4">Engagement – Last 14 Days</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={engagementTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="visits" name="Page Visits" fill="#4f6ef7" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cart_adds" name="Cart Adds" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── Drill-Down Content Component ────────────────────────────────────────────

type DrillData = Record<string, unknown>;
type MetaInfo = { label: string; color: string; unit?: string };

function DrillDownContent({ kpi, data, meta }: { kpi: KpiType; data: DrillData; meta: MetaInfo }) {
  const byMarketplace = (data.by_marketplace as { name: string; value: number }[]) || [];
  const topProducts = (data.top_products as { name: string; value: number }[]) || [];
  const byCategory = (data.by_category as { name: string; value: number }[]) || [];
  const sampleComments = (data.sample_comments as { text: string; rating: number; product: string }[]) || [];

  const formatVal = (v: number) => {
    if (kpi === "revenue") return `$${v.toLocaleString()}`;
    if (kpi === "ctr") return `${v}%`;
    return v.toLocaleString();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* By Marketplace Bar Chart */}
      <div>
        <h3 className="text-sm font-medium text-slate-500 mb-3">By Marketplace</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={byMarketplace} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatVal(v)} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
            <Tooltip formatter={(v: number) => [formatVal(v), meta.label]} />
            <Bar dataKey="value" fill={meta.color} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Right panel: top products table or returns details or sample comments */}
      <div>
        {/* Returns special: show rate + marketplace table */}
        {kpi === "returns" && (
          <>
            <div className="flex items-center gap-4 mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <div>
                <p className="text-xs text-amber-600 font-medium uppercase">Return Rate</p>
                <p className="text-2xl font-bold text-amber-700">{String(data.return_rate)}%</p>
              </div>
              <div className="text-xs text-amber-600">
                {String(data.total_returns)} returned out of {String(data.total_orders)} orders
              </div>
            </div>
            <h3 className="text-sm font-medium text-slate-500 mb-2">Most Returned Products</h3>
            <div className="space-y-2">
              {(data.top_returned_products as { name: string; value: number }[])?.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 truncate max-w-[65%]">{p.name}</span>
                  <span className="font-semibold text-amber-600">{p.value} returns</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Sample comments for sentiment KPIs */}
        {(kpi === "positive" || kpi === "negative") && sampleComments.length > 0 && (
          <>
            <h3 className="text-sm font-medium text-slate-500 mb-3">Sample Reviews</h3>
            <div className="space-y-3">
              {sampleComments.map((c, i) => (
                <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-500 truncate">{c.product}</span>
                    <span className="flex items-center gap-0.5 text-xs text-amber-500">
                      {Array.from({ length: c.rating }).map((_, j) => (
                        <Star key={j} className="w-3 h-3 fill-amber-400 text-amber-400" />
                      ))}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2">{c.text}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Top products for non-returns/non-sentiment KPIs, and for sentiment too */}
        {kpi !== "returns" && topProducts.length > 0 && sampleComments.length === 0 && (
          <>
            <h3 className="text-sm font-medium text-slate-500 mb-3">
              Top Products by {meta.label}
            </h3>
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-300 w-4">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-700 truncate max-w-[65%]">{p.name}</span>
                      <span className="text-sm font-semibold text-slate-800">{formatVal(p.value)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round((p.value / topProducts[0].value) * 100)}%`,
                          backgroundColor: meta.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Top products for positive/negative (shown under comments) */}
        {(kpi === "positive" || kpi === "negative") && topProducts.length > 0 && (
          <>
            <h3 className="text-sm font-medium text-slate-500 mt-4 mb-2">Top Products</h3>
            <div className="space-y-1">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 truncate max-w-[70%]">{p.name}</span>
                  <span className="font-medium" style={{ color: meta.color }}>{p.value} reviews</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* By category for orders */}
        {kpi === "orders" && byCategory.length > 0 && (
          <>
            <h3 className="text-sm font-medium text-slate-500 mb-3">By Category</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={byCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" name="Orders" fill={meta.color} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </div>
  );
}
