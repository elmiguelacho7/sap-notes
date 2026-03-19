"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError, hasLoggableSupabaseError } from "@/lib/supabaseError";
import type { Ticket, TicketPriority, TicketStatus } from "@/lib/types/ticketTypes";
import { AppPageShell } from "@/components/ui/layout/AppPageShell";
import { SapitoState } from "@/components/ui/SapitoState";
import { RowActions } from "@/components/RowActions";
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
    low: "bg-slate-700/80 text-slate-300",
    medium: "bg-blue-900/60 text-blue-300",
    high: "bg-amber-900/60 text-amber-300",
    urgent: "bg-red-900/60 text-red-300",
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
    open: "bg-slate-700/80 text-slate-300",
    in_progress: "bg-blue-900/60 text-blue-300",
    resolved: "bg-emerald-900/60 text-emerald-300",
    closed: "bg-slate-700/60 text-slate-400",
    cancelled: "bg-red-900/60 text-red-300",
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
    <AppPageShell>
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
          <div className="rounded-2xl border border-red-900/50 bg-red-950/40 overflow-hidden">
            <SapitoState
              variant="error"
              title="Algo salió mal"
              description="Intenta nuevamente o contacta soporte"
              tone="dark"
            />
          </div>
        )}

        <section className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-200 mb-0.5">Tickets globales</h2>
            <p className="text-xs text-slate-500">Listado de tickets no asignados a ningún proyecto.</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
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
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors shrink-0 ${
                  assigneeFilter === key
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden min-h-[200px]">
            {loading ? (
              <div className="px-4 sm:px-5 py-6">
                <TableSkeleton rows={6} colCount={6} />
              </div>
            ) : visibleTickets.length === 0 ? (
              <div className="w-full rounded-2xl border-0 min-h-[280px] flex items-center justify-center px-6 py-10">
                <div className="flex flex-col items-center justify-center text-center gap-4">
                  <Image
                    src="/agents/sapito/sapito_sleeping_192x192.svg"
                    alt=""
                    width={128}
                    height={128}
                    className="shrink-0"
                    unoptimized
                  />
                  <div className="space-y-1">
                    <p className="text-slate-200 font-medium text-base">No hay tickets</p>
                    <p className="text-slate-500 text-sm max-w-md">Crea uno con «Nuevo ticket» o desde un proyecto.</p>
                  </div>
                  <Link
                    href="/tickets/new"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-transparent bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Nuevo ticket
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* Mobile: stacked cards */}
                <div className="md:hidden divide-y divide-slate-800">
                  {visibleTickets.map((t) => (
                    <div key={t.id} className="px-4 py-4 hover:bg-slate-800/40 transition">
                      <Link
                        href={`/tickets/${t.id}`}
                        className="block font-medium text-slate-200 line-clamp-2 hover:text-indigo-400"
                      >
                        {t.title}
                      </Link>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <AssigneeCell
                          profileId={(t as Ticket & { assigned_to?: string | null }).assigned_to ?? null}
                          profilesMap={profilesMap}
                          tone="dark"
                        />
                        <PriorityBadge priority={t.priority} />
                        <StatusBadge status={t.status} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(t.created_at).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </p>
                      <div className="mt-2 flex justify-end" onClick={(e) => e.preventDefault()}>
                        <RowActions
                          entity="ticket"
                          id={t.id}
                          viewHref={`/tickets/${t.id}`}
                          canEdit={appRole === "superadmin"}
                          canDelete={appRole === "superadmin"}
                          deleteEndpoint={appRole === "superadmin" ? `/api/tickets/${t.id}` : undefined}
                          onDeleted={loadTickets}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop: table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm md:table">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-800/60">
                        <th className="px-5 py-3 font-semibold text-slate-300">Título</th>
                        <th className="px-5 py-3 font-semibold text-slate-300">Responsable</th>
                        <th className="px-5 py-3 font-semibold text-slate-300">Prioridad</th>
                        <th className="px-5 py-3 font-semibold text-slate-300">Estado</th>
                        <th className="px-5 py-3 font-semibold text-slate-300">Fecha de creación</th>
                        <th className="px-5 py-3 font-semibold text-slate-300 text-right w-[120px]">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {visibleTickets.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-5 py-3">
                            <Link
                              href={`/tickets/${t.id}`}
                              className="font-medium text-slate-200 hover:text-indigo-400"
                            >
                              {t.title}
                            </Link>
                          </td>
                          <td className="px-5 py-3">
                            <AssigneeCell
                              profileId={(t as Ticket & { assigned_to?: string | null }).assigned_to ?? null}
                              profilesMap={profilesMap}
                              tone="dark"
                            />
                          </td>
                          <td className="px-5 py-3">
                            <PriorityBadge priority={t.priority} />
                          </td>
                          <td className="px-5 py-3">
                            <StatusBadge status={t.status} />
                          </td>
                          <td className="px-5 py-3 text-slate-400">
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
              </>
            )}
          </div>
        </section>
      </div>
    </AppPageShell>
  );
}
