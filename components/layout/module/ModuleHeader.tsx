"use client";

import type { ReactNode } from "react";

export interface ModuleHeaderProps {
  title: string;
  subtitle?: string;
  /** Primary CTA (e.g. "Crear ticket") — aligned right on desktop */
  actions?: ReactNode;
}

/**
 * Reusable module header for project workspace sections (Tickets, Tasks, Activities).
 * Layout: title + subtitle on left; primary CTA on right.
 */
export function ModuleHeader({ title, subtitle, actions }: ModuleHeaderProps) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold text-slate-100">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 pt-2 lg:pt-0">{actions}</div>}
    </header>
  );
}
