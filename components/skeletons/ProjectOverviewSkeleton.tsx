import { PageShell } from "@/components/layout/PageShell";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  PROJECT_WORKSPACE_HERO,
  PROJECT_WORKSPACE_CARD,
  PROJECT_WORKSPACE_TOOLBAR,
} from "@/lib/projectWorkspaceUi";

/**
 * Reusable skeleton for project overview / dashboard.
 * Used by app/(private)/projects/[id]/loading.tsx and when project page is loading.
 */
export function ProjectOverviewSkeleton({ wrapInPageShell = true }: { wrapInPageShell?: boolean }) {
  const content = (
    <div className="space-y-8">
      <div className={`relative overflow-hidden ${PROJECT_WORKSPACE_HERO}`}>
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <Skeleton className="h-7 w-3/4 max-w-md sm:h-8" />
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-20 rounded-lg" />
                <Skeleton className="h-4 w-36" />
              </div>
              <Skeleton className="mt-2 h-3 w-48" />
            </div>
            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3 border-t border-slate-200/80 pt-5">
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-6 w-10" />
                </span>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Skeleton className="h-11 w-32 rounded-xl" />
            <Skeleton className="h-11 w-28 rounded-xl" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`${PROJECT_WORKSPACE_TOOLBAR} rounded-xl p-4 sm:p-5`}>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-6 w-16" />
          </div>
        ))}
      </div>
      <div className={`${PROJECT_WORKSPACE_CARD} rounded-xl p-6`}>
        <Skeleton className="mb-4 h-6 w-48" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );

  if (wrapInPageShell) {
    return <PageShell>{content}</PageShell>;
  }
  return content;
}
