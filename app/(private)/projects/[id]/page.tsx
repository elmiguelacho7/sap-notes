"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabaseClient";
import {
  handleSupabaseError,
} from "@/lib/supabaseError";
import { useProjectWorkspace } from "@/components/projects/ProjectWorkspaceContext";
import type { TicketPriority, TicketStatus } from "@/lib/types/ticketTypes";
import { getSuggestedKnowledgeForProject, listSpaces } from "@/lib/knowledgeService";
import { ProjectOverviewSkeleton } from "@/components/skeletons/ProjectOverviewSkeleton";
import { ProjectOverviewCommandBar } from "@/components/projects/ProjectOverviewCommandBar";
import { ProjectExecutiveSignalsStrip } from "@/components/projects/ProjectExecutiveSignalsStrip";
import {
  ProjectTeamLoadPanel,
  type TeamLoadRow,
} from "@/components/projects/ProjectTeamLoadPanel";
import { ProjectRisksBottlenecksPanel } from "@/components/projects/ProjectRisksBottlenecksPanel";
import {
  ProjectTasksPreviewPanel,
  type ProjectTaskPreviewRow,
} from "@/components/projects/ProjectTasksPreviewPanel";
import {
  ProjectTicketsPreviewPanel,
  type ProjectTicketPreviewRow,
} from "@/components/projects/ProjectTicketsPreviewPanel";
import { ProjectKnowledgePanel } from "@/components/projects/ProjectKnowledgePanel";
import { ProjectAIQuickPanel } from "@/components/projects/ProjectAIQuickPanel";
import {
  ProjectRecentWorkPanel,
  type ProjectRecentActivityEvent,
} from "@/components/projects/ProjectRecentWorkPanel";
import type { KnowledgePage } from "@/lib/types/knowledge";
import type { ExecutiveSignalLevel } from "@/lib/projectOverviewExecutive";
import {
  buildRiskBullets,
  daysUntilPlannedEnd,
  executiveDeliveryRisk,
  executiveInsightVariant,
  executiveProjectHealth,
  memberLoadBand,
  memberLoadScore,
} from "@/lib/projectOverviewExecutive";
import { PROJECT_WORKSPACE_PAGE, PROJECT_WORKSPACE_SECTION_STACK } from "@/lib/projectWorkspaceUi";

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
  due_date?: string | null;
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

// ==========================
// Componente principal
// ==========================

export default function ProjectDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = (params?.id ?? "") as string;
  const planGeneratedFailed = searchParams?.get("planGenerated") === "false";
  const tOverview = useTranslations("projects.overview");

  /* eslint-disable @typescript-eslint/no-unused-vars -- full fetch graph retained; overview v2 shows a subset */
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
  const [_loadingActivityStats, setLoadingActivityStats] = useState(false);

  // SAP Activate plan (phases + dates + counts)
  const [_activatePlan, setActivatePlan] = useState<{
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

  const [suggestedKnowledge, setSuggestedKnowledge] = useState<KnowledgePage[]>([]);
  /* eslint-enable @typescript-eslint/no-unused-vars */

  type TeamMemberRow = {
    user_id: string;
    user_full_name: string | null;
    user_email: string | null;
  };
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);

  const [projectActivityFeed, setProjectActivityFeed] = useState<ProjectRecentActivityEvent[]>([]);
  const [loadingProjectActivity, setLoadingProjectActivity] = useState(false);

  const [openTicketsList, setOpenTicketsList] = useState<
    (TicketSummary & { due_date?: string | null; assigned_to?: string | null })[]
  >([]);

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

  const { openProjectCopilotWithMessage, setHeaderActions } = useProjectWorkspace();

  // Project mode: surface project-scoped actions in the shared workspace header.
  useEffect(() => {
    if (!projectId) return;
    setHeaderActions(
      <ProjectOverviewCommandBar
        projectId={projectId}
        permissions={permissions}
        loadProject={loadProject}
        onAskSapito={() => openProjectCopilotWithMessage("")}
      />
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, projectId, permissions, loadProject, openProjectCopilotWithMessage]);

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
  }, [projectId, projectLoadFailed, loadProject]);

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

  // Recent activity (existing /api/activity — filter to this project on the client)
  useEffect(() => {
    if (!projectId || projectLoadFailed) return;
    let cancelled = false;
    setLoadingProjectActivity(true);
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch("/api/activity", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (cancelled) return;
        const data = await res.json().catch(() => ({}));
        const events = (data as { events?: ProjectRecentActivityEvent[] }).events ?? [];
        setProjectActivityFeed(events.filter((e) => e.projectId === projectId));
      } catch {
        if (!cancelled) setProjectActivityFeed([]);
      } finally {
        if (!cancelled) setLoadingProjectActivity(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, projectLoadFailed]);

  useEffect(() => {
    if (!projectId || projectLoadFailed) return;
    let cancelled = false;
    setLoadingProjectActivity(true);
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch("/api/activity", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (cancelled) return;
        const data = await res.json().catch(() => ({}));
        const events = (data as { events?: ProjectRecentActivityEvent[] }).events ?? [];
        setProjectActivityFeed(events.filter((e) => e.projectId === projectId));
      } catch {
        if (!cancelled) setProjectActivityFeed([]);
      } finally {
        if (!cancelled) setLoadingProjectActivity(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
        const members = (data as { members?: TeamMemberRow[] }).members ?? [];
        setTeamMembers(Array.isArray(members) ? members : []);
      } catch {
        if (!cancelled) setTeamMembers([]);
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
      setOpenTicketsList(list);
      setOpenTicketsCount(countRes.count ?? 0);
      const today = new Date().toISOString().slice(0, 10);
      setOverdueTicketsCount(list.filter((t) => t.due_date && t.due_date < today).length);
      setUnassignedTicketsCount(list.filter((t) => !t.assigned_to).length);
      setUrgentTicketsCount(list.filter((t) => t.priority === "urgent" || t.priority === "high").length);
      const sortedForPreview = [...list].sort((a, b) => {
        const ac = a.created_at ?? "";
        const bc = b.created_at ?? "";
        if (ac !== bc) return ac.localeCompare(bc);
        return a.title.localeCompare(b.title);
      });
      setTodayTickets(sortedForPreview.slice(0, 5) as TicketSummary[]);
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
  // Derived metrics (executive summary + previews; same underlying data as before)
  // ==========================

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

    const total = activities.length;
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

  const taskPreviewRows = useMemo((): ProjectTaskPreviewRow[] => {
    const norm = (s: string) => String(s ?? "").toLowerCase().trim();
    const isDone = (s: string) => norm(s) === "done";
    const isBlocked = (s: string) => norm(s) === "blocked";
    const isOverdue = (due: string | null, status: string) => {
      if (!due || isDone(status)) return false;
      const d = new Date(due);
      d.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return d < today;
    };
    return projectTasks
      .filter((t) => !isDone(t.status))
      .slice()
      .sort((a, b) => {
        const aOver = isOverdue(a.due_date, a.status) ? 0 : 1;
        const bOver = isOverdue(b.due_date, b.status) ? 0 : 1;
        if (aOver !== bOver) return aOver - bOver;
        const aBl = isBlocked(a.status) ? 0 : 1;
        const bBl = isBlocked(b.status) ? 0 : 1;
        if (aBl !== bBl) return aBl - bBl;
        const aIp = norm(a.status) === "in_progress" ? 0 : 1;
        const bIp = norm(b.status) === "in_progress" ? 0 : 1;
        if (aIp !== bIp) return aIp - bIp;
        const aDue = a.due_date || "\uffff";
        const bDue = b.due_date || "\uffff";
        if (aDue !== bDue) return aDue.localeCompare(bDue);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.due_date,
        assigneeLabel: t.assignee_profile_id ? "Assigned" : "Unassigned",
        assigneeInitial: t.assignee_profile_id
          ? t.assignee_profile_id.replace(/-/g, "").slice(0, 2).toUpperCase()
          : null,
      }));
  }, [projectTasks]);

  const teamLoadRows = useMemo((): TeamLoadRow[] => {
    const norm = (s: string) => String(s ?? "").toLowerCase().trim();
    const isDone = (s: string) => norm(s) === "done";
    const isBlocked = (s: string) => norm(s) === "blocked";
    const isOverdue = (due: string | null, status: string) => {
      if (!due || isDone(status)) return false;
      const d = new Date(due);
      d.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return d < today;
    };
    const byUser = new Map<string, { tasks: number; tickets: number; blocked: number; overdue: number }>();
    for (const m of teamMembers) {
      byUser.set(m.user_id, { tasks: 0, tickets: 0, blocked: 0, overdue: 0 });
    }
    for (const task of projectTasks) {
      if (isDone(task.status)) continue;
      const uid = task.assignee_profile_id;
      if (!uid || !byUser.has(uid)) continue;
      const row = byUser.get(uid)!;
      row.tasks += 1;
      if (isBlocked(task.status)) row.blocked += 1;
      if (isOverdue(task.due_date, task.status)) row.overdue += 1;
    }
    for (const tk of openTicketsList) {
      const uid = tk.assigned_to;
      if (!uid || !byUser.has(uid)) continue;
      byUser.get(uid)!.tickets += 1;
    }
    return teamMembers
      .map((m) => {
        const acc = byUser.get(m.user_id)!;
        const score = memberLoadScore({
          openTasks: acc.tasks,
          openTickets: acc.tickets,
          blockedItems: acc.blocked,
          overdueItems: acc.overdue,
        });
        const band = memberLoadBand(score);
        return {
          userId: m.user_id,
          displayName: (m.user_full_name || m.user_email || "Member").trim(),
          openTasks: acc.tasks,
          openTickets: acc.tickets,
          blocked: acc.blocked,
          overdue: acc.overdue,
          score,
          band,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [teamMembers, projectTasks, openTicketsList]);

  const daysToEnd = useMemo(
    () => daysUntilPlannedEnd(project?.planned_end_date ?? null),
    [project?.planned_end_date]
  );

  const executiveStrip = useMemo(() => {
    const health = executiveProjectHealth({
      openTickets: openTicketsCount,
      overdueTasks: healthMetrics.overdueTasks,
      blockedTasks: healthMetrics.blockedTasks,
      blockedActivities: projectActivityStats.blocked,
      plannedEndDate: project?.planned_end_date ?? null,
      projectStatus: project?.status ?? null,
    });
    const delivery = executiveDeliveryRisk({
      overdueTasks: healthMetrics.overdueTasks,
      blockedTasks: healthMetrics.blockedTasks,
      blockedActivities: projectActivityStats.blocked,
      overdueTickets: overdueTicketsCount,
      highRiskActivities: healthMetrics.highRiskActivitiesCount,
      mediumRiskActivities: healthMetrics.mediumRiskActivitiesCount,
      daysToEnd,
    });
    const worst = teamLoadRows[0]?.band ?? "light";
    const teamLoadLevel: ExecutiveSignalLevel =
      worst === "overloaded" || worst === "high" ? "watch" : "good";
    const hotMembers = teamLoadRows.filter((r) => r.band === "high" || r.band === "overloaded").length;
    const openIssues = openTicketsCount + healthMetrics.overdueTasks;
    const openIssuesLevel: ExecutiveSignalLevel =
      openIssues > 10 ? "risk" : openIssues > 4 ? "watch" : "good";
    return {
      health,
      delivery,
      teamLoadLevel,
      teamLoadLabel: tOverview(`load.bands.${worst}`),
      teamLoadHelper:
        hotMembers > 0 ? tOverview("signals.teamLoadHelper", { n: hotMembers }) : undefined,
      openIssues,
      openIssuesLevel,
    };
  }, [
    openTicketsCount,
    healthMetrics,
    projectActivityStats.blocked,
    project?.planned_end_date,
    project?.status,
    overdueTicketsCount,
    daysToEnd,
    teamLoadRows,
    tOverview,
  ]);

  const executiveInsightKey = useMemo(() => {
    const worst = teamLoadRows[0]?.band ?? "light";
    return executiveInsightVariant({
      healthLevel: executiveStrip.health.level,
      deliveryLevel: executiveStrip.delivery.level,
      worstLoadBand: worst,
      openIssues: executiveStrip.openIssues,
    });
  }, [
    executiveStrip.delivery.level,
    executiveStrip.health.level,
    executiveStrip.openIssues,
    teamLoadRows,
  ]);

  const teamLoadSummaryLine = useMemo(() => {
    const hot = teamLoadRows.filter((r) => r.band === "high" || r.band === "overloaded").length;
    if (hot >= 3) return tOverview("load.summaryManyHot", { n: hot });
    if (hot === 2) return tOverview("load.summaryTwoHot");
    if (hot === 1) return tOverview("load.summaryOneHot");
    const [a, b] = teamLoadRows;
    if (a && b && a.score >= 7 && b.score >= 7 && teamLoadRows.length >= 2) {
      return tOverview("load.summaryConcentrated");
    }
    return undefined;
  }, [teamLoadRows, tOverview]);

  const riskBullets = useMemo(() => {
    const overloadedMemberCount = teamLoadRows.filter((r) => r.score >= 9).length;
    const onTrack =
      healthMetrics.overdueTasks === 0 &&
      projectActivityStats.blocked === 0 &&
      overdueTicketsCount === 0;
    return buildRiskBullets({
      overdueTasks: healthMetrics.overdueTasks,
      blockedActivities: projectActivityStats.blocked,
      openTickets: openTicketsCount,
      overloadedMemberCount,
      daysToEnd,
      onTrack,
    });
  }, [
    teamLoadRows,
    healthMetrics.overdueTasks,
    projectActivityStats.blocked,
    openTicketsCount,
    overdueTicketsCount,
    daysToEnd,
  ]);

  const openTasksNotDone = useMemo(
    () => projectTasks.filter((t) => String(t.status ?? "").toLowerCase().trim() !== "done").length,
    [projectTasks]
  );

  const currentPhaseLabel = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const sorted = [...projectPhases].sort((a, b) => a.sort_order - b.sort_order);
    const active = sorted.find((p) => p.start_date && p.end_date && today >= p.start_date && today <= p.end_date);
    if (active) return active.name;
    const next = sorted.find((p) => p.start_date && today < p.start_date);
    if (next) return `${next.name} (upcoming)`;
    return sorted[sorted.length - 1]?.name ?? "Not configured";
  }, [projectPhases]);

  const keySignalLabel = useMemo(() => {
    if (healthMetrics.blockedTasks > 0) return `${healthMetrics.blockedTasks} blocked tasks`;
    if (healthMetrics.overdueTasks > 0) return `${healthMetrics.overdueTasks} overdue tasks`;
    if (overdueTicketsCount > 0) return `${overdueTicketsCount} overdue tickets`;
    if (openTicketsCount > 0) return `${openTicketsCount} open tickets`;
    return "No active blockers";
  }, [
    healthMetrics.blockedTasks,
    healthMetrics.overdueTasks,
    overdueTicketsCount,
    openTicketsCount,
  ]);

  const ticketPreviewRows = useMemo((): ProjectTicketPreviewRow[] => {
    return todayTickets.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
    }));
  }, [todayTickets]);

  // ==========================
  // Render
  // ==========================

  if (loading) {
    return <ProjectOverviewSkeleton />;
  }

  if (projectLoadFailed || !project) {
    return (
      <div className={PROJECT_WORKSPACE_PAGE}>
        <div className="flex items-center justify-center min-h-[40vh] w-full min-w-0">
          <div className="w-full max-w-md rounded-xl border border-[rgb(var(--rb-surface-border))]/85 bg-[rgb(var(--rb-surface))]/95 p-6 text-center">
            <h1 className="text-lg font-semibold text-[rgb(var(--rb-text-primary))] mb-2">Proyecto no encontrado</h1>
            <p className="text-sm text-[rgb(var(--rb-text-muted))] mb-4">
              No hemos podido cargar la información de este proyecto. Es posible que haya sido eliminado o que la URL no sea correcta.
            </p>
            <button
              type="button"
              onClick={() => router.push("/projects")}
              className="rounded-xl border border-[rgb(var(--rb-brand-primary))]/35 bg-[rgb(var(--rb-brand-primary))] px-4 py-2 text-sm font-medium text-white hover:bg-[rgb(var(--rb-brand-primary-hover))] transition-colors"
            >
              Volver a proyectos
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={PROJECT_WORKSPACE_PAGE}>
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

      {executiveInsightKey ? (
        <div className="rounded-2xl border border-slate-200/85 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {tOverview("heroEyebrow")}
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800">
            {tOverview(`insight.${executiveInsightKey}`)}
          </p>
        </div>
      ) : null}

      <section className={PROJECT_WORKSPACE_SECTION_STACK}>
        <div className="space-y-1">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">Project health</h2>
          <p className="text-xs text-slate-500">Executive snapshot of delivery risk and immediate attention areas.</p>
        </div>
        <div className="rounded-2xl border border-slate-200/85 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Status</p>
              <p className="mt-1.5 text-base font-semibold text-slate-900">
                {tOverview(`healthLabels.${executiveStrip.health.labelKey}`)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Progress</p>
              <p className="mt-1.5 text-base font-semibold tabular-nums text-slate-900">{healthMetrics.progressGeneral}%</p>
            </div>
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Current phase</p>
              <p className="mt-1.5 text-base font-semibold text-slate-900">{currentPhaseLabel}</p>
            </div>
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Key signal</p>
              <p className="mt-1.5 text-base font-semibold text-slate-900">{keySignalLabel}</p>
            </div>
          </div>
          <div className="mt-4">
            <ProjectExecutiveSignalsStrip
              healthLabel={tOverview(`healthLabels.${executiveStrip.health.labelKey}`)}
              healthLevel={executiveStrip.health.level}
              deliveryLabel={tOverview(`delivery.${executiveStrip.delivery.labelKey}`)}
              deliveryLevel={executiveStrip.delivery.level}
              teamLoadLabel={executiveStrip.teamLoadLabel}
              teamLoadLevel={executiveStrip.teamLoadLevel}
              teamLoadHelper={executiveStrip.teamLoadHelper}
              openIssues={executiveStrip.openIssues}
              openIssuesLevel={executiveStrip.openIssuesLevel}
              progressPct={healthMetrics.progressGeneral}
              loading={projectTasksLoading || loadingTickets}
            />
          </div>
        </div>
      </section>

      <section className={PROJECT_WORKSPACE_SECTION_STACK}>
        <div className="space-y-1">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">Key risks & blockers</h2>
          <p className="text-xs text-slate-500">Top issues that can impact delivery in the current phase.</p>
        </div>
        <ProjectRisksBottlenecksPanel
          bullets={
            riskBullets.length > 0
              ? riskBullets.slice(0, 5)
              : [{ tone: "good", text: "No major risks detected. This project is running smoothly." }]
          }
        />
      </section>

      <section className={PROJECT_WORKSPACE_SECTION_STACK}>
        <div className="space-y-1">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">Execution snapshot</h2>
          <p className="text-xs text-slate-500">Tasks, tickets, and team capacity in one view.</p>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <ProjectTasksPreviewPanel
            projectId={projectId}
            tasks={taskPreviewRows}
            loading={projectTasksLoading}
            overdueCount={healthMetrics.overdueTasks}
            blockedCount={healthMetrics.blockedTasks}
            openTotal={openTasksNotDone}
          />
          <ProjectTicketsPreviewPanel
            projectId={projectId}
            tickets={ticketPreviewRows}
            loading={loadingTickets}
            openCount={openTicketsCount}
            urgentCount={urgentTicketsCount}
          />
          <ProjectTeamLoadPanel rows={teamLoadRows} loading={false} summaryLine={teamLoadSummaryLine} />
        </div>
      </section>

      <section className={PROJECT_WORKSPACE_SECTION_STACK}>
        <div className="space-y-1">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">Recent activity</h2>
          <p className="text-xs text-slate-500">Latest project movements and updates.</p>
        </div>
        <ProjectRecentWorkPanel
          projectId={projectId}
          events={projectActivityFeed}
          loading={loadingProjectActivity}
          openTickets={openTicketsCount}
          notesCount={notes.length}
          linksCount={links.length}
          lastUpdatedAt={stats?.last_update_at}
        />
      </section>

      <section className={PROJECT_WORKSPACE_SECTION_STACK}>
        <div className="space-y-1">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">Knowledge &amp; insights</h2>
          <p className="text-xs text-slate-500">Project context, key documentation, and Sapito prompts.</p>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ProjectKnowledgePanel
            projectId={projectId}
            knowledgeItemsCount={knowledgePagesCount}
            lastUpdatedAt={stats?.last_update_at}
            loading={loadingKnowledgeCounts || loadingStats}
          />
          <ProjectAIQuickPanel />
        </div>
      </section>
    </div>
  );
}
