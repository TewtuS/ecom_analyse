"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart2,
  Bot,
  Home,
  LogOut,
  MessageSquare,
  Settings,
  ShoppingCart,
  Users,
  DollarSign,
  Package,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { clsx } from "clsx";

const NAV_ITEMS = [
  { href: "/dashboard",          label: "Dashboard",        icon: Home },
  { href: "/dashboard/sales",    label: "Sales Analytics",  icon: ShoppingCart },
  { href: "/dashboard/pricing",  label: "Pricing",          icon: DollarSign },
  { href: "/dashboard/bundle",   label: "Bundle Analytics", icon: Package },
  { href: "/dashboard/engagement", label: "Engagement",     icon: Users },
  { href: "/dashboard/comments", label: "Comments",         icon: MessageSquare },
  { href: "/dashboard/insights", label: "AI Insights",      icon: Bot },
  { href: "/dashboard/settings", label: "Settings",         icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-slate-100 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-slate-800">MarketLens</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">E-Commerce Analytics</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "sidebar-link",
              pathname === href && "sidebar-link-active"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-slate-100">
        <div className="px-4 py-2 mb-1">
          <p className="text-sm font-semibold text-slate-700 truncate">{user?.username}</p>
          <p className="text-xs text-slate-400 truncate">{user?.email}</p>
        </div>
        <button onClick={logout} className="sidebar-link w-full text-red-500 hover:bg-red-50 hover:text-red-600">
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
