import { PageShell } from "@/components/layout/PageShell";
import { ContentSkeleton } from "@/components/skeletons/ContentSkeleton";

export default function NotesLoading() {
  return (
    <PageShell>
      <ContentSkeleton title lines={2} cards={4} />
    </PageShell>
  );
}
