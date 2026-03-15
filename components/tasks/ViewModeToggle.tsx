"use client";

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
  return (
    <div className={`flex rounded-xl border border-slate-600/80 bg-slate-800/60 p-0.5 ${className}`}>
      <button
        type="button"
        onClick={() => onChange("kanban")}
        className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
          value === "kanban" ? "bg-slate-700 text-slate-100" : "text-slate-400 hover:text-slate-200"
        }`}
      >
        Kanban
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
          value === "list" ? "bg-slate-700 text-slate-100" : "text-slate-400 hover:text-slate-200"
        }`}
      >
        List
      </button>
    </div>
  );
}
