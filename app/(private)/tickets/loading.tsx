import { PageShell } from "@/components/layout/PageShell";
import { ContentSkeleton } from "@/components/skeletons/ContentSkeleton";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";

export default function TicketsLoading() {
  return (
    <PageShell>
      <ContentSkeleton title lines={1} />
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <TableSkeleton rows={6} colCount={6} />
      </div>
    </PageShell>
  );
}
