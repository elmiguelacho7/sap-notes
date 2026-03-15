"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getTicketsListHref, getTicketDetailHref } from "@/lib/routes";
import { FileText, BookOpen, Link2, MessageSquare } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError, hasLoggableSupabaseError } from "@/lib/supabaseError";
import { addToRecent } from "@/components/command-palette/recentStore";
import type { Ticket, TicketPriority, TicketStatus } from "@/lib/types/ticketTypes";
import type { TicketDetailRow, TicketCommentDetail, TicketReference } from "@/components/tickets/ticketTypes";
import { ObjectActions } from "@/components/ObjectActions";
import TicketCommentsPanel from "@/components/tickets/TicketCommentsPanel";

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

export default function TicketDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = (params?.id ?? "") as string;
  const projectIdFromQuery = searchParams?.get("projectId") ?? null;

  const [ticket, setTicket] = useState<TicketDetailRow | null>(null);
  const [assigneeLabel, setAssigneeLabel] = useState<string | null>(null);
  const [comments, setComments] = useState<TicketCommentDetail[]>([]);
  const [references, setReferences] = useState<TicketReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appRole, setAppRole] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [solutionMarkdown, setSolutionMarkdown] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [resolutionType, setResolutionType] = useState("");
  const [savingSolution, setSavingSolution] = useState(false);
  const [converting, setConverting] = useState(false);

  const loadTicket = useCallback(async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("tickets")
      .select("id, title, description, priority, status, project_id, due_date, created_at, updated_at, assigned_to, solution_markdown, root_cause, resolution_type, knowledge_page_id")
      .eq("id", id)
      .single();

    if (error) {
      handleSupabaseError("tickets", error);
      if (hasLoggableSupabaseError(error)) {
        setErrorMsg("No se pudo cargar el ticket. Inténtalo de nuevo más tarde.");
      }
      setTicket(null);
      setAssigneeLabel(null);
    } else {
      const row = data as TicketDetailRow;
      setTicket(row);
      setSolutionMarkdown(row.solution_markdown ?? "");
      setRootCause(row.root_cause ?? "");
      setResolutionType(row.resolution_type ?? "");
      const assignedTo = (data as { assigned_to?: string | null }).assigned_to;
      if (assignedTo) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", assignedTo)
          .single();
        const p = profile as { full_name?: string | null; email?: string | null } | null;
        setAssigneeLabel(p ? (p.full_name ?? p.email ?? null) : null);
      } else {
        setAssigneeLabel(null);
      }
    }
    setLoading(false);
  }, [id]);

  const loadComments = useCallback(async () => {
    if (!id) return;
    const { data: rows } = await supabase
      .from("ticket_comments")
      .select("id, ticket_id, author_id, content, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });
    if (!rows?.length) {
      setComments([]);
      return;
    }
    const authorIds = Array.from(new Set((rows as { author_id: string }[]).map((r) => r.author_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", authorIds);
    const nameBy = (profiles ?? []).reduce(
      (acc, p) => {
        acc[p.id] = (p as { full_name?: string | null; email?: string }).full_name ?? (p as { email?: string }).email ?? null;
        return acc;
      },
      {} as Record<string, string | null>
    );
    setComments(
      (rows as { id: string; ticket_id: string; author_id: string; content: string; created_at: string }[]).map(
        (r) => ({
          id: r.id,
          ticket_id: r.ticket_id,
          author_id: r.author_id,
          content: r.content,
          created_at: r.created_at,
          author_name: nameBy[r.author_id] ?? null,
        })
      )
    );
  }, [id]);

  const loadReferences = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("ticket_references")
      .select("id, ticket_id, type, value, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });
    setReferences((data ?? []) as TicketReference[]);
  }, [id]);

  useEffect(() => {
    void loadTicket();
  }, [loadTicket]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  useEffect(() => {
    void loadReferences();
  }, [loadReferences]);

  useEffect(() => {
    if (ticket?.id && ticket?.title != null) {
      addToRecent({
        type: "ticket",
        id: ticket.id,
        title: ticket.title || "Sin título",
        href: `/tickets/${ticket.id}`,
      });
    }
  }, [ticket?.id, ticket?.title]);

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

  const getAuthHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, []);

  const handleCloseTicket = useCallback(async () => {
    if (!id || closing) return;
    setClosing(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "closed" }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErrorMsg(json?.error ?? "No se pudo cerrar el ticket.");
        setClosing(false);
        return;
      }
      await loadTicket();
    } catch {
      setErrorMsg("No se pudo cerrar el ticket.");
    } finally {
      setClosing(false);
    }
  }, [id, closing, loadTicket, getAuthHeaders]);

  const handleSaveSolution = useCallback(async () => {
    if (!id || savingSolution) return;
    setSavingSolution(true);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          solution_markdown: solutionMarkdown || null,
          root_cause: rootCause || null,
          resolution_type: resolutionType || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErrorMsg(json?.error ?? "No se pudo guardar.");
      } else {
        await loadTicket();
      }
    } catch {
      setErrorMsg("No se pudo guardar la solución.");
    } finally {
      setSavingSolution(false);
    }
  }, [id, savingSolution, ticket?.project_id, solutionMarkdown, rootCause, resolutionType, getAuthHeaders, loadTicket]);

  const handleConvertToKnowledge = useCallback(async () => {
    if (!id || converting || !ticket?.project_id) return;
    setConverting(true);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/tickets/${id}/convert-to-knowledge`, {
        method: "POST",
        headers,
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; knowledge_page_id?: string };
      if (!res.ok) {
        setErrorMsg(json?.error ?? "No se pudo convertir.");
      } else {
        await loadTicket();
      }
    } catch {
      setErrorMsg("No se pudo convertir en página de conocimiento.");
    } finally {
      setConverting(false);
    }
  }, [id, converting, ticket?.project_id, getAuthHeaders, loadTicket]);

  const backHref = getTicketsListHref(ticket?.project_id ?? projectIdFromQuery);

  if (!id) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <p className="text-sm text-slate-600">
          No se ha encontrado el identificador del ticket.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          Cargando ticket…
        </div>
      </div>
    );
  }

  if (errorMsg && !ticket) {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        <Link
          href={backHref}
          className="inline-flex items-center text-[11px] text-slate-500 hover:text-slate-700"
        >
          ← Volver a tickets
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        <Link
          href={backHref}
          className="inline-flex items-center text-[11px] text-slate-500 hover:text-slate-700"
        >
          ← Volver a tickets
        </Link>
        <p className="text-sm text-slate-600">No se encontró el ticket.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center text-[11px] text-slate-500 hover:text-slate-700"
        >
          ← Volver a tickets
        </Link>
      </div>

      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{ticket.title}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <PriorityBadge priority={(ticket.priority ?? "medium") as TicketPriority} />
                <StatusBadge status={(ticket.status ?? "open") as TicketStatus} />
                {ticket.project_id && (
                  <Link
                    href={`/projects/${ticket.project_id}`}
                    className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                  >
                    Vinculado al proyecto · Ver proyecto
                  </Link>
                )}
                <span className="text-[11px] text-slate-500">
                  Creado el {new Date(ticket.created_at).toLocaleDateString("es-ES")}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {ticket.status !== "closed" && (
                <button
                  type="button"
                  onClick={handleCloseTicket}
                  disabled={closing}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 h-8 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {closing ? "Cerrando…" : "Cerrar ticket"}
                </button>
              )}
              <ObjectActions
                entity="ticket"
                id={ticket.id}
                canEdit={false}
                canArchive={false}
                canDelete={appRole === "superadmin"}
                deleteEndpoint={appRole === "superadmin" ? `/api/tickets/${ticket.id}` : undefined}
                listPath={backHref}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Overview */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">Overview</h2>
        </div>
        <div className="px-4 py-4 space-y-4">
          {ticket.description && (
            <div>
              <h3 className="text-xs font-semibold text-slate-700 mb-1">Descripción</h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{ticket.description}</p>
            </div>
          )}
          <div>
            <h3 className="text-xs font-semibold text-slate-700 mb-1">Asignado a</h3>
            <p className="text-sm text-slate-600">{assigneeLabel ?? "Sin asignar"}</p>
          </div>
          {ticket.due_date && (
            <div>
              <h3 className="text-xs font-semibold text-slate-700 mb-1">Fecha límite</h3>
              <p className="text-sm text-slate-600">
                {new Date(ticket.due_date).toLocaleDateString("es-ES")}
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <span>Creado: {new Date(ticket.created_at).toLocaleString("es-ES")}</span>
            {ticket.updated_at && (
              <span>Actualizado: {new Date(ticket.updated_at).toLocaleString("es-ES")}</span>
            )}
          </div>
        </div>
      </section>

      {/* Discussion */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">Discussion</h2>
        </div>
        <TicketCommentsPanel
          ticketId={id}
          comments={comments}
          onCommentAdded={loadComments}
        />
      </section>

      {/* Solution */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">Solution</h2>
        </div>
        <div className="px-4 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Solution (Markdown)</label>
            <textarea
              value={solutionMarkdown}
              onChange={(e) => setSolutionMarkdown(e.target.value)}
              placeholder="Describe the solution in Markdown..."
              rows={8}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Root cause</label>
            <input
              type="text"
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              placeholder="Brief root cause"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Resolution type</label>
            <input
              type="text"
              value={resolutionType}
              onChange={(e) => setResolutionType(e.target.value)}
              placeholder="e.g. workaround, fix, configuration"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="button"
            onClick={handleSaveSolution}
            disabled={savingSolution}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {savingSolution ? "Guardando…" : "Save solution"}
          </button>
        </div>
      </section>

      {/* References */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 flex items-center gap-2">
          <Link2 className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">References</h2>
        </div>
        <div className="px-4 py-4">
          <ReferencesList
            ticketId={id}
            references={references}
            onRefresh={loadReferences}
          />
        </div>
      </section>

      {/* Knowledge */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">Knowledge</h2>
        </div>
        <div className="px-4 py-4">
          {ticket.knowledge_page_id ? (
            <Link
              href={`/knowledge/${ticket.knowledge_page_id}${(ticket.project_id ?? projectIdFromQuery) ? `?projectId=${ticket.project_id ?? projectIdFromQuery}` : ""}`}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
            >
              <BookOpen className="h-4 w-4" />
              Open Knowledge Page
            </Link>
          ) : ticket.project_id ? (
            <button
              type="button"
              onClick={handleConvertToKnowledge}
              disabled={converting}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-500 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {converting ? "Converting…" : "Convert to Knowledge Page"}
            </button>
          ) : (
            <p className="text-sm text-slate-500">Link a project to convert this ticket into a knowledge page.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function ReferencesList({
  ticketId,
  references,
  onRefresh,
}: {
  ticketId: string;
  references: TicketReference[];
  onRefresh: () => void;
}) {
  const [type, setType] = useState<TicketReference["type"]>("link");
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v || adding) return;
    setAdding(true);
    const { error } = await supabase.from("ticket_references").insert({
      ticket_id: ticketId,
      type,
      value: v,
    });
    setAdding(false);
    if (error) {
      console.error("ticket_references insert", error);
    } else {
      setValue("");
      onRefresh();
    }
  };

  const handleDelete = async (refId: string) => {
    setDeletingId(refId);
    await supabase.from("ticket_references").delete().eq("id", refId);
    setDeletingId(null);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {references.length === 0 ? (
        <p className="text-sm text-slate-500">No references yet.</p>
      ) : (
        <ul className="space-y-2">
          {references.map((ref) => (
            <li
              key={ref.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
            >
              <span className="text-[11px] font-medium text-slate-600 uppercase">{ref.type.replace("_", " ")}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-800" title={ref.value}>
                {ref.type === "link" && ref.value.startsWith("http") ? (
                  <a href={ref.value} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                    {ref.value}
                  </a>
                ) : (
                  ref.value
                )}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(ref.id)}
                disabled={deletingId === ref.id}
                className="text-xs text-slate-500 hover:text-red-600 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as TicketReference["type"])}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="sap_note">SAP Note</option>
          <option value="link">Link</option>
          <option value="document">Document</option>
        </select>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={type === "link" ? "https://..." : "Value"}
          className="min-w-[200px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={adding || !value.trim()}
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
        >
          {adding ? "Adding…" : "Add"}
        </button>
      </form>
    </div>
  );
}
