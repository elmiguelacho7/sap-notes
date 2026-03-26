import { Skeleton } from "@/components/ui/Skeleton";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";
import { PROJECT_WORKSPACE_HERO, PROJECT_WORKSPACE_PAGE, PROJECT_WORKSPACE_TOOLBAR, PROJECT_WORKSPACE_PANEL } from "@/lib/projectWorkspaceUi";

/**
 * Carga del módulo Tickets del proyecto (misma cadencia que Tareas / workspace).
 */
export default function ProjectTicketsLoading() {
  return (
    <div className={PROJECT_WORKSPACE_PAGE}>
      <div className={PROJECT_WORKSPACE_HERO}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2 flex-1 min-w-0">
            <Skeleton className="h-8 w-56 rounded-lg" />
            <Skeleton className="h-4 w-full max-w-xl rounded-md" />
          </div>
          <Skeleton className="h-10 w-36 rounded-xl shrink-0" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton
            key={i}
            className="h-[72px] w-full rounded-xl border border-slate-200/90 bg-slate-100/70 ring-1 ring-slate-100"
          />
        ))}
      </div>

      <div className={PROJECT_WORKSPACE_TOOLBAR}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-10 w-full lg:w-64 rounded-xl shrink-0" />
        </div>
      </div>

      <section className={PROJECT_WORKSPACE_PANEL}>
        <div className="py-6 px-5">
          <TableSkeleton rows={6} colCount={7} />
        </div>
      </section>
    </div>
  );
}
