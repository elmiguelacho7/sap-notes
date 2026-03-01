"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError, hasLoggableSupabaseError } from "@/lib/supabaseError";
import type { Ticket, TicketPriority, TicketStatus } from "@/lib/types/ticketTypes";
import { RowActions } from "@/components/RowActions";

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Abierto",
  in_progress: "En progreso",
  resolved: "Resuelto",
  closed: "Cerrado",
  cancelled: "Cancelado",
};

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const colors: Record<TicketPriority, string> = {
    low: "bg-slate-100 text-slate-700",
    medium: "bg-blue-50 text-blue-700",
    high: "bg-amber-50 text-amber-700",
    urgent: "bg-red-50 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${colors[priority]}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const colors: Record<TicketStatus, string> = {
    open: "bg-slate-100 text-slate-700",
    in_progress: "bg-blue-50 text-blue-700",
    resolved: "bg-emerald-50 text-emerald-700",
    closed: "bg-slate-200 text-slate-600",
    cancelled: "bg-red-50 text-red-600",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${colors[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appRole, setAppRole] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("tickets")
      .select("id, title, description, priority, status, project_id, due_date, created_at, updated_at")
      .is("project_id", null)
      .order("created_at", { ascending: false });

    if (error) {
      handleSupabaseError("tickets", error);
      if (hasLoggableSupabaseError(error)) {
        setErrorMsg("No se pudieron cargar los tickets. Inténtalo de nuevo más tarde.");
      }
      setTickets([]);
    } else {
      setTickets((data ?? []) as Ticket[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    let cancelled = false;
    async function loadRole() {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      if (cancelled) return;
      const data = await res.json().catch(() => ({ appRole: null }));
      const role = (data as { appRole?: string | null }).appRole ?? null;
      setAppRole(role);
    }
    loadRole();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">
            Tickets
          </h1>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            Seguimiento de incidencias y solicitudes sin asignar a un proyecto.
          </p>
        </div>
        <Link
          href="/tickets/new"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition shrink-0"
        >
          <Plus className="h-4 w-4" />
          Nuevo ticket
        </Link>
      </div>

      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Tabla de tickets */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            Cargando tickets…
          </div>
        ) : tickets.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            No hay tickets. Crea uno desde la página de nuevo ticket o desde un proyecto.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Título
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Prioridad
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Estado
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Fecha de creación
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 text-right w-[120px]">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3">
                      <Link
                        href={`/tickets/${t.id}`}
                        className="font-medium text-slate-900 hover:text-blue-600"
                      >
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(t.created_at).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RowActions
                        entity="ticket"
                        id={t.id}
                        viewHref={`/tickets/${t.id}`}
                        canEdit={appRole === "superadmin"}
                        canDelete={appRole === "superadmin"}
                        deleteEndpoint={appRole === "superadmin" ? `/api/tickets/${t.id}` : undefined}
                        onDeleted={loadTickets}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
