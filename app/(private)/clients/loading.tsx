import { PageShell } from "@/components/layout/PageShell";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";

export default function ClientsLoading() {
  return (
    <PageShell wide={false} className="bg-slate-950">
      <div className="space-y-6">
        <div className="h-8 w-48 rounded-lg bg-slate-800 animate-pulse" />
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
          <TableSkeleton rows={5} colCount={6} />
        </div>
      </div>
    </PageShell>
  );
}
