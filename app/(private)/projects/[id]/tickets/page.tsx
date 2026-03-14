"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { User, Ticket, MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";
import { handleSupabaseError, hasLoggableSupabaseError } from "@/lib/supabaseError";
import type { TicketPriority, TicketStatus } from "@/lib/types/ticketTypes";

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

type TicketRow = {
  id: string;
  title: string;
  priority: TicketPriority;
  status: TicketStatus;
  created_at: string;
  due_date: string | null;
  assigned_to: string | null;
};

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const colors: Record<TicketPriority, string> = {
    low: "bg-slate-700/60 text-slate-400",
    medium: "bg-indigo-500/20 text-indigo-300",
    high: "bg-amber-500/20 text-amber-400",
    urgent: "bg-red-500/20 text-red-400",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${colors[priority]}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const colors: Record<string, string> = {
    open: "bg-slate-700/60 text-slate-400",
    in_progress: "bg-indigo-500/20 text-indigo-300",
    pending: "bg-amber-500/20 text-amber-400",
    resolved: "bg-emerald-500/20 text-emerald-400",
    closed: "bg-slate-600/50 text-slate-500",
    cancelled: "bg-red-500/20 text-red-400",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${colors[status] ?? "bg-slate-700/60 text-slate-400"}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function AssigneeCell({ profileId, profilesMap }: { profileId: string | null; profilesMap: Map<string, { full_name: string | null; email: string | null }> }) {
  if (!profileId) {
    return (
      <span className="inline-flex items-center gap-1.5 text-slate-500">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700/80 text-slate-500">
          <User className="h-3.5 w-3.5" />
        </span>
        Sin asignar
      </span>
    );
  }
  const p = profilesMap.get(profileId);
  const label = p ? (p.full_name || p.email || profileId) : profileId.slice(0, 8);
  const initial = (label.trim() || "?").charAt(0).toUpperCase();
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-300">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-600 text-slate-200 text-[10px] font-medium">
        {initial}
      </span>
      <span className="truncate max-w-[120px]" title={label}>{label}</span>
    </span>
  );
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function TicketRowActions({
  ticketId,
  viewHref,
  editHref,
  canEdit,
  canDelete,
  deleteEndpoint,
  onDeleted,
}: {
  ticketId: string;
  viewHref: string;
  editHref?: string;
  canEdit: boolean;
  canDelete: boolean;
  deleteEndpoint?: string;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [open]);

  const handleView = () => {
    setOpen(false);
    router.push(viewHref);
  };
  const handleEdit = () => {
    setOpen(false);
    if (canEdit && editHref) router.push(editHref);
    else router.push(viewHref);
  };
  const handleDeleteClick = () => {
    setOpen(false);
    setModalOpen(true);
  };
  const closeModal = () => {
    if (!loading) {
      setModalOpen(false);
      setErrorMessage(null);
    }
  };
  const handleDeleteConfirm = async () => {
    if (!deleteEndpoint) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(deleteEndpoint, { method: "DELETE", headers });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErrorMessage(data?.error ?? "No se pudo completar la acción.");
        setLoading(false);
        return;
      }
      closeModal();
      onDeleted?.();
    } catch {
      setErrorMessage("Error de conexión. Inténtalo de nuevo.");
      setLoading(false);
    }
  };

  const showEdit = canEdit;
  const showDelete = canDelete && deleteEndpoint;

  return (
    <div className="relative flex items-center justify-end shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-600/60 bg-slate-800/40 text-slate-400 hover:bg-slate-700/60 hover:text-slate-300 transition-colors"
        title="Acciones"
        aria-label="Acciones"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-xl border border-slate-600/80 bg-slate-800 shadow-xl py-1">
          <button
            type="button"
            onClick={handleView}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700/80 transition-colors"
          >
            <Eye className="h-4 w-4 text-slate-500" />
            Ver
          </button>
          {showEdit && (
            <button
              type="button"
              onClick={handleEdit}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700/80 transition-colors"
            >
              <Pencil className="h-4 w-4 text-slate-500" />
              Editar
            </button>
          )}
          {showDelete && (
            <button
              type="button"
              onClick={handleDeleteClick}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-300 hover:bg-slate-700/80 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </button>
          )}
        </div>
      )}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={closeModal}
        >
          <div
            className="rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-100">Eliminar ticket</h3>
            <p className="mt-2 text-sm text-slate-400">
              ¿Seguro que quieres eliminar este ticket? Esta acción no se puede deshacer.
            </p>
            {errorMessage && (
              <p className="mt-3 text-sm text-red-400 bg-red-950/30 rounded-lg px-3 py-2">{errorMessage}</p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={loading}
                className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={loading}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {loading ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectTicketsPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = (params?.id ?? "") as string;

  useEffect(() => {
    if (searchParams?.get("new") === "1" && projectId) {
      router.replace(`/projects/${projectId}/tickets/new?from=quick`);
    }
  }, [searchParams, projectId, router]);

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<{ id: string; full_name: string | null; email: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [canManageTickets, setCanManageTickets] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    async function loadPermissions() {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/projects/${projectId}/permissions`, { headers });
      if (cancelled) return;
      const data = await res.json().catch(() => ({}));
      const perms = data as { canManageProjectTickets?: boolean };
      setCanManageTickets(perms.canManageProjectTickets ?? false);
    }
    loadPermissions();
    return () => { cancelled = true; };
  }, [projectId]);

  const loadTickets = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setErrorMsg(null);

    const [ticketsRes, membersRes] = await Promise.all([
      supabase
        .from("tickets")
        .select("id, title, priority, status, created_at, due_date, assigned_to")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("project_members")
        .select("profile_id, user_id")
        .eq("project_id", projectId),
    ]);

    if (ticketsRes.error) {
      handleSupabaseError("tickets", ticketsRes.error);
      if (hasLoggableSupabaseError(ticketsRes.error)) {
        setErrorMsg("No se pudieron cargar los tickets. Inténtalo de nuevo más tarde.");
      }
      setTickets([]);
    } else {
      const list = (ticketsRes.data ?? []) as TicketRow[];
      const today = new Date().toISOString().slice(0, 10);
      list.sort((a, b) => {
        const aOverdue = a.due_date && a.due_date < today && a.status !== "closed" && a.status !== "resolved";
        const bOverdue = b.due_date && b.due_date < today && b.status !== "closed" && b.status !== "resolved";
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setTickets(list);
    }

    const memberIds = (membersRes.data ?? [])
      .map((r: { profile_id?: string | null; user_id?: string | null }) => r.profile_id ?? r.user_id)
      .filter((id): id is string => id != null && id !== "");
    const assigneeIds = ticketsRes.data
      ? Array.from(new Set((ticketsRes.data as TicketRow[]).map((t) => t.assigned_to).filter((id): id is string => id != null && id !== "")))
      : [];
    const allIds = Array.from(new Set([...memberIds, ...assigneeIds]));
    if (allIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", allIds);
      setMemberProfiles((profilesData ?? []) as { id: string; full_name: string | null; email: string | null }[]);
    } else {
      setMemberProfiles([]);
    }

    setLoading(false);
  }, [projectId]);

  const profilesMap = useMemo(() => {
    const map = new Map<string, { full_name: string | null; email: string | null }>();
    memberProfiles.forEach((p) => map.set(p.id, { full_name: p.full_name, email: p.email }));
    tickets.forEach((t) => {
      if (t.assigned_to && !map.has(t.assigned_to)) {
        map.set(t.assigned_to, { full_name: null, email: null });
      }
    });
    return map;
  }, [memberProfiles, tickets]);

  const summary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let open = 0;
    let inProgress = 0;
    let overdue = 0;
    let unassigned = 0;
    tickets.forEach((t) => {
      if (t.status !== "closed" && t.status !== "resolved") open += 1;
      if (t.status === "in_progress") inProgress += 1;
      if (t.due_date && t.due_date < today && t.status !== "closed" && t.status !== "resolved") overdue += 1;
      if (!t.assigned_to) unassigned += 1;
    });
    return { open, inProgress, overdue, unassigned };
  }, [tickets]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  if (!projectId) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-slate-400">Identificador de proyecto no válido.</p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <header>
        <ProjectPageHeader
          variant="section"
          dark
          title="Tickets del proyecto"
          subtitle="Incidencias y solicitudes vinculadas a este proyecto."
          primaryActionLabel="Nuevo ticket"
          primaryActionHref={`/projects/${projectId}/tickets/new`}
        />
      </header>

      {errorMsg && (
        <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-slate-400">Abiertos</p>
            <p className="text-lg font-semibold text-slate-100 mt-0.5">{summary.open}</p>
          </div>
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-slate-400">En progreso</p>
            <p className="text-lg font-semibold text-slate-100 mt-0.5">{summary.inProgress}</p>
          </div>
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-slate-400">Vencidos</p>
            <p className="text-lg font-semibold text-slate-100 mt-0.5">{summary.overdue}</p>
          </div>
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-slate-400">Sin asignar</p>
            <p className="text-lg font-semibold text-slate-100 mt-0.5">{summary.unassigned}</p>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-lg shadow-black/5 ring-1 ring-slate-700/30 overflow-hidden">
        {loading ? (
          <div className="px-6 py-6">
            <TableSkeleton rows={6} colCount={7} />
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 py-16 px-6 flex flex-col items-center justify-center min-h-[200px] text-center">
            <p className="text-sm font-medium text-slate-300">No hay tickets en este proyecto</p>
            <p className="mt-1 text-xs text-slate-500 max-w-sm">Crea el primero con «Nuevo ticket» para hacer seguimiento de incidencias y solicitudes.</p>
            <Link
              href={`/projects/${projectId}/tickets/new`}
              className="mt-4 inline-flex items-center rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 transition-colors"
            >
              Crear primer ticket
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700/60 bg-slate-800/50">
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Título</th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-36">Asignado a</th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24">Prioridad</th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-28">Estado</th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-28">Fecha límite</th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-32">Fecha de creación</th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-28">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/tickets/${t.id}`)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/tickets/${t.id}`); } }}
                    className="cursor-pointer hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center font-medium text-slate-100">
                        <Ticket className="h-4 w-4 text-slate-500 mr-2 shrink-0" aria-hidden />
                        {t.title}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <AssigneeCell profileId={t.assigned_to} profilesMap={profilesMap} />
                    </td>
                    <td className="px-5 py-3.5">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">
                      {t.due_date
                        ? new Date(t.due_date).toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">
                      {new Date(t.created_at).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <TicketRowActions
                        ticketId={t.id}
                        viewHref={`/tickets/${t.id}`}
                        editHref={`/tickets/${t.id}`}
                        canEdit={canManageTickets}
                        canDelete={canManageTickets}
                        deleteEndpoint={canManageTickets ? `/api/tickets/${t.id}` : undefined}
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
