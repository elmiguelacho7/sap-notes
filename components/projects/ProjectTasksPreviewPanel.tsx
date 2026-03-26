"use client";

import Link from "next/link";
import { ListTodo } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/Skeleton";

export type ProjectTaskPreviewRow = {
  id: string;
  title: string;
  status: string;
  /** ISO date string when set */
  dueDate?: string | null;
  assigneeLabel: string;
  /** Two-char or single placeholder from assignee id when assigned */
  assigneeInitial?: string | null;
};

function formatTaskDueMeta(dueDate: string | null | undefined): string {
  if (!dueDate) return "No due date";
  try {
    const d = new Date(dueDate);
    if (Number.isNaN(d.getTime())) return "Due date set";
    return `Due ${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  } catch {
    return "Due date set";
  }
}

function getTaskStatusLabel(status: string | null | undefined): string {
  const s = String((status ?? "").toLowerCase().trim());
  const map: Record<string, string> = {
    pending: "Por hacer",
    in_progress: "En progreso",
    blocked: "Bloqueado",
    review: "En revisión",
    done: "Hecho",
  };
  if (map[s]) return map[s];
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function taskStatusBadgeClass(status: string) {
  const s = String(status).toLowerCase().trim();
  if (s === "blocked") return "rb-badge-warning";
  if (s === "in_progress") return "rb-badge-success";
  if (s === "review") return "border-violet-500/35 bg-violet-500/10 text-violet-700";
  return "rb-badge-neutral";
}

export function ProjectTasksPreviewPanel({
  projectId,
  tasks,
  loading,
  overdueCount = 0,
  blockedCount = 0,
  openTotal = 0,
}: {
  projectId: string;
  tasks: ProjectTaskPreviewRow[];
  loading?: boolean;
  overdueCount?: number;
  blockedCount?: number;
  openTotal?: number;
}) {
  const tp = useTranslations("projects.overview.panels");
  const tasksHref = `/projects/${projectId}/tasks`;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-12px_rgba(15,23,42,0.09)] ring-1 ring-slate-100 w-full min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/85 bg-gradient-to-br from-slate-50 to-white text-slate-700 shadow-sm">
            <ListTodo className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--rb-brand-primary-active))]">
              {tp("tasksAttention")}
            </p>
            <h2 className="text-base font-semibold tracking-tight text-slate-900">{tp("tasksTitle")}</h2>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">{tp("tasksSubtitle")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {openTotal > 0 ? (
            <span className="rounded-lg border border-slate-200/80 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 tabular-nums">
              {tp("open", { n: openTotal })}
            </span>
          ) : null}
          {overdueCount > 0 ? (
            <span className="rounded-lg border border-rose-200/80 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-800 tabular-nums">
              {tp("overdue", { n: overdueCount })}
            </span>
          ) : null}
          {blockedCount > 0 ? (
            <span className="rounded-lg border border-amber-200/80 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 tabular-nums">
              {tp("blocked", { n: blockedCount })}
            </span>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[4.25rem] w-full rounded-lg" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200/90 bg-slate-50/80 px-4 py-6 text-center space-y-2">
          <p className="text-sm text-slate-600">No active tasks yet.</p>
          <Link
            href={`${tasksHref}?new=1`}
            className="inline-block text-sm font-semibold text-[rgb(var(--rb-brand-primary-active))] hover:text-[rgb(var(--rb-brand-primary-hover))]"
          >
            Create the first task
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/40 px-1">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="py-3.5 first:pt-3 last:pb-3 px-2 transition-colors hover:bg-white/90"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="min-w-0 flex-1 space-y-2">
                  <Link
                    href={tasksHref}
                    className="text-sm font-medium text-slate-900 line-clamp-2 hover:text-[rgb(var(--rb-brand-primary-hover))] transition-colors text-left block"
                  >
                    {t.title}
                  </Link>
                  <p className="text-[11px] text-slate-500">
                    {formatTaskDueMeta(t.dueDate)}
                  </p>
                  <span
                    className={`rb-badge ${taskStatusBadgeClass(t.status)}`}
                  >
                    {getTaskStatusLabel(t.status)}
                  </span>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1.5 pt-0.5">
                  {t.assigneeInitial ? (
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200/80 bg-white text-[10px] font-semibold uppercase text-slate-600"
                      title={t.assigneeLabel}
                    >
                      {t.assigneeInitial.slice(0, 2)}
                    </span>
                  ) : null}
                  <span className="text-[11px] text-slate-500 max-w-[5.5rem] text-right leading-tight">
                    {t.assigneeLabel}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-2 border-t border-slate-100">
        <Link
          href={tasksHref}
          className="text-sm font-semibold text-[rgb(var(--rb-brand-primary-active))] hover:text-[rgb(var(--rb-brand-primary-hover))] transition-colors"
        >
          {tp("viewAll")}
        </Link>
      </div>
    </section>
  );
}
