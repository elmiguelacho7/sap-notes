"use client";

import Link from "next/link";
import type { TicketDetail, ProfileOption } from "./ticketTypes";

type TicketDetailsCardProps = {
  ticket: TicketDetail;
  profiles: ProfileOption[];
  onAssignedToChange: (profileId: string) => void;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function TicketDetailsCard({
  ticket,
  profiles,
  onAssignedToChange,
}: TicketDetailsCardProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900 mb-4">Detalles</h2>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs font-medium text-slate-500">Cliente</dt>
          <dd className="mt-0.5">
            {ticket.client_id && ticket.client_name ? (
              <Link
                href={`/clients/${ticket.client_id}`}
                className="text-blue-600 hover:text-blue-700 hover:underline"
              >
                {ticket.client_name}
              </Link>
            ) : (
              <span className="text-slate-600">—</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Proyecto</dt>
          <dd className="mt-0.5">
            {ticket.project_id && ticket.project_name ? (
              <Link
                href={`/projects/${ticket.project_id}`}
                className="text-blue-600 hover:text-blue-700 hover:underline"
              >
                {ticket.project_name}
              </Link>
            ) : (
              <span className="text-slate-600">—</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Asignado a</dt>
          <dd className="mt-0.5">
            <select
              value={ticket.assigned_to ?? ""}
              onChange={(e) => onAssignedToChange(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Sin asignar</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.id}
                </option>
              ))}
            </select>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Fecha de vencimiento</dt>
          <dd className="mt-0.5 text-slate-600">{formatDate(ticket.due_date)}</dd>
        </div>
        {ticket.error_code && (
          <div>
            <dt className="text-xs font-medium text-slate-500">Código de error</dt>
            <dd className="mt-0.5 text-slate-800 font-medium">{ticket.error_code}</dd>
          </div>
        )}
        {ticket.category && (
          <div>
            <dt className="text-xs font-medium text-slate-500">Categoría</dt>
            <dd className="mt-0.5 text-slate-600">{ticket.category}</dd>
          </div>
        )}
        {ticket.source && (
          <div>
            <dt className="text-xs font-medium text-slate-500">Origen</dt>
            <dd className="mt-0.5 text-slate-600">{ticket.source}</dd>
          </div>
        )}
        {ticket.scope_items && ticket.scope_items.length > 0 && (
          <div>
            <dt className="text-xs font-medium text-slate-500">Scope items</dt>
            <dd className="mt-0.5 text-slate-600">
              {Array.isArray(ticket.scope_items)
                ? ticket.scope_items.join(", ")
                : String(ticket.scope_items)}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
