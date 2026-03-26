import { AppPageShell } from "@/components/ui/layout/AppPageShell";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";

export default function ClientsLoading() {
  return (
    <AppPageShell>
      <div className="space-y-6">
        <div className="h-8 w-48 rounded-lg bg-slate-200/80 animate-pulse" />
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <TableSkeleton rows={5} colCount={6} />
        </div>
      </div>
    </AppPageShell>
  );
}
