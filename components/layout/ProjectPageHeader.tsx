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
  secondaryActionSlot?: React.ReactNode;
  /** "section" = lighter weight for use inside project workspace (section header, not main page title) */
  variant?: "page" | "section";
};

export function ProjectPageHeader({
  title,
  subtitle,
  primaryActionLabel,
  primaryActionHref,
  primaryActionOnClick,
  primaryActionIcon,
  secondaryActionSlot,
  variant = "page",
}: ProjectPageHeaderProps) {
  const hasPrimary = primaryActionLabel && (primaryActionHref ?? primaryActionOnClick);
  const icon = primaryActionIcon ?? <Plus className="h-4 w-4" />;
  const isSection = variant === "section";

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${isSection ? "mb-4" : "mb-4"}`}>
      <div className="min-w-0">
        <h1
          className={
            isSection
              ? "text-lg font-medium tracking-tight text-slate-700"
              : "text-xl font-semibold text-slate-900 md:text-2xl"
          }
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={
              isSection
                ? "mt-0.5 text-sm text-slate-500 max-w-2xl"
                : "mt-1 text-sm text-slate-500 max-w-2xl"
            }
          >
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {secondaryActionSlot}
        {hasPrimary &&
          (primaryActionHref ? (
            <Link
              href={primaryActionHref}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition"
            >
              {icon}
              {primaryActionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={primaryActionOnClick}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition"
            >
              {icon}
              {primaryActionLabel}
            </button>
          ))}
      </div>
    </div>
  );
}
