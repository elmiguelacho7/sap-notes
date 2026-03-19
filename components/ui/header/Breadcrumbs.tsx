"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2 min-w-0">
          {i > 0 && (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden />
          )}
          {item.href != null ? (
            <Link
              href={item.href}
              className="text-slate-400 hover:text-slate-200 transition-colors duration-150 truncate max-w-[120px] sm:max-w-[200px] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2 focus:ring-offset-slate-950 rounded"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-200 font-medium truncate max-w-[150px] sm:max-w-[280px]">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
