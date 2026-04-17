import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: { value: number; label: string };
  onClick?: () => void;
  active?: boolean;
}

export default function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = "bg-brand-500",
  trend,
  onClick,
  active = false,
}: KpiCardProps) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "card flex flex-col gap-3 transition-all duration-200",
        onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5",
        active && "ring-2 ring-brand-500 shadow-md -translate-y-0.5"
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center", iconColor)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      {trend && (
        <div className={clsx("text-xs font-medium", trend.value >= 0 ? "text-emerald-500" : "text-red-500")}>
          {trend.value >= 0 ? "▲" : "▼"} {Math.abs(trend.value)}% {trend.label}
        </div>
      )}
      {onClick && (
        <p className={clsx("text-xs mt-0.5", active ? "text-brand-500 font-medium" : "text-slate-300")}>
          {active ? "▲ showing details below" : "Click to view details"}
        </p>
      )}
    </div>
  );
}
