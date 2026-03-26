"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import type { BreadcrumbItem } from "./Breadcrumbs";
import { SHELL_HEADER_HEIGHT_CLASS } from "@/lib/layoutSystem";

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
  const tShell = useTranslations("common.shell");
  const pageTitle =
    breadcrumbs && breadcrumbs.length > 0
      ? breadcrumbs[breadcrumbs.length - 1]?.label
      : tShell("defaultTitle");

  return (
    <header className={`${SHELL_HEADER_HEIGHT_CLASS} shrink-0 flex items-center justify-between gap-3 sm:gap-4 px-6 lg:px-8 border-b border-[rgb(var(--rb-surface-border))]/85 bg-[rgb(var(--rb-surface))]/90 backdrop-blur-md transition-colors duration-150 supports-[backdrop-filter]:bg-[rgb(var(--rb-surface))]/80`}>
      {/* Left: sidebar toggle (mobile) + page title */}
      <div className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none">
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center" aria-hidden>
            <img
              src="/branding/ribbit_eyes_brand.svg"
              alt=""
              className="h-full w-full object-contain"
            />
          </span>
          <span className="flex items-center gap-0 text-sm leading-none tracking-tight">
            <span className="font-bold text-[rgb(var(--rb-brand-primary))]">ri</span>
            <span className="font-extrabold text-[rgb(var(--rb-text-primary))]">bb</span>
            <span className="font-bold text-[rgb(var(--rb-brand-primary))]">it</span>
          </span>
        </div>
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden shrink-0 rounded-lg p-2 text-[rgb(var(--rb-text-muted))] hover:bg-[rgb(var(--rb-brand-primary))]/10 hover:text-[rgb(var(--rb-text-primary))] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--rb-surface))]"
            aria-label={tShell("openMenu")}
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <span className="text-sm font-semibold text-[rgb(var(--rb-text-primary))] truncate min-w-0 leading-none sm:ml-6 sm:pl-5 sm:border-l sm:border-[rgb(var(--rb-surface-border))]/50">
          {pageTitle}
        </span>
      </div>

      {/* Center: command palette / search trigger (max-w-lg, centered) */}
      {center ? (
        <div className="hidden md:flex flex-1 justify-center min-w-0 max-w-lg px-3">
          {center}
        </div>
      ) : (
        <div className="hidden md:block flex-1 min-w-0 max-w-lg px-3" />
      )}

      {/* Right: Create menu + User menu */}
      <div className="flex items-center gap-3 shrink-0">
        {right}
      </div>
    </header>
  );
}
