"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { AlertTriangle } from "lucide-react";

export type MyWorkTaskRow = {
  id: string;
  title: string;
  projectName: string | null;
  statusLabel: string;
  dueDate: string | null;
  /** Raw due date for overdue age (YYYY-MM-DD or ISO). */
  dueDateIso?: string | null;
  activityLabel?: string | null;
  tone?: "default" | "blocked" | "overdue";
};

const ROW_INTERACTIVE =
  "cursor-pointer rounded-xl p-3 transition-colors hover:bg-rose-50/60";

function overdueAgeLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - due.getTime();
  const diffDays = Math.round(diffMs / 86400000);
  if (diffDays <= 0) return null;
  return diffDays === 1 ? "1 day overdue" : `${diffDays} days overdue`;
}

function StatusBadge({
  label,
}: {
  label: string;
}) {
  return (
    <span className="inline-flex items-center rounded-full border border-red-200/90 bg-red-50 px-2.5 py-0.5 text-[11px] font-medium text-red-900">
      {label}
    </span>
  );
}

export function OverdueTasksCard({
  loading,
  items,
}: {
  loading: boolean;
  items: MyWorkTaskRow[];
}) {
  return (
    <section className="rounded-2xl border border-rose-200/80 bg-rose-50/55 p-5 space-y-4 shadow-sm ring-1 ring-rose-100/70">
      <div className="space-y-1">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-rose-900">
          <AlertTriangle className="h-4 w-4 text-rose-700" aria-hidden />
          Overdue Tasks
        </h2>
        <p className="text-xs text-rose-900/80">Due dates already passed and not completed.</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">You&apos;re all caught up — no overdue work.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((t) => {
            const age = overdueAgeLabel(t.dueDateIso ?? null);
            return (
              <li key={t.id} className={ROW_INTERACTIVE}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {t.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 truncate">
                      {t.projectName ?? "Project"}
                    </p>
                    {t.activityLabel ? (
                      <p className="mt-1 text-xs text-slate-500 truncate">
                        {t.activityLabel}
                      </p>
                    ) : null}
                    {age ? (
                      <p className="mt-1 text-xs text-slate-500">{age}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <StatusBadge label={t.statusLabel} />
                    {t.dueDate ? (
                      <p className="text-xs text-slate-500">{t.dueDate}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

