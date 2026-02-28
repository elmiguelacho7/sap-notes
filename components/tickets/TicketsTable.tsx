"use client";

import type { TicketWithRelations } from "./ticketTypes";

type TicketsTableProps = {
  tickets: TicketWithRelations[];
  loading: boolean;
  onRowClick: (id: string) => void;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function TicketsTable({
  tickets,
  loading,
  onRowClick,
}: TicketsTableProps) {
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <p className="text-sm text-slate-500">Cargando tickets...</p>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <p className="text-sm text-slate-500">
          No hay tickets para los filtros seleccionados.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                ID
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Título
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Cliente
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Proyecto
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Estado
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Prioridad
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Asignado
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Creado
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Vencimiento
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tickets.map((t) => (
              <tr
                key={t.id}
                onClick={() => onRowClick(t.id)}
                className="hover:bg-slate-50 cursor-pointer transition"
              >
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                  {t.id.slice(0, 8)}…
                </td>
                <td className="px-4 py-3 font-medium text-slate-900 line-clamp-1">
                  {t.title || "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {t.client_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {t.project_name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {t.status ? (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      {t.status}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  {t.priority ? (
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.priority === "urgent" || t.priority === "high"
                          ? "bg-red-50 text-red-700 border border-red-100"
                          : t.priority === "medium"
                          ? "bg-amber-50 text-amber-700 border border-amber-100"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {t.priority}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {t.assignee_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {formatDate(t.created_at)}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {formatDate(t.due_date)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
