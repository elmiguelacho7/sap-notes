"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export type MyWorkTaskRow = {
  id: string;
  title: string;
  projectName: string | null;
  statusLabel: string;
  dueDate: string | null;
  activityLabel?: string | null;
  tone?: "default" | "blocked" | "overdue";
  /** Visual grouping only: in_progress vs pending. */
  statusGroup?: "in_progress" | "pending";
};

const ROW_INTERACTIVE =
  "cursor-pointer rounded-xl p-3 transition-colors hover:bg-slate-50";

function StatusBadge({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "blocked" | "overdue";
}) {
  const classes =
    tone === "blocked"
      ? "border-amber-500/30 bg-amber-500/15 text-amber-200"
      : tone === "overdue"
        ? "border-red-500/30 bg-red-500/15 text-red-200"
      : "border-slate-200/80 bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${classes}`}
    >
      {label}
    </span>
  );
}

export function TasksAssignedCard({
  loading,
  items,
}: {
  loading: boolean;
  items: MyWorkTaskRow[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-sm ring-1 ring-slate-100">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-slate-900">Tasks Assigned</h2>
        <p className="text-xs text-slate-500">Active tasks across your projects.</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">No tasks assigned to you</p>
      ) : (
        <div className="space-y-5">
          {(["in_progress", "pending"] as const).map((group) => {
            const groupItems = items.filter((t) => (t.statusGroup ?? "pending") === group);
            if (groupItems.length === 0) return null;
            const label = group === "in_progress" ? "In progress" : "Pending";
            return (
              <div key={group} className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </p>
                <ul className="space-y-1.5">
                  {groupItems.map((t) => (
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
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <StatusBadge
                            label={t.statusLabel}
                            tone={t.tone ?? (t.statusLabel === "Blocked" ? "blocked" : "default")}
                          />
                          {t.dueDate ? (
                            <p className="text-xs text-slate-500">{t.dueDate}</p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

