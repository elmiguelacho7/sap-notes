"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  handleSupabaseError,
} from "@/lib/supabaseError";
import { ObjectActions } from "@/components/ObjectActions";
import type { TicketPriority, TicketStatus } from "@/lib/types/ticketTypes";
import { FileText, BookOpen, Link as LinkIcon, Ticket, CalendarDays } from "lucide-react";

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

  // Permisos del proyecto (Edit / Archive / Delete)
  const [permissions, setPermissions] = useState<{
    canEdit: boolean;
    canArchive: boolean;
    canDelete: boolean;
  } | null>(null);

  // ==========================
  // Carga: proyecto primero, luego datos relacionados
  // ==========================

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

  // Fetch project permissions (canEdit, canArchive, canDelete); fallback to superadmin from /api/me so buttons always show for superadmin
  useEffect(() => {
    if (!projectId || projectLoadFailed) return;
    let cancelled = false;
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [permRes, meRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/permissions`, { headers }),
          fetch("/api/me", { headers }),
        ]);
        if (cancelled) return;
        const permData = await permRes.json().catch(() => ({}));
        const meData = await meRes.json().catch(() => ({ appRole: null }));
        const appRole = (meData as { appRole?: string | null }).appRole ?? null;
        const fromApi = {
          canEdit: (permData as { canEdit?: boolean }).canEdit ?? false,
          canArchive: (permData as { canArchive?: boolean }).canArchive ?? false,
          canDelete: (permData as { canDelete?: boolean }).canDelete ?? false,
        };
        if (appRole === "superadmin") {
          setPermissions({ canEdit: true, canArchive: true, canDelete: true });
        } else {
          setPermissions(fromApi);
        }
      } catch {
        if (!cancelled) setPermissions({ canEdit: false, canArchive: false, canDelete: false });
      }
    }
    load();
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

    fetch(`/api/projects/${projectId}/stats`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErrorStats((data as { error?: string })?.error ?? "Error al cargar estadísticas");
          setStats(null);
          return;
        }
        const data = (await res.json()) as ProjectStats;
        setStats(data);
      })
      .catch(() => {
        if (!cancelled) {
          setErrorStats("Error al cargar estadísticas");
          setStats(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingStats(false);
      });

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

    fetch(`/api/projects/${projectId}/notes?limit=10`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErrorNotes((data as { error?: string })?.error ?? "Error al cargar las notas.");
          setNotes([]);
          return;
        }
        const data = (await res.json()) as { projectId: string; notes: ProjectNoteSummary[] };
        setNotes(data.notes ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setErrorNotes("Error al cargar las notas.");
          setNotes([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingNotes(false);
      });

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

    fetch(`/api/projects/${projectId}/links?limit=10`)
      .then(async (res) => {
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
      })
      .catch(() => {
        if (!cancelled) {
          setErrorLinks("Error al cargar los enlaces.");
          setLinks([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLinks(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, projectLoadFailed]);

  // Fetch activity stats (tasks board)
  useEffect(() => {
    if (!projectId || projectLoadFailed) return;

    let cancelled = false;
    setLoadingActivityStats(true);

    fetch(`/api/projects/${projectId}/activity-stats`)
      .then(async (res) => {
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
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Activity stats fetch failed", err);
          setActivityStats(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingActivityStats(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, projectLoadFailed]);

  // Fetch SAP Activate plan (phases + task counts) when project has dates
  useEffect(() => {
    if (!projectId || projectLoadFailed) return;

    let cancelled = false;
    setLoadingActivatePlan(true);

    fetch(`/api/projects/${projectId}/activate-plan`)
      .then(async (res) => {
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
      })
      .catch(() => {
        if (!cancelled) setActivatePlan(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingActivatePlan(false);
      });

    return () => { cancelled = true; };
  }, [projectId, projectLoadFailed]);

  // Fetch project_phases for planning summary (current phase, next phase, etc.)
  useEffect(() => {
    if (!projectId || projectLoadFailed) return;
    let cancelled = false;
    setLoadingProjectPhases(true);
    supabase
      .from("project_phases")
      .select("id, name, sort_order, start_date, end_date")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setProjectPhases([]);
          return;
        }
        setProjectPhases((data ?? []) as ProjectPhaseRow[]);
      })
      .finally(() => {
        if (!cancelled) setLoadingProjectPhases(false);
      });
    return () => { cancelled = true; };
  }, [projectId, projectLoadFailed]);

  // Fetch project_activities for "Estado de actividades" card
  useEffect(() => {
    if (!projectId || projectLoadFailed) return;
    let cancelled = false;
    setActivitiesLoading(true);
    supabase
      .from("project_activities")
      .select("id, project_id, phase_id, name, status, priority, start_date, due_date, progress_pct")
      .eq("project_id", projectId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Error loading project activities", error);
          setDashboardActivities([]);
        } else {
          setDashboardActivities((data ?? []) as DashboardProjectActivity[]);
        }
      })
      .finally(() => {
        if (!cancelled) setActivitiesLoading(false);
      });
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

  // ==========================
  // Render
  // ==========================

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">Cargando proyecto…</p>
      </div>
    );
  }

  if (projectLoadFailed || !project) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
          <h1 className="text-lg font-semibold text-slate-900 mb-2">
            Proyecto no encontrado
          </h1>
          <p className="text-sm text-slate-500 mb-4">
            No hemos podido cargar la información de este proyecto. Es
            posible que haya sido eliminado o que la URL no sea correcta.
          </p>
          <button
            type="button"
            onClick={() => router.push("/projects")}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Volver a proyectos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* 1) Header */}
        <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Proyecto SAP · Creado el {new Date(project.created_at).toLocaleDateString("es-ES")}
            </p>
            {project.description && (
              <p className="mt-1 text-sm text-slate-500">{project.description}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {project.status && (
              <ProjectStatusBadge status={project.status} />
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
              />
            )}
          </div>
        </section>

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

        {/* 2) KPI row */}
        <section>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
            <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
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

        {/* 3) Project Health */}
        <section>
          <ProjectHealthCard score={projectHealth} loading={loadingStats} />
        </section>

        {/* Resumen de planificación */}
        <section>
          {/* Debug: confirm phases are loaded (remove once verified) */}
          {loadingProjectPhases ? (
            <p className="text-xs text-slate-500 mt-4">Cargando fases de planificación…</p>
          ) : (
            <p className="text-xs text-slate-500 mt-4">Fases cargadas: {projectPhases.length}</p>
          )}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mt-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Resumen de planificación
                </h2>
                <p className="text-xs text-slate-500">
                  Vista rápida de las fases SAP Activate de este proyecto.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/projects/${projectId}/planning`)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mt-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Estado de actividades
                </h2>
                <p className="text-xs text-slate-500">
                  Resumen del plan de trabajo del proyecto.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/projects/${projectId}/activities`)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
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

        {/* Estado de actividades */}
        <section>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mt-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Estado de actividades
                </h2>
                <p className="text-xs text-slate-500">
                  Resumen del plan de trabajo del proyecto.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/projects/${projectId}/activities`)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
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
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Plan SAP Activate</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Fases y fechas planificadas · Actividades por fase
              </p>
              {loadingActivatePlan ? (
                <p className="mt-3 text-[11px] text-slate-500">Cargando…</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {activatePlan.phases.map((phase) => {
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
                  })}
                </div>
              )}
              <Link href={`/projects/${projectId}/planning`} className="mt-2 inline-block text-[11px] font-medium text-indigo-600 hover:text-indigo-800">
                Editar fases del proyecto →
              </Link>
              <div className="mt-3">
                <Link
                  href={`/projects/${projectId}/planning`}
                  className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Ir a planificación
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* 4) Module impact + Recent activity */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Impacto por módulos</h2>
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
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Actividad reciente</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Últimas notas y tickets del proyecto.</p>
              {loadingNotes || loadingTickets ? (
                <p className="mt-3 text-[11px] text-slate-500">Cargando…</p>
              ) : recentActivity.length === 0 ? (
                <p className="mt-3 text-[11px] text-slate-500">Sin actividad reciente.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {recentActivity.map((item) => (
                    <li key={`${item.type}-${item.id}`}>
                      <Link
                        href={item.href}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 text-[11px] hover:bg-slate-50 transition"
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
        </section>

        {/* 5) Metrics + actions: 4 entry-point cards */}
        <section>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
    </div>
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

function ProjectHealthCard({ score, loading }: { score: number; loading?: boolean }) {
  const status =
    score >= 80 ? "Buena" : score >= 50 ? "Media" : "Crítica";
  const barColor =
    score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-rose-500";
  const textColor =
    score >= 80 ? "text-emerald-700" : score >= 50 ? "text-amber-700" : "text-rose-700";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] text-slate-500 mb-1">Salud del proyecto</p>
      {loading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className={`text-2xl font-semibold ${textColor}`}>{score}</span>
            <span className={`text-[11px] font-medium ${textColor}`}>{status}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 mt-2">
            <div
              className={`h-2 rounded-full ${barColor} transition-[width] duration-300`}
              style={{ width: `${score}%` }}
            />
          </div>
        </>
      )}
    </div>
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
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm flex flex-col justify-between">
      <p className="text-[11px] text-slate-500 mb-1">{title}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      {error ? (
        <p className="text-[11px] text-red-600 mt-1">{error}</p>
      ) : (
        <p className="text-[11px] text-slate-400 mt-1">{subtitle}</p>
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
      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm flex flex-col gap-2 hover:border-slate-300 hover:shadow transition"
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
