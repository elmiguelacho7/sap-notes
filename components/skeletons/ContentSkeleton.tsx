import { Skeleton } from "@/components/ui/Skeleton";

type ContentSkeletonProps = {
  /** Show a title bar */
  title?: boolean;
  /** Number of text lines */
  lines?: number;
  /** Show a grid of cards (e.g. 6 cards in 3 columns) */
  cards?: number;
  className?: string;
};

/**
 * Generic content skeleton: optional title, lines, and card grid.
 * Use for Notes, Tickets, Knowledge, Clients list pages.
 */
export function ContentSkeleton({ title = true, lines = 3, cards = 0, className = "" }: ContentSkeletonProps) {
  return (
    <div className={`space-y-6 ${className}`.trim()}>
      {title && (
        <div className="space-y-2">
          <Skeleton className="h-7 w-48 rounded-xl" />
          <Skeleton className="h-4 w-72 max-w-full rounded-xl" />
        </div>
      )}
      {lines > 0 && (
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full max-w-md rounded-xl" />
          ))}
        </div>
      )}
      {cards > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
              <Skeleton className="mb-3 h-5 w-2/3 rounded-xl" />
              <Skeleton className="mb-2 h-4 w-full rounded-xl" />
              <Skeleton className="h-4 w-4/5 rounded-xl" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
