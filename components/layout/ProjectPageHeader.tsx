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
};

export function ProjectPageHeader({
  title,
  subtitle,
  primaryActionLabel,
  primaryActionHref,
  primaryActionOnClick,
  primaryActionIcon,
  secondaryActionSlot,
}: ProjectPageHeaderProps) {
  const hasPrimary = primaryActionLabel && (primaryActionHref ?? primaryActionOnClick);
  const icon = primaryActionIcon ?? <Plus className="h-4 w-4" />;

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
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
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition"
            >
              {icon}
              {primaryActionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={primaryActionOnClick}
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition"
            >
              {icon}
              {primaryActionLabel}
            </button>
          ))}
      </div>
    </div>
  );
}
