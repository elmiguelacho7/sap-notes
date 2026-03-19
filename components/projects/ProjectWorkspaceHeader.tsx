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
  in_progress: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  completed: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  paused: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  planned: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  archived: "bg-slate-500/10 text-slate-500 border-slate-600/40",
};

export function ProjectWorkspaceHeader({
  projectId,
  projectName,
  projectStatus,
  loading,
  actions,
  subtitle,
}: ProjectWorkspaceHeaderProps) {
  const statusStyle = projectStatus ? STATUS_STYLES[projectStatus] ?? "bg-slate-500/15 text-slate-400 border-slate-500/30" : null;
  const statusLabel = projectStatus ? STATUS_LABELS[projectStatus] ?? projectStatus : null;

  return (
    <header className="w-full min-w-0 px-4 sm:px-5 lg:px-6 pt-4 pb-2">
      {/* Row 1: breadcrumb + project title + status badge */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Link
          href="/projects"
          className="shrink-0 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium text-slate-500 transition-colors hover:text-slate-300 hover:bg-slate-800/60"
          title="Volver a Proyectos"
        >
          Proyectos
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden />
        {loading ? (
          <div className="h-5 w-40 rounded bg-slate-800/80 animate-pulse" />
        ) : (
          <>
            <h1 className="font-semibold text-slate-100 truncate min-w-0">
              {projectName ?? "Proyecto"}
            </h1>
            {statusLabel != null && statusStyle != null && (
              <span
                className={`shrink-0 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${statusStyle}`}
              >
                {statusLabel}
              </span>
            )}
          </>
        )}
      </div>

      {/* Row 2: optional subtitle / meta */}
      {subtitle != null && (
        <div className="mt-1.5 text-xs text-slate-500">
          {subtitle}
        </div>
      )}

      {/* Row 3: primary and secondary actions */}
      {actions != null && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}
