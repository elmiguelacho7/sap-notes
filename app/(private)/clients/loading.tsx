import { PageShell } from "@/components/layout/PageShell";
import { ContentSkeleton } from "@/components/skeletons/ContentSkeleton";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";

export default function ClientsLoading() {
  return (
    <PageShell wide={false}>
      <ContentSkeleton title lines={1} />
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <TableSkeleton rows={5} colCount={5} />
      </div>
    </PageShell>
  );
}
