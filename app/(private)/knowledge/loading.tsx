import { AppPageShell } from "@/components/ui/layout/AppPageShell";
import { ContentSkeleton } from "@/components/skeletons/ContentSkeleton";

export default function KnowledgeLoading() {
  return (
    <AppPageShell>
      <ContentSkeleton title lines={4} cards={3} />
    </AppPageShell>
  );
}
