import { AppPageShell } from "@/components/ui/layout/AppPageShell";
import { ContentSkeleton } from "@/components/skeletons/ContentSkeleton";

export default function NotesLoading() {
  return (
    <AppPageShell>
      <ContentSkeleton title lines={2} cards={4} />
    </AppPageShell>
  );
}
