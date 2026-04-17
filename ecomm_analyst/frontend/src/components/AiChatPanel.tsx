"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, User, Loader2, RotateCcw, ChevronRight, ChevronLeft } from "lucide-react";
import { insightsApi } from "@/lib/api";
import { clsx } from "clsx";

const SEGMENTS = [
  { id: "sales", label: "Sales", color: "bg-brand-50 text-brand-600 border-brand-200" },
  { id: "engagement", label: "Engagement", color: "bg-cyan-50 text-cyan-600 border-cyan-200" },
  { id: "comments", label: "Comments", color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
];

const QUICK_QUESTIONS = [
  { label: "Sales + Engagement", segments: ["sales", "engagement"], question: "How do sales and customer engagement correlate? What can I improve?" },
  { label: "Comments + Sales", segments: ["comments", "sales"], question: "What do customer comments reveal about our top-selling products?" },
  { label: "All Segments", segments: ["sales", "engagement", "comments"], question: "Give me a comprehensive store performance summary and top 3 action items." },
  { label: "Return Analysis", segments: ["sales", "comments"], question: "What products have high returns and what do reviews say about them?" },
];

interface Message {
  role: "user" | "assistant";
  content: string;
  segments?: string[];
  timestamp: Date;
}

export default function AiChatPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState<string[]>(["sales"]);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your AI assistant. Select segments and ask me anything about your store.",
      timestamp: new Date(),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleSegment = (id: string) => {
    setSelectedSegments((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const sendMessage = async (q: string, segs: string[]) => {
    if (!q.trim() || segs.length === 0 || loading) return;
    const userMsg: Message = { role: "user", content: q, segments: segs, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setLoading(true);
    try {
      const { data } = await insightsApi.ask(segs, q);
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer, timestamp: new Date() }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again.", timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(question, selectedSegments);
  };

  const clearChat = () => {
    setMessages([{ role: "assistant", content: "Chat cleared. Ask me anything about your store performance!", timestamp: new Date() }]);
  };

  return (
    /* Outer: sticks to full viewport height — like a Flutter Column that fills the screen */
    <div className={clsx(
      "relative flex flex-col border-l border-slate-200 bg-white transition-all duration-300 h-screen sticky top-0",
      collapsed ? "w-10" : "w-80 min-w-[320px]"
    )}>
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -left-3 top-6 z-10 w-6 h-6 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center hover:bg-slate-50 transition"
      >
        {collapsed ? <ChevronLeft className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
      </button>

      {collapsed ? (
        /* Collapsed: vertical label */
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs font-semibold text-slate-400 tracking-widest [writing-mode:vertical-rl] rotate-180">AI ASSISTANT</span>
        </div>
      ) : (
        /*
         * Expanded panel — mirrors Flutter's Column layout:
         *   Header        → fixed height (shrink)
         *   Segments      → fixed height (shrink)
         *   Quick actions → fixed height (shrink)
         *   Messages      → flex-1 + overflow-y-auto  ← the SingleChildScrollView equivalent
         *   Input bar     → fixed height (shrink)
         */
        <div className="flex flex-col h-full min-h-0">

          {/* Header — fixed, never scrolls */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-slate-700">AI Assistant</span>
            </div>
            <button onClick={clearChat} title="Clear chat" className="text-slate-400 hover:text-slate-600 transition">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Segment selector — fixed, never scrolls */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500 mb-2">SEGMENTS</p>
            <div className="flex flex-wrap gap-1.5">
              {SEGMENTS.map((seg) => (
                <button
                  key={seg.id}
                  onClick={() => toggleSegment(seg.id)}
                  className={clsx(
                    "px-2.5 py-1 rounded-full border text-xs font-medium transition-all",
                    selectedSegments.includes(seg.id)
                      ? seg.color + " border-current"
                      : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  {selectedSegments.includes(seg.id) ? "✓ " : ""}{seg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick questions — fixed, never scrolls */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500 mb-2">QUICK ANALYSES</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setSelectedSegments(q.segments); sendMessage(q.question, q.segments); }}
                  disabled={loading}
                  className="px-2.5 py-1 rounded-full bg-slate-50 hover:bg-brand-50 hover:text-brand-600 text-xs font-medium text-slate-600 border border-slate-200 transition-all disabled:opacity-50"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/*
           * Messages — THE scrollable region.
           * flex-1 makes it take all remaining height (like Flutter's Expanded).
           * overflow-y-auto gives it the scroll behaviour (like SingleChildScrollView).
           * min-h-0 is required so flexbox lets it shrink below its content size.
           */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={clsx("flex gap-2", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
                <div className={clsx("w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1", msg.role === "assistant" ? "bg-brand-500" : "bg-slate-200")}>
                  {msg.role === "assistant" ? <Bot className="w-3 h-3 text-white" /> : <User className="w-3 h-3 text-slate-600" />}
                </div>
                <div className={clsx("max-w-[85%] flex flex-col gap-1", msg.role === "user" ? "items-end" : "items-start")}>
                  {msg.segments && (
                    <div className="flex gap-1 flex-wrap">
                      {msg.segments.map((s) => (
                        <span key={s} className="text-xs bg-brand-100 text-brand-600 px-1.5 py-0.5 rounded-full capitalize">{s}</span>
                      ))}
                    </div>
                  )}
                  <div className={clsx("rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap", msg.role === "assistant" ? "bg-slate-100 text-slate-800" : "bg-brand-500 text-white")}>
                    {msg.content}
                  </div>
                  <span className="text-xs text-slate-400">{msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="bg-slate-100 rounded-2xl px-3 py-2 flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin text-brand-500" />
                  <span className="text-xs text-slate-500">Analyzing…</span>
                </div>
              </div>
            )}
            {/* Auto-scroll anchor — like ScrollController.animateTo in Flutter */}
            <div ref={bottomRef} />
          </div>

          {/* Input bar — fixed, never scrolls */}
          <form onSubmit={handleSubmit} className="flex-shrink-0 px-4 py-3 border-t border-slate-100 flex gap-2">
            <input
              type="text"
              className="input flex-1 text-xs py-2"
              placeholder={selectedSegments.length === 0 ? "Select a segment…" : `Ask about ${selectedSegments.join(" + ")}…`}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={loading || selectedSegments.length === 0}
            />
            <button
              type="submit"
              className="btn-primary px-3 py-2"
              disabled={loading || !question.trim() || selectedSegments.length === 0}
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
