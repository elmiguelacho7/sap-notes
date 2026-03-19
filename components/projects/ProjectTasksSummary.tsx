"use client";

import Link from "next/link";
import { CheckSquare, ArrowRight } from "lucide-react";

export type ProjectTasksSummaryProps = {
  projectId: string;
  overdue: number;
  inProgress: number;
  loading?: boolean;
};

export function ProjectTasksSummary({
  projectId,
  overdue,
  inProgress,
  loading = false,
}: ProjectTasksSummaryProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
      <div className="flex items-center gap-2 text-slate-400 mb-3">
        <CheckSquare className="h-4 w-4 shrink-0" />
        <h3 className="text-sm font-semibold uppercase tracking-wider">Tareas</h3>
      </div>
      <div className="space-y-1 text-sm">
        <p className="text-slate-300">
          <span className="font-semibold tabular-nums text-slate-100">{loading ? "—" : overdue}</span> vencidas
        </p>
        <p className="text-slate-300">
          <span className="font-semibold tabular-nums text-slate-100">{loading ? "—" : inProgress}</span> en progreso
        </p>
      </div>
      <Link
        href={`/projects/${projectId}/tasks`}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-400 hover:text-indigo-300"
      >
        Ver todas las tareas
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
