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
import { FileText, BookOpen, Link as LinkIcon, Ticket, CalendarDays, AlertTriangle, CalendarClock, User, Ban, Plus, CheckSquare, ListTodo } from "lucide-react";
import { getSuggestedKnowledgeForProject } from "@/lib/knowledgeService";
import type { KnowledgePage } from "@/lib/types/knowledge";
import { PageShell } from "@/components/layout/PageShell";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

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

/** Display-only mapping: task status -> Spanish label (does not change stored values). */
function getTaskStatusLabel(status: string | null | undefined): string {
  const s = String((status ?? "").toLowerCase().trim());
  const map: Record<string, string> = {
    pending: "Por hacer",
    in_progress: "En progreso",
    blocked: "Bloqueada",
    review: "En revisión",
    done: "Hecha",
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

  const loadProject = useCallback(async (): Promise<boolean> => {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, description, status, start_date, planned_end_date, created_at")
      .eq("id", projectId)
      .single();

    if (error) {
      handleSupabaseError("projects", error);
      setProject(null);
      setProjectLoadFailed(true);
      return false;
    }

    setProject(data as Project);
    setProjectLoadFailed(false);
    return true;
  }, [projectId]);

  const { setHeaderActions } = useProjectWorkspace();
  useEffect(() => {
    if (!project) return;
    setHeaderActions(
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative" ref={createMenuRef}>
          <button
            type="button"
            onClick={() => setCreateMenuOpen((o) => !o)}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 text-sm font-medium text-slate-200 shadow-sm hover:bg-slate-700 hover:text-white transition-colors"
            aria-expanded={createMenuOpen}
            aria-haspopup="true"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>+ Crear</span>
          </button>
          {createMenuOpen && (
            <div
              className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
              role="menu"
            >
              <Link
                href={`/projects/${projectId}/tasks?new=1`}
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
                onClick={() => setCreateMenuOpen(false)}
              >
                <CheckSquare className="h-4 w-4 shrink-0" />
                Nueva tarea
              </Link>
              <Link
                href={`/projects/${projectId}/notes?new=1`}
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
                onClick={() => setCreateMenuOpen(false)}
              >
                <FileText className="h-4 w-4 shrink-0" />
                Nueva nota
              </Link>
              <Link
                href={`/projects/${projectId}/tickets?new=1`}
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
                onClick={() => setCreateMenuOpen(false)}
              >
                <Ticket className="h-4 w-4 shrink-0" />
                Nuevo ticket
              </Link>
              <Link
                href={`/projects/${projectId}/planning/activities?new=1`}
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
                onClick={() => setCreateMenuOpen(false)}
              >
                <ListTodo className="h-4 w-4 shrink-0" />
                Nueva actividad
              </Link>
            </div>
          )}
        </div>
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
  // Fetch project tickets (open count + today list)
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
          .eq("status", "open"),
        supabase
          .from("tickets")
          .select("id, title, priority, status, created_at")
          .eq("project_id", projectId)
          .neq("status", "closed")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (cancelled) return;
      setOpenTicketsCount(countRes.count ?? 0);
      setTodayTickets((listRes.data ?? []) as TicketSummary[]);
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
        href: `/tickets/${t.id}`,
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

  // ==========================
  // Render
  // ==========================

  if (loading) {
    return (
      <PageShell>
        <p className="text-sm text-slate-500">Cargando proyecto…</p>
      </PageShell>
    );
  }

  if (projectLoadFailed || !project) {
    return (
      <PageShell>
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
            <h1 className="text-lg font-semibold text-slate-900 mb-2">
              Proyecto no encontrado
            </h1>
            <p className="text-sm text-slate-600 mb-4">
              No hemos podido cargar la información de este proyecto. Es
              posible que haya sido eliminado o que la URL no sea correcta.
            </p>
            <button
              type="button"
              onClick={() => router.push("/projects")}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Volver a proyectos
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="space-y-8">
        {errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] text-red-700">
            {errorMsg}
          </div>
        )}

        {planGeneratedFailed && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No se pudo generar el plan inicial de actividades SAP Activate. El proyecto se creó correctamente; puedes añadir actividades manualmente o volver a intentar generar el plan más tarde.
          </div>
        )}

        {/* 1) Project Health — hero block first for hierarchy */}
        <section>
          <h2 className="text-sm font-semibold text-slate-800 mb-1">Salud del proyecto</h2>
          <p className="text-xs text-slate-500 mb-5">
            Estado general, progreso y fase actual.
          </p>
          {projectTasksLoading ? (
            <p className="text-xs text-slate-500 py-6">Cargando indicadores…</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Puntuación
                </p>
                <p
                  className={`mt-2 text-4xl font-semibold tracking-tight ${
                    projectHealthScore.label === "Healthy"
                      ? "text-emerald-700"
                      : projectHealthScore.label === "Attention"
                        ? "text-amber-700"
                        : "text-red-700"
                  }`}
                >
                  {projectHealthScore.score}
                </p>
                <p
                  className={`text-sm font-medium mt-1 ${
                    projectHealthScore.label === "Healthy"
                      ? "text-emerald-600"
                      : projectHealthScore.label === "Attention"
                        ? "text-amber-600"
                        : "text-red-600"
                  }`}
                >
                  {projectHealthScore.label}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Progreso, vencidas, bloqueadas y riesgo.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Progreso general
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {healthMetrics.progressGeneral}%
                </p>
                <div className="mt-3 h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${healthMetrics.progressGeneral}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {dashboardActivities.length > 0
                    ? "Promedio de avance de actividades"
                    : "Tareas hechas / total"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Fase actual
                </p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {planningSummary.currentPhase?.name ?? "—"}
                </p>
                {planningSummary.currentPhase?.end_date && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Fin previsto:{" "}
                    {new Date(planningSummary.currentPhase.end_date).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                    {(() => {
                      const end = new Date(planningSummary.currentPhase!.end_date!);
                      end.setHours(0, 0, 0, 0);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const days = Math.ceil((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
                      if (days > 0) return ` · ${days} días restantes`;
                      if (days === 0) return " · Hoy";
                      return ` · Hace ${-days} días`;
                    })()}
                  </p>
                )}
                {!planningSummary.currentPhase?.end_date && planningSummary.currentPhase && (
                  <p className="text-[11px] text-slate-500 mt-0.5">Sin fecha de fin</p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* 2) KPI summary */}
        <section>
          <h2 className="text-sm font-semibold text-slate-800 mb-1">Indicadores</h2>
          <p className="text-xs text-slate-500 mb-5">
            Resumen de notas, tickets y actividades del proyecto.
          </p>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
            <KpiCard
              title="Notas totales"
              value={loadingStats ? "..." : (stats != null ? String(stats.total_notes) : "—")}
              subtitle="Memoria funcional acumulada."
              error={errorStats ?? undefined}
            />
            <KpiCard
              title="Notas con error"
              value={loadingStats ? "..." : (stats != null ? String(stats.error_notes) : "—")}
              subtitle="Incidencias detectadas."
            />
            <KpiCard
              title="Módulos impactados"
              value={loadingStats ? "..." : (stats != null ? String(stats.modules_impacted) : "—")}
              subtitle="Módulos SAP con notas asociadas."
            />
            <KpiCard
              title="Tickets abiertos"
              value={loadingTickets ? "..." : String(openTicketsCount)}
              subtitle="Tickets en estado abierto."
            />
            <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Actividades del proyecto
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {activityStats ? activityStats.total : "—"}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {activityStats
                  ? `${activityStats.active} activas · ${activityStats.blocked} bloqueadas · ${activityStats.overdue} vencidas`
                  : loadingActivityStats
                    ? "Cargando resumen de actividades…"
                    : "—"}
              </p>
              {activityStats && (
                <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${activityStats.completionRate}%` }}
                  />
                </div>
              )}
            </section>
          </div>
        </section>

        {/* 3) Visual Insights */}
        <section>
          <h2 className="text-sm font-semibold text-slate-800 mb-1">Visual Insights</h2>
          <p className="text-xs text-slate-500 mb-5">
            Resumen visual a partir de tareas y actividades ya cargadas.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[280px] flex flex-col">
              <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/50 shrink-0">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Tareas por estado
                </h3>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-center">
                {projectTasksLoading ? (
                  <p className="text-sm text-slate-500">Cargando…</p>
                ) : tasksByStatusChartData.length === 0 ? (
                  <p className="text-sm text-slate-500 py-10 text-center">Sin datos suficientes</p>
                ) : (
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                        <Pie
                          data={tasksByStatusChartData}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        >
                          {tasksByStatusChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number | undefined) => [value ?? 0, "Tareas"]}
                          contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[280px] flex flex-col">
              <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/50 shrink-0">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Actividades por fase
                </h3>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-center">
                {activitiesLoading || loadingProjectPhases ? (
                  <p className="text-sm text-slate-500">Cargando…</p>
                ) : activitiesByPhaseChartData.length === 0 ? (
                  <p className="text-sm text-slate-500 py-10 text-center">Sin datos suficientes</p>
                ) : (
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={activitiesByPhaseChartData}
                        margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                        layout="vertical"
                      >
                        <XAxis type="number" tick={{ fontSize: 11 }} stroke="#64748b" />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={90}
                          tick={{ fontSize: 11 }}
                          stroke="#64748b"
                        />
                        <Tooltip
                          formatter={(value: number | undefined) => [value ?? 0, "Actividades"]}
                          contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                        />
                        <Bar dataKey="count" fill="#6366f1" name="count" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 4) Contexto operativo: alertas, riesgo, próximas tareas */}
        <section>
          <h2 className="text-sm font-semibold text-slate-800 mb-1">
            Contexto operativo
          </h2>
          <p className="text-xs text-slate-500 mb-5">
            Alertas, riesgo por fase, próximas tareas y estados.
          </p>

          {projectTasksLoading ? (
            <p className="text-xs text-slate-500">Cargando indicadores…</p>
          ) : (
            <>
              {/* KPI row: Vencidas, Bloqueadas, Riesgo alto */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Vencidas</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{healthMetrics.overdueTasks}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Tareas con fecha límite pasada</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Bloqueadas</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{healthMetrics.blockedTasks}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Tareas en estado bloqueado</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Riesgo alto</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{healthMetrics.highRiskActivitiesCount}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Actividades con riesgo alto</p>
                </div>
              </div>

              {/* Row A: Hoy | Riesgo por fase | Project Intelligence */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm h-full flex flex-col">
                  <h3 className="text-xs font-semibold text-slate-800 mb-0.5">Hoy</h3>
                  <p className="text-[11px] text-slate-500 mb-2">Alertas y enlaces rápidos.</p>
                  <ul className="space-y-0.5 text-sm flex-1">
                    <Link href={`/projects/${projectId}/planning/activities`} className="flex items-center gap-2 rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50 transition-colors">
                      <span className="text-red-500 shrink-0"><AlertTriangle className="h-3.5 w-3.5" /></span>
                      <span>Actividades riesgo alto</span>
                      <span className="ml-auto font-semibold text-slate-900">{healthMetrics.highRiskActivitiesCount}</span>
                    </Link>
                    <Link href={`/projects/${projectId}/tasks`} className="flex items-center gap-2 rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50 transition-colors">
                      <span className="text-amber-500 shrink-0"><CalendarClock className="h-3.5 w-3.5" /></span>
                      <span>Tareas vencidas</span>
                      <span className="ml-auto font-semibold text-slate-900">{healthMetrics.overdueTasks}</span>
                    </Link>
                    <Link href={`/projects/${projectId}/tasks`} className="flex items-center gap-2 rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50 transition-colors">
                      <span className="text-amber-500 shrink-0"><User className="h-3.5 w-3.5" /></span>
                      <span>Tareas sin asignar</span>
                      <span className="ml-auto font-semibold text-slate-900">{healthMetrics.unassignedTasks}</span>
                    </Link>
                    <Link href={`/projects/${projectId}/tasks`} className="flex items-center gap-2 rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50 transition-colors">
                      <span
                        className={`shrink-0 ${
                          healthMetrics.blockedTasks > 0 ? "text-red-500" : "text-emerald-500"
                        }`}
                      ><Ban className="h-3.5 w-3.5" /></span>
                      <span>Tareas bloqueadas</span>
                      <span className="ml-auto font-semibold text-slate-900">{healthMetrics.blockedTasks}</span>
                    </Link>
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm h-full flex flex-col">
                  <h3 className="text-xs font-semibold text-slate-800 mb-0.5">Riesgo por fase</h3>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Actividades por nivel de riesgo por fase.
                  </p>
                  {riskByPhase.length === 0 ? (
                    <p className="text-xs text-slate-500">Sin fases o actividades.</p>
                  ) : (
                    <ul className="space-y-2 flex-1">
                      {riskByPhase.map(({ phaseId, phaseName, high, medium, low }) => (
                        <li key={phaseId} className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium text-slate-800 truncate">{phaseName}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {high > 0 && (
                              <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                                Alto {high}
                              </span>
                            )}
                            {medium > 0 && (
                              <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                Med {medium}
                              </span>
                            )}
                            {low > 0 && (
                              <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                Bajo {low}
                              </span>
                            )}
                            {high === 0 && medium === 0 && low === 0 && (
                              <span className="text-slate-400 text-[10px]">—</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm h-full flex flex-col">
                  <h3 className="text-xs font-semibold text-slate-800 mb-0.5">Inteligencia del proyecto</h3>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Señales derivadas de actividades, tareas y estado actual del proyecto.
                  </p>
                  {projectInsights.length === 0 ? (
                    <p className="text-sm text-slate-500">Sin señales relevantes en este momento.</p>
                  ) : (
                    <ul className="space-y-2 flex-1">
                      {projectInsights.map((insight, i) => (
                        <li key={`${insight.type}-${i}`} className="flex items-start gap-2 text-sm">
                          {insight.type === "high_risk_activity" && (
                            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                          )}
                          {insight.type === "overdue_tasks" && (
                            <CalendarClock className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                          )}
                          {insight.type === "blocked_tasks" && (
                            <Ban className="h-4 w-4 shrink-0 text-orange-500 mt-0.5" />
                          )}
                          <span className="text-slate-700">
                            {insight.text}
                            {insight.details != null && (
                              <span className="block text-xs text-slate-500 mt-0.5 truncate">{insight.details}</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Row B: Próximas tareas (left) | Estados de tareas (right) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm h-full flex flex-col">
                  <h3 className="text-xs font-semibold text-slate-800 mb-0.5">
                    Próximas tareas
                  </h3>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Próximas 8 por fecha límite (abiertas o en progreso).
                  </p>
                  {healthMetrics.upcomingTasks.length === 0 ? (
                    <p className="text-xs text-slate-500">No hay tareas próximas con fecha.</p>
                  ) : (
                    <ul className="space-y-2">
                      {healthMetrics.upcomingTasks.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs hover:bg-slate-50 transition-colors"
                        >
                          <span className="font-medium text-slate-800 truncate">
                            {t.title}
                          </span>
                          <span className="shrink-0 text-slate-500">
                            {t.due_date
                              ? new Date(t.due_date).toLocaleDateString("es-ES", {
                                  day: "2-digit",
                                  month: "short",
                                })
                              : "—"}
                          </span>
                          <span
                            className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              String((t.status ?? "").toLowerCase().trim()) === "blocked"
                                ? "bg-red-100 text-red-700"
                                : String((t.status ?? "").toLowerCase().trim()) === "in_progress"
                                  ? "bg-blue-100 text-blue-700"
                                  : String((t.status ?? "").toLowerCase().trim()) === "review"
                                    ? "bg-violet-100 text-violet-700"
                                    : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {getTaskStatusLabel(t.status)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    href={`/projects/${projectId}/tasks`}
                    className="mt-3 inline-block text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Ver tablero de tareas →
                  </Link>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm h-full flex flex-col">
                  <h3 className="text-xs font-semibold text-slate-800 mb-0.5">
                    Estados de tareas
                  </h3>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Desglose por estado.
                  </p>
                  {healthMetrics.totalTasks === 0 ? (
                    <p className="text-xs text-slate-500">Sin tareas aún.</p>
                  ) : (
                    <div className="space-y-2">
                      {[
                        {
                          label: getTaskStatusLabel("pending"),
                          count: healthMetrics.openOrPending,
                          bar: "bg-slate-400",
                        },
                        {
                          label: getTaskStatusLabel("in_progress"),
                          count: healthMetrics.inProgressTasks,
                          bar: "bg-blue-500",
                        },
                        ...(healthMetrics.reviewTasks > 0
                          ? [
                              {
                                label: getTaskStatusLabel("review"),
                                count: healthMetrics.reviewTasks,
                                bar: "bg-violet-500",
                              },
                            ]
                          : []),
                        {
                          label: getTaskStatusLabel("blocked"),
                          count: healthMetrics.blockedTasks,
                          bar: "bg-red-500",
                        },
                        {
                          label: getTaskStatusLabel("done"),
                          count: healthMetrics.doneTasks,
                          bar: "bg-emerald-500",
                        },
                      ].map(({ label, count, bar }) => (
                        <div key={label} className="flex items-center gap-2">
                          <span className="w-24 text-[11px] text-slate-600 shrink-0">
                            {label}
                          </span>
                          <div className="h-2 flex-1 min-w-0 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${bar} transition-all`}
                              style={{
                                width: `${
                                  healthMetrics.totalTasks > 0
                                    ? (count / healthMetrics.totalTasks) * 100
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                          <span className="text-[11px] font-medium text-slate-700 w-6 text-right">
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Suggested Knowledge — elevated as distinct capability */}
              <div className="mt-8 pt-8 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-800 mb-0.5">
                  Knowledge del proyecto
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Páginas de conocimiento vinculadas a este proyecto.
                </p>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 px-5 py-5">
                  {suggestedKnowledge.length === 0 ? (
                    <p className="text-sm text-slate-500">Ninguna página vinculada aún.</p>
                  ) : (
                    <ul className="space-y-1">
                      {suggestedKnowledge.map((page) => (
                        <li key={page.id}>
                          <Link
                            href={`/knowledge/${page.id}`}
                            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-white hover:shadow-sm transition-colors"
                          >
                            <BookOpen className="h-[18px] w-[18px] shrink-0 text-slate-400" />
                            <span className="truncate">{page.title}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    href={`/projects/${projectId}/knowledge`}
                    className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Ver Knowledge del proyecto →
                  </Link>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Resumen de planificación */}
        <section>
          <h2 className="text-sm font-semibold text-slate-800 mb-1">Resumen de planificación</h2>
          <p className="text-xs text-slate-500 mb-5">Vista rápida de las fases SAP Activate de este proyecto.</p>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex justify-end mb-4">
              <button
                type="button"
                onClick={() => router.push(`/projects/${projectId}/planning`)}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                Ver planificación
              </button>
            </div>

            {loadingProjectPhases ? (
              <p className="text-xs text-slate-500">Cargando fases…</p>
            ) : projectPhases.length === 0 ? (
              <p className="text-xs text-slate-500">
                Este proyecto aún no tiene fases configuradas. Configúralas en la pestaña de Planificación.
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-slate-500">Fase actual</span>
                  <div className="text-sm font-semibold text-slate-900">
                    {planningSummary.currentPhase?.name ?? "Sin definir"}
                  </div>
                </div>

                {planningSummary.projectTimeProgress != null && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">
                        Progreso temporal del proyecto
                      </span>
                      <span className="text-xs font-medium text-slate-700">
                        {planningSummary.projectTimeProgress}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${planningSummary.projectTimeProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {planningSummary.nextPhaseStart && (
                  <div className="text-xs text-slate-500">
                    Próxima fase:{" "}
                    <span className="font-medium text-slate-800">
                      {planningSummary.nextPhaseStart.name}
                    </span>{" "}
                    (inicio previsto {new Date(planningSummary.nextPhaseStart.start_date).toLocaleDateString("es-ES", { dateStyle: "short" })})
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Estado de actividades */}
        <section>
          <h2 className="text-sm font-semibold text-slate-800 mb-1">Estado de actividades</h2>
          <p className="text-xs text-slate-500 mb-5">Resumen del plan de trabajo del proyecto.</p>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex justify-end mb-4">
              <button
                type="button"
                onClick={() => router.push(`/projects/${projectId}/planning/activities`)}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                Ver todas
              </button>
            </div>

            {activitiesLoading ? (
              <p className="text-xs text-slate-500">Cargando actividades…</p>
            ) : projectActivityStats.total === 0 ? (
              <p className="text-xs text-slate-500">
                Este proyecto aún no tiene actividades definidas.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="text-[11px] text-slate-500">Total</div>
                    <div className="text-lg font-semibold text-slate-900">
                      {projectActivityStats.total}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="text-[11px] text-slate-500">En progreso</div>
                    <div className="text-lg font-semibold text-slate-900">
                      {projectActivityStats.inProgress}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="text-[11px] text-slate-500">Bloqueadas</div>
                    <div className="text-lg font-semibold text-slate-900">
                      {projectActivityStats.blocked}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="text-[11px] text-slate-500">Retrasadas</div>
                    <div className="text-lg font-semibold text-slate-900">
                      {projectActivityStats.delayed}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="text-[11px] text-slate-500">% avance medio</div>
                    <div className="text-lg font-semibold text-slate-900">
                      {projectActivityStats.avgProgress !== null
                        ? `${projectActivityStats.avgProgress}%`
                        : "—"}
                    </div>
                  </div>
                </div>

                {(projectActivityStats.blockedList.length > 0 ||
                  projectActivityStats.delayedList.length > 0) && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {projectActivityStats.blockedList.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-slate-800 mb-1">
                          Actividades bloqueadas
                        </div>
                        <ul className="space-y-1">
                          {projectActivityStats.blockedList.map((act) => (
                            <li
                              key={act.id}
                              className="text-xs text-slate-700 flex justify-between gap-3"
                            >
                              <span className="truncate">{act.name}</span>
                              {act.due_date && (
                                <span className="shrink-0 text-slate-500">
                                  Fin {act.due_date}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {projectActivityStats.delayedList.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-slate-800 mb-1">
                          Actividades retrasadas
                        </div>
                        <ul className="space-y-1">
                          {projectActivityStats.delayedList.map((act) => (
                            <li
                              key={act.id}
                              className="text-xs text-slate-700 flex justify-between gap-3"
                            >
                              <span className="truncate">{act.name}</span>
                              {act.due_date && (
                                <span className="shrink-0 text-slate-500">
                                  Fin {act.due_date}
                                </span>
                              )}
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
            <h2 className="text-sm font-semibold text-slate-800 mb-1">Plan SAP Activate</h2>
            <p className="text-xs text-slate-500 mb-5">Fases y fechas planificadas · Actividades por fase.</p>
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              {loadingActivatePlan ? (
                <p className="text-sm text-slate-500">Cargando…</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {activatePlan?.phases?.map((phase) => {
                    const pct = phase.completionPercent;
                    const traffic = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-slate-300";
                    return (
                      <div
                        key={phase.phase_key}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs"
                      >
                        <span className={`h-2 w-2 rounded-full ${traffic}`} title={`${phase.completedTasks}/${phase.totalTasks} completadas`} />
                        <span className="font-medium text-slate-800">{phase.name}</span>
                        <span className="text-slate-500">
                          {new Date(phase.start_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                          –{new Date(phase.end_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                        </span>
                        <span className="text-slate-400">
                          {phase.completedTasks}/{phase.totalTasks} · {phase.completionPercent}%
                        </span>
                      </div>
                    );
                  }) ?? null}
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link href={`/projects/${projectId}/planning`} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                  Editar fases del proyecto →
                </Link>
                <Link
                  href={`/projects/${projectId}/planning`}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Ir a planificación
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Module impact + Recent activity */}
        <section>
          <h2 className="text-sm font-semibold text-slate-800 mb-1">Impacto y actividad</h2>
          <p className="text-xs text-slate-500 mb-5">Módulos impactados y actividad reciente del proyecto.</p>
          <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800">Impacto por módulos</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Módulos SAP con notas asociadas.</p>
              {loadingStats ? (
                <p className="mt-3 text-[11px] text-slate-500">Cargando…</p>
              ) : (
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {stats != null ? stats.modules_impacted : "—"}
                </p>
              )}
              <Link href={`/projects/${projectId}/notes`} className="mt-2 inline-block text-[11px] font-medium text-indigo-600 hover:text-indigo-800">
                Ver notas por módulo →
              </Link>
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800">Actividad reciente</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Últimas notas y tickets del proyecto.</p>
              {loadingNotes || loadingTickets ? (
                <p className="mt-3 text-[11px] text-slate-500">Cargando…</p>
              ) : recentActivity.length === 0 ? (
                <p className="mt-3 text-[11px] text-slate-500">Sin actividad reciente.</p>
              ) : (
                <ul className="mt-3 space-y-0.5">
                  {recentActivity.map((item) => (
                    <li key={`${item.type}-${item.id}`}>
                      <Link
                        href={item.href}
                        className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <span className="font-medium text-slate-900 truncate">{item.title}</span>
                        <span className="shrink-0 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                          {item.type === "note" ? "Nota" : "Ticket"}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link href={`/projects/${projectId}/notes`} className="mt-2 inline-block text-[11px] font-medium text-indigo-600 hover:text-indigo-800">
                Ver todas las notas
              </Link>
              <span className="mx-2 text-slate-300">·</span>
              <Link href={`/projects/${projectId}/tickets`} className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800">
                Ver todos los tickets
              </Link>
            </div>
          </div>
          </div>
        </section>

        {/* Accesos rápidos */}
        <section>
          <h2 className="text-sm font-semibold text-slate-800 mb-1">Accesos rápidos</h2>
          <p className="text-xs text-slate-500 mb-5">Notas, knowledge, enlaces, tickets y planificación.</p>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <MetricActionCard
              title="Notas del proyecto"
              value={loadingStats ? "…" : (stats != null ? String(stats.total_notes) : "—")}
              subtitle="Memoria funcional"
              href={`/projects/${projectId}/notes`}
              icon={<FileText className="h-5 w-5" />}
            />
            <MetricActionCard
              title="Base de conocimiento"
              value="—"
              subtitle="Documentación y procedimientos"
              href={`/projects/${projectId}/knowledge`}
              icon={<BookOpen className="h-5 w-5" />}
            />
            <MetricActionCard
              title="Enlaces del proyecto"
              value={loadingLinks ? "…" : String(links.length)}
              subtitle="Accesos rápidos"
              href={`/projects/${projectId}/links`}
              icon={<LinkIcon className="h-5 w-5" />}
            />
            <MetricActionCard
              title="Tickets / Actividad"
              value={loadingTickets ? "…" : String(openTicketsCount)}
              subtitle="Tickets abiertos"
              href={`/projects/${projectId}/tickets`}
              icon={<Ticket className="h-5 w-5" />}
            />
            <MetricActionCard
              title="Planificación"
              value="Fases"
              subtitle="SAP Activate: editar fases y fechas"
              href={`/projects/${projectId}/planning`}
              icon={<CalendarDays className="h-5 w-5" />}
            />
          </div>
        </section>
      </div>
    </PageShell>
  );
}

// ==========================
// Componentes auxiliares
// ==========================

const STATUS_LABELS: Record<string, string> = {
  in_progress: "En progreso",
  completed: "Completado",
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
