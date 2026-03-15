"use client";

import { Search } from "lucide-react";

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
 * Compact filter bar for task workspace. Dark premium style.
 * All filters optional so global and project pages can use incrementally.
 */
export function TaskFilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search tasks...",
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
  const selectClass =
    "rounded-xl border border-slate-600/80 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
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
  );
}
