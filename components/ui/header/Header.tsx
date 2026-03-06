"use client";

import type { ReactNode } from "react";
import { Breadcrumbs, type BreadcrumbItem } from "./Breadcrumbs";

export function Header({
  breadcrumbs,
  center,
  right,
}: {
  breadcrumbs?: BreadcrumbItem[];
  center?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="h-14 shrink-0 flex items-center justify-between gap-4 px-6 border-b border-slate-800 bg-slate-950">
      <div className="min-w-0 flex items-center gap-4">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <Breadcrumbs items={breadcrumbs} />
        ) : (
          <span className="text-slate-500 text-sm">SAP Notes Hub</span>
        )}
      </div>

      {center ? (
        <div className="hidden md:flex flex-1 max-w-md mx-4 justify-center">
          {center}
        </div>
      ) : (
        <div className="flex-1 min-w-0" />
      )}

      <div className="flex items-center gap-2 shrink-0">
        {right}
      </div>
    </header>
  );
}
