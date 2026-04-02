"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, LayoutDashboard, FolderKanban, FileText, Brain, Activity, Calendar, ArrowUpRight, Globe, ListChecks, StickyNote, BookOpenText, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { PageShell } from "@/components/layout/PageShell";
import { getCountryDisplayName } from "@/lib/countryStateCity";
import type { TicketStatus } from "@/lib/types/ticketTypes";

type ClientRow = {
  id: string;
  name: string;
  legal_name?: string | null;
  display_name?: string | null;
  tax_id?: string | null;
  website?: string | null;
  linkedin_url?: string | null;
  industry?: string | null;
  subindustry?: string | null;
  company_size_bucket?: string | null;
  employee_range?: string | null;
  annual_revenue_range?: string | null;
  country?: string | null;
  region?: string | null;
  preferred_language?: string | null;
  timezone?: string | null;
  parent_client_id?: string | null;
  account_group?: string | null;
  account_tier?: string | null;
  ownership_type?: string | null;
  business_model?: string | null;
  main_products_services?: string | null;
  sap_relevance_summary?: string | null;
  known_pain_points?: string | null;
  strategic_notes?: string | null;
  is_active?: boolean | null;
  created_at?: string;
  created_by?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
};

type TabId = "overview" | "projects" | "notes" | "knowledge" | "activity";

async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : null;
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<ClientRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  type ProjectRow = {
    id: string;
    name: string;
    status: string | null;
    start_date: string | null;
    planned_end_date: string | null;
    created_at: string | null;
  };

  type NoteRow = {
    id: string;
    title: string;
    body: string | null;
    created_at: string;
    project_id: string | null;
    client_id?: string | null;
    deleted_at?: string | null;
  };

  type KnowledgePageRow = {
    id: string;
    title: string;
    summary: string | null;
    page_type: string | null;
    updated_at: string;
  };

  type ActivityItem = {
    kind: "project" | "ticket" | "task" | "note" | "knowledge";
    title: string;
    timestamp: string;
    href?: string;
    subtitle?: string;
  };

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectsLoaded, setProjectsLoaded] = useState(false);

  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [notesLoaded, setNotesLoaded] = useState(false);

  const [knowledgePages, setKnowledgePages] = useState<KnowledgePageRow[]>([]);
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);
  const [knowledgeLoaded, setKnowledgeLoaded] = useState(false);

  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityLoaded, setActivityLoaded] = useState(false);

  const [kpis, setKpis] = useState<{
    projects?: number;
    openTickets?: number;
    openTasks?: number;
    overdueItems?: number;
    notes?: number;
    knowledge?: number;
  }>({});
  const [loadingKpis, setLoadingKpis] = useState(false);

  const [portfolioLoaded, setPortfolioLoaded] = useState(false);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [projectTicketCounts, setProjectTicketCounts] = useState<Record<string, number>>({});
  const [projectTaskCounts, setProjectTaskCounts] = useState<Record<string, number>>({});
  const [projectNoteCounts, setProjectNoteCounts] = useState<Record<string, number>>({});
  const [knowledgeProjectByPageId, setKnowledgeProjectByPageId] = useState<Record<string, string>>({});

  const projectIds = useMemo(
    () => projects.map((p) => p.id).filter(Boolean),
    [projects]
  );

  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );

  const loadClient = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(`/api/admin/clients/${id}`, { headers });
      if (!res.ok) {
        if (res.status === 404) setError("Client not found.");
        else setError("Failed to load client.");
        setClient(null);
        return;
      }
      const data = (await res.json()) as { client?: ClientRow };
      setClient(data.client ?? null);
    } catch {
      setError("Connection error.");
      setClient(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadClient();
  }, [loadClient]);

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
  };

  const isPastDate = (iso: string | null | undefined) => {
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
  };

  const isTicketOpen = (status: TicketStatus) =>
    status !== "closed" && status !== "resolved" && status !== "cancelled";

  const isTaskOpen = (status: string | null | undefined) => {
    const s = (status ?? "").toLowerCase().trim();
    if (!s) return true;
    // Schema-safe heuristic (we don't have a canonical enum here).
    return !(s === "done" || s === "completed" || s === "closed" || s === "resolved" || s === "cancelled");
  };

  const loadProjects = useCallback(async () => {
    if (!id) return;
    setLoadingProjects(true);
    setProjectsError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("projects")
        .select("id, name, status, start_date, planned_end_date, created_at")
        .eq("client_id", id)
        .order("created_at", { ascending: false });

      if (qErr) throw qErr;
      setProjects((data ?? []) as ProjectRow[]);
    } catch {
      setProjects([]);
      setProjectsError("Failed to load projects.");
    } finally {
      setProjectsLoaded(true);
      setLoadingProjects(false);
    }
  }, [id]);

  // Load projects once after client is available (used for KPIs + tab derivations).
  useEffect(() => {
    if (!client?.id) return;
    void loadProjects();
  }, [client?.id, loadProjects]);

  const loadNotes = useCallback(async (opts?: { force?: boolean }) => {
    if (!id) return;
    if (!opts?.force && notesLoaded) return;
    setLoadingNotes(true);
    setNotesError(null);
    try {
      // Preferred: direct client relation (notes.client_id).
      let { data, error: qErr } = await supabase
        .from("notes")
        .select("id, title, body, created_at, project_id, client_id")
        .eq("client_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (qErr) throw qErr;
      const direct = (data ?? []) as NoteRow[];

      // Fallback: derive through projects when direct relation is not present/used.
      if (direct.length === 0) {
        if (projectIds.length > 0) {
          const res = await supabase
            .from("notes")
            .select("id, title, body, created_at, project_id, client_id")
            .in("project_id", projectIds)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(50);
          data = res.data;
          qErr = res.error;
          if (qErr) throw qErr;
          setNotes(((data ?? []) as NoteRow[]) ?? []);
          return;
        }
      }

      setNotes(direct);
    } catch {
      setNotes([]);
      setNotesError("Failed to load notes.");
    } finally {
      setNotesLoaded(true);
      setLoadingNotes(false);
    }
  }, [id, notesLoaded, projectIds]);

  const loadKnowledge = useCallback(async (opts?: { force?: boolean }) => {
    if (!id) return;
    if (!opts?.force && knowledgeLoaded) return;
    setLoadingKnowledge(true);
    setKnowledgeError(null);
    try {
      if (projectIds.length === 0) {
        setKnowledgePages([]);
        return;
      }

      const { data: links, error: linksError } = await supabase
        .from("knowledge_page_projects")
        .select("page_id, project_id")
        .in("project_id", projectIds)
        .limit(100);

      if (linksError) throw linksError;
      const pageIds = Array.from(
        new Set((links ?? []).map((r) => (r as { page_id: string }).page_id).filter(Boolean))
      );

      if (pageIds.length === 0) {
        setKnowledgePages([]);
        setKnowledgeProjectByPageId({});
        return;
      }

      const byPage: Record<string, string> = {};
      for (const row of (links ?? []) as { page_id: string; project_id: string }[]) {
        if (!byPage[row.page_id]) byPage[row.page_id] = row.project_id;
      }
      setKnowledgeProjectByPageId(byPage);

      const { data: pages, error: pagesError } = await supabase
        .from("knowledge_pages")
        .select("id, title, summary, page_type, updated_at")
        .in("id", pageIds)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (pagesError) throw pagesError;
      setKnowledgePages((pages ?? []) as KnowledgePageRow[]);
    } catch {
      setKnowledgePages([]);
      setKnowledgeError("Failed to load knowledge pages.");
    } finally {
      setKnowledgeLoaded(true);
      setLoadingKnowledge(false);
    }
  }, [id, knowledgeLoaded, projectIds]);

  const loadPortfolio = useCallback(async () => {
    if (!id) return;
    if (portfolioLoaded) return;
    if (projectIds.length === 0) {
      setProjectTicketCounts({});
      setProjectTaskCounts({});
      setProjectNoteCounts({});
      setKpis((prev) => ({
        ...prev,
        projects: projects.length,
        openTickets: 0,
        openTasks: 0,
        overdueItems: 0,
        notes: prev.notes ?? 0,
        knowledge: prev.knowledge ?? 0,
      }));
      setPortfolioLoaded(true);
      return;
    }

    setLoadingPortfolio(true);
    setPortfolioError(null);
    try {
      // Tickets (scoped to client projects)
      const ticketsRes = await supabase
        .from("tickets")
        .select("id, title, status, project_id, due_date, created_at, updated_at")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })
        .limit(500);

      // Tasks (scoped to client projects)
      const tasksRes = await supabase
        .from("project_tasks")
        .select("id, title, status, project_id, due_date, created_at, updated_at")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })
        .limit(800);

      // Notes (scoped to client projects) + direct client notes
      const [projectNotesRes, directNotesRes] = await Promise.all([
        supabase
          .from("notes")
          .select("id, project_id, client_id, created_at")
          .in("project_id", projectIds)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(800),
        supabase
          .from("notes")
          .select("id, project_id, client_id, created_at")
          .eq("client_id", id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(800),
      ]);

      // Knowledge links (unique pages across projects)
      const knowledgeLinksRes = await supabase
        .from("knowledge_page_projects")
        .select("page_id")
        .in("project_id", projectIds)
        .limit(1000);

      if (ticketsRes.error) throw ticketsRes.error;
      if (tasksRes.error) throw tasksRes.error;
      if (projectNotesRes.error) throw projectNotesRes.error;
      if (directNotesRes.error) throw directNotesRes.error;
      if (knowledgeLinksRes.error) throw knowledgeLinksRes.error;

      const tickets = (ticketsRes.data ?? []) as {
        id: string;
        status: TicketStatus;
        project_id: string | null;
        due_date: string | null;
        created_at: string;
        updated_at: string;
      }[];

      const tasks = (tasksRes.data ?? []) as {
        id: string;
        status: string | null;
        project_id: string | null;
        due_date: string | null;
        created_at: string;
        updated_at: string | null;
      }[];

      const noteIds = new Set<string>();
      const noteCounts: Record<string, number> = {};
      for (const row of [
        ...((projectNotesRes.data ?? []) as { id: string; project_id: string | null }[]),
        ...((directNotesRes.data ?? []) as { id: string; project_id: string | null }[]),
      ]) {
        if (noteIds.has(row.id)) continue;
        noteIds.add(row.id);
        if (row.project_id) {
          noteCounts[row.project_id] = (noteCounts[row.project_id] ?? 0) + 1;
        }
      }

      const ticketCounts: Record<string, number> = {};
      const taskCounts: Record<string, number> = {};
      let openTickets = 0;
      let openTasks = 0;
      let overdue = 0;

      for (const t of tickets) {
        if (!t.project_id) continue;
        if (isTicketOpen(t.status)) {
          openTickets += 1;
          ticketCounts[t.project_id] = (ticketCounts[t.project_id] ?? 0) + 1;
          if (isPastDate(t.due_date)) overdue += 1;
        }
      }

      for (const task of tasks) {
        if (!task.project_id) continue;
        if (isTaskOpen(task.status)) {
          openTasks += 1;
          taskCounts[task.project_id] = (taskCounts[task.project_id] ?? 0) + 1;
          if (isPastDate(task.due_date)) overdue += 1;
        }
      }

      const uniqueKnowledgePages = new Set(
        ((knowledgeLinksRes.data ?? []) as { page_id: string }[]).map((r) => r.page_id).filter(Boolean)
      );

      setProjectTicketCounts(ticketCounts);
      setProjectTaskCounts(taskCounts);
      setProjectNoteCounts(noteCounts);

      setKpis({
        projects: projects.length,
        openTickets,
        openTasks,
        overdueItems: overdue,
        notes: noteIds.size,
        knowledge: uniqueKnowledgePages.size,
      });
    } catch {
      setPortfolioError("Failed to load portfolio metrics.");
    } finally {
      setPortfolioLoaded(true);
      setLoadingPortfolio(false);
    }
  }, [id, portfolioLoaded, projectIds, projects.length]);

  const loadActivity = useCallback(async (opts?: { force?: boolean }) => {
    if (!id) return;
    if (!opts?.force && activityLoaded) return;
    setLoadingActivity(true);
    setActivityError(null);
    try {
      // Tickets + project tasks are the two most valuable “activity” sources here.
      const ticketsPromise =
        projectIds.length > 0
          ? supabase
              .from("tickets")
              .select("id, title, status, project_id, created_at, updated_at")
              .in("project_id", projectIds)
              .order("updated_at", { ascending: false })
              .limit(40)
          : Promise.resolve({ data: [], error: null } as { data: unknown[]; error: unknown });

      const tasksPromise =
        projectIds.length > 0
          ? supabase
              .from("project_tasks")
              .select("id, title, status, project_id, created_at, updated_at")
              .in("project_id", projectIds)
              .order("updated_at", { ascending: false })
              .limit(40)
          : Promise.resolve({ data: [], error: null } as { data: unknown[]; error: unknown });

      const [ticketsRes, tasksRes] = await Promise.all([ticketsPromise, tasksPromise]);
      if ((ticketsRes as { error?: unknown }).error) throw (ticketsRes as { error: unknown }).error;
      if ((tasksRes as { error?: unknown }).error) throw (tasksRes as { error: unknown }).error;

      const projectItems: ActivityItem[] = projects
        .filter((p) => p.created_at)
        .slice(0, 20)
        .map((p) => ({
          kind: "project",
          title: p.name,
          subtitle: "Project updated",
          timestamp: p.created_at as string,
          href: `/projects/${p.id}`,
        }));

      const ticketItems: ActivityItem[] = ((ticketsRes as { data?: unknown[] }).data ?? []).map((t) => {
        const row = t as { id: string; title: string; status: TicketStatus; project_id: string | null; updated_at: string; created_at: string };
        const projectName = row.project_id ? projectById.get(row.project_id)?.name : null;
        return {
          kind: "ticket",
          title: row.title,
          subtitle: projectName ? `Ticket · ${projectName}` : "Ticket",
          timestamp: row.updated_at ?? row.created_at,
          href: `/tickets/${row.id}`,
        };
      });

      const taskItems: ActivityItem[] = ((tasksRes as { data?: unknown[] }).data ?? []).map((t) => {
        const row = t as { id: string; title: string; status: string | null; project_id: string | null; updated_at: string | null; created_at: string };
        const projectName = row.project_id ? projectById.get(row.project_id)?.name : null;
        return {
          kind: "task",
          title: row.title,
          subtitle: projectName ? `Task · ${projectName}` : "Task",
          timestamp: (row.updated_at ?? row.created_at) as string,
          href: row.project_id ? `/projects/${row.project_id}/tasks` : undefined,
        };
      });

      const noteItems: ActivityItem[] = notes.slice(0, 20).map((n) => {
        const projectName = n.project_id ? projectById.get(n.project_id)?.name : null;
        return {
          kind: "note",
          title: n.title || "Untitled note",
          subtitle: projectName ? `Note · ${projectName}` : "Note",
          timestamp: n.created_at,
          href: `/notes/${n.id}`,
        };
      });

      const knowledgeItems: ActivityItem[] = knowledgePages.slice(0, 20).map((p) => ({
        kind: "knowledge",
        title: p.title,
        subtitle: p.page_type ? `Knowledge · ${p.page_type}` : "Knowledge",
        timestamp: p.updated_at,
        href: `/knowledge/${p.id}`,
      }));

      const merged = [...ticketItems, ...taskItems, ...noteItems, ...knowledgeItems, ...projectItems]
        .filter((x) => x.timestamp)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 30);

      setActivity(merged);
    } catch {
      setActivity([]);
      setActivityError("Failed to load activity.");
    } finally {
      setActivityLoaded(true);
      setLoadingActivity(false);
    }
  }, [activityLoaded, id, knowledgePages, notes, projectById, projectIds, projects]);

  // KPI strip (small + inexpensive: projects always; others best-effort via scoped count queries).
  useEffect(() => {
    if (!client?.id) return;
    // Prefer portfolio-derived KPIs when available (avoids extra count queries).
    if (portfolioLoaded) return;
    let cancelled = false;
    setLoadingKpis(true);
    (async () => {
      try {
        const [notesCountRes, knowledgeLinksRes, openTicketsRes] = await Promise.all([
          supabase.from("notes").select("id", { count: "exact", head: true }).eq("client_id", client.id).is("deleted_at", null),
          projectIds.length > 0
            ? supabase.from("knowledge_page_projects").select("page_id", { count: "exact", head: true }).in("project_id", projectIds)
            : Promise.resolve({ count: 0 } as { count: number | null }),
          projectIds.length > 0
            ? supabase
                .from("tickets")
                .select("id", { count: "exact", head: true })
                .in("project_id", projectIds)
                .not("status", "in", "(closed,resolved,cancelled)")
            : Promise.resolve({ count: 0 } as { count: number | null }),
        ]);

        if (cancelled) return;

        setKpis({
          projects: projects.length,
          notes: (notesCountRes.count ?? 0) as number,
          knowledge: (knowledgeLinksRes as { count?: number | null }).count ?? 0,
          openTickets: (openTicketsRes as { count?: number | null }).count ?? 0,
        });
      } catch {
        if (!cancelled) {
          setKpis((prev) => ({ ...prev, projects: projects.length }));
        }
      } finally {
        if (!cancelled) setLoadingKpis(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client?.id, projectIds, projects.length]);

  // Load portfolio metrics after projects are available (single batched pass).
  useEffect(() => {
    if (!client?.id) return;
    if (!projectsLoaded) return;
    void loadPortfolio();
  }, [client?.id, loadPortfolio, projectsLoaded]);

  // Lazy-load tab datasets only when needed.
  useEffect(() => {
    if (!client?.id) return;
    if (activeTab === "notes" && !notesLoaded && !loadingNotes) {
      void loadNotes();
    }
    if (activeTab === "knowledge" && !knowledgeLoaded && !loadingKnowledge) {
      void loadKnowledge();
    }
    if (activeTab === "activity" && !activityLoaded && !loadingActivity) {
      void loadActivity();
    }
  }, [
    activeTab,
    activityLoaded,
    client?.id,
    loadActivity,
    loadKnowledge,
    loadNotes,
    loadingActivity,
    knowledgeLoaded,
    loadingNotes,
    loadingKnowledge,
    notesLoaded,
  ]);

  if (!id) {
    return (
      <PageShell wide={false}>
        <div className="rounded-xl border border-slate-200/90 bg-white px-5 py-12 text-center shadow-sm ring-1 ring-slate-100">
          <p className="text-sm text-slate-600">Invalid client ID.</p>
          <Link href="/clients" className="mt-3 inline-block text-sm font-medium text-[rgb(var(--rb-brand-primary-active))] hover:text-[rgb(var(--rb-brand-primary-hover))]">
            Back to clients
          </Link>
        </div>
      </PageShell>
    );
  }

  if (loading && !client) {
    return (
      <PageShell wide={false}>
        <div className="space-y-6">
          <div className="h-8 w-64 rounded-lg bg-slate-200/80 animate-pulse" />
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="h-10 w-full rounded-lg bg-slate-100/90 animate-pulse mb-4" />
            <div className="space-y-3">
              <div className="h-4 w-full rounded bg-slate-100/90 animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-slate-100/90 animate-pulse" />
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  if (error || !client) {
    return (
      <PageShell wide={false}>
        <div className="rounded-xl border border-slate-200/90 bg-white px-5 py-12 text-center shadow-sm ring-1 ring-slate-100">
          <p className="text-sm font-semibold text-slate-900">{error ?? "Client not found."}</p>
          <button
            type="button"
            onClick={() => router.push("/clients")}
            className="mt-3 text-sm font-medium text-[rgb(var(--rb-brand-primary-active))] hover:text-[rgb(var(--rb-brand-primary-hover))]"
          >
            Back to clients
          </button>
        </div>
      </PageShell>
    );
  }

  const displayName = client.display_name || client.name;
  const tabClass = (tab: TabId) =>
    `inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2 ${
      activeTab === tab
        ? "bg-[rgb(var(--rb-surface))] text-[rgb(var(--rb-text-primary))] shadow-sm ring-1 ring-slate-100"
        : "text-[rgb(var(--rb-text-muted))] hover:text-[rgb(var(--rb-text-primary))] hover:bg-[rgb(var(--rb-surface))]/80"
    }`;

  return (
    <PageShell wide={false}>
      <div className="space-y-6">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to clients
        </Link>

        <header className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/75 bg-[rgb(var(--rb-surface))] p-5 shadow-sm ring-1 ring-slate-100 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-lg border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/70 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--rb-text-secondary))]">
                  Client
                </span>
                <span className="inline-flex items-center rounded-lg border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/70 px-2.5 py-0.5 text-[11px] font-medium text-[rgb(var(--rb-text-muted))]">
                  {client.is_active !== false ? "Active" : "Inactive"}
                </span>
                {client.website ? (
                  <a
                    href={client.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/70 px-2.5 py-0.5 text-[11px] font-medium text-[rgb(var(--rb-brand-primary-active))] hover:text-[rgb(var(--rb-brand-primary-hover))] hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2"
                  >
                    <Globe className="h-3.5 w-3.5" aria-hidden />
                    Website
                  </a>
                ) : null}
              </div>

              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[rgb(var(--rb-text-primary))] sm:text-[2.15rem]">
                {displayName}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-lg border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/60 px-2.5 py-0.5 text-xs text-[rgb(var(--rb-text-secondary))]">
                  {client.industry ?? "—"}
                </span>
                <span className="inline-flex items-center rounded-lg border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/60 px-2.5 py-0.5 text-xs text-[rgb(var(--rb-text-secondary))]">
                  {getCountryDisplayName(client.country) ?? "—"}
                </span>
              </div>
            </div>
          </div>
        </header>

        {portfolioError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {portfolioError}
          </div>
        ) : null}

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          {[
            { label: "Projects", value: kpis.projects },
            { label: "Open tickets", value: kpis.openTickets },
            { label: "Open tasks", value: kpis.openTasks },
            { label: "Notes", value: kpis.notes },
            { label: "Knowledge", value: kpis.knowledge },
            { label: "Overdue", value: kpis.overdueItems, tone: "warn" as const },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-xl border border-[rgb(var(--rb-surface-border))]/75 bg-[rgb(var(--rb-surface))] px-4 py-3 shadow-sm ring-1 ring-slate-100"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--rb-text-muted))]">
                {k.label}
              </p>
              <p className="mt-1 text-lg font-semibold text-[rgb(var(--rb-text-primary))]">
                {(loadingPortfolio || loadingKpis) && k.value == null ? "—" : (k.value ?? 0)}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 rounded-xl border border-[rgb(var(--rb-surface-border))]/75 bg-[rgb(var(--rb-surface-2))]/55 p-1.5 ring-1 ring-slate-100">
          <button type="button" onClick={() => setActiveTab("overview")} className={tabClass("overview")}>
            <LayoutDashboard className="size-4" aria-hidden />
            Overview
          </button>
          <button type="button" onClick={() => setActiveTab("projects")} className={tabClass("projects")}>
            <FolderKanban className="size-4" aria-hidden />
            Projects
          </button>
          <button type="button" onClick={() => setActiveTab("notes")} className={tabClass("notes")}>
            <FileText className="size-4" aria-hidden />
            Notes
          </button>
          <button type="button" onClick={() => setActiveTab("knowledge")} className={tabClass("knowledge")}>
            <Brain className="size-4" aria-hidden />
            Knowledge
          </button>
          <button type="button" onClick={() => setActiveTab("activity")} className={tabClass("activity")}>
            <Activity className="size-4" aria-hidden />
            Activity
          </button>
        </div>

        <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/75 bg-[rgb(var(--rb-surface))] p-5 shadow-sm ring-1 ring-slate-100 sm:p-6">
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--rb-text-muted))]">
                  Overview
                </p>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs font-medium text-[rgb(var(--rb-text-muted))]">Name</dt>
                  <dd className="mt-0.5 text-sm font-medium text-[rgb(var(--rb-text-primary))]">{client.name}</dd>
                </div>
                {client.display_name && (
                  <div>
                    <dt className="text-xs font-medium text-[rgb(var(--rb-text-muted))]">Display name</dt>
                    <dd className="mt-0.5 text-sm font-medium text-[rgb(var(--rb-text-primary))]">{client.display_name}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-medium text-[rgb(var(--rb-text-muted))]">Industry</dt>
                  <dd className="mt-0.5 text-sm font-medium text-[rgb(var(--rb-text-primary))]">{client.industry ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[rgb(var(--rb-text-muted))]">Country</dt>
                  <dd className="mt-0.5 text-sm font-medium text-[rgb(var(--rb-text-primary))]">{getCountryDisplayName(client.country) ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[rgb(var(--rb-text-muted))]">Website</dt>
                  <dd className="mt-0.5 text-sm font-medium text-[rgb(var(--rb-text-primary))]">
                    {client.website ? (
                      <a
                        href={client.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[rgb(var(--rb-brand-primary-active))] hover:text-[rgb(var(--rb-brand-primary-hover))] hover:underline underline-offset-4"
                      >
                        {client.website}
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[rgb(var(--rb-text-muted))]">Status</dt>
                  <dd className="mt-0.5 text-sm font-medium text-[rgb(var(--rb-text-primary))]">
                    {client.is_active !== false ? "Active" : "Inactive"}
                  </dd>
                </div>
              </dl>
              {client.sap_relevance_summary && (
                <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-4 py-4 ring-1 ring-slate-100">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--rb-text-muted))] mb-2">
                    SAP context
                  </p>
                  <p className="text-[15px] leading-7 text-[rgb(var(--rb-text-secondary))] whitespace-pre-wrap">
                    {client.sap_relevance_summary}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "projects" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--rb-text-muted))]">
                  Projects
                </p>
              </div>

              {loadingProjects ? (
                <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-4 py-4 ring-1 ring-slate-100">
                  <p className="text-sm text-[rgb(var(--rb-text-secondary))]">Loading projects…</p>
                </div>
              ) : projectsError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
                  {projectsError}
                </div>
              ) : projects.length === 0 ? (
                <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-4 py-4 ring-1 ring-slate-100">
                  <p className="text-sm font-medium text-[rgb(var(--rb-text-primary))]">No projects yet for this client.</p>
                  <p className="mt-1 text-sm text-[rgb(var(--rb-text-secondary))]">
                    Create a project and set its client to start tracking work here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {projects.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] px-4 py-4 shadow-sm ring-1 ring-slate-100"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <Link
                            href={`/projects/${p.id}`}
                            className="group inline-flex items-start gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2 rounded-lg"
                          >
                            <p className="text-sm font-semibold text-[rgb(var(--rb-text-primary))] truncate group-hover:underline underline-offset-4">
                              {p.name}
                            </p>
                            <ArrowUpRight className="h-4 w-4 shrink-0 text-[rgb(var(--rb-text-muted))] group-hover:text-[rgb(var(--rb-text-secondary))]" aria-hidden />
                          </Link>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-lg border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-2 py-0.5 text-xs text-[rgb(var(--rb-text-secondary))]">
                              {p.status ?? "—"}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-lg border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-2 py-0.5 text-xs text-[rgb(var(--rb-text-secondary))]">
                              <Calendar className="h-3.5 w-3.5" aria-hidden />
                              Created {formatDate(p.created_at)}
                            </span>
                            {p.start_date || p.planned_end_date ? (
                              <span className="inline-flex items-center gap-1 rounded-lg border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-2 py-0.5 text-xs text-[rgb(var(--rb-text-secondary))]">
                                <Calendar className="h-3.5 w-3.5" aria-hidden />
                                {formatDate(p.start_date)} → {formatDate(p.planned_end_date)}
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-lg border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-2 py-0.5 text-xs text-[rgb(var(--rb-text-secondary))]">
                              <Activity className="h-3.5 w-3.5" aria-hidden />
                              {loadingPortfolio ? "…" : (projectTicketCounts[p.id] ?? 0)} open tickets
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-lg border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-2 py-0.5 text-xs text-[rgb(var(--rb-text-secondary))]">
                              <ListChecks className="h-3.5 w-3.5" aria-hidden />
                              {loadingPortfolio ? "…" : (projectTaskCounts[p.id] ?? 0)} open tasks
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-lg border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-2 py-0.5 text-xs text-[rgb(var(--rb-text-secondary))]">
                              <StickyNote className="h-3.5 w-3.5" aria-hidden />
                              {loadingPortfolio ? "…" : (projectNoteCounts[p.id] ?? 0)} notes
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 flex flex-col gap-2 items-end">
                          <Link
                            href={`/projects/${p.id}`}
                            className="inline-flex items-center justify-center gap-2 rounded-xl rb-btn-primary px-3.5 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2"
                          >
                            Open workspace
                          </Link>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Link
                              href={`/projects/${p.id}/tasks`}
                              className="inline-flex items-center rounded-lg border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-2.5 py-1.5 text-xs font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-2))]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2"
                            >
                              Tasks
                            </Link>
                            <Link
                              href={`/projects/${p.id}/tickets`}
                              className="inline-flex items-center rounded-lg border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-2.5 py-1.5 text-xs font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-2))]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2"
                            >
                              Tickets
                            </Link>
                            <Link
                              href={`/projects/${p.id}/planning/calendar`}
                              className="inline-flex items-center rounded-lg border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-2.5 py-1.5 text-xs font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-2))]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2"
                            >
                              Planning
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "notes" && (
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--rb-text-muted))]">
                Notes
              </p>
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-[rgb(var(--rb-text-secondary))]">
                  Notes associated with this client.
                </p>
                <button
                  type="button"
                  onClick={() => void loadNotes({ force: true })}
                  className="text-sm font-medium text-[rgb(var(--rb-brand-primary-active))] hover:text-[rgb(var(--rb-brand-primary-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2 rounded-md px-2 py-1"
                >
                  Refresh
                </button>
              </div>

              {loadingNotes ? (
                <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-4 py-4 ring-1 ring-slate-100">
                  <p className="text-sm text-[rgb(var(--rb-text-secondary))]">Loading notes…</p>
                </div>
              ) : notesError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
                  {notesError}
                </div>
              ) : notes.length === 0 ? (
                <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-4 py-4 ring-1 ring-slate-100">
                  <p className="text-sm font-medium text-[rgb(var(--rb-text-primary))]">No notes found for this client.</p>
                  <p className="mt-1 text-sm text-[rgb(var(--rb-text-secondary))]">
                    Create a note and associate it with this client (or one of its projects) to have it show here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[rgb(var(--rb-surface-border))]/60 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] overflow-hidden shadow-sm ring-1 ring-slate-100">
                  {notes.map((n) => {
                    const snippet = (n.body ?? "").trim().replace(/\s+/g, " ").slice(0, 140);
                    const projectName = n.project_id ? projects.find((p) => p.id === n.project_id)?.name : null;
                    return (
                      <Link
                        key={n.id}
                        href={`/notes/${n.id}`}
                        className="block px-4 py-4 transition-colors hover:bg-[rgb(var(--rb-surface-2))]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[rgb(var(--rb-text-primary))] truncate">
                              {n.title || "Untitled note"}
                            </p>
                            <p className="mt-1 text-sm text-[rgb(var(--rb-text-secondary))] line-clamp-2">
                              {snippet || "—"}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center rounded-lg border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-2 py-0.5 text-xs text-[rgb(var(--rb-text-secondary))]">
                                {formatDate(n.created_at)}
                              </span>
                              {projectName ? (
                                <span className="inline-flex items-center rounded-lg border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-2 py-0.5 text-xs text-[rgb(var(--rb-text-secondary))]">
                                  {projectName}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <ArrowUpRight className="h-4 w-4 shrink-0 text-[rgb(var(--rb-text-muted))]" aria-hidden />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "knowledge" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--rb-text-muted))]">
                  Knowledge
                </p>
                <button
                  type="button"
                  onClick={() => void loadKnowledge({ force: true })}
                  className="text-sm font-medium text-[rgb(var(--rb-brand-primary-active))] hover:text-[rgb(var(--rb-brand-primary-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2 rounded-md px-2 py-1"
                >
                  Refresh
                </button>
              </div>

              {loadingKnowledge ? (
                <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-4 py-4 ring-1 ring-slate-100">
                  <p className="text-sm text-[rgb(var(--rb-text-secondary))]">Loading knowledge…</p>
                </div>
              ) : knowledgeError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
                  {knowledgeError}
                </div>
              ) : knowledgePages.length === 0 ? (
                <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-4 py-4 ring-1 ring-slate-100">
                  <p className="text-sm font-medium text-[rgb(var(--rb-text-primary))]">No knowledge pages linked yet.</p>
                  <p className="mt-1 text-sm text-[rgb(var(--rb-text-secondary))]">
                    Link knowledge pages to the client’s projects to have them appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[rgb(var(--rb-surface-border))]/60 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] overflow-hidden shadow-sm ring-1 ring-slate-100">
                  {knowledgePages.map((p) => (
                    <Link
                      key={p.id}
                      href={`/knowledge/${p.id}`}
                      className="block px-4 py-4 transition-colors hover:bg-[rgb(var(--rb-surface-2))]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[rgb(var(--rb-text-primary))] truncate">{p.title}</p>
                          {p.summary ? (
                            <p className="mt-1 text-sm text-[rgb(var(--rb-text-secondary))] line-clamp-2">{p.summary}</p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-lg border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-2 py-0.5 text-xs text-[rgb(var(--rb-text-secondary))]">
                              Updated {formatDate(p.updated_at)}
                            </span>
                            {p.page_type ? (
                              <span className="inline-flex items-center rounded-lg border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-2 py-0.5 text-xs text-[rgb(var(--rb-text-secondary))]">
                                {p.page_type}
                              </span>
                            ) : null}
                            {knowledgeProjectByPageId[p.id] ? (
                              <span className="inline-flex items-center rounded-lg border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-2 py-0.5 text-xs text-[rgb(var(--rb-text-secondary))]">
                                {projectById.get(knowledgeProjectByPageId[p.id])?.name ?? "Project"}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-[rgb(var(--rb-text-muted))]" aria-hidden />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "activity" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--rb-text-muted))]">
                  Activity
                </p>
                <button
                  type="button"
                  onClick={() => void loadActivity({ force: true })}
                  className="text-sm font-medium text-[rgb(var(--rb-brand-primary-active))] hover:text-[rgb(var(--rb-brand-primary-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2 rounded-md px-2 py-1"
                >
                  Refresh
                </button>
              </div>

              {loadingActivity ? (
                <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-4 py-4 ring-1 ring-slate-100">
                  <p className="text-sm text-[rgb(var(--rb-text-secondary))]">Loading activity…</p>
                </div>
              ) : activityError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
                  {activityError}
                </div>
              ) : activity.length === 0 ? (
                <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-4 py-4 ring-1 ring-slate-100">
                  <p className="text-sm font-medium text-[rgb(var(--rb-text-primary))]">No recent activity yet.</p>
                  <p className="mt-1 text-sm text-[rgb(var(--rb-text-secondary))]">
                    Once work starts across projects, tickets, tasks, notes, and knowledge, you’ll see it here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[rgb(var(--rb-surface-border))]/60 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] overflow-hidden shadow-sm ring-1 ring-slate-100">
                  {activity.map((a, idx) => {
                    const icon =
                      a.kind === "project" ? (
                        <FolderKanban className="h-4 w-4" aria-hidden />
                      ) : a.kind === "ticket" ? (
                        <Activity className="h-4 w-4" aria-hidden />
                      ) : a.kind === "task" ? (
                        <LayoutDashboard className="h-4 w-4" aria-hidden />
                      ) : a.kind === "note" ? (
                        <FileText className="h-4 w-4" aria-hidden />
                      ) : (
                        <Brain className="h-4 w-4" aria-hidden />
                      );

                    const content = (
                      <div className="flex items-start gap-3 px-4 py-4">
                        <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/60 text-[rgb(var(--rb-text-secondary))]">
                          {icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[rgb(var(--rb-text-primary))] truncate">{a.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {a.subtitle ? (
                              <span className="text-xs text-[rgb(var(--rb-text-secondary))]">{a.subtitle}</span>
                            ) : null}
                            <span className="text-xs text-[rgb(var(--rb-text-muted))]">
                              {formatDate(a.timestamp)}
                            </span>
                          </div>
                        </div>
                        {a.href ? (
                          <ArrowUpRight className="h-4 w-4 shrink-0 text-[rgb(var(--rb-text-muted))]" aria-hidden />
                        ) : null}
                      </div>
                    );

                    return a.href ? (
                      <Link
                        key={`${a.kind}-${idx}`}
                        href={a.href}
                        className="block transition-colors hover:bg-[rgb(var(--rb-surface-2))]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div key={`${a.kind}-${idx}`}>{content}</div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
