"use client";

import type { ReactNode } from "react";

export interface ModuleHeaderProps {
  title: string;
  subtitle?: string;
  /** Primary CTA (e.g. "Crear ticket") — aligned right on desktop */
  actions?: ReactNode;
  /** `dark` = legacy slate, `light` = premium light workspace */
  tone?: "dark" | "light";
}

/**
 * Reusable module header for project workspace sections (Tickets, Tasks, Activities).
 * Layout: title + subtitle on left; primary CTA on right.
 */
export function ModuleHeader({ title, subtitle, actions, tone = "dark" }: ModuleHeaderProps) {
  const titleClass = tone === "light" ? "text-3xl font-semibold text-slate-900" : "text-3xl font-semibold text-slate-100";
  const subtitleClass = tone === "light" ? "mt-0.5 text-sm text-slate-600" : "mt-0.5 text-sm text-slate-400";
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className={titleClass}>{title}</h1>
        {subtitle && <p className={subtitleClass}>{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 pt-2 lg:pt-0">{actions}</div>}
    </header>
  );
}
