"use client";

import Link from "next/link";
import { CheckSquare, Kanban, Ticket } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Completed",
  archived: "Archived",
  paused: "Paused",
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusBadgeClass(status: string) {
  const s = status.toLowerCase();
  if (s === "in_progress") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (s === "blocked") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  if (s === "completed") return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  if (s === "planned") return "border-slate-600 bg-slate-800/80 text-slate-300";
  return "border-slate-600 bg-slate-800/80 text-slate-300";
}

const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-500/45 bg-indigo-500/15 px-3.5 py-2 text-sm font-medium text-indigo-100 shadow-sm shadow-indigo-950/20 hover:bg-indigo-500/25 hover:border-indigo-400/50 transition-colors";
const secondaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/30 px-3 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/55 hover:border-slate-600/80 transition-colors";

export function ProjectWorkspaceHeaderV2({
  projectName,
  clientName,
  status,
  startDate,
  plannedEndDate,
  projectId,
}: {
  projectName: string;
  clientName: string | null;
  status: string | null;
  startDate: string | null;
  plannedEndDate: string | null;
  projectId: string;
}) {
  const start = formatDate(startDate);
  const end = formatDate(plannedEndDate);

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-5 w-full min-w-0">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between w-full min-w-0 pb-5 border-b border-slate-800/80">
        <div className="min-w-0 space-y-3 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100 truncate">
            {projectName}
          </h1>
          {clientName ? (
            <p className="text-sm text-slate-400 truncate">{clientName}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
            {status ? (
              <span
                className={`inline-flex items-center rounded-md border px-2 py-0.5 font-medium ${statusBadgeClass(status)}`}
              >
                {STATUS_LABELS[status.toLowerCase()] ?? status}
              </span>
            ) : null}
            {(start || end) && (
              <span className="flex flex-wrap items-center gap-x-2 text-slate-500 tabular-nums">
                {start ? <span>Start · {start}</span> : null}
                {start && end ? <span className="text-slate-700" aria-hidden>|</span> : null}
                {end ? <span>Plan end · {end}</span> : null}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0 sm:pt-0.5">
          <Link href={`/projects/${projectId}/planning`} className={primaryBtn}>
            <Kanban className="h-4 w-4 shrink-0 text-indigo-300/90" aria-hidden />
            Open Planning
          </Link>
          <Link href={`/projects/${projectId}/tasks`} className={secondaryBtn}>
            <CheckSquare className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            Open Tasks
          </Link>
          <Link href={`/projects/${projectId}/tickets`} className={secondaryBtn}>
            <Ticket className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            Open Tickets
          </Link>
        </div>
      </div>
    </div>
  );
}
