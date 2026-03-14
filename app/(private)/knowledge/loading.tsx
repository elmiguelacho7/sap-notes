import { PageShell } from "@/components/layout/PageShell";
import { ContentSkeleton } from "@/components/skeletons/ContentSkeleton";

export default function KnowledgeLoading() {
  return (
    <PageShell>
      <ContentSkeleton title lines={4} cards={3} />
    </PageShell>
  );
}
