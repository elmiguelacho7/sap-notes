"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

export type ProjectPageHeaderProps = {
  title: string;
  subtitle?: string;
  primaryActionLabel?: string;
  primaryActionHref?: string;
  primaryActionOnClick?: () => void;
  primaryActionIcon?: React.ReactNode;
  /** Optional extra class for the primary action (e.g. shadow for emphasis) */
  primaryActionClassName?: string;
  secondaryActionSlot?: React.ReactNode;
  /** "section" = lighter weight for use inside project workspace (section header, not main page title) */
  variant?: "page" | "section";
  /** Use dark/slate styling for project workspace consistency */
  dark?: boolean;
};

export function ProjectPageHeader({
  title,
  subtitle,
  primaryActionLabel,
  primaryActionHref,
  primaryActionOnClick,
  primaryActionIcon,
  primaryActionClassName,
  secondaryActionSlot,
  variant = "page",
  dark = false,
}: ProjectPageHeaderProps) {
  const hasPrimary = primaryActionLabel && (primaryActionHref ?? primaryActionOnClick);
  const icon = primaryActionIcon ?? <Plus className="h-4 w-4" />;
  const isSection = variant === "section";

  const titleClass = dark
    ? "text-xl font-semibold text-slate-100 sm:text-2xl"
    : isSection
      ? "text-lg font-medium tracking-tight text-slate-700"
      : "text-xl font-semibold text-slate-900 md:text-2xl";
  const subtitleClass = dark
    ? "mt-0.5 text-sm text-slate-500 max-w-2xl"
    : isSection
      ? "mt-0.5 text-sm text-slate-500 max-w-2xl"
      : "mt-1 text-sm text-slate-500 max-w-2xl";
  const primaryBtnBase = dark
    ? "inline-flex items-center gap-2 rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0"
    : "inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2";
  const primaryBtnClass = primaryActionClassName ? `${primaryBtnBase} ${primaryActionClassName}` : primaryBtnBase;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
      <div className="min-w-0">
        <h1 className={titleClass}>{title}</h1>
        {subtitle && <p className={subtitleClass}>{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {secondaryActionSlot}
        {hasPrimary &&
          (primaryActionHref ? (
            <Link href={primaryActionHref} className={primaryBtnClass}>
              {icon}
              {primaryActionLabel}
            </Link>
          ) : (
            <button type="button" onClick={primaryActionOnClick} className={primaryBtnClass}>
              {icon}
              {primaryActionLabel}
            </button>
          ))}
      </div>
    </div>
  );
}
