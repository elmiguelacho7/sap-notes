"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ticket, Search, Plus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError, hasLoggableSupabaseError } from "@/lib/supabaseError";
import { getTicketDetailHref } from "@/lib/routes";
import type { TicketPriority, TicketStatus } from "@/lib/types/ticketTypes";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";
import { AssigneeCell } from "@/components/AssigneeCell";
import { useAssignableUsers } from "@/components/hooks/useAssignableUsers";
import { TicketRowActions } from "@/components/tickets/TicketRowActions";
import {
  ModuleHeader,
  ModuleKpiCard,
  ModuleToolbar,
  ModuleContentCard,
} from "@/components/layout/module";
import { AppPageShell } from "@/components/ui/layout/AppPageShell";

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Abierto",
  in_progress: "En progreso",
  pending: "Pendiente",
  resolved: "Resuelto",
  closed: "Cerrado",
  cancelled: "Cancelado",
};

type FilterKind = "all" | "open" | "in_progress" | "closed" | "overdue" | "unassigned" | "my_tickets";

type TicketRow = {
  id: string;
  title: string;
  description: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  created_at: string;
  due_date: string | null;
  assigned_to: string | null;
};

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const colors: Record<TicketPriority, string> = {
    low: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/90",
    medium: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200/80",
    high: "bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-200/80",
    urgent: "bg-rose-100 text-rose-900 ring-1 ring-inset ring-rose-300/70",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors[priority]}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const colors: Record<string, string> = {
    open: "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200/80",
    in_progress:
      "bg-[rgb(var(--rb-brand-surface))] text-[rgb(var(--rb-brand-primary-active))] ring-1 ring-inset ring-[rgb(var(--rb-brand-primary))]/18",
    pending: "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200/80",
    resolved: "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200/80",
    closed: "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200/80",
    cancelled: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/90",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors[status] ?? "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/90"}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appRole, setAppRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKind>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { profilesMap } = useAssignableUsers({ contextType: "global" });

  const loadTickets = useCallback(async () => {
    const hasData = tickets.length > 0;
    if (hasData) {
      setIsRefreshing(true);
    } else {
      setInitialLoading(true);
    }
    setErrorMsg(null);
    try {
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
        const list = (data ?? []) as TicketRow[];
        const today = new Date().toISOString().slice(0, 10);
        list.sort((a, b) => {
          const aOverdue =
            Boolean(a.due_date && a.due_date < today && a.status !== "closed" && a.status !== "resolved");
          const bOverdue =
            Boolean(b.due_date && b.due_date < today && b.status !== "closed" && b.status !== "resolved");
          if (aOverdue && !bOverdue) return -1;
          if (!aOverdue && bOverdue) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setTickets(list);
      }
    } catch (error) {
      console.error("Tickets error:", error);
      setErrorMsg("No se pudieron cargar los tickets. Inténtalo de nuevo más tarde.");
      setTickets([]);
    } finally {
      setInitialLoading(false);
      setIsRefreshing(false);
    }
  }, [tickets.length]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    let cancelled = false;
    async function loadRole() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      if (cancelled) return;
      const data = await res.json().catch(() => ({ appRole: null }));
      const role = (data as { appRole?: string | null }).appRole ?? null;
      setAppRole(role);
    }
    loadRole();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled) setCurrentUserId(user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const mergedProfilesMap = useMemo(() => {
    const map = new Map(profilesMap);
    tickets.forEach((t) => {
      if (t.assigned_to && !map.has(t.assigned_to)) {
        map.set(t.assigned_to, { id: t.assigned_to, full_name: null, email: null });
      }
    });
    return map;
  }, [profilesMap, tickets]);

  const summary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let open = 0;
    let inProgress = 0;
    let overdue = 0;
    let unassigned = 0;
    let mine = 0;
    tickets.forEach((t) => {
      if (t.status !== "closed" && t.status !== "resolved") open += 1;
      if (t.status === "in_progress") inProgress += 1;
      if (t.due_date && t.due_date < today && t.status !== "closed" && t.status !== "resolved") overdue += 1;
      if (!t.assigned_to) unassigned += 1;
      if (currentUserId && t.assigned_to === currentUserId) mine += 1;
    });
    return { open, inProgress, overdue, unassigned, mine };
  }, [tickets, currentUserId]);

  const filteredTickets = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const q = searchQuery.trim().toLowerCase();
    return tickets.filter((t) => {
      if (filter === "open" && (t.status === "closed" || t.status === "resolved")) return false;
      if (filter === "in_progress" && t.status !== "in_progress") return false;
      if (filter === "closed" && t.status !== "closed" && t.status !== "resolved") return false;
      if (filter === "overdue") {
        if (!t.due_date || t.due_date >= today || t.status === "closed" || t.status === "resolved") return false;
      }
      if (filter === "unassigned" && t.assigned_to) return false;
      if (filter === "my_tickets" && currentUserId && t.assigned_to !== currentUserId) return false;
      if (q) {
        const title = (t.title ?? "").toLowerCase();
        const desc = (t.description ?? "").toLowerCase();
        if (!title.includes(q) && !desc.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, filter, searchQuery, currentUserId]);

  const canManage = appRole === "superadmin";

  return (
    <AppPageShell>
      <div className="space-y-6 w-full min-w-0">
      <ModuleHeader
        tone="light"
        title="Tickets"
        subtitle="Incidencias y solicitudes sin proyecto vinculado."
        actions={
          <div className="flex items-center gap-3">
            {isRefreshing ? (
              <span className="text-xs font-medium text-slate-500">Actualizando...</span>
            ) : null}
            <Link
              href="/tickets/new"
              className="inline-flex items-center gap-2 rounded-xl rb-btn-primary px-4 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4 shrink-0" />
              Nuevo ticket
            </Link>
          </div>
        }
      />

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {initialLoading && tickets.length === 0 ? (
          Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100">
              <div className="h-3 w-16 animate-pulse rounded bg-slate-200/80" />
              <div className="mt-2 h-6 w-12 animate-pulse rounded bg-slate-200/80" />
            </div>
          ))
        ) : (
          <>
            <ModuleKpiCard tone="light" label="Abiertos" value={summary.open} />
            <ModuleKpiCard tone="light" label="En progreso" value={summary.inProgress} />
            <ModuleKpiCard tone="light" label="Vencidos" value={summary.overdue} />
            <ModuleKpiCard tone="light" label="Sin asignar" value={summary.unassigned} />
            <ModuleKpiCard tone="light" label="Asignados a mí" value={summary.mine} />
          </>
        )}
      </div>

      <ModuleToolbar
        left={(
          [
            { key: "all" as FilterKind, label: "Todos" },
            { key: "open" as FilterKind, label: "Abierto" },
            { key: "in_progress" as FilterKind, label: "En progreso" },
            { key: "closed" as FilterKind, label: "Cerrado" },
            { key: "overdue" as FilterKind, label: "Vencidos" },
            { key: "unassigned" as FilterKind, label: "Sin asignar" },
            { key: "my_tickets" as FilterKind, label: "Asignado a mí" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors duration-150 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
              filter === key
                ? "bg-[rgb(var(--rb-brand-surface))] border-[rgb(var(--rb-brand-primary))]/35 text-[rgb(var(--rb-brand-primary-active))]"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
        right={
          <label className="relative block">
            <span className="sr-only">Buscar tickets</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="search"
              placeholder="Buscar tickets…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200/90 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30 focus-visible:border-[rgb(var(--rb-brand-primary))]/30 min-w-0"
            />
          </label>
        }
      />

      <ModuleContentCard tone="light">
        {initialLoading && tickets.length === 0 ? (
          <div className="py-6 px-5">
            <TableSkeleton rows={6} colCount={7} />
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 py-16 px-5 flex flex-col items-center justify-center min-h-[200px] text-center">
            <p className="text-base font-medium text-slate-900">No hay tickets globales</p>
            <p className="mt-1.5 text-sm text-slate-600 max-w-sm">
              Crea un ticket para registrar incidencias o solicitudes sin vincularlas a un proyecto.
            </p>
            <Link
              href="/tickets/new"
              className="mt-5 inline-flex items-center gap-2 rounded-xl rb-btn-primary px-4 py-2.5 text-sm font-medium transition-colors"
            >
              <Plus className="h-4 w-4 shrink-0" />
              Crear primer ticket
            </Link>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 py-12 px-5 flex flex-col items-center justify-center min-h-[160px] text-center">
            <p className="text-sm font-medium text-slate-800">No hay tickets que coincidan con los filtros</p>
            <p className="mt-1 text-xs text-slate-500">Prueba otro filtro o búsqueda.</p>
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-slate-100">
              {filteredTickets.map((t) => (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(getTicketDetailHref(t.id))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(getTicketDetailHref(t.id));
                    }
                  }}
                  className="w-full text-left px-5 py-4 hover:bg-slate-50 transition active:bg-slate-100/70 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30 focus-visible:ring-inset"
                >
                  <div className="flex items-start gap-2">
                    <Ticket className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 line-clamp-2">{t.title}</p>
                      {t.description && (
                        <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">{t.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <AssigneeCell profileId={t.assigned_to} profilesMap={mergedProfilesMap} tone="light" />
                    <PriorityBadge priority={t.priority} />
                    <StatusBadge status={t.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {t.due_date
                      ? `Vence ${new Date(t.due_date).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })}`
                      : "Sin fecha límite"}
                    {" · "}
                    {new Date(t.created_at).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </p>
                  <div className="mt-2 flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <TicketRowActions
                      tone="light"
                      viewHref={getTicketDetailHref(t.id)}
                      editHref={getTicketDetailHref(t.id)}
                      canEdit={canManage}
                      canDelete={canManage}
                      deleteEndpoint={canManage ? `/api/tickets/${t.id}` : undefined}
                      onDeleted={loadTickets}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto min-w-0">
              <table className="w-full min-w-[640px] text-left text-sm md:table">
                <thead>
                  <tr className="border-b border-slate-200/90 bg-slate-50/85">
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Título
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-36">
                      Asignado a
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24">
                      Prioridad
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-28">
                      Estado
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-28">
                      Fecha límite
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-32">
                      Fecha de creación
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-28">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTickets.map((t) => (
                    <tr
                      key={t.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(getTicketDetailHref(t.id))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(getTicketDetailHref(t.id));
                        }
                      }}
                      className="cursor-pointer hover:bg-slate-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30 focus-visible:ring-inset"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center font-medium text-slate-900">
                            <Ticket className="h-4 w-4 text-slate-400 mr-2 shrink-0" aria-hidden />
                            {t.title}
                          </span>
                          {t.description && (
                            <span className="text-xs text-slate-600 line-clamp-1 pl-6">{t.description}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <AssigneeCell profileId={t.assigned_to} profilesMap={mergedProfilesMap} tone="light" />
                      </td>
                      <td className="px-5 py-3.5">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {t.due_date
                          ? new Date(t.due_date).toLocaleDateString("es-ES", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {new Date(t.created_at).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <TicketRowActions
                          tone="light"
                          viewHref={getTicketDetailHref(t.id)}
                          editHref={getTicketDetailHref(t.id)}
                          canEdit={canManage}
                          canDelete={canManage}
                          deleteEndpoint={canManage ? `/api/tickets/${t.id}` : undefined}
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
      </ModuleContentCard>
      </div>
    </AppPageShell>
  );
}
