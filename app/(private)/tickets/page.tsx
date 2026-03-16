"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError, hasLoggableSupabaseError } from "@/lib/supabaseError";
import type { Ticket, TicketPriority, TicketStatus } from "@/lib/types/ticketTypes";
import { RowActions } from "@/components/RowActions";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";
import { AssigneeCell } from "@/components/AssigneeCell";
import { useAssignableUsers } from "@/components/hooks/useAssignableUsers";

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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<"all" | "unassigned" | "me">("all");

  const { profilesMap } = useAssignableUsers({ contextType: "global" });

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("tickets")
      .select("id, title, description, priority, status, project_id, due_date, created_at, updated_at, assigned_to")
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

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled) setCurrentUserId(user?.id ?? null);
    });
    return () => { cancelled = true; };
  }, []);

  const visibleTickets = useMemo(() => {
    if (assigneeFilter === "unassigned") return tickets.filter((t) => !(t as Ticket & { assigned_to?: string | null }).assigned_to);
    if (assigneeFilter === "me" && currentUserId) {
      return tickets.filter((t) => (t as Ticket & { assigned_to?: string | null }).assigned_to === currentUserId);
    }
    return tickets;
  }, [tickets, assigneeFilter, currentUserId]);

  return (
    <PageShell>
      <div className="space-y-8">
      <PageHeader
        title="Tickets"
        description="Seguimiento de incidencias y solicitudes sin asignar a un proyecto."
        actions={
          <Link
            href="/tickets/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-transparent bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo ticket
          </Link>
        }
      />

      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-slate-800 mb-1">Tickets globales</h2>
        <p className="text-xs text-slate-500 mb-5">Listado de tickets no asignados a ningún proyecto.</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {(
            [
              { key: "all" as const, label: "Todos" },
              { key: "unassigned" as const, label: "Sin asignar" },
              { key: "me" as const, label: "Asignado a mí" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setAssigneeFilter(key)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                assigneeFilter === key
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="px-5 py-6">
              <TableSkeleton rows={6} colCount={6} />
            </div>
          ) : visibleTickets.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">No hay tickets</p>
              <p className="mt-1 text-sm text-slate-500">Crea uno desde el botón «Nuevo ticket» o desde un proyecto.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-5 py-3 font-semibold text-slate-700">
                      Título
                    </th>
                    <th className="px-5 py-3 font-semibold text-slate-700">
                      Responsable
                    </th>
                    <th className="px-5 py-3 font-semibold text-slate-700">
                      Prioridad
                    </th>
                    <th className="px-5 py-3 font-semibold text-slate-700">
                      Estado
                    </th>
                    <th className="px-5 py-3 font-semibold text-slate-700">
                      Fecha de creación
                    </th>
                    <th className="px-5 py-3 font-semibold text-slate-700 text-right w-[120px]">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleTickets.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-5 py-3">
                        <Link
                          href={`/tickets/${t.id}`}
                          className="font-medium text-slate-900 hover:text-indigo-600"
                        >
                          {t.title}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <AssigneeCell
                          profileId={(t as Ticket & { assigned_to?: string | null }).assigned_to ?? null}
                          profilesMap={profilesMap}
                          tone="light"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {new Date(t.created_at).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-3 text-right">
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
        </div>
      </section>
      </div>
    </PageShell>
  );
}
