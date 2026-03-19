"use client";

import Link from "next/link";
import { CheckSquare, Ticket, FileText, BookOpen } from "lucide-react";

export type ProjectQuickActionsProps = {
  projectId: string;
};

export function ProjectQuickActions({ projectId }: ProjectQuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Link
        href={`/projects/${projectId}/tasks?new=1`}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 hover:border-slate-500 transition-colors"
      >
        <CheckSquare className="h-4 w-4 shrink-0" />
        Nueva tarea
      </Link>
      <Link
        href={`/projects/${projectId}/tickets/new`}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 hover:border-slate-500 transition-colors"
      >
        <Ticket className="h-4 w-4 shrink-0" />
        Nuevo ticket
      </Link>
      <Link
        href={`/projects/${projectId}/knowledge`}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 hover:border-slate-500 transition-colors"
      >
        <BookOpen className="h-4 w-4 shrink-0" />
        Nueva página
      </Link>
      <Link
        href={`/projects/${projectId}/notes?new=1`}
        className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 hover:border-indigo-400/50 transition-colors"
      >
        <FileText className="h-4 w-4 shrink-0" />
        Nueva nota
      </Link>
    </div>
  );
}
