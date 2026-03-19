"use client";

import type { ReactNode } from "react";

export interface ModuleKpiCardProps {
  label: string;
  value: ReactNode;
  className?: string;
}

/**
 * Single KPI card for module dashboard (dark theme).
 * Use inside ModuleKpiRow for consistent grid.
 */
export function ModuleKpiCard({ label, value, className = "" }: ModuleKpiCardProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition-colors hover:border-slate-700/80 ${className}`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-100">{value}</p>
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
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 ${className}`}
    >
      {children}
    </div>
  );
}
