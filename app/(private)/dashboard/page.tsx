"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { StatCard } from "@/components/ui/stat/StatCard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  FolderOpen,
  FileText,
  LayoutGrid,
  ArrowRight,
  Ticket,
  CheckSquare,
  Building2,
  BookOpen,
  Activity,
  UserPlus,
  FolderPlus,
  StickyNote,
  AlertTriangle,
  CheckCircle2,
  ActivityIcon,
  Users,
  Search,
  Plus,
  ChevronDown,
} from "lucide-react";

type ProjectSummary = { id: string; name: string; status: string | null; created_at: string };
type NoteSummary = { id: string; title: string; client: string | null; module: string | null; created_at: string };

type DashboardStats = {
  totalProjects: number;
  openProjects: number;
  totalNotes: number;
  todayNotes: number;
  tickets_open: number;
  tasks_due_today: number;
  clients_count: number;
  knowledge_entries_count: number;
  overdue_tasks_count: number;
  projects_without_recent_activity_count: number;
};

type ActivityEvent = {
  id: string;
  type: "project_created" | "task_created" | "ticket_closed" | "note_created" | "user_invited";
  title: string;
  date: string;
  link: string;
  projectName?: string | null;
};

type ChartData = {
  ticketsByStatus: { status: string; count: number }[];
  ticketsByClient: { clientName: string; count: number }[];
  activityLast30Days: { date: string; count: number }[];
};

type TeamWorkloadUser = { id: string; name: string; taskCount: number };

const RECENT_COUNT = 5;
const ACTIVITY_DISPLAY_MAX = 6;
const KPI_ANIMATION_MS = 750;

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function relativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return "ahora";
  if (sec < 3600) return `hace ${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `hace ${Math.floor(sec / 3600)} h`;
  if (sec < 604800) return `hace ${Math.floor(sec / 86400)} d`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

/** Lightweight count-up for KPI on first load. Returns displayed number; runs once when ready becomes true. */
function useCountUp(target: number, ready: boolean): number {
  const [display, setDisplay] = useState(0);
  const hasAnimated = useRef(false);
  useEffect(() => {
    if (!ready || typeof target !== "number") {
      setDisplay(0);
      return;
    }
    if (hasAnimated.current) {
      setDisplay(target);
      return;
    }
    let cancelled = false;
    const start = performance.now();
    const step = () => {
      if (cancelled) return;
      const elapsed = performance.now() - start;
      const t = Math.min(elapsed / KPI_ANIMATION_MS, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      setDisplay(Math.round(eased * target));
      if (t < 1) requestAnimationFrame(step);
      else hasAnimated.current = true;
    };
    requestAnimationFrame(step);
    return () => { cancelled = true; };
  }, [ready, target]);
  return ready ? display : 0;
}

const DashboardCharts = dynamic(
  () => import("@/components/dashboard/DashboardCharts").then((m) => m.DashboardCharts),
  { ssr: false, loading: () => <div className="grid grid-cols-1 xl:grid-cols-3 gap-6"><div className="rounded-2xl border border-slate-700/80 bg-slate-800/30 h-[280px] animate-pulse" /><div className="rounded-2xl border border-slate-700/80 bg-slate-800/30 h-[280px] animate-pulse" /><div className="rounded-2xl border border-slate-700/80 bg-slate-800/30 h-[280px] animate-pulse" /></div> }
);

const TeamWorkloadChart = dynamic(
  () => import("@/components/dashboard/TeamWorkloadChart").then((m) => m.TeamWorkloadChart),
  { ssr: false, loading: () => <div className="h-[220px] rounded-xl bg-slate-800/30 animate-pulse" /> }
);

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    openProjects: 0,
    totalNotes: 0,
    todayNotes: 0,
    tickets_open: 0,
    tasks_due_today: 0,
    clients_count: 0,
    knowledge_entries_count: 0,
    overdue_tasks_count: 0,
    projects_without_recent_activity_count: 0,
  });
  const [recentProjects, setRecentProjects] = useState<ProjectSummary[]>([]);
  const [recentNotes, setRecentNotes] = useState<NoteSummary[]>([]);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [chartData, setChartData] = useState<ChartData>({
    ticketsByStatus: [],
    ticketsByClient: [],
    activityLast30Days: [],
  });
  const [teamWorkload, setTeamWorkload] = useState<TeamWorkloadUser[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  const animatedProjects = useCountUp(stats.openProjects, !loadingStats);
  const animatedTickets = useCountUp(stats.tickets_open, !loadingStats);
  const animatedTasksToday = useCountUp(stats.tasks_due_today, !loadingStats);
  const animatedClients = useCountUp(stats.clients_count, !loadingStats);
  const animatedKnowledge = useCountUp(stats.knowledge_entries_count, !loadingStats);

  const loadData = useCallback(async () => {
    setLoadingStats(true);
    setErrorMsg(null);
    try {
      const [sessionResult, projResult] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from("projects").select("id, name, status, created_at").order("created_at", { ascending: false }),
      ]);

      let projects: ProjectSummary[] = [];
      let notes: NoteSummary[] = [];

      if (projResult.error) {
        handleSupabaseError("dashboard projects", projResult.error);
        setErrorMsg("No se pudieron cargar los datos del dashboard.");
      } else {
        projects = (projResult.data ?? []) as ProjectSummary[];
      }

      const userId = sessionResult.data?.session?.user?.id;
      const user = sessionResult.data?.session?.user;
      if (userId) {
        const { data: profile } = await supabase.from("profiles").select("app_role, full_name").eq("id", userId).maybeSingle();
        const prof = profile as { app_role?: string; full_name?: string | null } | null;
        const name = (prof?.full_name ?? user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "").toString().trim();
        setUserName(name || "");
        if (prof?.app_role === "consultant") {
          notes = [];
        } else {
          const noteResult = await supabase
            .from("notes")
            .select("id, title, client, module, created_at")
            .is("deleted_at", null)
            .order("created_at", { ascending: false });
          if (!noteResult.error) notes = (noteResult.data ?? []) as NoteSummary[];
        }
      } else {
        const noteResult = await supabase
          .from("notes")
          .select("id, title, client, module, created_at")
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        if (!noteResult.error) notes = (noteResult.data ?? []) as NoteSummary[];
      }

      setRecentProjects(projects.slice(0, RECENT_COUNT));
      setRecentNotes(notes.slice(0, RECENT_COUNT));

      const token = sessionResult.data?.session?.access_token;
      if (token) {
        const [metricsRes, activityRes, chartsRes, teamWorkloadRes] = await Promise.all([
          fetch("/api/metrics/platform", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/activity", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/metrics/dashboard-charts", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/metrics/team-workload", { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (metricsRes.ok) {
          const data = (await metricsRes.json()) as Record<string, number>;
          setStats({
            totalProjects: data.projects_total ?? 0,
            openProjects: data.projects_active ?? 0,
            totalNotes: data.notes_total ?? 0,
            todayNotes: data.notes_today ?? 0,
            tickets_open: data.tickets_open ?? 0,
            tasks_due_today: data.tasks_due_today ?? 0,
            clients_count: data.clients_count ?? 0,
            knowledge_entries_count: data.knowledge_entries_count ?? 0,
            overdue_tasks_count: data.overdue_tasks_count ?? 0,
            projects_without_recent_activity_count: data.projects_without_recent_activity_count ?? 0,
          });
        }

        if (activityRes.ok) {
          const act = (await activityRes.json()) as { events?: ActivityEvent[] };
          setActivityEvents(act.events ?? []);
        }

        if (chartsRes.ok) {
          const charts = (await chartsRes.json()) as ChartData;
          setChartData({
            ticketsByStatus: charts.ticketsByStatus ?? [],
            ticketsByClient: charts.ticketsByClient ?? [],
            activityLast30Days: charts.activityLast30Days ?? [],
          });
        }

        if (teamWorkloadRes.ok) {
          const tw = (await teamWorkloadRes.json()) as { users?: TeamWorkloadUser[] };
          setTeamWorkload(tw.users ?? []);
        }
      }
    } catch (e) {
      handleSupabaseError("dashboard loadData", e);
      setErrorMsg("No se pudieron cargar los datos del dashboard.");
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!createOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCreateOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) setCreateOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onClick, true);
    };
  }, [createOpen]);

  const eventTypeLabel: Record<string, string> = {
    project_created: "Proyecto creado",
    task_created: "Tarea creada",
    ticket_closed: "Ticket cerrado",
    note_created: "Nota añadida",
    user_invited: "Usuario invitado",
  };
  const eventIcon: Record<string, React.ReactNode> = {
    project_created: <FolderPlus className="h-3.5 w-3.5 shrink-0" />,
    task_created: <CheckSquare className="h-3.5 w-3.5 shrink-0" />,
    ticket_closed: <Ticket className="h-3.5 w-3.5 shrink-0" />,
    note_created: <StickyNote className="h-3.5 w-3.5 shrink-0" />,
    user_invited: <UserPlus className="h-3.5 w-3.5 shrink-0" />,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Workspace principal: prioridades, apps e insights."
      />

      {errorMsg && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-5 py-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-red-300">{errorMsg}</p>
          <Button variant="secondary" onClick={() => { setErrorMsg(null); void loadData(); }}>
            Reintentar
          </Button>
        </div>
      )}

      {/* Workspace header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">
            {getGreeting()}{userName ? `, ${userName}` : ""}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Workspace overview</p>
          <p className="text-xs text-slate-500">Projects, tasks and knowledge in one place.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative" ref={createMenuRef}>
            <Button
              type="button"
              variant="secondary"
              className="!bg-slate-800 !text-slate-200 !border-slate-600 hover:!bg-slate-700"
              onClick={() => setCreateOpen((o) => !o)}
              aria-expanded={createOpen}
              aria-haspopup="true"
            >
              <Plus className="h-4 w-4 shrink-0" />
              Create
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </Button>
            {createOpen && (
              <div
                className="absolute left-0 top-full mt-1 z-50 min-w-[180px] rounded-xl border border-slate-700 bg-slate-800 py-1 shadow-lg"
                role="menu"
              >
                <Link
                  href="/projects/new"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700/80"
                  role="menuitem"
                  onClick={() => setCreateOpen(false)}
                >
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  Create Project
                </Link>
                <Link
                  href="/tickets/new"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700/80"
                  role="menuitem"
                  onClick={() => setCreateOpen(false)}
                >
                  <Ticket className="h-4 w-4 shrink-0" />
                  Create Ticket
                </Link>
                <Link
                  href="/tasks"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700/80"
                  role="menuitem"
                  onClick={() => setCreateOpen(false)}
                >
                  <CheckSquare className="h-4 w-4 shrink-0" />
                  Create Task
                </Link>
                <Link
                  href="/notes/new"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700/80"
                  role="menuitem"
                  onClick={() => setCreateOpen(false)}
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  Create Note
                </Link>
              </div>
            )}
          </div>
          <Link
            href="/search"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <Search className="h-4 w-4 shrink-0" />
            Search
          </Link>
          <Link
            href="/knowledge"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            Ask Sapito
          </Link>
        </div>
      </header>

      {/* Context bar */}
      <div className="flex flex-wrap gap-8 mb-8">
        <div>
          <span className="text-slate-400 text-sm">Projects</span>
          <p className="text-slate-200 font-semibold">{loadingStats ? "—" : stats.openProjects}</p>
        </div>
        <div>
          <span className="text-slate-400 text-sm">Tickets</span>
          <p className="text-slate-200 font-semibold">{loadingStats ? "—" : stats.tickets_open}</p>
        </div>
        <div>
          <span className="text-slate-400 text-sm">Tasks</span>
          <p className="text-slate-200 font-semibold">{loadingStats ? "—" : stats.tasks_due_today}</p>
        </div>
        <div>
          <span className="text-slate-400 text-sm">Knowledge spaces</span>
          <p className="text-slate-200 font-semibold">{loadingStats ? "—" : stats.knowledge_entries_count}</p>
        </div>
      </div>

      {/* 1. My Work (tiles) */}
      <section className="space-y-6">
        <h2 className="text-sm font-semibold text-slate-200">My Work</h2>
        {loadingStats ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : (() => {
          const tiles: { icon: React.ReactNode; label: string; href: string; isWarning: boolean }[] = [];
          if (stats.overdue_tasks_count > 0)
            tiles.push({
              icon: <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500/90" />,
              label: `${stats.overdue_tasks_count} tareas vencidas`,
              href: "/my-work",
              isWarning: true,
            });
          if (stats.tickets_open > 0)
            tiles.push({
              icon: <Ticket className="h-5 w-5 shrink-0 text-slate-400" />,
              label: `${stats.tickets_open} tickets abiertos`,
              href: "/tickets",
              isWarning: false,
            });
          if (stats.projects_without_recent_activity_count > 0)
            tiles.push({
              icon: <FolderOpen className="h-5 w-5 shrink-0 text-slate-400" />,
              label: `${stats.projects_without_recent_activity_count} proyecto${stats.projects_without_recent_activity_count !== 1 ? "s" : ""} sin actividad`,
              href: "/projects",
              isWarning: false,
            });
          if (tiles.length === 0) {
            return (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4">
                <p className="text-sm text-slate-400">Everything looks good today.</p>
              </div>
            );
          }
          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {tiles.map((t) => (
                <Link
                  key={t.href + t.label}
                  href={t.href}
                  className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
                    t.isWarning
                      ? "border-amber-700/50 bg-amber-950/20 hover:bg-amber-900/30"
                      : "border-slate-800 bg-slate-900/60 hover:bg-slate-800/60"
                  }`}
                >
                  {t.icon}
                  <span className="text-sm font-medium text-slate-200 flex-1 truncate">{t.label}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-500" />
                </Link>
              ))}
            </div>
          );
        })()}
      </section>

      {/* 2. Apps (launchpad tiles) */}
      <section className="space-y-6">
        <h2 className="text-sm font-semibold text-slate-200">Apps</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
          {[
            { href: "/projects", icon: FolderOpen, label: "Projects" },
            { href: "/tickets", icon: Ticket, label: "Tickets" },
            { href: "/my-work", icon: CheckSquare, label: "Tasks" },
            { href: "/knowledge", icon: BookOpen, label: "Knowledge" },
            { href: "/notes", icon: FileText, label: "Notes" },
            { href: "/clients", icon: Building2, label: "Clients" },
            { href: "/search", icon: Search, label: "Search" },
          ].map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 px-6 h-[96px] rounded-xl border border-slate-800 bg-slate-900/60 text-slate-200 hover:border-slate-700 hover:bg-slate-800/60 transition-colors"
            >
              <Icon className="w-7 h-7 shrink-0 text-slate-400" />
              <span className="text-sm font-medium truncate">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. Insights (KPIs + charts in one panel) */}
      <section className="space-y-6">
        <h2 className="text-sm font-semibold text-slate-200">Insights</h2>
        <p className="text-xs text-slate-500 -mt-2">Métricas y gráficos.</p>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            href="/projects"
            icon={<FolderOpen className="h-4 w-4" />}
            label="Proyectos activos"
            value={loadingStats ? "—" : animatedProjects}
            trend="En curso"
          />
          <StatCard
            href="/tickets"
            icon={<Ticket className="h-4 w-4" />}
            label="Tickets abiertos"
            value={loadingStats ? "—" : animatedTickets}
            trend="Pendientes"
          />
          <StatCard
            href="/my-work"
            icon={<CheckSquare className="h-4 w-4" />}
            label="Tareas vencen hoy"
            value={loadingStats ? "—" : animatedTasksToday}
            trend="Fecha hoy"
          />
          <StatCard
            href="/clients"
            icon={<Building2 className="h-4 w-4" />}
            label="Clientes"
            value={loadingStats ? "—" : animatedClients}
            trend="Registrados"
          />
          <StatCard
            href="/knowledge"
            icon={<BookOpen className="h-4 w-4" />}
            label="Espacios knowledge"
            value={loadingStats ? "—" : animatedKnowledge}
            trend="Knowledge"
          />
        </div>
        <DashboardCharts data={chartData} />
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="px-5 pt-4 pb-1 border-b border-slate-700/50">
            <h3 className="text-sm font-semibold text-slate-100">Team Workload</h3>
            <p className="text-xs text-slate-500 mt-0.5">Tareas activas por responsable.</p>
          </div>
          {loadingStats ? (
            <div className="h-[220px] flex items-center justify-center p-4">
              <Skeleton className="h-full w-full rounded-xl" />
            </div>
          ) : (() => {
            const totalTasks = teamWorkload.reduce((s, u) => s + u.taskCount, 0);
            const hasMeaningfulData = teamWorkload.length >= 2 && totalTasks > 0;
            if (!hasMeaningfulData) {
              return (
                <div className="flex flex-col items-center justify-center gap-2 py-12 px-4">
                  <Users className="h-10 w-10 text-slate-600" aria-hidden />
                  <p className="text-sm font-medium text-slate-400">Aún no hay datos de carga de trabajo</p>
                  <p className="text-xs text-slate-500 text-center max-w-[260px]">
                    Los datos aparecerán cuando existan tareas asignadas a varios responsables en tus proyectos.
                  </p>
                </div>
              );
            }
            return (
              <div className="p-4 h-[240px] min-h-[200px]">
                <TeamWorkloadChart users={teamWorkload} />
              </div>
            );
          })()}
        </div>
        </div>
      </section>

      {/* 4. System Health */}
      <section className="space-y-6">
        <h2 className="text-sm font-semibold text-slate-200">System Health</h2>
        <p className="text-xs text-slate-500 -mt-2">Resumen operativo de la plataforma.</p>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-700/50">
            <SystemHealthRow
              icon={<FolderOpen className="h-4 w-4" />}
              label="Proyectos activos"
              value={loadingStats ? "—" : stats.openProjects}
              status={stats.openProjects > 0 ? "healthy" : "neutral"}
              statusText={stats.openProjects > 0 ? "Activo" : "Sin proyectos"}
            />
            <SystemHealthRow
              icon={<CheckSquare className="h-4 w-4" />}
              label="Tareas vencidas"
              value={loadingStats ? "—" : stats.overdue_tasks_count}
              status={stats.overdue_tasks_count > 0 ? "warning" : "neutral"}
              statusText={stats.overdue_tasks_count > 0 ? "Atención" : "Al día"}
            />
            <SystemHealthRow
              icon={<Ticket className="h-4 w-4" />}
              label="Tickets abiertos"
              value={loadingStats ? "—" : stats.tickets_open}
              status={stats.tickets_open > 5 ? "warning" : "neutral"}
              statusText={stats.tickets_open > 5 ? "Varios pendientes" : "Normal"}
            />
            <SystemHealthRow
              icon={<ActivityIcon className="h-4 w-4" />}
              label="Proyectos sin actividad reciente"
              value={loadingStats ? "—" : stats.projects_without_recent_activity_count}
              status={stats.projects_without_recent_activity_count > 0 ? "warning" : "neutral"}
              statusText={stats.projects_without_recent_activity_count > 0 ? "Revisar" : "Ok"}
            />
          </div>
        </div>
      </section>

      {/* 5. Recent Activity */}
      <section className="space-y-6">
        <h2 className="text-sm font-semibold text-slate-200">Recent Activity</h2>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-slate-700/50">
            <p className="text-xs text-slate-500">Últimos eventos (proyectos, tareas, tickets, notas).</p>
          </div>
          <div className="px-5 py-4">
            {loadingStats ? (
              <div className="space-y-2 py-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : activityEvents.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">Aún no hay actividad reciente.</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {activityEvents.slice(0, ACTIVITY_DISPLAY_MAX).map((ev) => (
                    <li key={ev.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/50 px-3 py-2.5 text-left hover:bg-slate-800/80 transition-colors"
                        onClick={() => router.push(ev.link)}
                      >
                        <span className="text-indigo-400 shrink-0">{eventIcon[ev.type]}</span>
                        <div className="min-w-0 flex-1 flex items-center gap-2">
                          <span className="text-sm font-medium text-white truncate">{ev.title}</span>
                          {ev.projectName && (
                            <span className="text-[11px] text-slate-500 truncate hidden sm:inline">{ev.projectName}</span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 shrink-0">{relativeTime(ev.date)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 6. Recent Projects */}
      <section className="space-y-6">
        <h2 className="text-sm font-semibold text-slate-200">Recent Projects</h2>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-slate-700/50">
            <p className="text-xs text-slate-500">Acceso rápido a proyectos.</p>
          </div>
          <div className="px-5 py-4">
            {loadingStats ? (
              <div className="space-y-2 py-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : recentProjects.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">Sin proyectos</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {recentProjects.slice(0, 6).map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-800/50 px-3 py-2.5 text-left hover:bg-slate-800/80 transition-colors"
                        onClick={() => router.push(`/projects/${p.id}`)}
                      >
                        <p className="text-sm font-medium text-white truncate">{p.name}</p>
                        {p.status && <StatusPill status={p.status} />}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <Link href="/projects" className="text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors">
                    Ver todos los proyectos
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function SystemHealthRow({
  icon,
  label,
  value,
  status,
  statusText,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  status: "healthy" | "warning" | "critical" | "neutral";
  statusText: string;
}) {
  const statusStyles = {
    healthy: "text-emerald-400",
    warning: "text-amber-400",
    critical: "text-red-400",
    neutral: "text-slate-500",
  };
  const iconBg = {
    healthy: "text-emerald-500/80",
    warning: "text-amber-500/80",
    critical: "text-red-500/80",
    neutral: "text-slate-500",
  };
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <span className={iconBg[status]}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-lg font-semibold text-slate-100 mt-0.5">{value}</p>
        <p className={`text-xs font-medium mt-1 ${statusStyles[status]}`}>{statusText}</p>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  const isActive = !s.includes("cerrado") && !s.includes("closed") && !s.includes("finalizado");
  return (
    <span
      className={`text-[10px] rounded-full px-2 py-0.5 font-medium shrink-0 ${
        isActive ? "bg-indigo-500/20 text-indigo-300" : "bg-slate-700 text-slate-400"
      }`}
    >
      {status}
    </span>
  );
}
