"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

export type TaskFilterBarProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Scope options for global workspace; or Activity for project (scopeValue = activity id). */
  scopeOptions?: { value: string; label: string }[];
  scopeValue?: string;
  onScopeChange?: (value: string) => void;
  /** Status options: e.g. [{ value: "", label: "All statuses" }, ...] */
  statusOptions?: { value: string; label: string }[];
  statusValue?: string;
  onStatusChange?: (value: string) => void;
  /** Priority options */
  priorityOptions?: { value: string; label: string }[];
  priorityValue?: string;
  onPriorityChange?: (value: string) => void;
  /** Assignee filter (global or project). */
  assigneeOptions?: { value: string; label: string }[];
  assigneeValue?: string;
  onAssigneeChange?: (value: string) => void;
  /** Project filter (global only). */
  projectOptions?: { value: string; label: string }[];
  projectValue?: string;
  onProjectChange?: (value: string) => void;
  children?: React.ReactNode;
};

/**
 * Compact filter bar for task workspace. Ribbit light control strip.
 * All filters optional so global and project pages can use incrementally.
 */
export function TaskFilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  scopeOptions,
  scopeValue = "",
  onScopeChange,
  statusOptions,
  statusValue = "",
  onStatusChange,
  priorityOptions,
  priorityValue = "",
  onPriorityChange,
  assigneeOptions,
  assigneeValue = "",
  onAssigneeChange,
  projectOptions,
  projectValue = "",
  onProjectChange,
  children,
}: TaskFilterBarProps) {
  const t = useTranslations("tasks.filters");
  const placeholder = searchPlaceholder ?? t("defaultSearch");
  const selectClass =
    "h-10 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/30 w-full sm:w-auto min-w-0";
  return (
    <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] p-3 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
      <div className="relative flex-1 min-w-0 w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[rgb(var(--rb-text-muted))]" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 pl-9 pr-3 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/30"
        />
      </div>
      {scopeOptions != null && scopeOptions.length > 0 && onScopeChange != null && (
        <select value={scopeValue} onChange={(e) => onScopeChange(e.target.value)} className={selectClass}>
          {scopeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
      {statusOptions != null && statusOptions.length > 0 && onStatusChange != null && (
        <select value={statusValue} onChange={(e) => onStatusChange(e.target.value)} className={selectClass}>
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
      {priorityOptions != null && priorityOptions.length > 0 && onPriorityChange != null && (
        <select value={priorityValue} onChange={(e) => onPriorityChange(e.target.value)} className={selectClass}>
          {priorityOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
      {assigneeOptions != null && assigneeOptions.length > 0 && onAssigneeChange != null && (
        <select value={assigneeValue} onChange={(e) => onAssigneeChange(e.target.value)} className={selectClass}>
          {assigneeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
      {projectOptions != null && projectOptions.length > 0 && onProjectChange != null && (
        <select value={projectValue} onChange={(e) => onProjectChange(e.target.value)} className={selectClass}>
          {projectOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
      {children}
      </div>
    </div>
  );
}
