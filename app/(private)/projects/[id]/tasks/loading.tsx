import { Skeleton } from "@/components/ui/Skeleton";
import { TasksBoardSkeleton } from "@/components/skeletons/TasksBoardSkeleton";
import { PROJECT_WORKSPACE_HERO, PROJECT_WORKSPACE_TOOLBAR, PROJECT_WORKSPACE_PANEL, PROJECT_WORKSPACE_PAGE } from "@/lib/projectWorkspaceUi";

/**
 * Carga del módulo Tareas dentro del workspace de proyecto (misma cadencia que Overview / Planificación).
 */
export default function ProjectTasksLoading() {
  return (
    <div className={PROJECT_WORKSPACE_PAGE}>
      <div className={PROJECT_WORKSPACE_HERO + " space-y-4"}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2 flex-1 min-w-0">
            <Skeleton className="h-8 w-40 rounded-lg" />
            <Skeleton className="h-4 w-full max-w-xl rounded-md" />
            <Skeleton className="h-3 w-2/3 max-w-md rounded-md" />
          </div>
          <Skeleton className="h-10 w-[9.5rem] rounded-xl shrink-0" />
        </div>
      </div>
      <div className={PROJECT_WORKSPACE_TOOLBAR}>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <Skeleton className="h-10 flex-1 min-w-[200px] rounded-xl" />
          <Skeleton className="h-10 w-full sm:w-40 rounded-xl" />
          <Skeleton className="h-10 w-full sm:w-36 rounded-xl" />
          <Skeleton className="h-10 w-full sm:w-36 rounded-xl" />
          <Skeleton className="h-10 w-full sm:w-44 rounded-xl" />
        </div>
      </div>
      <div className={PROJECT_WORKSPACE_PANEL + " p-4 sm:p-5 space-y-4"}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48 rounded-md" />
            <Skeleton className="h-4 w-72 max-w-full rounded-md" />
          </div>
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <TasksBoardSkeleton columnCount={5} />
      </div>
    </div>
  );
}
