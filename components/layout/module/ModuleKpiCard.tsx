"use client";

import type { ReactNode } from "react";

export interface ModuleKpiCardProps {
  label: string;
  value: ReactNode;
  className?: string;
  /** Optional class for the numeric/value line (e.g. semantic emphasis). */
  valueClassName?: string;
  /** `dark` = legacy slate module chrome; `light` = premium project workspace (default for /projects/[id]/*). */
  tone?: "dark" | "light";
}

/**
 * Single KPI card for module dashboard.
 * Use inside ModuleKpiRow for consistent grid.
 */
export function ModuleKpiCard({
  label,
  value,
  className = "",
  valueClassName = "",
  tone = "dark",
}: ModuleKpiCardProps) {
  const shell =
    tone === "light"
      ? "rounded-xl border border-slate-200/90 bg-white px-3 py-3 min-w-0 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 transition-colors hover:border-slate-300/90"
      : "rounded-xl border border-slate-700/50 bg-slate-950/30 px-3 py-3 min-w-0 transition-colors hover:border-slate-600/50";
  const labelClass =
    tone === "light"
      ? "text-[11px] font-semibold uppercase tracking-wide text-slate-500"
      : "text-[11px] uppercase tracking-wide text-slate-500";
  const valueBase =
    tone === "light"
      ? "mt-1 text-lg font-semibold tabular-nums text-slate-900"
      : "mt-1 text-lg font-semibold tabular-nums text-slate-100";

  return (
    <div className={`${shell} ${className}`}>
      <p className={labelClass}>{label}</p>
      <p className={`${valueBase} ${valueClassName}`.trim()}>{value}</p>
    </div>
  );
}

export interface ModuleKpiRowProps {
  children: ReactNode;
  className?: string;
}

/**
 * Responsive grid for 4 KPI cards (or fewer). Use with ModuleKpiCard.
 */
export function ModuleKpiRow({ children, className = "" }: ModuleKpiRowProps) {
  return (
    <div
      className={`grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4 ${className}`}
    >
      {children}
    </div>
  );
}
