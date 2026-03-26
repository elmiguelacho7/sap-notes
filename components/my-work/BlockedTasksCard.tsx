"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { PauseCircle } from "lucide-react";

export type MyWorkTaskRow = {
  id: string;
  title: string;
  projectName: string | null;
  statusLabel: string;
  dueDate: string | null;
  activityLabel?: string | null;
  /** Task description / note when blocked (muted second line). */
  blockedNote?: string | null;
  tone?: "default" | "blocked" | "overdue";
};

const ROW_INTERACTIVE =
  "cursor-pointer rounded-xl p-3 transition-colors hover:bg-amber-50/60";

function StatusBadge({
  label,
}: {
  label: string;
}) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-200/90 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-900">
      {label}
    </span>
  );
}

export function BlockedTasksCard({
  loading,
  items,
}: {
  loading: boolean;
  items: MyWorkTaskRow[];
}) {
  return (
    <section className="rounded-2xl border border-amber-200/80 bg-amber-50/55 p-5 space-y-4 shadow-sm ring-1 ring-amber-100/70">
      <div className="space-y-1">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-amber-900">
          <PauseCircle className="h-4 w-4 text-amber-700" aria-hidden />
          Blocked Tasks
        </h2>
        <p className="text-xs text-amber-900/80">
          Tasks currently blocked and requiring unblock action.
        </p>
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
        <p className="text-sm text-slate-600">
          No blocked tasks — everything is moving forward.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((t) => (
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
                  {t.blockedNote ? (
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">{t.blockedNote}</p>
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
          ))}
        </ul>
      )}
    </section>
  );
}

