"use client";

import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import type { BreadcrumbItem } from "./Breadcrumbs";

export function Header({
  breadcrumbs,
  center,
  right,
  onMenuClick,
}: {
  breadcrumbs?: BreadcrumbItem[];
  center?: ReactNode;
  right?: ReactNode;
  /** When provided, shows hamburger on mobile to open sidebar. */
  onMenuClick?: () => void;
}) {
  const pageTitle = breadcrumbs && breadcrumbs.length > 0
    ? breadcrumbs[breadcrumbs.length - 1]?.label
    : "SAP Notes Hub";

  return (
    <header className="sticky top-0 z-30 h-14 shrink-0 flex items-center justify-between gap-4 px-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md transition-colors duration-150">
      {/* Left: sidebar toggle (mobile) + page title */}
      <div className="min-w-0 flex items-center gap-4 flex-1 lg:flex-none">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-800/70 hover:text-white transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <span className="text-sm font-semibold text-slate-200 truncate min-w-0 leading-none">
          {pageTitle}
        </span>
      </div>

      {/* Center: global search (max-w-md, centered) */}
      {center ? (
        <div className="hidden md:flex flex-1 justify-center min-w-0 max-w-md">
          {center}
        </div>
      ) : (
        <div className="hidden md:block flex-1 min-w-0 max-w-md" />
      )}

      {/* Right: Create menu + User menu */}
      <div className="flex items-center gap-4 shrink-0">
        {right}
      </div>
    </header>
  );
}
