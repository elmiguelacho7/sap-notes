import { Skeleton } from "@/components/ui/Skeleton";
import { AppPageShell } from "@/components/ui/layout/AppPageShell";

export default function DashboardLoading() {
  return (
    <AppPageShell>
      <div className="space-y-8">
        <div className="flex flex-wrap gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-[200px] rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </AppPageShell>
  );
}
