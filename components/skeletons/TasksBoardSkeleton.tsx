import { Skeleton } from "@/components/ui/Skeleton";

/** Skeleton for task board: column headers + card placeholders. */
export function TasksBoardSkeleton({ columnCount = 5 }: { columnCount?: number }) {
  return (
    <div className="flex gap-4 items-start pb-2 pl-3 pr-3 min-w-0">
      {Array.from({ length: columnCount }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3 w-[280px] shrink-0">
          <Skeleton className="h-6 w-28 rounded-lg" />
          <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] p-3 min-h-[120px] space-y-2 shadow-sm ring-1 ring-slate-100">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] p-3 min-h-[100px] space-y-2 shadow-sm ring-1 ring-slate-100">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] p-3 min-h-[90px] space-y-2 shadow-sm ring-1 ring-slate-100">
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
