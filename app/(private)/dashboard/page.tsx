"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { AppPageShell } from "@/components/ui/layout/AppPageShell";
import { StatCard } from "@/components/ui/stat/StatCard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  FolderOpen,
  FileText,
  ArrowRight,
  Ticket,
  CheckSquare,
  Building2,
  BookOpen,
  UserPlus,
  FolderPlus,
  StickyNote,
  AlertTriangle,
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

const KPI_SIGNAL_CLASS =
  "relative overflow-hidden pl-3.5 before:pointer-events-none before:absolute before:left-0 before:top-4 before:bottom-4 before:w-[3px] before:rounded-full before:bg-[rgb(var(--rb-brand-primary))]/38 before:content-['']";

function DashboardSectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1.5">
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--rb-text-muted))]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-lg font-semibold tracking-tight text-[rgb(var(--rb-text-primary))]">{title}</h2>
      {description ? (
        <p className="max-w-2xl text-sm leading-relaxed text-[rgb(var(--rb-text-muted))]">{description}</p>
      ) : null}
    </div>
  );
}

/** Lightweight count-up for KPI on first load. Returns displayed number; runs once when ready becomes true. */
function useCountUp(target: number, ready: boolean): number {
  const [display, setDisplay] = useState(0);
  const hasAnimated = useRef(false);
  /* eslint-disable react-hooks/set-state-in-effect -- KPI count-up: sync reset / jump-to-target before rAF animation */
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
  /* eslint-enable react-hooks/set-state-in-effect */
  return ready ? display : 0;
}

const DashboardCharts = dynamic(
  () => import("@/components/dashboard/DashboardCharts").then((m) => m.DashboardCharts),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:gap-8">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="min-h-[260px] rounded-2xl border border-[rgb(var(--rb-surface-border))]/50 bg-[rgb(var(--rb-surface-3))]/20 animate-pulse"
          />
        ))}
      </div>
    ),
  }
);

const TeamWorkloadChart = dynamic(
  () => import("@/components/dashboard/TeamWorkloadChart").then((m) => m.TeamWorkloadChart),
  { ssr: false, loading: () => <div className="h-[220px] rounded-xl bg-[rgb(var(--rb-surface-2))]/80 animate-pulse" /> }
);

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  function relativeTimeLabel(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (sec < 60) return t("relative.now");
    if (sec < 3600) return t("relative.minutes", { n: Math.floor(sec / 60) });
    if (sec < 86400) return t("relative.hours", { n: Math.floor(sec / 3600) });
    if (sec < 604800) return t("relative.days", { n: Math.floor(sec / 86400) });
    const locTag = locale === "es" ? "es-ES" : "en-US";
    return d.toLocaleDateString(locTag, { day: "numeric", month: "short" });
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t("greeting.morning") : hour < 19 ? t("greeting.afternoon") : t("greeting.evening");
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
  const [, setRecentNotes] = useState<NoteSummary[]>([]);
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
        setErrorMsg(t("errors.loadFailed"));
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
      setErrorMsg(t("errors.loadFailed"));
    } finally {
      setLoadingStats(false);
    }
  }, [t]);

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

  const eventIcon: Record<string, React.ReactNode> = {
    project_created: <FolderPlus className="h-3.5 w-3.5 shrink-0" />,
    task_created: <CheckSquare className="h-3.5 w-3.5 shrink-0" />,
    ticket_closed: <Ticket className="h-3.5 w-3.5 shrink-0" />,
    note_created: <StickyNote className="h-3.5 w-3.5 shrink-0" />,
    user_invited: <UserPlus className="h-3.5 w-3.5 shrink-0" />,
  };

  return (
    <AppPageShell>
      <div className="mx-auto w-full max-w-[1440px] space-y-10 lg:space-y-12">
      {errorMsg && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200/90 bg-red-50 px-5 py-4">
          <p className="text-sm text-red-800">{errorMsg}</p>
          <Button variant="secondary" onClick={() => { setErrorMsg(null); void loadData(); }}>
            {tCommon("retry")}
          </Button>
        </div>
      )}

      {/* Hero — command surface */}
      <header className="relative overflow-hidden rounded-2xl border border-[rgb(var(--rb-surface-border))]/55 bg-[rgb(var(--rb-surface))] px-5 py-6 shadow-sm ring-1 ring-[rgb(var(--rb-brand-primary))]/14 sm:px-8 sm:py-7">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[rgb(var(--rb-brand-primary))]/[0.09] via-transparent to-transparent"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgb(var(--rb-brand-primary))]">
            {t("heroEyebrow")}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[rgb(var(--rb-text-primary))] sm:text-[1.85rem] sm:leading-snug">
            {greeting}
            {userName ? `, ${userName}` : ""}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--rb-text-muted))]">{t("subtitle")}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-start gap-2.5 sm:justify-end">
          <div className="relative" ref={createMenuRef}>
            <button
              type="button"
              className="rb-btn-primary rb-depth-hover inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-transparent px-4 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--rb-shell-bg))] disabled:opacity-50"
              onClick={() => setCreateOpen((o) => !o)}
              aria-expanded={createOpen}
              aria-haspopup="true"
            >
              <Plus className="h-4 w-4 shrink-0" />
              {t("create")}
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-80" />
            </button>
            {createOpen && (
              <div
                className="absolute left-0 top-full z-50 mt-1.5 min-w-[200px] rounded-xl border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface))] py-1 shadow-lg"
                role="menu"
              >
                <Link href="/projects/new" className="flex items-center gap-2 px-4 py-2 text-sm text-[rgb(var(--rb-text-primary))] hover:bg-[rgb(var(--rb-surface-3))]/80" role="menuitem" onClick={() => setCreateOpen(false)}>
                  <FolderOpen className="h-4 w-4 shrink-0" /> {t("createMenu.project")}
                </Link>
                <Link href="/tickets/new" className="flex items-center gap-2 px-4 py-2 text-sm text-[rgb(var(--rb-text-primary))] hover:bg-[rgb(var(--rb-surface-3))]/80" role="menuitem" onClick={() => setCreateOpen(false)}>
                  <Ticket className="h-4 w-4 shrink-0" /> {t("createMenu.ticket")}
                </Link>
                <Link href="/tasks" className="flex items-center gap-2 px-4 py-2 text-sm text-[rgb(var(--rb-text-primary))] hover:bg-[rgb(var(--rb-surface-3))]/80" role="menuitem" onClick={() => setCreateOpen(false)}>
                  <CheckSquare className="h-4 w-4 shrink-0" /> {t("createMenu.task")}
                </Link>
                <Link href="/notes/new" className="flex items-center gap-2 px-4 py-2 text-sm text-[rgb(var(--rb-text-primary))] hover:bg-[rgb(var(--rb-surface-3))]/80" role="menuitem" onClick={() => setCreateOpen(false)}>
                  <FileText className="h-4 w-4 shrink-0" /> {t("createMenu.note")}
                </Link>
              </div>
            )}
          </div>
          <Link
            href="/search"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-3))]/15 px-4 text-sm font-medium text-[rgb(var(--rb-text-secondary))] transition-all hover:border-[rgb(var(--rb-brand-primary))]/28 hover:bg-[rgb(var(--rb-surface-3))]/25 hover:text-[rgb(var(--rb-text-primary))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--rb-shell-bg))]"
          >
            <Search className="h-4 w-4 shrink-0 opacity-90" /> {t("search")}
          </Link>
          <Link
            href="/knowledge"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[rgb(var(--rb-brand-primary))]/32 bg-[rgb(var(--rb-brand-primary))]/10 px-4 text-sm font-semibold text-[rgb(var(--rb-brand-primary))] shadow-sm transition-all hover:border-[rgb(var(--rb-brand-primary))]/45 hover:bg-[rgb(var(--rb-brand-primary))]/14 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--rb-shell-bg))]"
          >
            <BookOpen className="h-4 w-4 shrink-0 text-[rgb(var(--rb-brand-primary))]" /> {t("askSapito")}
          </Link>
        </div>
        </div>
      </header>

      {/* Operating signals */}
      <section className="space-y-4">
        <DashboardSectionHeader title={t("metricsSr")} description={t("metricsIntro")} />
        <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface))] p-3 shadow-sm sm:p-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5 lg:gap-3.5">
          <StatCard
            href="/projects"
            className={KPI_SIGNAL_CLASS}
            icon={<FolderOpen className="h-4 w-4 shrink-0" />}
            label={t("kpi.activeProjects")}
            value={loadingStats ? "—" : animatedProjects}
            trend={t("kpi.activeProjectsTrend")}
          />
          <StatCard
            href="/tickets"
            className={KPI_SIGNAL_CLASS}
            icon={<Ticket className="h-4 w-4 shrink-0" />}
            label={t("kpi.openTickets")}
            value={loadingStats ? "—" : animatedTickets}
            trend={t("kpi.openTicketsTrend")}
          />
          <StatCard
            href="/my-work"
            className={KPI_SIGNAL_CLASS}
            icon={<CheckSquare className="h-4 w-4 shrink-0" />}
            label={t("kpi.tasksDueToday")}
            value={loadingStats ? "—" : animatedTasksToday}
            trend={t("kpi.tasksDueTodayTrend")}
          />
          <StatCard
            href="/clients"
            className={KPI_SIGNAL_CLASS}
            icon={<Building2 className="h-4 w-4 shrink-0" />}
            label={t("kpi.clients")}
            value={loadingStats ? "—" : animatedClients}
            trend={t("kpi.clientsTrend")}
          />
          <StatCard
            href="/knowledge"
            className={KPI_SIGNAL_CLASS}
            icon={<BookOpen className="h-4 w-4 shrink-0" />}
            label={t("kpi.knowledgeSpaces")}
            value={loadingStats ? "—" : animatedKnowledge}
            trend={t("kpi.knowledgeTrend")}
          />
          </div>
        </div>
      </section>

      {/* Applications */}
      <section className="space-y-4">
        <DashboardSectionHeader title={t("applications")} description={t("appsHint")} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {(
            [
              { href: "/projects", icon: FolderOpen, labelKey: "projects" as const },
              { href: "/tickets", icon: Ticket, labelKey: "tickets" as const },
              { href: "/my-work", icon: CheckSquare, labelKey: "tasks" as const },
              { href: "/knowledge", icon: BookOpen, labelKey: "knowledge" as const },
              { href: "/notes", icon: FileText, labelKey: "notes" as const },
              { href: "/clients", icon: Building2, labelKey: "clients" as const },
              { href: "/search", icon: Search, labelKey: "search" as const },
            ] as const
          ).map(({ href, icon: Icon, labelKey }) => (
            <Link
              key={href}
              href={href}
              className="group flex min-h-[4.5rem] items-center gap-4 rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] px-4 py-3.5 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[rgb(var(--rb-brand-primary))]/28 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--rb-shell-bg))]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--rb-brand-primary))]/18 bg-[rgb(var(--rb-brand-primary))]/8 text-[rgb(var(--rb-brand-primary))] transition-colors group-hover:border-[rgb(var(--rb-brand-primary))]/28 group-hover:bg-[rgb(var(--rb-brand-primary))]/12">
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 text-left text-sm font-semibold tracking-tight text-[rgb(var(--rb-text-primary))]">
                {(t as (key: string) => string)(`app.${labelKey}`)}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-[rgb(var(--rb-text-muted))] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[rgb(var(--rb-brand-primary))]" aria-hidden />
            </Link>
          ))}
        </div>
      </section>

      {/* Your work — attention items */}
      <section className="space-y-4">
        <DashboardSectionHeader title={t("yourWork")} />
        {loadingStats ? (
          <p className="text-sm text-[rgb(var(--rb-text-muted))]">{t("loading")}</p>
        ) : (() => {
          const tiles: { icon: React.ReactNode; label: string; href: string; isWarning: boolean }[] = [];
          if (stats.overdue_tasks_count > 0)
            tiles.push({
              icon: <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600/85" />,
              label: t("tiles.overdueTasks", { count: stats.overdue_tasks_count }),
              href: "/my-work",
              isWarning: true,
            });
          if (stats.tickets_open > 0)
            tiles.push({
              icon: <Ticket className="h-5 w-5 shrink-0 text-[rgb(var(--rb-brand-primary-hover))]/80" />,
              label: t("tiles.openTickets", { count: stats.tickets_open }),
              href: "/tickets",
              isWarning: false,
            });
          if (stats.projects_without_recent_activity_count > 0)
            tiles.push({
              icon: <FolderOpen className="h-5 w-5 shrink-0 text-amber-600/85" />,
              label: t("tiles.staleProjects", { count: stats.projects_without_recent_activity_count }),
              href: "/projects",
              isWarning: true,
            });
          if (tiles.length === 0) {
            return (
              <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/55 bg-[rgb(var(--rb-surface-3))]/10 px-5 py-5">
                <p className="text-sm text-[rgb(var(--rb-text-secondary))]">{t("allCaughtUp")}</p>
              </div>
            );
          }
          return (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
              {tiles.map((tile) => (
                <Link
                  key={tile.href + tile.label}
                  href={tile.href}
                  className={`group flex items-center gap-3 rounded-2xl border p-4 shadow-sm transition-[border-color,box-shadow,transform] duration-200 ${
                    tile.isWarning
                      ? "border-amber-200/80 bg-amber-50/80 hover:border-amber-300/90 hover:shadow-md"
                      : "border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] hover:-translate-y-0.5 hover:border-[rgb(var(--rb-brand-primary))]/25 hover:shadow-md"
                  }`}
                >
                  {tile.icon}
                  <span className="flex-1 truncate text-sm font-medium text-[rgb(var(--rb-text-primary))]">{tile.label}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[rgb(var(--rb-text-muted))] transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          );
        })()}
      </section>

      {/* Insights — intelligence panel */}
      <section className="space-y-5">
        <DashboardSectionHeader title={t("insights")} description={t("insightsLead")} />
        <div className="space-y-8 rounded-2xl border border-[rgb(var(--rb-surface-border))]/55 bg-[rgb(var(--rb-surface-3))]/10 p-5 shadow-sm ring-1 ring-[rgb(var(--rb-surface-border))]/20 sm:p-8">
        <DashboardCharts data={chartData} />
        <div className="overflow-hidden rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] shadow-sm ring-1 ring-[rgb(var(--rb-surface-border))]/20">
          <div className="border-b border-[rgb(var(--rb-surface-border))]/45 px-5 py-4 sm:px-6">
            <h3 className="text-sm font-semibold tracking-tight text-[rgb(var(--rb-text-primary))]">{t("workload.title")}</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-[rgb(var(--rb-text-muted))]">{t("workload.subtitle")}</p>
          </div>
          {loadingStats ? (
            <div className="flex h-[260px] items-center justify-center p-6">
              <Skeleton className="h-full w-full max-w-4xl rounded-xl" />
            </div>
          ) : (() => {
            const totalTasks = teamWorkload.reduce((s, u) => s + u.taskCount, 0);
            const hasMeaningfulData = teamWorkload.length >= 2 && totalTasks > 0;
            if (!hasMeaningfulData) {
              return (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-14">
                  <Users className="h-10 w-10 text-[rgb(var(--rb-text-muted))]" aria-hidden />
                  <p className="text-sm font-medium text-[rgb(var(--rb-text-secondary))]">{t("workload.emptyTitle")}</p>
                  <p className="max-w-[280px] text-center text-xs leading-relaxed text-[rgb(var(--rb-text-muted))]">{t("workload.emptySub")}</p>
                </div>
              );
            }
            return (
              <div className="h-[min(300px,40vw)] min-h-[240px] p-5 sm:p-6">
                <TeamWorkloadChart users={teamWorkload} />
              </div>
            );
          })()}
        </div>
        </div>
      </section>

      {/* System Health */}
      <section className="space-y-4">
        <DashboardSectionHeader title={t("systemHealth.title")} description={t("systemHealth.subtitle")} />
        <div className="overflow-hidden rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] shadow-sm ring-1 ring-[rgb(var(--rb-surface-border))]/20">
          <div className="grid grid-cols-1 divide-y divide-[rgb(var(--rb-surface-border))]/45 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            <SystemHealthRow
              icon={<FolderOpen className="h-4 w-4" />}
              label={t("systemHealth.activeProjects")}
              value={loadingStats ? "—" : stats.openProjects}
              status={stats.openProjects > 0 ? "healthy" : "neutral"}
              statusText={stats.openProjects > 0 ? t("systemHealth.healthy") : t("systemHealth.noProjects")}
            />
            <SystemHealthRow
              icon={<CheckSquare className="h-4 w-4" />}
              label={t("systemHealth.overdueTasks")}
              value={loadingStats ? "—" : stats.overdue_tasks_count}
              status={stats.overdue_tasks_count > 0 ? "warning" : "neutral"}
              statusText={stats.overdue_tasks_count > 0 ? t("systemHealth.attention") : t("systemHealth.onTrack")}
            />
            <SystemHealthRow
              icon={<Ticket className="h-4 w-4" />}
              label={t("systemHealth.openTickets")}
              value={loadingStats ? "—" : stats.tickets_open}
              status={stats.tickets_open > 5 ? "warning" : "neutral"}
              statusText={stats.tickets_open > 5 ? t("systemHealth.manyPending") : t("systemHealth.normal")}
            />
            <SystemHealthRow
              icon={<ActivityIcon className="h-4 w-4" />}
              label={t("systemHealth.staleProjects")}
              value={loadingStats ? "—" : stats.projects_without_recent_activity_count}
              status={stats.projects_without_recent_activity_count > 0 ? "warning" : "neutral"}
              statusText={
                stats.projects_without_recent_activity_count > 0 ? t("systemHealth.review") : t("systemHealth.ok")
              }
            />
          </div>
        </div>
      </section>

      {/* Recent Activity */}
      <section className="space-y-4">
        <DashboardSectionHeader title={t("activity.title")} description={t("activity.subtitle")} />
        <div className="overflow-hidden rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] shadow-sm ring-1 ring-[rgb(var(--rb-surface-border))]/20">
          <div className="px-1 py-2 sm:px-2 sm:py-3">
            {loadingStats ? (
              <div className="space-y-2 px-3 py-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : activityEvents.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[rgb(var(--rb-text-muted))]">{t("activity.empty")}</p>
            ) : (
              <ul className="divide-y divide-[rgb(var(--rb-surface-border))]/40">
                {activityEvents.slice(0, ACTIVITY_DISPLAY_MAX).map((ev) => (
                  <li key={ev.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[rgb(var(--rb-brand-primary))]/[0.045] focus:outline-none focus-visible:bg-[rgb(var(--rb-brand-primary))]/[0.06] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--rb-brand-ring))]/30 sm:px-5 sm:py-4"
                      onClick={() => router.push(ev.link)}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[rgb(var(--rb-surface-border))]/50 bg-[rgb(var(--rb-surface-3))]/15 text-[rgb(var(--rb-brand-primary))]">
                        {eventIcon[ev.type]}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
                        <span className="text-sm font-semibold tracking-tight text-[rgb(var(--rb-text-primary))] sm:truncate">{ev.title}</span>
                        {ev.projectName && (
                          <span className="hidden text-[11px] text-[rgb(var(--rb-text-muted))] sm:inline sm:truncate">{ev.projectName}</span>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] font-medium tabular-nums text-[rgb(var(--rb-text-muted))]">{relativeTimeLabel(ev.date)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Active projects */}
      <section className="space-y-4">
        <DashboardSectionHeader title={t("recentProjects.title")} description={t("recentProjects.subtitle")} />
        <div className="overflow-hidden rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] shadow-sm ring-1 ring-[rgb(var(--rb-surface-border))]/20">
          <div className="px-1 py-2 sm:px-2 sm:py-3">
            {loadingStats ? (
              <div className="space-y-2 px-3 py-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : recentProjects.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[rgb(var(--rb-text-muted))]">{t("recentProjects.empty")}</p>
            ) : (
              <>
                <ul className="divide-y divide-[rgb(var(--rb-surface-border))]/40">
                  {recentProjects.slice(0, 6).map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[rgb(var(--rb-brand-primary))]/[0.045] focus:outline-none focus-visible:bg-[rgb(var(--rb-brand-primary))]/[0.06] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--rb-brand-ring))]/30 sm:px-5 sm:py-4"
                        onClick={() => router.push(`/projects/${p.id}`)}
                      >
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-[rgb(var(--rb-text-primary))]">{p.name}</p>
                        {p.status && <StatusPill status={p.status} />}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-[rgb(var(--rb-surface-border))]/45 px-5 py-3">
                  <Link
                    href="/projects"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[rgb(var(--rb-brand-primary))] transition-colors hover:text-[rgb(var(--rb-brand-primary-hover))]"
                  >
                    {t("recentProjects.viewAll")}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
      </div>
    </AppPageShell>
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
  const iconBg = {
    healthy: "text-emerald-700/80",
    warning: "text-amber-700/80",
    critical: "text-red-700/80",
    neutral: "text-[rgb(var(--rb-text-muted))]",
  };
  const statusPill = {
    healthy: "rb-badge-success",
    warning: "rb-badge-warning",
    critical: "rb-badge-error",
    neutral: "rb-badge-neutral",
  };
  return (
    <div className="flex items-center gap-3 px-5 py-5">
      <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${statusPill[status]} ${iconBg[status]}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[rgb(var(--rb-text-muted))]">{label}</p>
        <p className="text-lg font-semibold text-[rgb(var(--rb-text-primary))] mt-0.5">{value}</p>
        <p className={`rb-badge mt-1 ${statusPill[status]}`}>{statusText}</p>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  const isActive = !s.includes("cerrado") && !s.includes("closed") && !s.includes("finalizado");
  return (
    <span
      className={`rb-badge shrink-0 ${isActive ? "rb-badge-success" : "rb-badge-neutral"}`}
    >
      {status}
    </span>
  );
}
