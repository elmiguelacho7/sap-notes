import { Skeleton } from "@/components/ui/Skeleton";
import { PROJECT_WORKSPACE_HERO, PROJECT_WORKSPACE_PAGE, PROJECT_WORKSPACE_TOOLBAR, PROJECT_WORKSPACE_PANEL } from "@/lib/projectWorkspaceUi";

/**
 * Carga del módulo Conocimiento del proyecto (workspace premium).
 */
export default function ProjectKnowledgeLoading() {
  return (
    <div className={PROJECT_WORKSPACE_PAGE}>
      <div className={PROJECT_WORKSPACE_HERO}>
        <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
          <div className="space-y-2 flex-1 min-w-0">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-4 w-full max-w-xl rounded-md" />
          </div>
          <div className="flex gap-2 shrink-0">
            <Skeleton className="h-10 w-36 rounded-xl" />
            <Skeleton className="h-10 w-36 rounded-xl" />
          </div>
        </div>
      </div>

      <div className={PROJECT_WORKSPACE_TOOLBAR}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-4 w-40 rounded" />
          </div>
          <Skeleton className="h-10 w-full lg:w-52 rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
        <div className={`${PROJECT_WORKSPACE_PANEL} overflow-hidden flex flex-col min-h-[280px]`}>
          <div className="border-b border-slate-200/90 px-5 py-3.5 space-y-2 bg-slate-50/80">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-3 w-full max-w-[180px] rounded" />
          </div>
          <div className="p-4 space-y-2 flex-1">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-4/5 rounded-xl" />
          </div>
        </div>
        <div className={`md:col-span-2 ${PROJECT_WORKSPACE_PANEL} overflow-hidden flex flex-col min-h-[280px]`}>
          <div className="border-b border-slate-200/90 px-5 py-3.5 space-y-2 bg-slate-50/80">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
          <div className="p-4 space-y-2 flex-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
