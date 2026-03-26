"use client";

import { CalendarDays } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

export type ProjectWorkspaceHeaderProps = {
  projectId: string;
  projectName: string | null;
  clientName?: string | null;
  /** Legacy alias used by layout */
  projectStatus?: string | null;
  status?: string | null;
  /** Single source of truth for current phase label (computed in ProjectLayout). */
  currentPhaseName?: string | null;
  startDate?: string | null;
  plannedEndDate?: string | null;
  /** @deprecated Prefer passing Ask Sapito via `actions` (e.g. ProjectOverviewCommandBar). */
  onAskSapito?: () => void;
  loading?: boolean;
  actions?: ReactNode;
  /** Executive narrative line (display-only, from workspace heuristics). */
  insightLine?: string | null;
  subtitle?: ReactNode;
  compact?: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  archived: "Archived",
  paused: "Paused",
  blocked: "Blocked",
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function statusClass(status: string) {
  const s = status.toLowerCase();
  if (s === "in_progress") return "rb-badge-success";
  if (s === "blocked" || s === "paused") return "rb-badge-warning";
  if (s === "archived") return "rb-badge-neutral";
  if (s === "completed") return "border-sky-500/30 bg-sky-500/12 text-sky-700";
  return "rb-badge-neutral";
}

export function ProjectWorkspaceHeader({
  projectId,
  projectName,
  clientName,
  projectStatus,
  status,
  currentPhaseName,
  startDate,
  plannedEndDate,
  onAskSapito,
  loading = false,
  actions,
  insightLine,
  subtitle,
  compact = false,
}: ProjectWorkspaceHeaderProps) {
  const tOverview = useTranslations("projects.overview");
  void projectId;
  const resolvedStatus = status ?? projectStatus ?? null;
  const statusLabel = resolvedStatus ? STATUS_LABELS[resolvedStatus] ?? resolvedStatus : null;
  const resolvedPhase = currentPhaseName?.trim() ? currentPhaseName.trim() : null;
  const startLabel = formatDate(startDate);
  const endLabel = formatDate(plannedEndDate);
  const resolvedProjectName = projectName?.trim() || "Project";

  if (compact) {
    return (
      <header className="w-full min-w-0 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Project workspace
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-2 min-w-0">
              <h1 className="text-base font-semibold text-[rgb(var(--rb-text-primary))] truncate">
                {loading ? "Loading project..." : resolvedProjectName}
              </h1>
              {statusLabel ? (
                <span className={`rb-badge ${statusClass(resolvedStatus ?? "")}`}>{statusLabel}</span>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[rgb(var(--rb-text-secondary))]">
              {clientName ? <span className="font-medium text-slate-700">{clientName}</span> : null}
              {clientName && (resolvedPhase || startLabel || endLabel) ? (
                <span className="text-slate-300" aria-hidden>
                  •
                </span>
              ) : null}
              {resolvedPhase ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-slate-400">Phase</span>
                  <span className="font-medium text-slate-700">{resolvedPhase}</span>
                </span>
              ) : null}
              {resolvedPhase && (startLabel || endLabel) ? (
                <span className="text-slate-300" aria-hidden>
                  •
                </span>
              ) : null}
              {(startLabel || endLabel) ? (
                <span className="inline-flex items-center gap-1.5 tabular-nums text-slate-600">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                  {startLabel ? <span>Start {startLabel}</span> : null}
                  {startLabel && endLabel ? <span className="text-slate-300">—</span> : null}
                  {endLabel ? <span>Target {endLabel}</span> : null}
                </span>
              ) : null}
            </div>
            {subtitle ? <div className="mt-1 text-xs text-[rgb(var(--rb-text-muted))]">{subtitle}</div> : null}
          </div>
          {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
        </div>
      </header>
    );
  }

  void onAskSapito;

  return (
    <header className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/55 to-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_36px_-14px_rgba(15,23,42,0.09)] ring-1 ring-slate-100 sm:p-6 space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="min-w-0 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {tOverview("heroEyebrow")}
          </p>
          <h1 className="text-2xl sm:text-[1.85rem] font-semibold tracking-tight text-slate-900 truncate">
            {loading ? "Loading project..." : resolvedProjectName}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-600">
            {clientName ? <span className="font-medium text-slate-800">{clientName}</span> : null}
            {statusLabel ? <span className={`rb-badge ${statusClass(resolvedStatus ?? "")}`}>{statusLabel}</span> : null}
            {(startLabel || endLabel) && (
              <span className="inline-flex items-center gap-1.5 tabular-nums text-xs text-slate-600 sm:text-sm">
                <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                {startLabel ? <span>Start {startLabel}</span> : null}
                {startLabel && endLabel ? <span className="text-slate-400">—</span> : null}
                {endLabel ? <span>Target {endLabel}</span> : null}
              </span>
            )}
          </div>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">{actions}</div>
        ) : null}
      </div>
      {insightLine ? (
        <div className="rounded-xl border border-slate-200/85 bg-white/90 px-4 py-3.5 shadow-[inset_3px_0_0_rgba(30,111,72,0.55)] ring-1 ring-slate-100/90">
          <p className="text-sm font-medium leading-relaxed text-slate-800">{insightLine}</p>
        </div>
      ) : null}
      {subtitle ? <div className="text-xs text-slate-500">{subtitle}</div> : null}
    </header>
  );
}
