"use client";

import Link from "next/link";
import { BookOpen, ArrowRight } from "lucide-react";

export type ProjectKnowledgeSummaryCompactProps = {
  projectId: string;
  spaces: number;
  pages: number;
  notesCount?: number;
  loading?: boolean;
};

export function ProjectKnowledgeSummaryCompact({
  projectId,
  spaces,
  pages,
  notesCount,
  loading = false,
}: ProjectKnowledgeSummaryCompactProps) {
  const value = (n: number) => (loading ? "—" : n);

  return (
    <section aria-labelledby="knowledge-summary-heading">
      <h2 id="knowledge-summary-heading" className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-widest">
        Conocimiento
      </h2>
      <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
            <span><span className="font-semibold tabular-nums text-slate-100">{value(spaces)}</span> espacios</span>
            <span><span className="font-semibold tabular-nums text-slate-100">{value(pages)}</span> páginas</span>
            {notesCount !== undefined && (
              <span><span className="font-semibold tabular-nums text-slate-100">{value(notesCount)}</span> notas</span>
            )}
          </div>
          <Link
            href={`/projects/${projectId}/knowledge`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-400 hover:text-indigo-300 shrink-0"
          >
            Abrir conocimiento
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
