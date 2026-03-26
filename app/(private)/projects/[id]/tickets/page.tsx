"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Ticket, Search, Plus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";
import { handleSupabaseError, hasLoggableSupabaseError } from "@/lib/supabaseError";
import { getTicketDetailHref } from "@/lib/routes";
import type { TicketPriority, TicketStatus } from "@/lib/types/ticketTypes";
import { AssigneeCell } from "@/components/AssigneeCell";
import { ModuleKpiCard, ModuleKpiRow, ModuleToolbar, ModuleContentCard } from "@/components/layout/module";
import { TicketRowActions } from "@/components/tickets/TicketRowActions";
import {
  getTicketDuePresentation,
  type TaskDuePresentationLabels,
} from "@/app/components/taskDuePresentation";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  PROJECT_WORKSPACE_PAGE,
  PROJECT_WORKSPACE_HERO,
  PROJECT_WORKSPACE_TOOLBAR,
  PROJECT_WORKSPACE_SEARCH_INPUT,
  PROJECT_WORKSPACE_FILTER_PILL,
  PROJECT_WORKSPACE_FILTER_PILL_ACTIVE,
  PROJECT_WORKSPACE_EMPTY,
  PROJECT_WORKSPACE_TABLE_HEAD_ROW,
  PROJECT_WORKSPACE_TABLE_HEAD_CELL,
  PROJECT_WORKSPACE_TABLE_BODY,
  PROJECT_WORKSPACE_TABLE_ROW,
} from "@/lib/projectWorkspaceUi";

type FilterKind = "all" | "open" | "in_progress" | "closed" | "overdue" | "unassigned" | "my_tickets";

const FILTER_KEYS: FilterKind[] = [
  "all",
  "open",
  "in_progress",
  "closed",
  "overdue",
  "unassigned",
  "my_tickets",
];

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
  const t = useTranslations("tickets.priority");
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
      {t(priority)}
    </span>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const t = useTranslations("tickets.status");
  const colors: Record<string, string> = {
    open: "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200/80",
    in_progress:
      "bg-[rgb(var(--rb-brand-surface))] text-[rgb(var(--rb-brand-primary-active))] ring-1 ring-inset ring-[rgb(var(--rb-brand-primary))]/18",
    pending: "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200/80",
    resolved: "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200/80",
    closed: "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200/80",
    cancelled: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/90",
  };
  const label =
    status === "open" ||
    status === "in_progress" ||
    status === "pending" ||
    status === "resolved" ||
    status === "closed" ||
    status === "cancelled"
      ? t(status)
      : status;
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        colors[status] ?? "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/90"
      }`}
    >
      {label}
    </span>
  );
}

function DueDateCell({ ticket }: { ticket: TicketRow }) {
  const tDue = useTranslations("tickets.due");
  const tCommon = useTranslations("tickets");
  const locale = useLocale();
  const closedDateLocale = locale === "es" ? "es-ES" : "en-US";
  const labels: TaskDuePresentationLabels = useMemo(
    () => ({
      overdue: tDue("overdue"),
      dueToday: tDue("dueToday"),
      dueTomorrow: tDue("dueTomorrow"),
      inDays: (n: number) => tDue("inDays", { n }),
      limit: tDue("limit"),
    }),
    [tDue]
  );
  const pres = getTicketDuePresentation(ticket.due_date, ticket.status, labels, closedDateLocale, "light");
  if (!pres) {
    return <span className="text-slate-400 tabular-nums">{tCommon("emDash")}</span>;
  }
  return (
    <span className={`text-[13px] leading-tight tabular-nums flex flex-col gap-0 ${pres.className}`}>
      <span className="font-medium">{pres.line}</span>
      {pres.sub ? <span className="text-[11px] font-normal opacity-90">{pres.sub}</span> : null}
    </span>
  );
}

function KpiSkeletonRow() {
  return (
    <ModuleKpiRow>
      {[1, 2, 3, 4].map((i) => (
        <Skeleton
          key={i}
          className="h-[72px] w-full rounded-xl border border-slate-200/90 bg-slate-100/80 ring-1 ring-slate-100"
        />
      ))}
    </ModuleKpiRow>
  );
}

function FilterToolbarSkeleton() {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-10 w-full lg:w-64 rounded-xl" />
    </div>
  );
}

export default function ProjectTicketsPage() {
  const tr = useTranslations("tickets");
  const locale = useLocale();
  const dateLocaleTag = locale === "es" ? "es-ES" : "en-US";
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = (params?.id ?? "") as string;

  const filterPills = useMemo(
    () => FILTER_KEYS.map((key) => ({ key, label: tr(`filters.${key}`) })),
    [tr]
  );

  const formatListDate = useCallback(
    (iso: string) =>
      new Date(iso).toLocaleDateString(dateLocaleTag, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    [dateLocaleTag]
  );

  useEffect(() => {
    if (searchParams?.get("new") === "1" && projectId) {
      router.replace(`/projects/${projectId}/tickets/new?from=quick`);
    }
  }, [searchParams, projectId, router]);

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<
    { id: string; full_name: string | null; email: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [canManageTickets, setCanManageTickets] = useState(false);
  const [filter, setFilter] = useState<FilterKind>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    async function loadPermissionsAndProfile() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const permRes = await fetch(`/api/projects/${projectId}/permissions`, { headers });
      if (cancelled) return;
      const permData = await permRes.json().catch(() => ({}));
      const perms = permData as { canManageProjectTickets?: boolean };
      setCanManageTickets(perms.canManageProjectTickets ?? false);
      if (session?.user?.id) setCurrentUserId(session.user.id);
      else setCurrentUserId(null);
    }
    loadPermissionsAndProfile();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const loadTickets = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [ticketsRes, membersRes] = await Promise.all([
        supabase
          .from("tickets")
          .select("id, title, description, priority, status, created_at, due_date, assigned_to")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false }),
        supabase.from("project_members").select("profile_id, user_id").eq("project_id", projectId),
      ]);

      if (ticketsRes.error) {
        handleSupabaseError("tickets", ticketsRes.error);
        if (hasLoggableSupabaseError(ticketsRes.error)) {
          setErrorMsg(tr("project.loadError"));
        }
        setTickets([]);
      } else {
        const list = (ticketsRes.data ?? []) as TicketRow[];
        const today = new Date().toISOString().slice(0, 10);
        list.sort((a, b) => {
          const aOverdue =
            a.due_date && a.due_date < today && a.status !== "closed" && a.status !== "resolved";
          const bOverdue =
            b.due_date && b.due_date < today && b.status !== "closed" && b.status !== "resolved";
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
        ? Array.from(
            new Set(
              (ticketsRes.data as TicketRow[])
                .map((t) => t.assigned_to)
                .filter((id): id is string => id != null && id !== "")
            )
          )
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
    } catch (error) {
      console.error("Tickets error:", error);
      setErrorMsg(tr("project.loadError"));
      setTickets([]);
      setMemberProfiles([]);
    }

    setLoading(false);
  }, [projectId, tr]);

  const profilesMap = useMemo(() => {
    const map = new Map<string, { id: string; full_name: string | null; email: string | null }>();
    memberProfiles.forEach((p) => map.set(p.id, { id: p.id, full_name: p.full_name, email: p.email }));
    tickets.forEach((t) => {
      if (t.assigned_to && !map.has(t.assigned_to)) {
        map.set(t.assigned_to, { id: t.assigned_to, full_name: null, email: null });
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

  useEffect(() => {
    // Carga inicial y cuando cambia projectId (loadTickets en deps)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch de lista; patrón estándar en páginas cliente
    void loadTickets();
  }, [loadTickets]);

  const filterToolbar = (
    <ModuleToolbar
      left={filterPills.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => setFilter(key)}
          className={filter === key ? PROJECT_WORKSPACE_FILTER_PILL_ACTIVE : PROJECT_WORKSPACE_FILTER_PILL}
        >
          {label}
        </button>
      ))}
      right={
        <label className="relative block w-full lg:min-w-[220px]">
          <span className="sr-only">{tr("project.searchAria")}</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            placeholder={tr("project.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={PROJECT_WORKSPACE_SEARCH_INPUT}
          />
        </label>
      }
    />
  );

  if (!projectId) {
    return (
      <div className={PROJECT_WORKSPACE_PAGE}>
        <p className="text-sm text-slate-500">{tr("project.invalidProjectId")}</p>
      </div>
    );
  }

  return (
    <div className={PROJECT_WORKSPACE_PAGE}>
      <div className={PROJECT_WORKSPACE_HERO}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between min-w-0">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {tr("project.eyebrow")}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.65rem]">
              {tr("project.title")}
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">{tr("project.subtitle")}</p>
          </div>
          <Link
            href={`/projects/${projectId}/tickets/new`}
            className="inline-flex items-center justify-center gap-2 rounded-xl rb-btn-primary px-4 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2 shrink-0"
          >
            <Plus className="h-4 w-4 shrink-0" />
            {tr("project.createTicket")}
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <KpiSkeletonRow />
      ) : (
        <ModuleKpiRow>
          <ModuleKpiCard tone="light" label={tr("project.kpi.open")} value={summary.open} />
          <ModuleKpiCard tone="light" label={tr("project.kpi.inProgress")} value={summary.inProgress} />
          <ModuleKpiCard
            tone="light"
            label={tr("project.kpi.overdue")}
            value={summary.overdue}
            valueClassName={summary.overdue > 0 ? "!text-amber-700" : ""}
          />
          <ModuleKpiCard
            tone="light"
            label={tr("project.kpi.unassigned")}
            value={summary.unassigned}
            valueClassName={summary.unassigned > 0 ? "!text-slate-800" : ""}
          />
        </ModuleKpiRow>
      )}

      {(loading || tickets.length > 0) && (
        <div className={PROJECT_WORKSPACE_TOOLBAR}>
          {loading ? <FilterToolbarSkeleton /> : filterToolbar}
        </div>
      )}

      <ModuleContentCard tone="light">
        {loading ? (
          <div className="py-6 px-5">
            <TableSkeleton rows={6} colCount={7} />
          </div>
        ) : tickets.length === 0 ? (
          <div className={`${PROJECT_WORKSPACE_EMPTY} min-h-[200px]`}>
            <p className="text-base font-semibold tracking-tight text-slate-900">{tr("project.empty.title")}</p>
            <p className="mt-2 text-sm text-slate-600 max-w-md leading-relaxed">
              {tr("project.empty.description")}
            </p>
            <Link
              href={`/projects/${projectId}/tickets/new`}
              className="mt-6 inline-flex items-center gap-2 rounded-xl rb-btn-primary px-4 py-2.5 text-sm font-medium transition-colors"
            >
              <Plus className="h-4 w-4 shrink-0" />
              {tr("project.createFirstTicket")}
            </Link>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className={`${PROJECT_WORKSPACE_EMPTY} min-h-[160px] py-12`}>
            <p className="text-sm font-semibold text-slate-800">{tr("project.filteredEmpty.title")}</p>
            <p className="mt-1.5 text-xs text-slate-600 max-w-sm leading-relaxed">
              {tr("project.filteredEmpty.description")}
            </p>
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-slate-100">
              {filteredTickets.map((tk) => (
                <div
                  key={tk.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(getTicketDetailHref(tk.id, projectId))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(getTicketDetailHref(tk.id, projectId));
                    }
                  }}
                  className="w-full text-left px-4 py-4 hover:bg-slate-50/90 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--rb-brand-ring))]/25"
                >
                  <div className="flex items-start gap-3">
                    <Ticket className="h-4 w-4 text-slate-400 shrink-0 mt-1" aria-hidden />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <p className="text-[15px] font-semibold leading-snug text-slate-900 line-clamp-2">{tk.title}</p>
                        {tk.description && (
                          <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">{tk.description}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <AssigneeCell profileId={tk.assigned_to} profilesMap={profilesMap} tone="light" />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <PriorityBadge priority={tk.priority} />
                        <StatusBadge status={tk.status} />
                      </div>
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-slate-600">
                        <span>
                          {tk.due_date ? (
                            <DueDateCell ticket={tk} />
                          ) : (
                            <span className="text-slate-500">{tr("project.noDueDate")}</span>
                          )}
                        </span>
                        <span className="text-slate-500 tabular-nums">
                          {tr("project.createdMeta")}{" "}
                          {formatListDate(tk.created_at)}
                        </span>
                      </div>
                      <div className="flex justify-end pt-1" onClick={(e) => e.stopPropagation()}>
                        <TicketRowActions
                          tone="light"
                          viewHref={getTicketDetailHref(tk.id, projectId)}
                          editHref={getTicketDetailHref(tk.id, projectId)}
                          canEdit={canManageTickets}
                          canDelete={canManageTickets}
                          deleteEndpoint={canManageTickets ? `/api/tickets/${tk.id}` : undefined}
                          onDeleted={loadTickets}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto min-w-0">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className={PROJECT_WORKSPACE_TABLE_HEAD_ROW}>
                    <th className={`${PROJECT_WORKSPACE_TABLE_HEAD_CELL} pl-6`}>
                      {tr("project.table.title")}
                    </th>
                    <th className={`${PROJECT_WORKSPACE_TABLE_HEAD_CELL} w-40`}>
                      {tr("project.table.assignee")}
                    </th>
                    <th className={`${PROJECT_WORKSPACE_TABLE_HEAD_CELL} w-28`}>
                      {tr("project.table.priority")}
                    </th>
                    <th className={`${PROJECT_WORKSPACE_TABLE_HEAD_CELL} w-32`}>
                      {tr("project.table.status")}
                    </th>
                    <th className={`${PROJECT_WORKSPACE_TABLE_HEAD_CELL} w-36`}>
                      {tr("project.table.dueDate")}
                    </th>
                    <th className={`${PROJECT_WORKSPACE_TABLE_HEAD_CELL} w-32`}>
                      {tr("project.table.created")}
                    </th>
                    <th className="px-5 py-3 text-right w-24">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                        {tr("project.table.actions")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className={PROJECT_WORKSPACE_TABLE_BODY}>
                  {filteredTickets.map((tk) => (
                    <tr
                      key={tk.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(getTicketDetailHref(tk.id, projectId))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(getTicketDetailHref(tk.id, projectId));
                        }
                      }}
                      className={PROJECT_WORKSPACE_TABLE_ROW}
                    >
                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-col gap-1 min-w-0 max-w-md">
                          <span className="inline-flex items-start gap-2 text-[15px] font-semibold leading-snug text-slate-900">
                            <Ticket className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" aria-hidden />
                            <span className="min-w-0">{tk.title}</span>
                          </span>
                          {tk.description && (
                            <span className="text-xs text-slate-600 line-clamp-1 pl-6 leading-relaxed">{tk.description}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <AssigneeCell profileId={tk.assigned_to} profilesMap={profilesMap} tone="light" />
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <PriorityBadge priority={tk.priority} />
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <StatusBadge status={tk.status} />
                      </td>
                      <td className="px-5 py-4 align-top">
                        <DueDateCell ticket={tk} />
                      </td>
                      <td className="px-5 py-4 align-middle text-xs text-slate-600 tabular-nums">
                        {formatListDate(tk.created_at)}
                      </td>
                      <td
                        className="px-4 py-4 align-middle text-right opacity-90 hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <TicketRowActions
                          tone="light"
                          viewHref={getTicketDetailHref(tk.id, projectId)}
                          editHref={getTicketDetailHref(tk.id, projectId)}
                          canEdit={canManageTickets}
                          canDelete={canManageTickets}
                          deleteEndpoint={canManageTickets ? `/api/tickets/${tk.id}` : undefined}
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
  );
}
