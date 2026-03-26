"use client";

import type { ReactNode } from "react";

export interface ModuleContentCardProps {
  children: ReactNode;
  className?: string;
  /** `dark` = legacy slate module chrome; `light` = premium project workspace. */
  tone?: "dark" | "light";
}

/**
 * Wrapper for main table/list content in a module dashboard.
 */
export function ModuleContentCard({
  children,
  className = "",
  tone = "dark",
}: ModuleContentCardProps) {
  const shell =
    tone === "light"
      ? "w-full min-w-0 rounded-2xl border border-slate-200/85 bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100"
      : "w-full min-w-0 rounded-2xl border border-slate-700/60 bg-slate-900/40 overflow-hidden";

  return <section className={`${shell} ${className}`}>{children}</section>;
}
