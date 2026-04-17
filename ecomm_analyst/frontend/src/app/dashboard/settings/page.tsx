"use client";
/**
 * Settings / Integrations page.
 * Shows connected marketplaces and future extension integration points.
 */
import { useState } from "react";
import { Check, Link2, Plug, RefreshCw } from "lucide-react";
import PageHeader from "@/components/PageHeader";

const MARKETPLACES = [
  { name: "Shopee", logo: "🛍️", status: "connected", color: "text-orange-500 bg-orange-50" },
  { name: "Taobao", logo: "🏪", status: "connected", color: "text-red-500 bg-red-50" },
  { name: "Temu", logo: "🎯", status: "demo", color: "text-blue-500 bg-blue-50" },
  { name: "Facebook Marketplace", logo: "📘", status: "coming_soon", color: "text-indigo-500 bg-indigo-50" },
  { name: "JD.com", logo: "📦", status: "coming_soon", color: "text-red-600 bg-red-50" },
  { name: "Lazada", logo: "🏬", status: "coming_soon", color: "text-purple-500 bg-purple-50" },
];

export default function SettingsPage() {
  const [openaiKey, setOpenaiKey] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSaveKey = () => {
    // In a real app, this would be sent securely to the backend
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <PageHeader title="Settings & Integrations" description="Manage marketplace connections and API configurations" />

      {/* Marketplace Connections */}
      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Plug className="w-5 h-5 text-brand-500" />
          <h2 className="text-base font-semibold text-slate-700">Marketplace Integrations</h2>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Currently running on mock/demo data. Browser extension integration for live scraping is planned.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MARKETPLACES.map((mp) => (
            <div key={mp.name} className="flex items-center justify-between border border-slate-100 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{mp.logo}</span>
                <span className="text-sm font-medium text-slate-700">{mp.name}</span>
              </div>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                  mp.status === "connected"
                    ? "bg-emerald-50 text-emerald-600"
                    : mp.status === "demo"
                    ? "bg-amber-50 text-amber-600"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {mp.status === "connected" ? "Connected" : mp.status === "demo" ? "Demo" : "Coming Soon"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Browser Extension (Concept) */}
      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="w-5 h-5 text-brand-500" />
          <h2 className="text-base font-semibold text-slate-700">Browser Extension (Planned)</h2>
        </div>
        <div className="bg-brand-50 rounded-xl p-4 border border-brand-100">
          <p className="text-sm text-brand-700 font-medium mb-2">How it will work:</p>
          <ul className="text-sm text-brand-600 space-y-1 list-disc list-inside">
            <li>Install the MarketLens browser extension</li>
            <li>Visit your seller dashboard on Shopee / Taobao / Temu</li>
            <li>Click "Import" to sync real-time data into MarketLens</li>
            <li>Analytics will update automatically with live data</li>
          </ul>
          <button className="mt-3 text-sm text-brand-600 font-semibold border border-brand-300 px-3 py-1.5 rounded-lg hover:bg-brand-100 transition-colors">
            Join Waitlist
          </button>
        </div>
      </div>

      {/* OpenAI Key Config */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw className="w-5 h-5 text-brand-500" />
          <h2 className="text-base font-semibold text-slate-700">AI Configuration</h2>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Configure your OpenAI API key for real AI-powered insights. Without a key, the app uses smart mock responses.
        </p>
        <div className="flex gap-3 max-w-lg">
          <input
            type="password"
            className="input flex-1"
            placeholder="sk-..."
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
          />
          <button onClick={handleSaveKey} className="btn-primary flex items-center gap-2 whitespace-nowrap">
            {saved ? <Check className="w-4 h-4" /> : null}
            {saved ? "Saved!" : "Save Key"}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          ⚠ For production use, configure this via the backend <code className="bg-slate-100 px-1 rounded">.env</code> file. Never expose API keys in the frontend.
        </p>
      </div>
    </div>
  );
}
