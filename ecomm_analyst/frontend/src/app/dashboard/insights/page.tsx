"use client";
import { Bot } from "lucide-react";
import PageHeader from "@/components/PageHeader";

export default function InsightsPage() {
  return (
    <div>
      <PageHeader
        title="AI Insights"
        description="Ask questions about your store data using the AI assistant panel on the right"
      />
      <div className="card flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center">
          <Bot className="w-8 h-8 text-brand-500" />
        </div>
        <h3 className="text-lg font-semibold text-slate-700">AI Assistant is always available</h3>
        <p className="text-slate-500 max-w-sm text-sm leading-relaxed">
          The AI chat panel is now pinned to the right side of every page. Select segments, ask questions, and get insights without leaving your current view.
        </p>
        <p className="text-xs text-slate-400">Use the <span className="font-medium text-brand-500">›</span> button on the right edge to collapse or expand the panel.</p>
      </div>
    </div>
  );
}
