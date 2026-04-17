"use client";
/**
 * Customer Engagement analytics page.
 */
import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Eye, ShoppingCart, MousePointerClick, Image } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import KpiCard from "@/components/KpiCard";
import { engagementApi } from "@/lib/api";

export default function EngagementPage() {
  const [trends, setTrends] = useState<{ day: string; visits: number; cart_adds: number; avg_ctr: number }[]>([]);
  const [topViewed, setTopViewed] = useState<{ name: string; visits: number; cart_adds: number; avg_ctr: number }[]>([]);
  const [imageViews, setImageViews] = useState<{ name: string; total_image_views: number; image_url: string }[]>([]);

  useEffect(() => {
    Promise.all([
      engagementApi.trends(30),
      engagementApi.topViewed(8),
      engagementApi.imageViews(6),
    ]).then(([t, tv, iv]) => {
      setTrends(t.data);
      setTopViewed(tv.data);
      setImageViews(iv.data);
    });
  }, []);

  const totalVisits = trends.reduce((s, d) => s + (d.visits || 0), 0);
  const totalCart = trends.reduce((s, d) => s + (d.cart_adds || 0), 0);
  const avgCtr = trends.length ? (trends.reduce((s, d) => s + (d.avg_ctr || 0), 0) / trends.length).toFixed(2) : "0";

  return (
    <div>
      <PageHeader title="Customer Engagement" description="How customers interact with your products" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Total Page Visits" value={totalVisits.toLocaleString()} icon={Eye} iconColor="bg-cyan-500" trend={{ value: 9.2, label: "vs last month" }} />
        <KpiCard title="Cart Adds" value={totalCart.toLocaleString()} icon={ShoppingCart} iconColor="bg-brand-500" trend={{ value: 5.7, label: "vs last month" }} />
        <KpiCard title="Avg CTR" value={`${avgCtr}%`} icon={MousePointerClick} iconColor="bg-purple-500" />
        <KpiCard title="Most Viewed Image" value={imageViews[0]?.name ?? "—"} icon={Image} iconColor="bg-amber-500" />
      </div>

      {/* Engagement Trend */}
      <div className="card mb-6">
        <h2 className="text-base font-semibold text-slate-700 mb-4">Engagement Trend – Last 30 Days</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={trends}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="visits" name="Page Visits" stroke="#4f6ef7" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="cart_adds" name="Cart Adds" stroke="#10b981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Viewed Products */}
        <div className="card">
          <h2 className="text-base font-semibold text-slate-700 mb-4">Top Products by Page Visits</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topViewed} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={130} />
              <Tooltip />
              <Bar dataKey="visits" name="Page Visits" fill="#4f6ef7" radius={[0, 4, 4, 0]} />
              <Bar dataKey="cart_adds" name="Cart Adds" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* CTR by Product */}
        <div className="card">
          <h2 className="text-base font-semibold text-slate-700 mb-4">Click-Through Rate by Product</h2>
          <div className="space-y-3">
            {topViewed.slice(0, 7).map((p, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700 truncate max-w-[180px]">{p.name}</span>
                  <span className="text-brand-500 font-semibold">{p.avg_ctr}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-brand-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(p.avg_ctr * 5, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Most Viewed Images */}
      <div className="card">
        <h2 className="text-base font-semibold text-slate-700 mb-4">Most Viewed Product Images</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {imageViews.map((item, i) => (
            <div key={i} className="text-center">
              <img
                src={item.image_url ? `http://localhost:8000${item.image_url}` : `https://picsum.photos/seed/${i + 10}/200/200`}
                alt={item.name}
                className="w-full aspect-square object-cover rounded-xl mb-2 border border-slate-100"
              />
              <p className="text-xs font-medium text-slate-700 truncate">{item.name}</p>
              <p className="text-xs text-slate-400">{item.total_image_views?.toLocaleString()} views</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
