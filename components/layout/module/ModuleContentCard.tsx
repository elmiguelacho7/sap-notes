"use client";

import type { ReactNode } from "react";

export interface ModuleContentCardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper for main table/list content in a module dashboard.
 * Consistent dark-theme card: rounded-2xl, border-slate-800, bg-slate-900/40.
 */
export function ModuleContentCard({ children, className = "" }: ModuleContentCardProps) {
  return (
    <section
      className={`w-full min-w-0 rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden ${className}`}
    >
      {children}
    </section>
  );
}
