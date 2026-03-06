"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export type ProjectWorkspaceHeaderProps = {
  projectId: string;
  projectName: string | null;
  projectStatus?: string | null;
  loading?: boolean;
  actions?: ReactNode;
  subtitle?: ReactNode;
};

const STATUS_STYLES: Record<string, string> = {
  in_progress: "bg-emerald-500/20 text-emerald-400",
  completed: "bg-blue-500/20 text-blue-400",
  paused: "bg-amber-500/20 text-amber-400",
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

  return (
    <header className="shrink-0 border-b border-slate-800 bg-slate-950/95 px-6 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            href="/projects"
            className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            title="Back to Projects"
            aria-label="Back to Projects"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </Link>
          <div className="min-w-0">
            {loading ? (
              <div className="h-7 w-48 rounded bg-slate-800 animate-pulse" />
            ) : (
              <>
                <h1 className="text-lg font-semibold tracking-tight text-white truncate">
                  {projectName ?? "Project"}
                </h1>
                {(subtitle != null || statusStyle != null) && (
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    {subtitle}
                    {statusStyle && projectStatus && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${statusStyle}`}
                      >
                        {projectStatus}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        {actions != null && (
          <div className="flex min-h-[2.25rem] flex-wrap items-center justify-end gap-3 shrink-0 sm:justify-between">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
