"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  handleSupabaseError,
} from "@/lib/supabaseError";
import { ObjectActions } from "@/components/ObjectActions";
import { useProjectWorkspace } from "@/components/projects/ProjectWorkspaceContext";
import type { TicketPriority, TicketStatus } from "@/lib/types/ticketTypes";
import { FileText, BookOpen, Link as LinkIcon, Ticket, CalendarDays, Plus, CheckSquare, ListTodo } from "lucide-react";
import { getSuggestedKnowledgeForProject, listSpaces } from "@/lib/knowledgeService";
import { getTicketDetailHref } from "@/lib/routes";
import type { KnowledgePage } from "@/lib/types/knowledge";
import { ProjectOverviewSkeleton } from "@/components/skeletons/ProjectOverviewSkeleton";
import { ProjectHealthStrip } from "@/components/projects/ProjectHealthStrip";
import { ProjectActionZone } from "@/components/projects/ProjectActionZone";
import { ProjectRecentActivity } from "@/components/projects/ProjectRecentActivity";
import type { ProjectRecentActivityItem } from "@/components/projects/ProjectRecentActivity";
import { ProjectAnalyticsSection } from "@/components/projects/ProjectAnalyticsSection";
import { ProjectKnowledgeSummaryCompact } from "@/components/projects/ProjectKnowledgeSummaryCompact";
import type { ActivityItem } from "@/components/projects/ProjectActivityFeed";
import { Skeleton } from "@/components/ui/Skeleton";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";

// ==========================
// Tipos
// ==========================

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  start_date: string | null;
  planned_end_date: string | null;
  created_at: string;
  client_id?: string | null;
};

type NoteRow = {
  id: string;
  title: string;
  body: string | null;
  module: string | null;
  module_id: string | null;
  scope_item: string | null;
  scope_item_id: string | null;
  system_type: string | null;
  transaction: string | null;
  error_code: string | null;
  note_type: string | null;
  web_link_1: string | null;
  web_link_2: string | null;
  extra_info: string | null;
  project_id: string | null;
  created_at: string;
};

/** Shape returned by GET /api/projects/[id]/notes (list only) */
type ProjectNoteSummary = {
  id: string;
  title: string | null;
  module: string | null;
  scope_item: string | null;
  error_code: string | null;
  web_link_1: string | null;
  web_link_2: string | null;
  extra_info: string | null;
  created_at: string;
};

type ProjectLinkRow = {
  id: string;
  project_id?: string;
  name: string | null;
  url: string | null;
  link_type: string | null;
  created_at: string;
};

type ProjectStats = {
  projectId: string;
  total_notes: number;
  error_notes: number;
  modules_impacted: number;
  last_update_at: string | null;
};

type TicketSummary = {
  id: string;
  title: string;
  priority: TicketPriority;
  status: TicketStatus;
  created_at: string;
};

type ProjectPhaseRow = {
  id: string;
  name: string;
  sort_order: number;
  start_date: string | null;
  end_date: string | null;
};

/** For dashboard activity KPIs; DB has name + due_date */
type DashboardProjectActivity = {
  id: string;
  project_id: string;
  phase_id: string | null;
  name: string;
  status: string | null;
  priority: string | null;
  start_date: string | null;
  due_date: string | null;
  progress_pct: number | null;
};

/** Display-only mapping: task status -> Spanish label (unified workflow). */
function getTaskStatusLabel(status: string | null | undefined): string {
  const s = String((status ?? "").toLowerCase().trim());
  const map: Record<string, string> = {
    pending: "Por hacer",
    in_progress: "En progreso",
    blocked: "Bloqueado",
    review: "En revisión",
    done: "Hecho",
  };
  if (map[s]) return map[s];
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ==========================
// Componente principal
// ==========================

export default function ProjectDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = (params?.id ?? "") as string;
  const planGeneratedFailed = searchParams?.get("planGenerated") === "false";

  // Datos principales
  const [project, setProject] = useState<Project | null>(null);
  const [projectLoadFailed, setProjectLoadFailed] = useState(false);
  const [notes, setNotes] = useState<ProjectNoteSummary[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [errorNotes, setErrorNotes] = useState<string | null>(null);
  const [links, setLinks] = useState<ProjectLinkRow[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [errorLinks, setErrorLinks] = useState<string | null>(null);

  const [openTicketsCount, setOpenTicketsCount] = useState<number>(0);
  const [overdueTicketsCount, setOverdueTicketsCount] = useState<number>(0);
  const [unassignedTicketsCount, setUnassignedTicketsCount] = useState<number>(0);
  const [urgentTicketsCount, setUrgentTicketsCount] = useState<number>(0);
  const [todayTickets, setTodayTickets] = useState<TicketSummary[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const [membersCount, setMembersCount] = useState<number>(0);
  const [knowledgeSpacesCount, setKnowledgeSpacesCount] = useState<number>(0);
  const [knowledgePagesCount, setKnowledgePagesCount] = useState<number>(0);
  const [loadingKnowledgeCounts, setLoadingKnowledgeCounts] = useState(false);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // KPIs desde API (GET /api/projects/[id]/stats)
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [errorStats, setErrorStats] = useState<string | null>(null);

  // Activity stats (tasks board)
  const [activityStats, setActivityStats] = useState<{
    total: number;
    active: number;
    blocked: number;
    overdue: number;
    completed: number;
    completionRate: number;
  } | null>(null);
  const [loadingActivityStats, setLoadingActivityStats] = useState(false);

  // SAP Activate plan (phases + dates + counts)
  const [activatePlan, setActivatePlan] = useState<{
    phases: Array<{
      phase_key: string;
      name: string;
      sort_order: number;
      start_date: string;
      end_date: string;
      totalTasks: number;
      completedTasks: number;
      completionPercent: number;
    }>;
    projectStart?: string;
    projectEnd?: string;
  } | null>(null);
  const [loadingActivatePlan, setLoadingActivatePlan] = useState(false);

  // Project phases (from project_phases table, for planning summary)
  const [projectPhases, setProjectPhases] = useState<ProjectPhaseRow[]>([]);
  const [loadingProjectPhases, setLoadingProjectPhases] = useState(false);

  // Project activities (from project_activities, for "Estado de actividades" card)
  const [dashboardActivities, setDashboardActivities] = useState<DashboardProjectActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  // Project health dashboard: tasks + activity risk metrics (read-only)
  type ProjectTaskRow = {
    id: string;
    title: string;
    status: string;
    due_date: string | null;
    activity_id: string | null;
    assignee_profile_id: string | null;
    created_at: string;
  };
  const [projectTasks, setProjectTasks] = useState<ProjectTaskRow[]>([]);
  const [projectTasksLoading, setProjectTasksLoading] = useState(false);
  const [riskMetricsList, setRiskMetricsList] = useState<{ activity_id: string; risk_level: string }[]>([]);

  // Permisos del proyecto (Edit / Archive / Delete)
  const [permissions, setPermissions] = useState<{
    canEdit: boolean;
    canArchive: boolean;
    canDelete: boolean;
    canManageMembers?: boolean;
  } | null>(null);

  // Quick Actions "Crear" dropdown (UI only)
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  const [suggestedKnowledge, setSuggestedKnowledge] = useState<KnowledgePage[]>([]);

  useEffect(() => {
    if (!createMenuOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCreateMenuOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setCreateMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [createMenuOpen]);

  const [clientName, setClientName] = useState<string | null>(null);

  const loadProject = useCallback(async (): Promise<boolean> => {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, description, status, start_date, planned_end_date, created_at, client_id")
      .eq("id", projectId)
      .single();

    if (error) {
      handleSupabaseError("projects", error);
      setProject(null);
      setClientName(null);
      setProjectLoadFailed(true);
      return false;
    }

    const row = data as Project & { client_id?: string | null };
    setProject(row);
    setProjectLoadFailed(false);

    if (row.client_id) {
      const { data: clientRow } = await supabase
        .from("clients")
        .select("name, display_name")
        .eq("id", row.client_id)
        .single();
      setClientName(
        clientRow
          ? ((clientRow as { display_name?: string | null; name?: string }).display_name ||
            (clientRow as { name?: string }).name) ??
            null
          : null
      );
    } else {
      setClientName(null);
    }
    return true;
  }, [projectId]);

  const { setHeaderActions } = useProjectWorkspace();
  useEffect(() => {
    if (!project) return;
    setHeaderActions(
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="relative" ref={createMenuRef}>
          <button
            type="button"
            onClick={() => setCreateMenuOpen((o) => !o)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-600/80 bg-slate-800/80 px-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:border-slate-500 hover:text-white transition-colors"
            aria-expanded={createMenuOpen}
            aria-haspopup="true"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span>Create</span>
          </button>
          {createMenuOpen && (
            <div
              className="absolute right-0 top-full z-50 mt-1.5 min-w-[180px] rounded-xl border border-slate-700 bg-slate-800 py-1 shadow-xl shadow-black/20"
              role="menu"
            >
              <Link
                href={`/projects/${projectId}/tasks?new=1`}
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700/80 transition-colors"
                onClick={() => setCreateMenuOpen(false)}
              >
                <CheckSquare className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                New task
              </Link>
              <Link
                href={`/projects/${projectId}/notes?new=1`}
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700/80 transition-colors"
                onClick={() => setCreateMenuOpen(false)}
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                New note
              </Link>
              <Link
                href={`/projects/${projectId}/tickets?new=1`}
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700/80 transition-colors"
                onClick={() => setCreateMenuOpen(false)}
              >
                <Ticket className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                New ticket
              </Link>
              <Link
                href={`/projects/${projectId}/planning/activities?new=1`}
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700/80 transition-colors"
                onClick={() => setCreateMenuOpen(false)}
              >
                <ListTodo className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                New activity
              </Link>
            </div>
          )}
        </div>
        {permissions && (
          <span className="inline-block h-4 w-px bg-slate-700" aria-hidden />
        )}
        {permissions && (
          <ObjectActions
            entity="project"
            id={projectId}
            canEdit={permissions.canEdit}
            canDelete={permissions.canDelete}
            canArchive={permissions.canArchive}
            archiveEndpoint={`/api/projects/${projectId}/archive`}
            deleteEndpoint={`/api/projects/${projectId}`}
            onArchived={() => void loadProject()}
            variant="dark"
          />
        )}
      </div>
    );
    return () => setHeaderActions(null);
  }, [project, permissions, createMenuOpen, setHeaderActions, projectId, loadProject]);

  // ==========================
  // Carga: proyecto primero, luego datos relacionados
  // ==========================

  useEffect(() => {
    if (!projectId) {
      setProjectLoadFailed(true);
      setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      setErrorMsg(null);
      const ok = await loadProject();
      if (!ok) {
        setLoading(false);
        return;
      }
      setLoading(false);
    };

    void run();
  }, [projectId, projectLoadFailed]);

  // Fetch project permissions (canEdit, canArchive, canDelete, canManageMembers) from API.
  useEffect(() => {
    if (!projectId || projectLoadFailed) return;
    let cancelled = false;
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const headers: Record<string, string> = {};
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
        const permRes = await fetch(`/api/projects/${projectId}/permissions`, { headers });
        if (cancelled) return;
        const permData = await permRes.json().catch(() => ({}));
        setPermissions({
          canEdit: (permData as { canEdit?: boolean }).canEdit ?? false,
          canArchive: (permData as { canArchive?: boolean }).canArchive ?? false,
          canDelete: (permData as { canDelete?: boolean }).canDelete ?? false,
          canManageMembers: (permData as { canManageMembers?: boolean }).canManageMembers ?? false,
        });
      } catch {
        if (!cancelled) setPermissions({ canEdit: false, canArchive: false, canDelete: false, canManageMembers: false });
      }
    }
    load();
    return () => { cancelled = true; };
  }, [projectId, projectLoadFailed]);

  // Suggested Knowledge (pages linked to this project via knowledge_page_projects)
  useEffect(() => {
    if (!projectId || projectLoadFailed) return;
    let cancelled = false;
    getSuggestedKnowledgeForProject(supabase, projectId).then((list) => {
      if (!cancelled) setSuggestedKnowledge(list);
    });
    return () => { cancelled = true; };
  }, [projectId, projectLoadFailed]);

  // Members count (for Project HQ metrics)
  useEffect(() => {
    if (!projectId || projectLoadFailed) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(`/api/projects/${projectId}/members`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (cancelled) return;
        const data = await res.json().catch(() => ({}));
        const members = (data as { members?: unknown[] }).members ?? [];
        setMembersCount(Array.isArray(members) ? members.length : 0);
      } catch {
        if (!cancelled) setMembersCount(0);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, projectLoadFailed]);

  // Knowledge spaces + pages count (for Project HQ metrics)
  useEffect(() => {
    if (!projectId || projectLoadFailed) return;
    let cancelled = false;
    setLoadingKnowledgeCounts(true);
    (async () => {
      try {
        const spaces = await listSpaces(supabase, { projectId });
        if (cancelled) return;
        setKnowledgeSpacesCount(spaces.length);
        if (spaces.length === 0) {
          setKnowledgePagesCount(0);
          return;
        }
        const spaceIds = spaces.map((s) => s.id);
        const { count } = await supabase
          .from("knowledge_pages")
          .select("id", { count: "exact", head: true })
          .in("space_id", spaceIds)
          .is("deleted_at", null);
        if (!cancelled) setKnowledgePagesCount(count ?? 0);
      } catch {
        if (!cancelled) {
          setKnowledgeSpacesCount(0);
          setKnowledgePagesCount(0);
        }
      } finally {
        if (!cancelled) setLoadingKnowledgeCounts(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, projectLoadFailed]);

  // ==========================
  // Fetch KPIs from API
  // ==========================

  useEffect(() => {
    if (!projectId || projectLoadFailed) return;

    let cancelled = false;
    setLoadingStats(true);
    setErrorStats(null);

    const load = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/stats`);
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErrorStats((data as { error?: string })?.error ?? "Error al cargar estadísticas");
          setStats(null);
          return;
        }
        const data = (await res.json()) as ProjectStats;
        setStats(data);
      } catch {
        if (!cancelled) {
          setErrorStats("Error al cargar estadísticas");
          setStats(null);
        }
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, projectLoadFailed]);

  // ==========================
  // Fetch notes from API (GET /api/projects/[id]/notes)
  // ==========================

  useEffect(() => {
    if (!projectId || projectLoadFailed) return;

    let cancelled = false;
    setLoadingNotes(true);
    setErrorNotes(null);

    const load = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/notes?limit=10`);
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErrorNotes((data as { error?: string })?.error ?? "Error al cargar las notas.");
          setNotes([]);
          return;
        }
        const data = (await res.json()) as { projectId: string; notes: ProjectNoteSummary[] };
        setNotes(data.notes ?? []);
      } catch {
        if (!cancelled) {
          setErrorNotes("Error al cargar las notas.");
          setNotes([]);
        }
      } finally {
        if (!cancelled) setLoadingNotes(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, projectLoadFailed]);

  // ==========================
  // Fetch project tickets (open count, overdue/unassigned counts, recent list)
  // ==========================

  useEffect(() => {
    if (!projectId || projectLoadFailed) return;

    let cancelled = false;
    setLoadingTickets(true);

    const load = async () => {
      const [countRes, listRes] = await Promise.all([
        supabase
          .from("tickets")
          .select("id", { count: "exact", head: true })
          .eq("project_id", projectId)
          .neq("status", "closed"),
        supabase
          .from("tickets")
          .select("id, title, priority, status, created_at, due_date, assigned_to")
          .eq("project_id", projectId)
          .neq("status", "closed")
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      if (cancelled) return;
      const list = (listRes.data ?? []) as (TicketSummary & { due_date?: string | null; assigned_to?: string | null })[];
      setOpenTicketsCount(countRes.count ?? 0);
      const today = new Date().toISOString().slice(0, 10);
      setOverdueTicketsCount(list.filter((t) => t.due_date && t.due_date < today).length);
      setUnassignedTicketsCount(list.filter((t) => !t.assigned_to).length);
      setUrgentTicketsCount(list.filter((t) => t.priority === "urgent" || t.priority === "high").length);
      setTodayTickets(list.slice(0, 5));
      setLoadingTickets(false);
    };

    void load();
    return () => { cancelled = true; };
  }, [projectId, projectLoadFailed]);

  // ==========================
  // Fetch project links from API (GET /api/projects/[id]/links)
  // ==========================

  useEffect(() => {
    if (!projectId || projectLoadFailed) return;

    let cancelled = false;
    setLoadingLinks(true);
    setErrorLinks(null);

    const load = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/links?limit=10`);
        if (cancelled) return;
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrorLinks(
            (data as { error?: string })?.error ?? "Error al cargar los enlaces."
          );
          setLinks([]);
          return;
        }
        const payload = data as { projectId: string; links: ProjectLinkRow[] };
        setLinks(payload.links ?? []);
        setErrorLinks(null);
      } catch {
        if (!cancelled) {
          setErrorLinks("Error al cargar los enlaces.");
          setLinks([]);
        }
      } finally {
        if (!cancelled) setLoadingLinks(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, projectLoadFailed]);

  // Fetch activity stats (tasks board)
  useEffect(() => {
    if (!projectId || projectLoadFailed) return;

    let cancelled = false;
    setLoadingActivityStats(true);

    const load = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/activity-stats`);
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.warn("Activity stats error", (data as { error?: string })?.error);
          setActivityStats(null);
          return;
        }
        const data = (await res.json()) as {
          total: number;
          active: number;
          blocked: number;
          overdue: number;
          completed: number;
          completionRate: number;
        };
        setActivityStats(data);
      } catch (err) {
        if (!cancelled) {
          console.error("Activity stats fetch failed", err);
          setActivityStats(null);
        }
      } finally {
        if (!cancelled) setLoadingActivityStats(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, projectLoadFailed]);

  // Fetch SAP Activate plan (phases + task counts) when project has dates
  useEffect(() => {
    if (!projectId || projectLoadFailed) return;

    let cancelled = false;
    setLoadingActivatePlan(true);

    const load = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/activate-plan`);
        if (cancelled) return;
        if (!res.ok) {
          setActivatePlan(null);
          return;
        }
        const data = await res.json();
        setActivatePlan({
          phases: data.phases ?? [],
          projectStart: data.projectStart,
          projectEnd: data.projectEnd,
        });
      } catch {
        if (!cancelled) setActivatePlan(null);
      } finally {
        if (!cancelled) setLoadingActivatePlan(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [projectId, projectLoadFailed]);

  // Fetch project_phases for planning summary (current phase, next phase, etc.)
  useEffect(() => {
    if (!projectId || projectLoadFailed) return;
    let cancelled = false;

    const load = async () => {
      if (!cancelled) setLoadingProjectPhases(true);
      try {
        const { data, error } = await supabase
          .from("project_phases")
          .select("id, name, sort_order, start_date, end_date")
          .eq("project_id", projectId)
          .order("sort_order", { ascending: true });
        if (cancelled) return;
        if (error) {
          setProjectPhases([]);
          return;
        }
        setProjectPhases((data ?? []) as ProjectPhaseRow[]);
      } catch {
        if (!cancelled) setProjectPhases([]);
      } finally {
        if (!cancelled) setLoadingProjectPhases(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [projectId, projectLoadFailed]);

  // Fetch project_activities for "Estado de actividades" card
  useEffect(() => {
    if (!projectId || projectLoadFailed) return;
    let cancelled = false;

    const load = async () => {
      if (!cancelled) setActivitiesLoading(true);
      try {
        const { data, error } = await supabase
          .from("project_activities")
          .select("id, project_id, phase_id, name, status, priority, start_date, due_date, progress_pct")
          .eq("project_id", projectId);
        if (cancelled) return;
        if (error) {
          console.error("Error loading project activities", error);
          setDashboardActivities([]);
        } else {
          setDashboardActivities((data ?? []) as DashboardProjectActivity[]);
        }
      } catch (err) {
        console.error("Error loading project activities", err);
        if (!cancelled) setDashboardActivities([]);
      } finally {
        if (!cancelled) setActivitiesLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [projectId, projectLoadFailed]);

  // Fetch project_tasks + activity_risk_metrics for "Salud del proyecto" (read-only)
  useEffect(() => {
    if (!projectId || projectLoadFailed) return;
    let cancelled = false;
    setProjectTasksLoading(true);

    const load = async () => {
      try {
        const tasksRes = await supabase
          .from("project_tasks")
          .select("id, title, status, due_date, activity_id, assignee_profile_id, created_at")
          .eq("project_id", projectId)
          .order("due_date", { ascending: true, nullsFirst: false });

        if (cancelled) return;
        const tasks = (tasksRes.data ?? []) as ProjectTaskRow[];
        setProjectTasks(tasksRes.error ? [] : tasks);

        const actRes = await supabase
          .from("project_activities")
          .select("id")
          .eq("project_id", projectId);
        if (cancelled) return;
        const activityIds = ((actRes.data ?? []) as { id: string }[]).map((a) => a.id);

        if (activityIds.length > 0) {
          const riskRes = await supabase
            .from("activity_risk_metrics")
            .select("activity_id, risk_level")
            .in("activity_id", activityIds);
          if (!cancelled && !riskRes.error && riskRes.data?.length) {
            setRiskMetricsList(
              riskRes.data as { activity_id: string; risk_level: string }[]
            );
          } else if (!cancelled) {
            setRiskMetricsList([]);
          }
        } else if (!cancelled) {
          setRiskMetricsList([]);
        }
      } catch {
        if (!cancelled) {
          setProjectTasks([]);
          setRiskMetricsList([]);
        }
      } finally {
        if (!cancelled) setProjectTasksLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [projectId, projectLoadFailed]);

  // ==========================
  // KPIs (datos desde API; placeholders mientras loading)
  // ==========================

  // Project health score 0–100 (heuristic)
  const projectHealth = useMemo(() => {
    const totalNotes = stats?.total_notes ?? 0;
    const errorNotes = stats?.error_notes ?? 0;
    const modulesImpacted = stats?.modules_impacted ?? 0;
    const openTickets = openTicketsCount;
    const lastUpdate = stats?.last_update_at ?? null;

    let score = 100;
    // Error notes: up to 30 points (by % of notes with error)
    if (totalNotes > 0 && errorNotes > 0) {
      const ratio = errorNotes / totalNotes;
      score -= Math.min(30, Math.round(ratio * 30));
    }
    // Open tickets: up to 40 points (e.g. 10+ = full penalty)
    if (openTickets > 0) {
      score -= Math.min(40, openTickets * 4);
    }
    // Stale activity: up to 30 points if no update in 30+ days
    if (lastUpdate) {
      const daysSince = (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > 30) score -= Math.min(30, Math.round((daysSince - 30) / 10) * 10);
    } else if (totalNotes === 0 && openTickets === 0) {
      score = Math.max(0, score - 15); // new project, slight penalty
    }
    return Math.max(0, Math.min(100, score));
  }, [stats, openTicketsCount]);

  // Planning summary: current phase, time progress, next phase (from project_phases + project dates)
  const planningSummary = useMemo(() => {
    const phases = projectPhases;
    const startDate = project?.start_date ?? null;
    const plannedEndDate = project?.planned_end_date ?? null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const phasesWithDates = phases.filter(
      (p): p is ProjectPhaseRow & { start_date: string; end_date: string } =>
        !!p.start_date && !!p.end_date
    );

    let currentPhase: ProjectPhaseRow | null = null;
    if (phasesWithDates.length > 0) {
      const inRange = phasesWithDates.find((p) => {
        const s = new Date(p.start_date);
        const e = new Date(p.end_date);
        s.setHours(0, 0, 0, 0);
        e.setHours(23, 59, 59, 999);
        return today >= s && today <= e;
      });
      if (inRange) {
        currentPhase = inRange;
      } else {
        const minStart = phasesWithDates.reduce(
          (min, p) => (p.start_date < min ? p.start_date : min),
          phasesWithDates[0].start_date
        );
        const maxEnd = phasesWithDates.reduce(
          (max, p) => (p.end_date > max ? p.end_date : max),
          phasesWithDates[0].end_date
        );
        const todayStr = today.toISOString().slice(0, 10);
        if (todayStr < minStart) currentPhase = phasesWithDates[0];
        else if (todayStr > maxEnd) currentPhase = phasesWithDates[phasesWithDates.length - 1];
      }
    }

    let projectTimeProgress: number | null = null;
    if (startDate && plannedEndDate) {
      const start = new Date(startDate);
      const end = new Date(plannedEndDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      const totalDurationDays = Math.max(
        1,
        (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
      );
      const elapsedDays = Math.max(
        0,
        Math.min(
          totalDurationDays,
          (today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
        )
      );
      projectTimeProgress = Math.round((elapsedDays / totalDurationDays) * 100);
    }

    let nextPhaseStart: { name: string; start_date: string } | null = null;
    const todayStr = today.toISOString().slice(0, 10);
    const upcoming = phasesWithDates
      .filter((p) => p.start_date > todayStr)
      .sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
    if (upcoming.length > 0) {
      nextPhaseStart = { name: upcoming[0].name, start_date: upcoming[0].start_date };
    }

    return { currentPhase, projectTimeProgress, nextPhaseStart };
  }, [projectPhases, project?.start_date, project?.planned_end_date]);

  // Activity KPIs from project_activities (total, in progress, blocked, done, delayed, avg progress)
  const projectActivityStats = useMemo(() => {
    const activities = dashboardActivities;
    if (!activities || activities.length === 0) {
      return {
        total: 0,
        inProgress: 0,
        blocked: 0,
        done: 0,
        delayed: 0,
        avgProgress: null as number | null,
        blockedList: [] as DashboardProjectActivity[],
        delayedList: [] as DashboardProjectActivity[],
      };
    }

    const today = new Date();
    const parse = (d: string | null) => (d ? new Date(d) : null);

    let total = activities.length;
    let inProgress = 0;
    let blocked = 0;
    let done = 0;
    let delayed = 0;
    const progressValues: number[] = [];
    const blockedList: DashboardProjectActivity[] = [];
    const delayedList: DashboardProjectActivity[] = [];

    for (const act of activities) {
      const status = act.status ?? "planned";

      if (status === "in_progress") inProgress++;
      if (status === "blocked") {
        blocked++;
        blockedList.push(act);
      }
      if (status === "done") done++;

      const end = parse(act.due_date);
      if (end && end < today && status !== "done") {
        delayed++;
        delayedList.push(act);
      }

      if (typeof act.progress_pct === "number") {
        progressValues.push(Math.min(100, Math.max(0, act.progress_pct)));
      }
    }

    const avgProgress =
      progressValues.length > 0
        ? Math.round(
            progressValues.reduce((sum, v) => sum + v, 0) / progressValues.length
          )
        : null;

    blockedList.sort((a, b) => ((a.due_date || "") > (b.due_date || "") ? 1 : -1));
    delayedList.sort((a, b) => ((a.due_date || "") > (b.due_date || "") ? 1 : -1));

    return {
      total,
      inProgress,
      blocked,
      done,
      delayed,
      avgProgress,
      blockedList: blockedList.slice(0, 3),
      delayedList: delayedList.slice(0, 3),
    };
  }, [dashboardActivities]);

  // Project health metrics from project_tasks + activity_risk_metrics (client-side)
  const healthMetrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tasks = projectTasks;
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter(
      (t) => String((t.status ?? "").toLowerCase().trim()) === "done"
    ).length;
    const blockedTasks = tasks.filter(
      (t) => String((t.status ?? "").toLowerCase().trim()) === "blocked"
    ).length;
    const overdueTasks = tasks.filter((t) => {
      if (!t.due_date) return false;
      const status = String((t.status ?? "").toLowerCase().trim());
      if (status === "done") return false;
      const due = new Date(t.due_date);
      due.setHours(0, 0, 0, 0);
      return due < today;
    }).length;
    const unassignedTasks = tasks.filter(
      (t) => !t.assignee_profile_id
    ).length;
    const openOrPending = tasks.filter(
      (t) => String((t.status ?? "").toLowerCase().trim()) === "pending"
    ).length;
    const inProgressTasks = tasks.filter(
      (t) => String((t.status ?? "").toLowerCase().trim()) === "in_progress"
    ).length;
    const reviewTasks = tasks.filter(
      (t) => String((t.status ?? "").toLowerCase().trim()) === "review"
    ).length;

    const upcomingTasks = tasks
      .filter((t) => {
        const s = String((t.status ?? "").toLowerCase().trim());
        if (s === "done" || !t.due_date) return false;
        const due = new Date(t.due_date);
        due.setHours(0, 0, 0, 0);
        return due >= today;
      })
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
      .slice(0, 8);

    const highRiskActivitiesCount = riskMetricsList.filter(
      (r) => r.risk_level === "HIGH"
    ).length;
    const mediumRiskActivitiesCount = riskMetricsList.filter(
      (r) => r.risk_level === "MEDIUM"
    ).length;

    const progressPct =
      totalTasks === 0
        ? null
        : Math.round((doneTasks / totalTasks) * 100);
    const progressFromActivities =
      dashboardActivities.length > 0 && projectActivityStats.avgProgress !== null
        ? projectActivityStats.avgProgress
        : null;
    const progressGeneral = progressFromActivities ?? progressPct ?? 0;

    return {
      totalTasks,
      doneTasks,
      blockedTasks,
      overdueTasks,
      unassignedTasks,
      openOrPending,
      inProgressTasks,
      reviewTasks,
      upcomingTasks,
      highRiskActivitiesCount,
      mediumRiskActivitiesCount,
      progressGeneral,
    };
  }, [projectTasks, riskMetricsList, dashboardActivities.length, projectActivityStats.avgProgress]);

  // Activity feed items for Project HQ (last 10: tasks, tickets, pages)
  const projectHQActivityItems = useMemo((): ActivityItem[] => {
    const items: ActivityItem[] = [];
    const projectIdVal = projectId;
    projectTasks.forEach((t) => {
      items.push({
        id: t.id,
        type: String((t.status ?? "").toLowerCase()) === "done" ? "task_completed" : "task_created",
        title: t.title ?? "Tarea",
        date: t.created_at,
        href: `/projects/${projectIdVal}/tasks`,
      });
    });
    todayTickets.forEach((t) => {
      items.push({
        id: t.id,
        type: "ticket_created",
        title: t.title ?? "Ticket",
        date: t.created_at,
        href: getTicketDetailHref(t.id, projectIdVal),
      });
    });
    suggestedKnowledge.forEach((p) => {
      items.push({
        id: p.id,
        type: "page_updated",
        title: p.title ?? "Página",
        date: p.updated_at ?? p.created_at ?? "",
        href: `/knowledge/${p.id}${projectIdVal ? `?projectId=${projectIdVal}` : ""}`,
      });
    });
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items.slice(0, 10);
  }, [projectId, projectTasks, todayTickets, suggestedKnowledge]);

  // Priority tasks for Action Zone: overdue or blocked, max 3
  const priorityTasksForAction = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return projectTasks
      .filter((t) => {
        const s = String((t.status ?? "").toLowerCase().trim());
        if (s === "done") return false;
        if (s === "blocked") return true;
        return t.due_date != null && t.due_date < today;
      })
      .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
      .slice(0, 3);
  }, [projectTasks]);

  // Merged recent activity (tasks, tickets, pages, notes) for dashboard, max 8
  const recentActivityMerged = useMemo((): ProjectRecentActivityItem[] => {
    const list: ProjectRecentActivityItem[] = [
      ...projectHQActivityItems.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        date: item.date,
        href: item.href,
      })),
      ...notes.map((n) => ({
        id: n.id,
        type: "note_created" as const,
        title: n.title ?? "Sin título",
        date: n.created_at,
        href: `/notes/${n.id}`,
      })),
    ];
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list.slice(0, 8);
  }, [projectHQActivityItems, notes]);

  // Project Health Score (client-side from existing metrics; 0–100)
  const projectHealthScore = useMemo(() => {
    const totalActivities = Math.max(1, dashboardActivities.length);
    const overdueRatio = healthMetrics.totalTasks > 0 ? healthMetrics.overdueTasks / healthMetrics.totalTasks : 0;
    const blockedRatio = healthMetrics.totalTasks > 0 ? healthMetrics.blockedTasks / healthMetrics.totalTasks : 0;
    const highRiskRatio = healthMetrics.highRiskActivitiesCount / totalActivities;

    const raw =
      healthMetrics.progressGeneral * 0.3 +
      (1 - overdueRatio) * 100 * 0.25 +
      (1 - blockedRatio) * 100 * 0.2 +
      (1 - highRiskRatio) * 100 * 0.25;
    const score = Math.round(Math.max(0, Math.min(100, raw)));
    const label = score >= 80 ? "Healthy" : score >= 60 ? "Attention" : "At Risk";
    return { score, label };
  }, [healthMetrics, dashboardActivities.length]);

  // Risk by phase: from projectPhases + dashboardActivities + riskMetricsList (read-only)
  const riskByPhase = useMemo(() => {
    const riskMap = new Map<string, string>();
    riskMetricsList.forEach((r) => riskMap.set(r.activity_id, r.risk_level));
    return projectPhases.map((phase) => {
      const phaseActivities = dashboardActivities.filter((a) => a.phase_id === phase.id);
      let high = 0;
      let medium = 0;
      let low = 0;
      phaseActivities.forEach((a) => {
        const level = riskMap.get(a.id);
        if (level === "HIGH") high++;
        else if (level === "MEDIUM") medium++;
        else if (level === "LOW") low++;
      });
      return { phaseId: phase.id, phaseName: phase.name, high, medium, low };
    });
  }, [projectPhases, dashboardActivities, riskMetricsList]);

  // Project Intelligence: derive insights from already-loaded data (max 3)
  const projectInsights = useMemo(() => {
    const insights: { type: string; text: string; details?: string }[] = [];
    const activityById = new Map(dashboardActivities.map((a) => [a.id, a]));

    const highRisk = riskMetricsList.filter((r) => r.risk_level === "HIGH");
    for (const r of highRisk) {
      if (insights.length >= 3) break;
      const name = activityById.get(r.activity_id)?.name ?? "Actividad";
      insights.push({ type: "high_risk_activity", text: "Actividad en riesgo alto", details: name });
    }

    if (insights.length < 3 && healthMetrics.overdueTasks > 0) {
      insights.push({
        type: "overdue_tasks",
        text: `${healthMetrics.overdueTasks} tareas vencidas`,
      });
    }
    if (insights.length < 3 && healthMetrics.blockedTasks > 0) {
      insights.push({
        type: "blocked_tasks",
        text: `${healthMetrics.blockedTasks} tareas bloqueadas`,
      });
    }

    return insights.slice(0, 3);
  }, [healthMetrics.overdueTasks, healthMetrics.blockedTasks, riskMetricsList, dashboardActivities]);

  // Recent activity: notes + tickets merged by created_at
  const recentActivity = useMemo(() => {
    const items: { type: "note" | "ticket"; id: string; title: string; created_at: string; href: string }[] = [];
    notes.forEach((n) => {
      items.push({
        type: "note",
        id: n.id,
        title: n.title ?? "Sin título",
        created_at: n.created_at,
        href: `/notes/${n.id}`,
      });
    });
    todayTickets.forEach((t) => {
      items.push({
        type: "ticket",
        id: t.id,
        title: t.title,
        created_at: t.created_at,
        href: getTicketDetailHref(t.id, projectId),
      });
    });
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return items.slice(0, 10);
  }, [notes, todayTickets]);

  // Visual Insights: tasks by status (from projectTasks / healthMetrics)
  const tasksByStatusChartData = useMemo(() => {
    const data = [
      { name: getTaskStatusLabel("pending"), count: healthMetrics.openOrPending, fill: "#94a3b8" },
      { name: getTaskStatusLabel("in_progress"), count: healthMetrics.inProgressTasks, fill: "#3b82f6" },
      { name: getTaskStatusLabel("review"), count: healthMetrics.reviewTasks, fill: "#8b5cf6" },
      { name: getTaskStatusLabel("blocked"), count: healthMetrics.blockedTasks, fill: "#ef4444" },
      { name: getTaskStatusLabel("done"), count: healthMetrics.doneTasks, fill: "#10b981" },
    ];
    return data.filter((d) => d.count > 0).length > 0 ? data : [];
  }, [healthMetrics.openOrPending, healthMetrics.inProgressTasks, healthMetrics.reviewTasks, healthMetrics.blockedTasks, healthMetrics.doneTasks]);

  // Visual Insights: activities per phase (from dashboardActivities + projectPhases)
  const activitiesByPhaseChartData = useMemo(() => {
    return projectPhases.map((phase) => ({
      name: phase.name,
      count: dashboardActivities.filter((a) => a.phase_id === phase.id).length,
    }));
  }, [projectPhases, dashboardActivities]);

  // ECharts options: Tasks by status (donut) — aligned with Dashboard quality
  const tasksByStatusEChartsOption = useMemo((): EChartsOption | null => {
    if (tasksByStatusChartData.length === 0) return null;
    const total = tasksByStatusChartData.reduce((acc, d) => acc + d.count, 0);
    const TOOLTIP = {
      backgroundColor: "#1e293b",
      borderColor: "#334155",
      textStyle: { color: "#e2e8f0", fontSize: 12 },
      padding: [10, 12],
      extraCssText: "line-height: 1.5;",
    };
    return {
      tooltip: {
        ...TOOLTIP,
        trigger: "item",
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number; percent?: number };
          const pc = typeof p.percent === "number" ? p.percent.toFixed(1) : "0";
          return `<span style="color:#94a3b8">Status</span><br/><span style="color:#f1f5f9;font-weight:600">${p.name}</span><br/><span style="color:#94a3b8">Tasks</span><br/><span style="color:#e2e8f0;font-weight:600">${p.value}</span><br/><span style="color:#94a3b8">% of total</span><br/><span style="color:#e2e8f0;font-weight:600">${pc}%</span>`;
        },
      },
      legend: { show: false },
      graphic: [
        {
          type: "text",
          left: "50%",
          top: "46%",
          style: {
            text: total.toString(),
            textAlign: "center",
            fill: "#e2e8f0",
            fontSize: 20,
            fontWeight: 600,
            lineHeight: 24,
          } as Record<string, unknown>,
          z: 10,
        },
        {
          type: "text",
          left: "50%",
          top: "58%",
          style: {
            text: "Tasks",
            textAlign: "center",
            fill: "#94a3b8",
            fontSize: 11,
            fontWeight: 500,
          } as Record<string, unknown>,
          z: 10,
        },
      ] as EChartsOption["graphic"],
      series: [
        {
          type: "pie",
          radius: ["54%", "78%"],
          center: ["50%", "52%"],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: "#1e293b", borderWidth: 2 },
          label: { show: false },
          emphasis: { scale: false, itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,0.2)" } },
          data: tasksByStatusChartData.map((d) => ({
            name: d.name,
            value: d.count,
            itemStyle: { color: d.fill },
          })),
        },
      ],
    };
  }, [tasksByStatusChartData]);

  // ECharts options: Activities by phase (horizontal bar)
  const activitiesByPhaseEChartsOption = useMemo((): EChartsOption | null => {
    if (activitiesByPhaseChartData.length === 0) return null;
    const GRID = { left: "0%", right: "8%", top: "8%", bottom: "8%", containLabel: true };
    const AXIS_LABEL = { color: "#94a3b8", fontSize: 11 };
    const SPLIT_LINE = { lineStyle: { color: "#334155", type: "dashed" as const } };
    const TOOLTIP = {
      backgroundColor: "#1e293b",
      borderColor: "#334155",
      textStyle: { color: "#e2e8f0", fontSize: 12 },
      padding: [10, 12],
      extraCssText: "line-height: 1.5;",
    };
    return {
      color: ["#6366f1"],
      tooltip: {
        ...TOOLTIP,
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const p = Array.isArray(params) ? params[0] : params;
          const payload = p as { name?: string; value?: number };
          const name = payload.name ?? "";
          const count = payload.value ?? 0;
          return `<span style="color:#94a3b8">Phase</span><br/><span style="color:#f1f5f9;font-weight:600">${name}</span><br/><span style="color:#94a3b8">Activities</span><br/><span style="color:#e2e8f0;font-weight:600">${count}</span>`;
        },
      },
      grid: { ...GRID, left: "22%" },
      xAxis: {
        type: "value",
        axisLabel: AXIS_LABEL,
        splitLine: SPLIT_LINE,
        axisLine: { show: true, lineStyle: { color: "#334155" } },
      },
      yAxis: {
        type: "category",
        data: activitiesByPhaseChartData.map((d) => d.name),
        axisLabel: { ...AXIS_LABEL, width: 76, overflow: "truncate" },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: "bar",
          barWidth: "58%",
          barMaxWidth: 20,
          data: activitiesByPhaseChartData.map((d) => d.count),
          itemStyle: { borderRadius: [0, 4, 4, 0] },
        },
      ],
    };
  }, [activitiesByPhaseChartData]);

  // ==========================
  // Render
  // ==========================

  if (loading) {
    return <ProjectOverviewSkeleton />;
  }

  if (projectLoadFailed || !project) {
    return (
      <div className="-mx-4 sm:-mx-5 lg:-mx-6 xl:-mx-8 2xl:-mx-10 bg-slate-950">
        <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-center min-h-[40vh] w-full min-w-0">
            <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center">
              <h1 className="text-lg font-semibold text-slate-100 mb-2">Proyecto no encontrado</h1>
              <p className="text-sm text-slate-500 mb-4">
                No hemos podido cargar la información de este proyecto. Es posible que haya sido eliminado o que la URL no sea correcta.
              </p>
              <button
                type="button"
                onClick={() => router.push("/projects")}
                className="rounded-xl border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-600 transition-colors"
              >
                Volver a proyectos
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-5 lg:-mx-6 xl:-mx-8 2xl:-mx-10 bg-slate-950">
      <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-8">
        <div className="min-w-0 space-y-6">
        {errorMsg && (
          <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {errorMsg}
          </div>
        )}

        {planGeneratedFailed && (
          <div className="rounded-xl border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            No se pudo generar el plan inicial de actividades SAP Activate. El proyecto se creó correctamente; puedes añadir actividades manualmente o volver a intentar más tarde.
          </div>
        )}

        {/* Section 1 — Project Header */}
        <header className="rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 className="text-lg font-semibold text-slate-100 sm:text-xl">{project?.name ?? "—"}</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
                {project?.status && (
                  <span className="inline-flex items-center rounded-lg border border-slate-600/80 bg-slate-800/90 px-2.5 py-0.5 text-xs font-medium text-slate-200">
                    {STATUS_LABELS[project.status] ?? project.status}
                  </span>
                )}
                <span className="tabular-nums text-slate-300">{healthMetrics.progressGeneral}% completado</span>
                {clientName && <span className="text-slate-500">{clientName}</span>}
              </div>
              <p className="text-xs text-slate-500">
                {projectTasksLoading || loadingTickets ? "—" : (
                  <>
                    {membersCount} miembros · {healthMetrics.totalTasks} tareas · {openTicketsCount} tickets abiertos
                    {healthMetrics.overdueTasks > 0 && ` · ${healthMetrics.overdueTasks} vencidos`}
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Link href={`/projects/${projectId}/planning`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors">
                <CalendarDays className="h-3.5 w-3.5" /> Planning
              </Link>
              <Link href={`/projects/${projectId}/tasks`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors">
                <CheckSquare className="h-3.5 w-3.5" /> Tasks
              </Link>
              <Link href={`/projects/${projectId}/tickets`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors">
                <Ticket className="h-3.5 w-3.5" /> Tickets
              </Link>
              <Link href={`/projects/${projectId}/notes?new=1`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors">
                <FileText className="h-3.5 w-3.5" /> Nota
              </Link>
            </div>
          </div>
        </header>

        {/* Section 2 — Project Health */}
        <ProjectHealthStrip
          projectId={projectId}
          overdueTasks={healthMetrics.overdueTasks}
          openTickets={openTicketsCount}
          blockedTasks={healthMetrics.blockedTasks}
          loading={projectTasksLoading || loadingTickets}
        />

        {/* Section 3 — Action Zone */}
        <ProjectActionZone
          projectId={projectId}
          priorityTasks={priorityTasksForAction}
          openTickets={todayTickets}
          tasksLoading={projectTasksLoading}
          ticketsLoading={loadingTickets}
        />

        {/* Section 4 — Recent Activity */}
        <ProjectRecentActivity
          items={recentActivityMerged}
          loading={projectTasksLoading && todayTickets.length === 0 && suggestedKnowledge.length === 0 && notes.length === 0}
          maxItems={8}
        />

        {/* Section 5 — Analytics */}
        <ProjectAnalyticsSection
          projectId={projectId}
          taskChartOption={tasksByStatusEChartsOption}
          ticketsOpen={openTicketsCount}
          ticketsOverdue={overdueTicketsCount}
          ticketsUrgent={urgentTicketsCount}
          loading={projectTasksLoading || loadingTickets}
        />

        {/* Section 6 — Knowledge Summary */}
        <ProjectKnowledgeSummaryCompact
          projectId={projectId}
          spaces={knowledgeSpacesCount}
          pages={knowledgePagesCount}
          notesCount={stats?.total_notes}
          loading={loadingKnowledgeCounts || loadingStats}
        />
        </div>
      </div>
    </div>
  );
}


// ==========================
// Componentes auxiliares
// ==========================

const STATUS_LABELS: Record<string, string> = {
  planned: "Planificado",
  in_progress: "En progreso",
  completed: "Completado",
  archived: "Archivado",
  paused: "En pausa",
};

const STATUS_STYLES: Record<string, string> = {
  in_progress: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  completed: "bg-blue-50 text-blue-700 ring-blue-200",
  paused: "bg-amber-50 text-amber-700 ring-amber-200",
};

function ProjectStatusBadge({ status }: { status: string }) {
  const friendlyStatus = STATUS_LABELS[status] ?? status;
  const style = STATUS_STYLES[status] ?? "bg-slate-50 text-slate-700 ring-slate-200";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {friendlyStatus}
    </span>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  error,
}: {
  title: string;
  value: string;
  subtitle: string;
  error?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm flex flex-col justify-between">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1">{title}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      {error ? (
        <p className="text-[11px] text-red-600 mt-1">{error}</p>
      ) : (
        <p className="text-[11px] text-slate-500 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

function MetricActionCard({
  title,
  value,
  subtitle,
  href,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm flex flex-col gap-2 hover:border-slate-300 hover:shadow transition"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-400">{icon}</span>
        <span className="text-2xl font-semibold text-slate-900">{value}</span>
      </div>
      <p className="text-[11px] font-medium text-slate-700">{title}</p>
      <p className="text-[11px] text-slate-400">{subtitle}</p>
      <span className="text-[11px] font-medium text-indigo-600 mt-auto">
        Ir →
      </span>
    </Link>
  );
}
