"use client";

import { useTranslations } from "next-intl";

export type ViewMode = "kanban" | "list";

export type ViewModeToggleProps = {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  /** Optional class for the wrapper. */
  className?: string;
};

/**
 * Shared Kanban / List view toggle. Same styling on global and project task pages.
 */
export function ViewModeToggle({ value, onChange, className = "" }: ViewModeToggleProps) {
  const t = useTranslations("tasks.view");
  return (
    <div
      className={`flex rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 p-0.5 shadow-sm ${className}`}
      role="tablist"
      aria-label="View mode"
    >
      <button
        type="button"
        onClick={() => onChange("kanban")}
        className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
          value === "kanban"
            ? "bg-[rgb(var(--rb-surface-3))]/60 text-[rgb(var(--rb-text-primary))] border border-[rgb(var(--rb-surface-border))]/60 shadow-sm"
            : "text-[rgb(var(--rb-text-secondary))] hover:text-[rgb(var(--rb-text-primary))] hover:bg-[rgb(var(--rb-surface))]/80"
        }`}
        role="tab"
        aria-selected={value === "kanban"}
      >
        {t("kanban")}
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
          value === "list"
            ? "bg-[rgb(var(--rb-surface-3))]/60 text-[rgb(var(--rb-text-primary))] border border-[rgb(var(--rb-surface-border))]/60 shadow-sm"
            : "text-[rgb(var(--rb-text-secondary))] hover:text-[rgb(var(--rb-text-primary))] hover:bg-[rgb(var(--rb-surface))]/80"
        }`}
        role="tab"
        aria-selected={value === "list"}
      >
        {t("list")}
      </button>
    </div>
  );
}
