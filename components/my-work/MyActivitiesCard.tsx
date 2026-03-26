"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export type MyWorkActivityRow = {
  id: string;
  title: string;
  projectName: string | null;
  statusLabel: string;
  dueDate: string | null;
};

const ROW_INTERACTIVE =
  "cursor-pointer rounded-xl p-3 transition-colors hover:bg-slate-50";

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-200/90 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-900">
      {label}
    </span>
  );
}

export function MyActivitiesCard({
  loading,
  items,
}: {
  loading: boolean;
  items: MyWorkActivityRow[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-5 space-y-3 shadow-sm ring-1 ring-slate-100">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-slate-900">My Activities</h2>
        <p className="text-xs text-slate-500">Activities where you are responsible.</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">No activities assigned to you</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((a) => (
            <li key={a.id} className={ROW_INTERACTIVE}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {a.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 truncate">
                    {a.projectName ?? "Project"}
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <StatusBadge label={a.statusLabel} />
                  {a.dueDate ? (
                    <p className="text-xs text-slate-500">{a.dueDate}</p>
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

