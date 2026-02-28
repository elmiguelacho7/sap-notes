"use client";

import type { TicketDetail } from "./ticketTypes";
import { TICKET_STATUS_OPTIONS_EDIT, TICKET_PRIORITY_OPTIONS_EDIT } from "./ticketTypes";

type TicketHeaderProps = {
  ticket: TicketDetail;
  onStatusChange: (status: string) => void;
  onPriorityChange: (priority: string) => void;
};

export default function TicketHeader({
  ticket,
  onStatusChange,
  onPriorityChange,
}: TicketHeaderProps) {
  const canMarkResolved =
    ticket.status && ticket.status !== "resolved" && ticket.status !== "closed";
  const canMarkClosed = ticket.status && ticket.status !== "closed";

  const setResolved = () => onStatusChange("resolved");
  const setClosed = () => onStatusChange("closed");

  return (
    <header className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-slate-900 truncate">
            {ticket.title || "Sin título"}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Creado el{" "}
            {ticket.created_at
              ? new Date(ticket.created_at).toLocaleString("es-ES")
              : "—"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="sr-only">Estado</label>
            <select
              value={ticket.status ?? ""}
              onChange={(e) => onStatusChange(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {TICKET_STATUS_OPTIONS_EDIT.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="sr-only">Prioridad</label>
            <select
              value={ticket.priority ?? ""}
              onChange={(e) => onPriorityChange(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {TICKET_PRIORITY_OPTIONS_EDIT.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {canMarkResolved && (
            <button
              type="button"
              onClick={setResolved}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Marcar como resuelto
            </button>
          )}
          {canMarkClosed && (
            <button
              type="button"
              onClick={setClosed}
              className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Marcar como cerrado
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
