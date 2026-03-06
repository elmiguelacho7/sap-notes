"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && (
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          )}
          {item.href != null ? (
            <Link
              href={item.href}
              className="text-slate-400 hover:text-white transition-colors truncate max-w-[120px] sm:max-w-[200px]"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-white font-medium truncate max-w-[150px] sm:max-w-[280px]">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
