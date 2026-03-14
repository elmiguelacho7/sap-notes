import { PageShell } from "@/components/layout/PageShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { TasksBoardSkeleton } from "@/components/skeletons/TasksBoardSkeleton";

export default function ProjectTasksLoading() {
  return (
    <PageShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
        <TasksBoardSkeleton columnCount={5} />
      </div>
    </PageShell>
  );
}
