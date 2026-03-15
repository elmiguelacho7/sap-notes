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
import { FileText, BookOpen, Link as LinkIcon, Ticket, CalendarDays, AlertTriangle, CalendarClock, User, Ban, Plus, CheckSquare, ListTodo, BarChart3 } from "lucide-react";
import { getSuggestedKnowledgeForProject } from "@/lib/knowledgeService";
import { getTicketDetailHref } from "@/lib/routes";
import type { KnowledgePage } from "@/lib/types/knowledge";
import { ProjectOverviewSkeleton } from "@/components/skeletons/ProjectOverviewSkeleton";
import { SapitoInsights } from "@/components/projects/SapitoInsights";
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
  const [todayTickets, setTodayTickets] = useState<TicketSummary[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

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
      <div className="w-full min-w-0 bg-slate-950">
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
    );
  }

  return (
    <div className="w-full min-w-0 space-y-8 bg-slate-950">
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

        {/* Hero: project identity + metrics + quick actions — dashboard header */}
        <header className="relative overflow-hidden rounded-2xl border border-slate-700/90 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-900/95 shadow-xl shadow-black/20 ring-1 ring-slate-700/50">
          <div className="relative p-4 sm:p-6 md:p-8 lg:p-10">
            <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="space-y-3">
                  <h1 className="text-xl font-semibold text-slate-100 sm:text-2xl">{project?.name ?? "—"}</h1>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-400">
                    {clientName && <span className="font-medium text-slate-300">{clientName}</span>}
                    {project?.status && (
                      <span className="inline-flex items-center rounded-lg border border-slate-600/80 bg-slate-800/90 px-3 py-1 text-xs font-medium text-slate-200">
                        {STATUS_LABELS[project.status] ?? project.status}
                      </span>
                    )}
                    {project?.start_date && project?.planned_end_date && (
                      <span className="text-slate-500">
                        {new Date(project.start_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                        {" – "}
                        {new Date(project.planned_end_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Project workspace · Overview</p>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3 border-t border-slate-700/80 pt-5">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Health</span>
                    <span className={`text-xl font-bold tabular-nums ${projectHealthScore.label === "Healthy" ? "text-emerald-400" : projectHealthScore.label === "Attention" ? "text-amber-400" : "text-red-400"}`}>
                      {projectTasksLoading ? "—" : projectHealthScore.score}
                    </span>
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Progress</span>
                    <span className="text-xl font-bold tabular-nums text-slate-100">{healthMetrics.progressGeneral}%</span>
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Open tickets</span>
                    <span className="text-xl font-bold tabular-nums text-slate-100">{loadingTickets ? "—" : openTicketsCount}</span>
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Overdue</span>
                    <span className="text-xl font-bold tabular-nums text-slate-100">{projectTasksLoading ? "—" : healthMetrics.overdueTasks}</span>
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 shrink-0 md:mt-0">
                <Link href={`/projects/${projectId}/planning`} className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-3 text-sm font-medium text-slate-100 hover:bg-slate-700 hover:border-slate-500 transition-colors shadow-sm">
                  <CalendarDays className="h-4 w-4 shrink-0" /> Planning
                </Link>
                <Link href={`/projects/${projectId}/tasks`} className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-3 text-sm font-medium text-slate-100 hover:bg-slate-700 hover:border-slate-500 transition-colors shadow-sm">
                  <CheckSquare className="h-4 w-4 shrink-0" /> Tasks
                </Link>
                <Link href={`/projects/${projectId}/tickets`} className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-3 text-sm font-medium text-slate-100 hover:bg-slate-700 hover:border-slate-500 transition-colors shadow-sm">
                  <Ticket className="h-4 w-4 shrink-0" /> Tickets
                </Link>
                <Link href={`/projects/${projectId}/notes?new=1`} className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-3 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 hover:border-indigo-400/50 transition-colors shadow-sm">
                  <FileText className="h-4 w-4 shrink-0" /> Add note
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Sapito Insights */}
        <section>
          <SapitoInsights projectId={projectId} />
        </section>

        {/* Executive overview: KPI cards */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 mb-4 uppercase tracking-widest">Executive overview</h2>
          {projectTasksLoading ? (
            <p className="text-sm text-slate-500 py-8">Cargando indicadores…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 sm:p-5 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
                <p className="text-xs uppercase text-slate-400">Health score</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100">{projectHealthScore.score}</p>
                <p className={`mt-0.5 text-sm font-medium ${projectHealthScore.label === "Healthy" ? "text-emerald-400" : projectHealthScore.label === "Attention" ? "text-amber-400" : "text-red-400"}`}>
                  {projectHealthScore.label}
                </p>
              </div>
              <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 sm:p-5 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
                <p className="text-xs uppercase text-slate-400">Progress</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100">{healthMetrics.progressGeneral}%</p>
                <div className="mt-2 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500/90 transition-all duration-300" style={{ width: `${healthMetrics.progressGeneral}%` }} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 sm:p-5 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
                <p className="text-xs uppercase text-slate-400">Current phase</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{planningSummary.currentPhase?.name ?? "—"}</p>
                {planningSummary.currentPhase?.end_date && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    End: {new Date(planningSummary.currentPhase.end_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 sm:p-5 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
                <p className="text-xs uppercase text-slate-400">Operational snapshot</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-300">
                  {openTicketsCount} open tickets · {healthMetrics.overdueTasks} overdue · {healthMetrics.blockedTasks} blocked
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Project tickets: operational block */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 mb-4 uppercase tracking-widest">Tickets</h2>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-lg shadow-black/5 ring-1 ring-slate-700/30 overflow-hidden">
            <div className="p-6 md:p-8">
              {loadingTickets ? (
                <div className="flex flex-wrap gap-4 items-center text-slate-500">
                  <span>—</span> <span>—</span> <span>—</span>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                    <span className="text-slate-300"><strong className="text-slate-100 tabular-nums">{openTicketsCount}</strong> abiertos</span>
                    <span className="text-slate-300"><strong className="text-slate-100 tabular-nums">{overdueTicketsCount}</strong> vencidos</span>
                    <span className="text-slate-300"><strong className="text-slate-100 tabular-nums">{unassignedTicketsCount}</strong> sin asignar</span>
                  </div>
                  {todayTickets.length > 0 && (
                    <ul className="mt-4 space-y-1">
                      {todayTickets.slice(0, 5).map((t) => (
                        <li key={t.id}>
                          <Link href={getTicketDetailHref(t.id, projectId)} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/60 hover:text-slate-100 transition-colors duration-150">
                            <span className="font-medium truncate">{t.title}</span>
                            <span className="shrink-0 text-xs text-slate-500">{new Date(t.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4">
                    <Link href={`/projects/${projectId}/tickets`} className="text-sm font-medium text-indigo-400 hover:text-indigo-300">
                      Ver todos los tickets
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Operational intelligence: charts + focus + risk + insights in one panel */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 mb-4 uppercase tracking-widest">Operational intelligence</h2>
          {projectTasksLoading ? (
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-lg shadow-black/5 ring-1 ring-slate-700/30 overflow-hidden p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Skeleton className="h-48 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-lg shadow-black/5 ring-1 ring-slate-700/30 overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                <div className="lg:col-span-2 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-700/60">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-b md:border-b-0 md:border-r border-slate-700/60">
                    <div className="p-6 bg-slate-800/30 flex flex-col">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Tasks by status</h3>
                      <div className="flex-1 min-h-[200px] flex items-center justify-center">
                        {tasksByStatusEChartsOption == null ? (
                          <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-6">
                            <BarChart3 className="h-9 w-9 text-slate-600" aria-hidden />
                            <p className="text-sm font-medium text-slate-400">No task status data yet.</p>
                            <p className="text-xs text-slate-500 max-w-[180px]">Create tasks to see the breakdown by status.</p>
                          </div>
                        ) : (
                          <div className="h-[200px] w-full">
                            <ReactECharts option={tasksByStatusEChartsOption} style={{ height: "100%", width: "100%" }} opts={{ renderer: "canvas" }} notMerge />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="p-6 bg-slate-800/20 flex flex-col">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Activities by phase</h3>
                      <div className="flex-1 min-h-[200px] flex items-center justify-center">
                        {activitiesLoading || loadingProjectPhases ? (
                          <Skeleton className="h-full min-h-[200px] w-full rounded-xl" />
                        ) : activitiesByPhaseEChartsOption == null ? (
                          <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-6">
                            <BarChart3 className="h-9 w-9 text-slate-600" aria-hidden />
                            <p className="text-sm font-medium text-slate-400">Phase activity will appear here</p>
                            <p className="text-xs text-slate-500 max-w-[200px]">once planning and activities are configured.</p>
                          </div>
                        ) : (
                          <div className="h-[200px] w-full">
                            <ReactECharts option={activitiesByPhaseEChartsOption} style={{ height: "100%", width: "100%" }} opts={{ renderer: "canvas" }} notMerge />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-6 md:p-6 flex flex-col gap-6 bg-slate-900/50">
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Today / immediate focus</h3>
                    <ul className="space-y-0.5 text-sm">
                      <Link href={`/projects/${projectId}/planning/activities`} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-slate-300 hover:bg-slate-800/70 transition-colors duration-150">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        <span>High-risk activities</span>
                        <span className="ml-auto font-semibold tabular-nums text-slate-100">{healthMetrics.highRiskActivitiesCount}</span>
                      </Link>
                      <Link href={`/projects/${projectId}/tasks`} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-slate-300 hover:bg-slate-800/70 transition-colors duration-150">
                        <CalendarClock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span>Overdue tasks</span>
                        <span className="ml-auto font-semibold tabular-nums text-slate-100">{healthMetrics.overdueTasks}</span>
                      </Link>
                      <Link href={`/projects/${projectId}/tasks`} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-slate-300 hover:bg-slate-800/70 transition-colors duration-150">
                        <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>Unassigned tasks</span>
                        <span className="ml-auto font-semibold tabular-nums text-slate-100">{healthMetrics.unassignedTasks}</span>
                      </Link>
                      <Link href={`/projects/${projectId}/tasks`} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-slate-300 hover:bg-slate-800/70 transition-colors duration-150">
                        <Ban className={`h-3.5 w-3.5 shrink-0 ${healthMetrics.blockedTasks > 0 ? "text-red-400" : "text-emerald-400"}`} />
                        <span>Blocked tasks</span>
                        <span className="ml-auto font-semibold tabular-nums text-slate-100">{healthMetrics.blockedTasks}</span>
                      </Link>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Phase risk</h3>
                    {riskByPhase.length === 0 ? (
                      <p className="text-sm text-slate-500">No phases or activities yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {riskByPhase.map(({ phaseId, phaseName, high, medium, low }) => (
                          <li key={phaseId} className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-medium text-slate-300 truncate">{phaseName}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {high > 0 && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-medium text-red-300">High {high}</span>}
                              {medium > 0 && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-300">Med {medium}</span>}
                              {low > 0 && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">Low {low}</span>}
                              {high === 0 && medium === 0 && low === 0 && <span className="text-slate-500 text-[10px]">—</span>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Insights</h3>
                    {projectInsights.length === 0 ? (
                      <p className="text-sm text-slate-500">No signals requiring attention right now.</p>
                    ) : (
                      <ul className="space-y-2">
                        {projectInsights.map((insight, i) => (
                          <li key={`${insight.type}-${i}`} className="flex items-start gap-2 text-sm">
                            {insight.type === "high_risk_activity" && <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />}
                            {insight.type === "overdue_tasks" && <CalendarClock className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />}
                            {insight.type === "blocked_tasks" && <Ban className="h-4 w-4 shrink-0 text-orange-400 mt-0.5" />}
                            <span className="text-slate-300">{insight.text}{insight.details != null && <span className="block text-xs text-slate-500 mt-0.5 truncate">{insight.details}</span>}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Current work context: what needs attention now */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 mb-4 uppercase tracking-widest">Current work context</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-lg shadow-black/5 ring-1 ring-slate-700/30 p-6">
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Upcoming tasks</h3>
              <p className="text-xs text-slate-500 mb-4">Next 8 by due date (open or in progress).</p>
              {healthMetrics.upcomingTasks.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">No upcoming tasks for now. Add tasks with due dates to see them here.</p>
              ) : (
                <ul className="space-y-1">
                  {healthMetrics.upcomingTasks.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-xs hover:bg-slate-800/60 transition-colors duration-150">
                      <span className="font-medium text-slate-200 truncate">{t.title}</span>
                      <span className="shrink-0 text-slate-500 tabular-nums">{t.due_date ? new Date(t.due_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "—"}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${String((t.status ?? "").toLowerCase().trim()) === "blocked" ? "bg-red-500/20 text-red-300" : String((t.status ?? "").toLowerCase().trim()) === "in_progress" ? "bg-indigo-500/20 text-indigo-300" : String((t.status ?? "").toLowerCase().trim()) === "review" ? "bg-violet-500/20 text-violet-300" : "bg-slate-500/20 text-slate-400"}`}>
                        {getTaskStatusLabel(t.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href={`/projects/${projectId}/tasks`} className="mt-4 inline-block text-xs font-medium text-indigo-400 hover:text-indigo-300">View task board →</Link>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-lg shadow-black/5 ring-1 ring-slate-700/30 p-6">
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Task status summary</h3>
              <p className="text-xs text-slate-500 mb-4">Breakdown by status.</p>
              {healthMetrics.totalTasks === 0 ? (
                <p className="text-sm text-slate-500 py-4">No tasks yet. Create the first task in Tasks.</p>
              ) : (
                <div className="space-y-4">
                  {[
                    { label: getTaskStatusLabel("pending"), count: healthMetrics.openOrPending, bar: "bg-slate-400" },
                    { label: getTaskStatusLabel("in_progress"), count: healthMetrics.inProgressTasks, bar: "bg-indigo-500" },
                    ...(healthMetrics.reviewTasks > 0 ? [{ label: getTaskStatusLabel("review"), count: healthMetrics.reviewTasks, bar: "bg-violet-500" }] : []),
                    { label: getTaskStatusLabel("blocked"), count: healthMetrics.blockedTasks, bar: "bg-red-500" },
                    { label: getTaskStatusLabel("done"), count: healthMetrics.doneTasks, bar: "bg-emerald-500" },
                  ].map(({ label, count, bar }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="w-24 text-xs text-slate-500 shrink-0">{label}</span>
                      <div className="h-2 flex-1 min-w-0 rounded-full bg-slate-800 overflow-hidden">
                        <div className={`h-full rounded-full ${bar} transition-all duration-300`} style={{ width: `${healthMetrics.totalTasks > 0 ? (count / healthMetrics.totalTasks) * 100 : 0}%` }} />
                      </div>
                      <span className="text-xs font-medium tabular-nums text-slate-300 w-6 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Knowledge & planning: project knowledge */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 mb-4 uppercase tracking-widest">Project knowledge</h2>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-lg shadow-black/5 ring-1 ring-slate-700/30 px-6 py-5">
            {suggestedKnowledge.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">No recent project knowledge yet. Link pages from Project Knowledge.</p>
            ) : (
              <ul className="space-y-0.5">
                {suggestedKnowledge.map((page) => (
                  <li key={page.id}>
                    <Link href={`/knowledge/${page.id}?projectId=${projectId}`} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800/60 transition-colors duration-150">
                      <BookOpen className="h-4 w-4 shrink-0 text-slate-500" />
                      <span className="truncate">{page.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/projects/${projectId}/knowledge`} className="mt-4 inline-block text-sm font-medium text-indigo-400 hover:text-indigo-300">View project knowledge →</Link>
          </div>
        </section>

        {/* Planning summary */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 mb-4 uppercase tracking-widest">Planning summary</h2>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-lg shadow-black/5 ring-1 ring-slate-700/30 p-6">
            <div className="flex justify-end mb-4">
              <Link href={`/projects/${projectId}/planning`} className="text-sm font-medium text-indigo-400 hover:text-indigo-300">
                View planning
              </Link>
            </div>

            {loadingProjectPhases ? (
              <p className="text-sm text-slate-500">Loading phases…</p>
            ) : projectPhases.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">Planning details will appear here once phases and activities are configured.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Current phase</span>
                  <div className="mt-1 text-sm font-semibold text-slate-100">{planningSummary.currentPhase?.name ?? "—"}</div>
                </div>
                {planningSummary.projectTimeProgress != null && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Project time progress</span>
                      <span className="text-xs font-medium tabular-nums text-slate-300">{planningSummary.projectTimeProgress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-indigo-500/90 rounded-full transition-all duration-300" style={{ width: `${planningSummary.projectTimeProgress}%` }} />
                    </div>
                  </div>
                )}
                {planningSummary.nextPhaseStart && (
                  <div className="text-xs text-slate-500">
                    Next phase: <span className="font-medium text-slate-300">{planningSummary.nextPhaseStart.name}</span> (expected start {new Date(planningSummary.nextPhaseStart.start_date).toLocaleDateString("es-ES", { dateStyle: "short" })})
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Activity status */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 mb-4 uppercase tracking-widest">Activity status</h2>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-lg shadow-black/5 ring-1 ring-slate-700/30 p-6">
            <div className="flex justify-end mb-4">
              <Link href={`/projects/${projectId}/planning/activities`} className="text-sm font-medium text-indigo-400 hover:text-indigo-300">
                View all
              </Link>
            </div>

            {activitiesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : projectActivityStats.total === 0 ? (
              <p className="text-sm text-slate-500 py-2">No activities yet. Create activities in Planning.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-4 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
                    <p className="text-xs uppercase text-slate-400">Total</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100">{projectActivityStats.total}</p>
                  </div>
                  <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-4 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
                    <p className="text-xs uppercase text-slate-400">In progress</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100">{projectActivityStats.inProgress}</p>
                  </div>
                  <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-4 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
                    <p className="text-xs uppercase text-slate-400">Blocked</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100">{projectActivityStats.blocked}</p>
                  </div>
                  <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-4 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
                    <p className="text-xs uppercase text-slate-400">Delayed</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100">{projectActivityStats.delayed}</p>
                  </div>
                  <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-4 hover:border-slate-600 hover:shadow-sm transition-all duration-150 sm:col-span-2 lg:col-span-1">
                    <p className="text-xs uppercase text-slate-400">Avg. progress</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100">{projectActivityStats.avgProgress !== null ? `${projectActivityStats.avgProgress}%` : "—"}</p>
                  </div>
                </div>

                {(projectActivityStats.blockedList.length > 0 || projectActivityStats.delayedList.length > 0) && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {projectActivityStats.blockedList.length > 0 && (
                      <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-4 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Blocked activities</div>
                        <ul className="space-y-1.5">
                          {projectActivityStats.blockedList.map((act) => (
                            <li key={act.id} className="text-xs text-slate-400 flex justify-between gap-3">
                              <span className="truncate">{act.name}</span>
                              {act.due_date && <span className="shrink-0 text-slate-500 tabular-nums">Due {act.due_date}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {projectActivityStats.delayedList.length > 0 && (
                      <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-4 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Delayed activities</div>
                        <ul className="space-y-1.5">
                          {projectActivityStats.delayedList.map((act) => (
                            <li key={act.id} className="text-xs text-slate-400 flex justify-between gap-3">
                              <span className="truncate">{act.name}</span>
                              {act.due_date && <span className="shrink-0 text-slate-500 tabular-nums">Due {act.due_date}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* SAP Activate Plan */}
        {(activatePlan?.phases?.length ?? 0) > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-slate-500 mb-4 uppercase tracking-widest">SAP Activate plan</h2>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-lg shadow-black/5 ring-1 ring-slate-700/30 px-6 py-5">
              {loadingActivatePlan ? (
                <div className="flex flex-wrap gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-9 w-40 rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {activatePlan?.phases?.map((phase) => {
                    const pct = phase.completionPercent;
                    const traffic = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-slate-500";
                    return (
                      <div key={phase.phase_key} className="inline-flex items-center gap-2.5 rounded-xl border border-slate-700/60 bg-slate-800/60 px-4 py-2.5 text-xs shadow-sm">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${traffic}`} title={`${phase.completedTasks}/${phase.totalTasks} completed`} />
                        <span className="font-medium text-slate-200">{phase.name}</span>
                        <span className="text-slate-500 tabular-nums">
                          {new Date(phase.start_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}–{new Date(phase.end_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                        </span>
                        <span className="text-slate-400 tabular-nums">{phase.completedTasks}/{phase.totalTasks} · {phase.completionPercent}%</span>
                      </div>
                    );
                  }) ?? null}
                </div>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link href={`/projects/${projectId}/planning`} className="text-sm font-medium text-indigo-400 hover:text-indigo-300">Edit phases →</Link>
                <Link href={`/projects/${projectId}/planning`} className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-100 hover:bg-slate-700 transition-colors">
                  Go to planning
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Recent activity & impact */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 mb-4 uppercase tracking-widest">Recent activity & impact</h2>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-lg shadow-black/5 ring-1 ring-slate-700/30 px-6 py-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Modules impacted</h3>
              <p className="text-xs text-slate-500 mt-0.5">SAP modules with linked notes.</p>
              {loadingStats ? (
                <Skeleton className="mt-4 h-8 w-16 rounded-xl" />
              ) : (
                <p className="mt-4 text-2xl font-bold tabular-nums text-slate-100">{stats != null ? stats.modules_impacted : "—"}</p>
              )}
              <Link href={`/projects/${projectId}/notes`} className="mt-4 inline-block text-xs font-medium text-indigo-400 hover:text-indigo-300">View notes by module →</Link>
            </div>
            <div className="lg:col-span-2 rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-lg shadow-black/5 ring-1 ring-slate-700/30 px-6 py-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Project activity log</h3>
              <p className="text-xs text-slate-500 mt-0.5">Latest notes and tickets.</p>
              {loadingNotes || loadingTickets ? (
                <div className="mt-4 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-xl" />
                  ))}
                </div>
              ) : recentActivity.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 py-2">No recent activity yet. Add the first note or ticket.</p>
              ) : (
                <ul className="mt-4 space-y-0.5">
                  {recentActivity.map((item) => (
                    <li key={`${item.type}-${item.id}`}>
                      <Link href={item.href} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800/60 transition-colors duration-150">
                        <span className="font-medium text-slate-100 truncate">{item.title}</span>
                        <span className="shrink-0 inline-flex items-center rounded-full border border-slate-600/60 bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-400">{item.type === "note" ? "Note" : "Ticket"}</span>
                        <span className="text-[10px] text-slate-500 tabular-nums">{new Date(item.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link href={`/projects/${projectId}/notes`} className="text-xs font-medium text-indigo-400 hover:text-indigo-300">View notes</Link>
                <span className="text-slate-600">·</span>
                <Link href={`/projects/${projectId}/tickets`} className="text-xs font-medium text-indigo-400 hover:text-indigo-300">View tickets</Link>
              </div>
            </div>
          </div>
        </section>

        {/* Quick access — cards */}
        <section className="min-w-0">
          <h2 className="text-xs font-semibold text-slate-500 mb-4 uppercase tracking-widest">Quick access</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href={`/projects/${projectId}/notes`} className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 cursor-pointer hover:bg-slate-800/60 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
              <div className="text-slate-400"><FileText className="h-5 w-5" /></div>
              <p className="mt-2 text-sm font-medium text-slate-200">Notes</p>
              <p className="mt-0.5 text-xs text-slate-400">Project notes and documentation</p>
            </Link>
            <Link href={`/projects/${projectId}/brain`} className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 cursor-pointer hover:bg-slate-800/60 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
              <div className="text-slate-400"><BookOpen className="h-5 w-5" /></div>
              <p className="mt-2 text-sm font-medium text-slate-200">Brain</p>
              <p className="mt-0.5 text-xs text-slate-400">AI assistant and context</p>
            </Link>
            <Link href={`/projects/${projectId}/links`} className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 cursor-pointer hover:bg-slate-800/60 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
              <div className="text-slate-400"><LinkIcon className="h-5 w-5" /></div>
              <p className="mt-2 text-sm font-medium text-slate-200">Links</p>
              <p className="mt-0.5 text-xs text-slate-400">References and resources</p>
            </Link>
            <Link href={`/projects/${projectId}/members`} className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 cursor-pointer hover:bg-slate-800/60 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
              <div className="text-slate-400"><User className="h-5 w-5" /></div>
              <p className="mt-2 text-sm font-medium text-slate-200">Team</p>
              <p className="mt-0.5 text-xs text-slate-400">Members and permissions</p>
            </Link>
          </div>
        </section>
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
