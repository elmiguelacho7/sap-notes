"use client";

import Link from "next/link";
import { CalendarClock, Ticket, Ban } from "lucide-react";

export type ProjectHealthStripProps = {
  projectId: string;
  overdueTasks: number;
  openTickets: number;
  blockedTasks: number;
  loading?: boolean;
};

export function ProjectHealthStrip({
  projectId,
  overdueTasks,
  openTickets,
  blockedTasks,
  loading = false,
}: ProjectHealthStripProps) {
  const value = (n: number) => (loading ? "—" : n);
  const hasRisk = overdueTasks > 0 || blockedTasks > 0;
  const hasWarning = openTickets > 0 && !hasRisk;

  return (
    <section aria-labelledby="health-strip-heading">
      <h2 id="health-strip-heading" className="sr-only">
        Estado del proyecto
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href={`/projects/${projectId}/tasks`}
          className={`rounded-xl border p-4 transition-colors ${
            overdueTasks > 0
              ? "border-red-500/40 bg-red-950/20 hover:bg-red-950/30"
              : "border-slate-700 bg-slate-900/80 hover:border-slate-600 hover:bg-slate-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <CalendarClock
              className={`h-4 w-4 shrink-0 ${overdueTasks > 0 ? "text-red-400" : "text-slate-500"}`}
              aria-hidden
            />
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Tareas vencidas
            </span>
          </div>
          <p
            className={`mt-2 text-2xl font-bold tabular-nums ${
              overdueTasks > 0 ? "text-red-300" : "text-slate-100"
            }`}
          >
            {value(overdueTasks)}
          </p>
          {overdueTasks === 0 && !loading && (
            <p className="mt-0.5 text-xs text-slate-500">Al día</p>
          )}
        </Link>

        <Link
          href={`/projects/${projectId}/tickets`}
          className={`rounded-xl border p-4 transition-colors ${
            openTickets > 0 && !hasRisk
              ? "border-amber-500/30 bg-amber-950/10 hover:bg-amber-950/20"
              : "border-slate-700 bg-slate-900/80 hover:border-slate-600 hover:bg-slate-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <Ticket
              className={`h-4 w-4 shrink-0 ${
                hasWarning ? "text-amber-400" : "text-slate-500"
              }`}
              aria-hidden
            />
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Tickets abiertos
            </span>
          </div>
          <p
            className={`mt-2 text-2xl font-bold tabular-nums ${
              hasWarning ? "text-amber-300" : "text-slate-100"
            }`}
          >
            {value(openTickets)}
          </p>
          {openTickets === 0 && !loading && (
            <p className="mt-0.5 text-xs text-slate-500">Ninguno</p>
          )}
        </Link>

        <Link
          href={`/projects/${projectId}/tasks`}
          className={`rounded-xl border p-4 transition-colors ${
            blockedTasks > 0
              ? "border-red-500/40 bg-red-950/20 hover:bg-red-950/30"
              : "border-slate-700 bg-slate-900/80 hover:border-slate-600 hover:bg-slate-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <Ban
              className={`h-4 w-4 shrink-0 ${
                blockedTasks > 0 ? "text-red-400" : "text-slate-500"
              }`}
              aria-hidden
            />
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Trabajo bloqueado
            </span>
          </div>
          <p
            className={`mt-2 text-2xl font-bold tabular-nums ${
              blockedTasks > 0 ? "text-red-300" : "text-slate-100"
            }`}
          >
            {value(blockedTasks)}
          </p>
          {blockedTasks === 0 && !loading && (
            <p className="mt-0.5 text-xs text-slate-500">Ninguno</p>
          )}
        </Link>
      </div>
    </section>
  );
}
