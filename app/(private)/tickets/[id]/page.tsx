"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { getTicketsListHref } from "@/lib/routes";
import { BookOpen } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError, hasLoggableSupabaseError } from "@/lib/supabaseError";
import { addToRecent } from "@/components/command-palette/recentStore";
import type { TicketPriority, TicketStatus } from "@/lib/types/ticketTypes";
import type { TicketDetailRow, TicketCommentDetail, TicketReference } from "@/components/tickets/ticketTypes";
import { ObjectActions } from "@/components/ObjectActions";
import TicketCommentsPanel from "@/components/tickets/TicketCommentsPanel";
import { AssigneeSelect } from "@/components/AssigneeSelect";

function PriorityBadge({ priority, label }: { priority: TicketPriority; label: string }) {
  const colors: Record<TicketPriority, string> = {
    low: "border border-slate-200/90 bg-slate-50 text-slate-700",
    medium: "border border-sky-200/90 bg-sky-50 text-sky-900",
    high: "border border-amber-200/90 bg-amber-50 text-amber-950",
    urgent: "border border-rose-200/90 bg-rose-50 text-rose-900",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${colors[priority]}`}
    >
      {label}
    </span>
  );
}

function StatusBadge({ status, label }: { status: TicketStatus; label: string }) {
  const colors: Record<TicketStatus, string> = {
    open: "border border-slate-200/90 bg-white text-slate-700",
    in_progress: "border border-sky-200/90 bg-sky-50 text-sky-900",
    pending: "border border-slate-200/90 bg-slate-50 text-slate-700",
    resolved: "border border-emerald-200/90 bg-emerald-50 text-emerald-900",
    closed: "border border-slate-200/90 bg-slate-50 text-slate-500",
    cancelled: "border border-rose-200/90 bg-rose-50 text-rose-900",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${colors[status]}`}
    >
      {label}
    </span>
  );
}

export default function TicketDetailPage() {
  const t = useTranslations("tickets.detail");
  const tStatus = useTranslations("tickets.status");
  const tPriority = useTranslations("tickets.priority");
  const locale = useLocale();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const params = useParams();
  const searchParams = useSearchParams();
  const id = (params?.id ?? "") as string;
  const projectIdFromQuery = searchParams?.get("projectId") ?? null;

  const [ticket, setTicket] = useState<TicketDetailRow | null>(null);
  const [assigneeLabel, setAssigneeLabel] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [savingAssignee, setSavingAssignee] = useState(false);
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
    try {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, title, description, priority, status, project_id, due_date, created_at, updated_at, assigned_to, solution_markdown, root_cause, resolution_type, knowledge_page_id")
        .eq("id", id)
        .single();

      if (error) {
        handleSupabaseError("tickets", error);
        if (hasLoggableSupabaseError(error)) {
          setErrorMsg(t("errors.loadTicket"));
        }
        setTicket(null);
        setAssigneeLabel(null);
      } else {
        const row = data as TicketDetailRow;
        setTicket(row);
        setSolutionMarkdown(row.solution_markdown ?? "");
        setRootCause(row.root_cause ?? "");
        setResolutionType(row.resolution_type ?? "");
        const nextAssignedTo = (data as { assigned_to?: string | null }).assigned_to ?? null;
        setAssignedTo(nextAssignedTo);
        if (nextAssignedTo) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", nextAssignedTo)
            .single();
          const p = profile as { full_name?: string | null; email?: string | null } | null;
          setAssigneeLabel(p ? (p.full_name ?? p.email ?? null) : null);
        } else {
          setAssigneeLabel(null);
        }
      }
    } catch (error) {
      console.error("Tickets error:", error);
      setErrorMsg(t("errors.loadTicket"));
      setTicket(null);
      setAssigneeLabel(null);
    } finally {
      setLoading(false);
    }
  }, [id, t]);

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
        title: ticket.title || t("untitled"),
        href: `/tickets/${ticket.id}`,
      });
    }
  }, [ticket?.id, ticket?.title, t]);

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
        setErrorMsg(json?.error ?? t("errors.closeFailed"));
        setClosing(false);
        return;
      }
      await loadTicket();
    } catch (error) {
      console.error("Tickets error:", error);
      setErrorMsg(t("errors.closeFailed"));
    } finally {
      setClosing(false);
    }
  }, [id, closing, loadTicket, getAuthHeaders, t]);

  const handleSaveAssignee = useCallback(async () => {
    if (!id || savingAssignee) return;
    setSavingAssignee(true);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ assigned_to: assignedTo ?? null }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErrorMsg(json?.error ?? t("errors.updateAssigneeFailed"));
      } else {
        await loadTicket();
      }
    } catch (error) {
      console.error("Tickets error:", error);
      setErrorMsg(t("errors.updateAssigneeFailed"));
    } finally {
      setSavingAssignee(false);
    }
  }, [id, assignedTo, savingAssignee, getAuthHeaders, loadTicket, t]);

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
        setErrorMsg(json?.error ?? t("errors.saveFailed"));
      } else {
        await loadTicket();
      }
    } catch (error) {
      console.error("Tickets error:", error);
      setErrorMsg(t("errors.saveSolutionFailed"));
    } finally {
      setSavingSolution(false);
    }
  }, [id, savingSolution, solutionMarkdown, rootCause, resolutionType, getAuthHeaders, loadTicket, t]);

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
        setErrorMsg(json?.error ?? t("errors.convertFailed"));
      } else {
        await loadTicket();
      }
    } catch (error) {
      console.error("Tickets error:", error);
      setErrorMsg(t("errors.convertKnowledgeFailed"));
    } finally {
      setConverting(false);
    }
  }, [id, converting, ticket?.project_id, getAuthHeaders, loadTicket, t]);

  const backHref = getTicketsListHref(ticket?.project_id ?? projectIdFromQuery);

  if (!id) {
    return (
      <div className="w-full min-w-0 rb-workspace-bg px-4 sm:px-5 lg:px-6 xl:px-8 2xl:px-10 py-8">
        <div className="mx-auto w-full max-w-7xl">
          <p className="text-sm text-slate-600">
          {t("missingId")}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full min-w-0 rb-workspace-bg px-4 sm:px-5 lg:px-6 xl:px-8 2xl:px-10 py-8">
        <div className="mx-auto w-full max-w-7xl">
          <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm ring-1 ring-slate-100">
            {t("loading")}
          </div>
        </div>
      </div>
    );
  }

  if (errorMsg && !ticket) {
    return (
      <div className="w-full min-w-0 rb-workspace-bg px-4 sm:px-5 lg:px-6 xl:px-8 2xl:px-10 py-8">
        <div className="mx-auto w-full max-w-7xl space-y-4">
          <Link
            href={backHref}
            className="inline-flex items-center text-[11px] text-slate-500 hover:text-slate-900"
          >
            {t("backToTickets")}
          </Link>
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm ring-1 ring-red-100">
            {errorMsg}
          </div>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="w-full min-w-0 rb-workspace-bg px-4 sm:px-5 lg:px-6 xl:px-8 2xl:px-10 py-8">
        <div className="mx-auto w-full max-w-7xl space-y-4">
          <Link
            href={backHref}
            className="inline-flex items-center text-[11px] text-slate-500 hover:text-slate-900"
          >
            {t("backToTickets")}
          </Link>
          <p className="text-sm text-slate-600">{t("notFound")}</p>
        </div>
      </div>
    );
  }

  const cardClass =
    "rounded-2xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-sm ring-1 ring-slate-100";
  const inputClass =
    "w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/25 focus:border-[rgb(var(--rb-brand-primary))]/30";
  const softPanelClass =
    "rounded-2xl border border-[rgb(var(--rb-surface-border))]/75 bg-[rgb(var(--rb-surface-2))]/55 p-4 shadow-sm ring-1 ring-slate-100";
  const railCardClass =
    "rounded-2xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-sm ring-1 ring-slate-100";

  return (
    <div className="w-full min-w-0 rb-workspace-bg px-4 sm:px-6 lg:px-8 2xl:px-10 py-6">
      <div className="mx-auto w-full max-w-[96rem] space-y-6">
        <nav className="flex items-center justify-between gap-3">
          <Link
            href={backHref}
            className="inline-flex items-center text-[11px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            {t("backToTickets")}
          </Link>
          {ticket.project_id ? (
            <Link
              href={`/projects/${ticket.project_id}/tickets`}
              className="inline-flex items-center text-[11px] font-medium text-[rgb(var(--rb-brand-primary-active))] hover:text-[rgb(var(--rb-brand-primary-hover))] transition-colors"
            >
              {t("linkedProject")}
            </Link>
          ) : null}
        </nav>

        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm ring-1 ring-red-100">
            {errorMsg}
          </div>
        )}

        <section className="rounded-3xl border border-slate-200/90 bg-white p-7 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-[2.15rem] font-semibold tracking-tight text-slate-900 truncate">
                {ticket.title}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <PriorityBadge
                  priority={(ticket.priority ?? "medium") as TicketPriority}
                  label={tPriority((ticket.priority ?? "medium") as TicketPriority)}
                />
                <StatusBadge
                  status={(ticket.status ?? "open") as TicketStatus}
                  label={tStatus((ticket.status ?? "open") as TicketStatus)}
                />
                {ticket.project_id ? (
                  <Link
                    href={`/projects/${ticket.project_id}`}
                    className="inline-flex items-center rounded-full bg-[rgb(var(--rb-brand-surface))] px-2.5 py-0.5 text-[11px] font-medium text-[rgb(var(--rb-brand-primary-active))] ring-1 ring-inset ring-[rgb(var(--rb-brand-primary))]/18 hover:bg-[rgb(var(--rb-brand-surface))]/80 transition-colors"
                  >
                    {t("linkedProject")}
                  </Link>
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 ring-1 ring-slate-100">
                  <span className="font-semibold text-slate-600">{t("created")}</span>
                  <span className="tabular-nums text-slate-500">{new Date(ticket.created_at).toLocaleString(localeTag)}</span>
                </span>
                {ticket.due_date ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 ring-1 ring-slate-100">
                    <span className="font-semibold text-slate-600">{t("due")}</span>
                    <span className="tabular-nums text-slate-500">{new Date(ticket.due_date).toLocaleDateString(localeTag)}</span>
                  </span>
                ) : null}
                {ticket.updated_at ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 ring-1 ring-slate-100">
                    <span className="font-semibold text-slate-600">{t("updated")}</span>
                    <span className="tabular-nums text-slate-500">{new Date(ticket.updated_at).toLocaleString(localeTag)}</span>
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {ticket.status !== "closed" && (
                <button
                  type="button"
                  onClick={handleCloseTicket}
                  disabled={closing}
                  className="inline-flex items-center rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30"
                >
                  {closing ? t("closing") : t("closeTicket")}
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
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-7">
            <section className={cardClass}>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Overview</h2>
                <p className="text-xs text-slate-500">{t("overviewSubtitle")}</p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-slate-500">{t("description")}</h3>
                {ticket.description ? (
                  <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 px-3 py-3 text-sm text-slate-700 whitespace-pre-wrap min-h-[120px] ring-1 ring-slate-100">
                    {ticket.description}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">{t("noDescription")}</p>
                )}
              </div>
            </section>

            <section className={cardClass}>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Comments</h2>
                <p className="text-xs text-slate-500">{t("commentsSubtitle")}</p>
              </div>
              <TicketCommentsPanel
                ticketId={id}
                comments={comments}
                onCommentAdded={loadComments}
              />
            </section>
          </div>

          <div className="space-y-5">
            <section className={railCardClass}>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Assignment</h2>
                <p className="text-xs text-slate-500">{t("assignmentSubtitle")}</p>
              </div>
              <div className="space-y-3">
                <AssigneeSelect
                  contextType={ticket.project_id ? "project" : "global"}
                  projectId={ticket.project_id ?? undefined}
                  value={assignedTo}
                  onChange={setAssignedTo}
                  placeholder={t("unassigned")}
                  className="w-full"
                  appearance="light"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveAssignee}
                    disabled={savingAssignee}
                    className="inline-flex items-center rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30"
                  >
                    {savingAssignee ? t("saving") : t("saveAssignee")}
                  </button>
                </div>
              </div>
            </section>

            <section className={railCardClass}>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Resolution</h2>
                <p className="text-xs text-slate-500">Causa raíz y resolución del incidente.</p>
              </div>
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Root cause</label>
                  <input
                    type="text"
                    value={rootCause}
                    onChange={(e) => setRootCause(e.target.value)}
                    placeholder={t("rootCausePlaceholder")}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Resolution type</label>
                  <input
                    type="text"
                    value={resolutionType}
                    onChange={(e) => setResolutionType(e.target.value)}
                    placeholder={t("resolutionTypePlaceholder")}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Resolution summary</label>
                  <textarea
                    value={solutionMarkdown}
                    onChange={(e) => setSolutionMarkdown(e.target.value)}
                    placeholder={t("resolutionSummaryPlaceholder")}
                    className={`${inputClass} min-h-[140px] resize-y font-mono`}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveSolution}
                  disabled={savingSolution}
                  className="inline-flex items-center rounded-xl rb-btn-primary px-3 py-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  {savingSolution ? t("saving") : t("saveResolution")}
                </button>
              </div>
            </section>

            <section className={railCardClass}>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">References</h2>
                <p className="text-xs text-slate-500">{t("referencesSubtitle")}</p>
              </div>
              <ReferencesList
                ticketId={id}
                references={references}
                onRefresh={loadReferences}
              />
            </section>

            <section className={railCardClass}>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Knowledge</h2>
                <p className="text-xs text-slate-500">
                  {t("knowledgeSubtitle")}
                </p>
              </div>
              {ticket.knowledge_page_id ? (
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-500">
                    {t("knowledgeAlreadyLinked")}
                  </p>
                  <Link
                    href={`/knowledge/${ticket.knowledge_page_id}${(ticket.project_id ?? projectIdFromQuery) ? `?projectId=${ticket.project_id ?? projectIdFromQuery}` : ""}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2 text-sm font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-2))]/60 hover:text-[rgb(var(--rb-text-primary))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30"
                  >
                    <BookOpen className="h-4 w-4" />
                    Open Knowledge Page
                  </Link>
                </div>
              ) : ticket.project_id ? (
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-500">
                    {t("knowledgePublishHint")}
                  </p>
                  <button
                    type="button"
                    onClick={handleConvertToKnowledge}
                    disabled={converting}
                    className="inline-flex items-center gap-2 rounded-xl rb-btn-primary px-3 py-2 text-sm font-medium transition-colors duration-150 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2"
                  >
                    {converting ? t("converting") : t("convertToKnowledge")}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  {t("knowledgeNeedsProject")}
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
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
  const t = useTranslations("tickets.detail.references");
  const [type, setType] = useState<TicketReference["type"]>("link");
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const softPanelClass =
    "rounded-2xl border border-[rgb(var(--rb-surface-border))]/75 bg-[rgb(var(--rb-surface-2))]/55 p-4 shadow-sm ring-1 ring-slate-100";

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
    <div className="space-y-3">
      {references.length === 0 ? (
        <p className="text-sm text-slate-500">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {references.map((ref) => (
            <li
              key={ref.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100"
            >
              <span className="text-[11px] font-semibold text-slate-500 uppercase">{ref.type.replace("_", " ")}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700" title={ref.value}>
                {ref.type === "link" && ref.value.startsWith("http") ? (
                  <a
                    href={ref.value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[rgb(var(--rb-brand-primary-active))] hover:text-[rgb(var(--rb-brand-primary-hover))] hover:underline"
                  >
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
                className="text-xs text-slate-500 hover:text-red-700 disabled:opacity-50"
              >
                {t("remove")}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={handleAdd}
        className={softPanelClass}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_minmax(0,1fr)]">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TicketReference["type"])}
            className="h-10 rounded-xl border border-slate-200/90 bg-white px-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/25 focus:border-[rgb(var(--rb-brand-primary))]/30"
          >
            <option value="sap_note">SAP Note</option>
            <option value="link">Link</option>
            <option value="document">{t("document")}</option>
          </select>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={type === "link" ? "https://..." : t("value")}
            className="w-full h-10 rounded-xl border border-slate-200/90 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/25 focus:border-[rgb(var(--rb-brand-primary))]/30"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={adding || !value.trim()}
            className="h-10 rounded-xl rb-btn-primary px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {adding ? t("adding") : t("add")}
          </button>
        </div>
      </form>
    </div>
  );
}
