"use client";

import Link from "next/link";
import { BookOpen, Brain, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

function formatRelativeOrDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function ProjectKnowledgePanel({
  projectId,
  knowledgeItemsCount,
  lastUpdatedAt,
  loading,
}: {
  projectId: string;
  knowledgeItemsCount: number;
  /** Best-effort: e.g. last note update from project stats */
  lastUpdatedAt: string | null | undefined;
  loading?: boolean;
}) {
  const updatedLabel = formatRelativeOrDate(lastUpdatedAt ?? null);

  return (
    <section className="rb-surface rb-depth-card p-5 space-y-4 w-full min-w-0">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[rgb(var(--rb-surface-border))]/85 bg-[rgb(var(--rb-surface-2))]/95">
            <Brain className="h-4 w-4 shrink-0 text-[rgb(var(--rb-brand-primary-hover))]" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-[-0.01em] text-[rgb(var(--rb-text-primary))]">Project Intelligence</h2>
            <p className="text-[11px] text-[rgb(var(--rb-text-muted))] flex items-center gap-1 mt-0.5">
              <BookOpen className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
              Knowledge spaces &amp; pages
            </p>
          </div>
        </div>
        <p className="text-xs text-[rgb(var(--rb-text-secondary))] leading-relaxed pl-0.5">
          Structured project knowledge, lessons learned, and reusable SAP context.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-16 w-full rounded-lg" />
      ) : (
        <div className="rounded-lg border border-[rgb(var(--rb-surface-border))]/80 bg-[rgb(var(--rb-surface-2))]/85 px-3 py-3 space-y-1">
          <p className="text-2xl font-semibold tabular-nums tracking-[-0.02em] text-[rgb(var(--rb-text-primary))]">{knowledgeItemsCount}</p>
          <p className="text-xs text-[rgb(var(--rb-text-muted))]">Knowledge pages in this project&apos;s spaces</p>
          {updatedLabel ? (
            <p className="text-xs text-[rgb(var(--rb-text-muted))] pt-1">
              Last activity signal: <span className="text-[rgb(var(--rb-text-secondary))]">{updatedLabel}</span>
            </p>
          ) : (
            <p className="text-xs text-[rgb(var(--rb-text-muted))] pt-1">No recent timestamp from project stats</p>
          )}
        </div>
      )}

      <Link
        href={`/projects/${projectId}/brain`}
        className="inline-flex items-center justify-center gap-2 w-full rounded-xl border border-[rgb(var(--rb-brand-primary))]/35 bg-[rgb(var(--rb-brand-primary))]/12 px-4 py-3 text-sm font-semibold text-[rgb(var(--rb-brand-primary-active))] hover:bg-[rgb(var(--rb-brand-primary))]/18 hover:border-[rgb(var(--rb-brand-primary))]/50 transition-all duration-200 rb-depth-hover"
      >
        Open Project Brain
        <ExternalLink className="h-3.5 w-3.5 opacity-90" aria-hidden />
      </Link>
    </section>
  );
}
