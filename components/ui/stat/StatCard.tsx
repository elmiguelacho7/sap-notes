import type { ReactNode } from "react";

/**
 * Stat card for KPIs. Design system v1 — dark.
 */
export function StatCard({
  label,
  value,
  trend,
  className = "",
}: {
  label: string;
  value: ReactNode;
  trend?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4 ${className}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 text-2xl font-semibold text-white tracking-tight">{value}</div>
      {trend != null ? <div className="mt-1 text-xs text-slate-400">{trend}</div> : null}
    </div>
  );
}
