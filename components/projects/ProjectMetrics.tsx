"use client";

import { CheckSquare, Ticket, BookOpen, Users } from "lucide-react";

export type ProjectMetricsProps = {
  /** Tasks */
  tasksTotal: number;
  tasksOverdue: number;
  tasksInProgress: number;
  /** Tickets */
  ticketsOpen: number;
  ticketsUrgent: number;
  /** Knowledge */
  knowledgeSpaces: number;
  knowledgePages: number;
  /** Members */
  membersTotal: number;
  loading?: boolean;
};

export function ProjectMetrics({
  tasksTotal,
  tasksOverdue,
  tasksInProgress,
  ticketsOpen,
  ticketsUrgent,
  knowledgeSpaces,
  knowledgePages,
  membersTotal,
  loading = false,
}: ProjectMetricsProps) {
  const value = (n: number) => (loading ? "—" : n);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div className="flex items-center gap-2 text-slate-400">
          <CheckSquare className="h-4 w-4 shrink-0" />
          <span className="text-xs font-medium uppercase tracking-wider">Tareas</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span><span className="font-semibold tabular-nums text-slate-100">{value(tasksTotal)}</span> total</span>
          <span><span className="font-semibold tabular-nums text-slate-100">{value(tasksOverdue)}</span> vencidas</span>
          <span><span className="font-semibold tabular-nums text-slate-100">{value(tasksInProgress)}</span> en progreso</span>
        </div>
      </div>
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div className="flex items-center gap-2 text-slate-400">
          <Ticket className="h-4 w-4 shrink-0" />
          <span className="text-xs font-medium uppercase tracking-wider">Tickets</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span><span className="font-semibold tabular-nums text-slate-100">{value(ticketsOpen)}</span> abiertos</span>
          <span><span className="font-semibold tabular-nums text-slate-100">{value(ticketsUrgent)}</span> urgentes</span>
        </div>
      </div>
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div className="flex items-center gap-2 text-slate-400">
          <BookOpen className="h-4 w-4 shrink-0" />
          <span className="text-xs font-medium uppercase tracking-wider">Conocimiento</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span><span className="font-semibold tabular-nums text-slate-100">{value(knowledgeSpaces)}</span> espacios</span>
          <span><span className="font-semibold tabular-nums text-slate-100">{value(knowledgePages)}</span> páginas</span>
        </div>
      </div>
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div className="flex items-center gap-2 text-slate-400">
          <Users className="h-4 w-4 shrink-0" />
          <span className="text-xs font-medium uppercase tracking-wider">Miembros</span>
        </div>
        <p className="mt-2 text-lg font-semibold tabular-nums text-slate-100">{value(membersTotal)}</p>
      </div>
    </div>
  );
}
