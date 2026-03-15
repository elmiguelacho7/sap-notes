"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type ProjectWorkspaceHeaderProps = {
  projectId: string;
  projectName: string | null;
  projectStatus?: string | null;
  loading?: boolean;
  actions?: ReactNode;
  subtitle?: ReactNode;
};

const STATUS_LABELS: Record<string, string> = {
  planned: "Planificado",
  in_progress: "En progreso",
  completed: "Completado",
  archived: "Archivado",
  paused: "En pausa",
};

const STATUS_STYLES: Record<string, string> = {
  in_progress: "bg-emerald-500/20 text-emerald-400",
  completed: "bg-blue-500/20 text-blue-400",
  paused: "bg-amber-500/20 text-amber-400",
  planned: "bg-slate-500/20 text-slate-400",
  archived: "bg-slate-500/20 text-slate-500",
};

export function ProjectWorkspaceHeader({
  projectId,
  projectName,
  projectStatus,
  loading,
  actions,
  subtitle,
}: ProjectWorkspaceHeaderProps) {
  const statusStyle = projectStatus ? STATUS_STYLES[projectStatus] ?? "bg-slate-500/20 text-slate-400" : null;
  const statusLabel = projectStatus ? STATUS_LABELS[projectStatus] ?? projectStatus : null;

  return (
    <header className="w-full min-w-0 px-4 sm:px-5 lg:px-6 py-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 lg:gap-8">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          <Link
            href="/projects"
            className="shrink-0 flex items-center gap-0.5 rounded px-1 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-400 hover:bg-slate-800/50 transition-colors"
            title="Back to Projects"
          >
            <span>Projects</span>
            <ChevronRight className="h-3 w-3 text-slate-700" aria-hidden />
          </Link>
          <span className="text-slate-700 shrink-0 text-[10px]" aria-hidden>
            /
          </span>
          <div className="min-w-0 flex items-center gap-2">
            {loading ? (
              <div className="h-5 w-36 rounded bg-slate-800/80 animate-pulse" />
            ) : (
              <>
                <h1 className="text-[15px] font-semibold tracking-tight text-slate-200 truncate">
                  {projectName ?? "Project"}
                </h1>
                {statusLabel != null && statusStyle != null && (
                  <span
                    className={`shrink-0 inline-flex items-center rounded border border-slate-700/60 px-1.5 py-0.5 text-[10px] font-medium ${statusStyle}`}
                  >
                    {statusLabel}
                  </span>
                )}
                {subtitle != null && <span className="shrink-0 text-slate-500 text-[11px]">{subtitle}</span>}
              </>
            )}
          </div>
        </div>
        {actions != null && (
          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 sm:gap-2.5 pt-2 border-t border-slate-800/70 sm:pt-0 sm:border-t-0 sm:pl-4 sm:border-l border-slate-800/70">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
