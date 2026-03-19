"use client";

import Link from "next/link";
import { CheckSquare, Ticket, ArrowRight } from "lucide-react";
import { getTicketDetailHref } from "@/lib/routes";

export type PriorityTask = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
};

export type OpenTicketItem = {
  id: string;
  title: string;
  priority?: string;
  status?: string;
  created_at: string;
};

export type ProjectActionZoneProps = {
  projectId: string;
  priorityTasks: PriorityTask[];
  openTickets: OpenTicketItem[];
  tasksLoading?: boolean;
  ticketsLoading?: boolean;
};

export function ProjectActionZone({
  projectId,
  priorityTasks,
  openTickets,
  tasksLoading = false,
  ticketsLoading = false,
}: ProjectActionZoneProps) {
  const displayTasks = priorityTasks.slice(0, 3);
  const displayTickets = openTickets.slice(0, 3);

  return (
    <section aria-labelledby="action-zone-heading" className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <h2 id="action-zone-heading" className="sr-only">
        Acciones prioritarias
      </h2>

      <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <CheckSquare className="h-4 w-4 shrink-0 text-slate-400" />
            Tareas prioritarias
          </h3>
          <Link
            href={`/projects/${projectId}/tasks`}
            className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
          >
            Ver todas las tareas
          </Link>
        </div>
        {tasksLoading ? (
          <p className="text-sm text-slate-500 py-3">Cargando…</p>
        ) : displayTasks.length === 0 ? (
          <p className="text-sm text-slate-500 py-3">No hay tareas vencidas ni bloqueadas.</p>
        ) : (
          <ul className="space-y-1">
            {displayTasks.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/projects/${projectId}/tasks`}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/60 hover:text-slate-100 transition-colors"
                >
                  <span className="truncate">{t.title}</span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {t.due_date
                      ? new Date(t.due_date).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                        })
                      : "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Ticket className="h-4 w-4 shrink-0 text-slate-400" />
            Tickets abiertos
          </h3>
          <Link
            href={`/projects/${projectId}/tickets`}
            className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
          >
            Ver tickets
          </Link>
        </div>
        {ticketsLoading ? (
          <p className="text-sm text-slate-500 py-3">Cargando…</p>
        ) : displayTickets.length === 0 ? (
          <p className="text-sm text-slate-500 py-3">No hay tickets abiertos.</p>
        ) : (
          <ul className="space-y-1">
            {displayTickets.map((t) => (
              <li key={t.id}>
                <Link
                  href={getTicketDetailHref(t.id, projectId)}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/60 hover:text-slate-100 transition-colors"
                >
                  <span className="truncate">{t.title}</span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {new Date(t.created_at).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
