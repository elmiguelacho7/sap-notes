"use client";

import type { ReactNode } from "react";

export type TaskWorkspaceHeaderProps = {
  title: string;
  subtitle: string;
  /** Optional actions (e.g. "New task" button, view toggle). */
  actions?: ReactNode;
};

/**
 * Shared header for task workspace (global /tasks and project /projects/[id]/tasks).
 * Dark premium style: rounded-xl, slate borders, strong hierarchy.
 */
export function TaskWorkspaceHeader({
  title,
  subtitle,
  actions,
}: TaskWorkspaceHeaderProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">
          {title}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500 max-w-2xl">
          {subtitle}
        </p>
      </div>
      {actions != null && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
