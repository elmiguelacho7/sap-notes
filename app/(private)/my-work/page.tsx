"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import type { ProjectTask } from "@/lib/types/projectTasks";
import {
  CalendarClock,
  Ticket,
  ListTodo,
  AlertTriangle,
  CheckSquare,
  Search,
  Clock,
  CalendarRange,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// project_tasks.assignee_profile_id and project_activities.owner_profile_id
// reference profiles.id. tickets.assigned_to: in this schema profiles.id = auth.uid(),
// so we use the resolved profile.id for all three for consistency.
// ---------------------------------------------------------------------------

type TicketRow = {
  id: string;
  title: string;
  status: string | null;
  priority: string | null;
  project_id: string | null;
  due_date: string | null;
  updated_at: string;
  created_at: string;
};

type ActivityRow = {
  id: string;
  project_id: string;
  name: string;
  owner_profile_id: string | null;
  start_date: string | null;
  due_date: string | null;
  status: string | null;
  created_at: string;
};

type ProjectRow = { id: string; name: string };

type TaskFilter = "all" | "today" | "overdue" | "blocked";

/** Unified work item for list (tasks, tickets, activities). */
type WorkItem =
  | { type: "task"; id: string; title: string; projectId: string | null; projectName: string | null; status: string; dueDate: string | null; updatedAt: string; priority: string | null; href: string }
  | { type: "ticket"; id: string; title: string; projectId: string | null; projectName: string | null; status: string; dueDate: string | null; updatedAt: string; priority: string | null; href: string }
  | { type: "activity"; id: string; title: string; projectId: string; projectName: string | null; status: string | null; dueDate: string | null; updatedAt: string; priority: null; href: string };

type TabFilter = "all" | "overdue" | "due_today" | "active" | "recent";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekStart(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekEnd(): Date {
  const s = weekStart();
  s.setDate(s.getDate() + 6);
  s.setHours(23, 59, 59, 999);
  return s;
}

function isSameDay(a: string | null, b: Date): boolean {
  if (!a) return false;
  const d = new Date(a);
  d.setHours(0, 0, 0, 0);
  return d.getTime() === b.getTime();
}

function isBeforeDay(a: string | null, b: Date): boolean {
  if (!a) return false;
  const d = new Date(a);
  d.setHours(0, 0, 0, 0);
  return d.getTime() < b.getTime();
}

function isInWeek(a: string | null, start: Date, end: Date): boolean {
  if (!a) return false;
  const t = new Date(a).getTime();
  return t >= start.getTime() && t <= end.getTime();
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

/** Short due label for list: "due 1 Mar" (es-ES). */
function formatDueShort(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `due ${d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`;
}

function isRecentlyUpdated(updatedAt: string, days = 3): boolean {
  const d = new Date(updatedAt);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000);
  return diff <= days;
}

/** Sort: overdue first, then blocked, then today, then rest by due_date asc nulls last. */
function sortTasksByPriority(tasks: ProjectTask[], today: Date): ProjectTask[] {
  const overdue: ProjectTask[] = [];
  const blocked: ProjectTask[] = [];
  const todayList: ProjectTask[] = [];
  const rest: ProjectTask[] = [];
  for (const t of tasks) {
    if (t.status === "done") continue;
    if (isBeforeDay(t.due_date, today)) overdue.push(t);
    else if (t.status === "blocked") blocked.push(t);
    else if (isSameDay(t.due_date, today)) todayList.push(t);
    else rest.push(t);
  }
  const byDue = (a: ProjectTask, b: ProjectTask) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  };
  return [...overdue.sort(byDue), ...blocked.sort(byDue), ...todayList.sort(byDue), ...rest.sort(byDue)];
}

/** Activities: prefer this week; fallback sort by nearest due_date/start_date. */
function sortActivitiesByNearest(activities: ActivityRow[]): ActivityRow[] {
  return [...activities].sort((a, b) => {
    const da = a.due_date ?? a.start_date;
    const db = b.due_date ?? b.start_date;
    if (!da) return 1;
    if (!db) return -1;
    return new Date(da).getTime() - new Date(db).getTime();
  });
}

/** Group tasks by project_id; fallback label "No project" for null. */
function groupTasksByProject(
  tasks: ProjectTask[],
  getProjectName: (id: string) => string | null
): { projectId: string; projectName: string; tasks: ProjectTask[] }[] {
  const byProject = new Map<string, ProjectTask[]>();
  for (const t of tasks) {
    const pid = t.project_id ?? "__none__";
    if (!byProject.has(pid)) byProject.set(pid, []);
    byProject.get(pid)!.push(t);
  }
  return Array.from(byProject.entries()).map(([projectId, taskList]) => ({
    projectId,
    projectName: projectId === "__none__" ? "No project" : (getProjectName(projectId) ?? "Unknown project"),
    tasks: taskList,
  }));
}

type AtRiskItem =
  | { type: "task"; id: string; title: string; projectName: string | null; reason: string; href: string; projectId: string | null }
  | { type: "activity"; id: string; title: string; projectName: string | null; reason: string; href: string; projectId: string }
  | { type: "ticket"; id: string; title: string; projectName: string | null; reason: string; href: string; projectId: string | null };

/** Build at-risk list: overdue blocked → overdue tasks → blocked → overdue activities → activities due in 7 days. Optional high-priority tickets. Limit 8. */
function buildAtRiskList(
  overdueTasks: ProjectTask[],
  blockedTasks: ProjectTask[],
  activities: ActivityRow[],
  tickets: TicketRow[],
  today: Date,
  getProjectName: (id: string) => string | null,
  limit: number
): AtRiskItem[] {
  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  const byDue = (a: ProjectTask, b: ProjectTask) =>
    (a.due_date && b.due_date ? new Date(a.due_date).getTime() - new Date(b.due_date).getTime() : 0);

  const overdueBlocked = overdueTasks.filter((t) => t.status === "blocked").sort(byDue);
  const overdueNotBlocked = overdueTasks.filter((t) => t.status !== "blocked").sort(byDue);
  const blockedNotOverdue = blockedTasks.filter((t) => !isBeforeDay(t.due_date, today)).sort(byDue);

  const overdueActivities = activities.filter((a) => {
    const d = a.due_date ?? a.start_date;
    return d != null && isBeforeDay(d, today);
  });
  const activitiesDueIn7Days = activities.filter((a) => {
    const d = a.due_date ?? a.start_date;
    if (!d) return false;
    const t = new Date(d).getTime();
    return t >= today.getTime() && t <= sevenDaysLater.getTime();
  });
  const sortedOverdueAct = sortActivitiesByNearest(overdueActivities);
  const sortedDueSoonAct = sortActivitiesByNearest(activitiesDueIn7Days);

  const highPriorityTickets = tickets.filter(
    (t) => t.priority === "high" || t.priority === "urgent"
  );

  const out: AtRiskItem[] = [];

  for (const t of overdueBlocked) {
    if (out.length >= limit) break;
    out.push({
      type: "task",
      id: t.id,
      title: t.title,
      projectName: t.project_id != null ? getProjectName(t.project_id) : null,
      reason: "Vencida y bloqueada",
      href: t.project_id != null ? `/projects/${t.project_id}/tasks` : "/my-work",
      projectId: t.project_id ?? null,
    });
  }
  for (const t of overdueNotBlocked) {
    if (out.length >= limit) break;
    out.push({
      type: "task",
      id: t.id,
      title: t.title,
      projectName: t.project_id != null ? getProjectName(t.project_id) : null,
      reason: "Vencida",
      href: t.project_id != null ? `/projects/${t.project_id}/tasks` : "/my-work",
      projectId: t.project_id ?? null,
    });
  }
  for (const t of blockedNotOverdue) {
    if (out.length >= limit) break;
    out.push({
      type: "task",
      id: t.id,
      title: t.title,
      projectName: t.project_id != null ? getProjectName(t.project_id) : null,
      reason: "Bloqueada",
      href: t.project_id != null ? `/projects/${t.project_id}/tasks` : "/my-work",
      projectId: t.project_id ?? null,
    });
  }
  for (const a of sortedOverdueAct) {
    if (out.length >= limit) break;
    out.push({
      type: "activity",
      id: a.id,
      title: a.name,
      projectName: getProjectName(a.project_id),
      reason: "Actividad vencida",
      href: `/projects/${a.project_id}/planning/activities`,
      projectId: a.project_id,
    });
  }
  for (const a of sortedDueSoonAct) {
    if (out.length >= limit) break;
    const d = a.due_date ?? a.start_date;
    const days = d != null ? Math.ceil((new Date(d).getTime() - today.getTime()) / (24 * 60 * 60 * 1000)) : 0;
    out.push({
      type: "activity",
      id: a.id,
      title: a.name,
      projectName: getProjectName(a.project_id),
      reason: days <= 0 ? "Vence hoy" : days === 1 ? "Vence mañana" : `Vence en ${days} días`,
      href: `/projects/${a.project_id}/planning/activities`,
      projectId: a.project_id,
    });
  }
  for (const t of highPriorityTickets) {
    if (out.length >= limit) break;
    out.push({
      type: "ticket",
      id: t.id,
      title: t.title,
      projectName: t.project_id != null ? getProjectName(t.project_id) : null,
      reason: t.priority === "urgent" ? "Urgente" : "Alta prioridad",
      href: t.project_id != null ? `/projects/${t.project_id}/tickets` : `/tickets/${t.id}`,
      projectId: t.project_id ?? null,
    });
  }

  return out.slice(0, limit);
}

const TASK_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  done: "Hecha",
  blocked: "Bloqueado",
  review: "Revisión",
};

const TICKET_STATUS_LABELS: Record<string, string> = {
  open: "Abierto",
  in_progress: "En progreso",
  resolved: "Resuelto",
  closed: "Cerrado",
  cancelled: "Cancelado",
};

// ---------------------------------------------------------------------------
// UI building blocks (dark theme, workspace style)
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<WorkItem["type"], string> = {
  task: "Task",
  ticket: "Ticket",
  activity: "Activity",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "low priority",
  medium: "medium priority",
  high: "high priority",
  urgent: "urgent",
};

function WorkRow({ item }: { item: WorkItem }) {
  const today = todayStart();
  const statusLabel =
    item.type === "task"
      ? TASK_STATUS_LABELS[item.status] ?? item.status
      : item.type === "ticket"
        ? TICKET_STATUS_LABELS[item.status] ?? item.status
        : (item.status ?? "—").toLowerCase();
  const hasDue = item.dueDate && (item.type === "task" || item.type === "activity");
  const dueOrUpdatedLabel = hasDue && isSameDay(item.dueDate!, today)
    ? "due today"
    : item.type === "task" && item.dueDate && isBeforeDay(item.dueDate, today)
      ? "overdue"
      : hasDue
        ? formatDueShort(item.dueDate)
        : `updated ${relativeTime(item.updatedAt)}`;
  const priorityLabel =
    item.priority && (item.priority === "high" || item.priority === "urgent")
      ? (PRIORITY_LABELS[item.priority] ?? item.priority)
      : item.priority
        ? PRIORITY_LABELS[item.priority] ?? item.priority
        : null;
  const typeLabel = TYPE_LABELS[item.type];
  const Icon = item.type === "task" ? CheckSquare : item.type === "ticket" ? Ticket : CalendarRange;
  const badgeClass =
    item.type === "task"
      ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
      : item.type === "ticket"
        ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
        : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  const metaParts = [
    item.projectName ?? "No project",
    statusLabel,
    dueOrUpdatedLabel,
    ...(priorityLabel ? [priorityLabel] : []),
  ];
  return (
    <Link
      href={item.href}
      className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 transition-colors hover:bg-slate-800/60"
    >
      <span
        className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${badgeClass}`}
      >
        <Icon className="h-3.5 w-3.5" />
        {typeLabel}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-100 truncate">{item.title}</p>
        <p className="mt-1 text-xs text-slate-500">
          {metaParts.join(" · ")}
        </p>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MyWorkPage() {
  const router = useRouter();
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loadingIdentity, setLoadingIdentity] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [allTasks, setAllTasks] = useState<ProjectTask[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);

  const [tasksError, setTasksError] = useState<string | null>(null);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);

  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [tabFilter, setTabFilter] = useState<TabFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Step 1: Resolve auth user and domain profile (canonical profile.id for ownership).
  // In this schema profiles.id = auth.uid(); we still fetch profile to ensure row exists.
  useEffect(() => {
    let cancelled = false;

    async function resolveIdentity() {
      setLoadingIdentity(true);
      setProfileError(null);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (cancelled) return;
      if (authError) {
        handleSupabaseError("my-work auth", authError);
        setProfileError("No se pudo verificar la sesión.");
        setLoadingIdentity(false);
        return;
      }
      if (!user?.id) {
        router.replace("/");
        return;
      }

      setAuthUserId(user.id);

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (cancelled) return;
      if (profileErr || !profile) {
        handleSupabaseError("my-work profile", profileErr);
        setProfileError("No se encontró tu perfil. Contacta al administrador.");
        setProfileId(null);
      } else {
        setProfileId((profile as { id: string }).id);
        setProfileError(null);
      }
      setLoadingIdentity(false);
    }

    void resolveIdentity();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Step 2: Load data only after profile is resolved (and no profile error).
  const loadData = useCallback(async () => {
    if (profileId == null || profileError != null) return;

    setLoadingData(true);
    setPageError(null);
    setTasksError(null);
    setTicketsError(null);
    setActivitiesError(null);

    const pid = profileId;

    const projRes = await supabase.from("projects").select("id, name").order("name", { ascending: true });
    if (projRes.error) handleSupabaseError("projects", projRes.error);
    setProjects((projRes.data ?? []) as ProjectRow[]);

    try {
      const tasksRes = await supabase
        .from("project_tasks")
        .select("id, project_id, activity_id, title, status, priority, due_date, assignee_profile_id, created_at, updated_at")
        .eq("assignee_profile_id", pid)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (tasksRes.error) {
        handleSupabaseError("project_tasks", tasksRes.error);
        setTasksError("No se pudieron cargar las tareas.");
        setAllTasks([]);
      } else {
        setAllTasks((tasksRes.data ?? []) as ProjectTask[]);
      }
    } catch {
      setTasksError("No se pudieron cargar las tareas.");
      setAllTasks([]);
    }

    try {
      const ticketsRes = await supabase
        .from("tickets")
        .select("id, title, status, priority, project_id, due_date, updated_at, created_at")
        .eq("assigned_to", pid)
        .neq("status", "closed")
        .order("updated_at", { ascending: false });
      if (ticketsRes.error) {
        handleSupabaseError("tickets", ticketsRes.error);
        setTicketsError("No se pudieron cargar los tickets.");
        setTickets([]);
      } else {
        setTickets((ticketsRes.data ?? []) as TicketRow[]);
      }
    } catch {
      setTicketsError("No se pudieron cargar los tickets.");
      setTickets([]);
    }

    try {
      const activitiesRes = await supabase
        .from("project_activities")
        .select("id, project_id, name, owner_profile_id, start_date, due_date, status, created_at")
        .eq("owner_profile_id", pid)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (activitiesRes.error) {
        handleSupabaseError("project_activities", activitiesRes.error);
        setActivitiesError("No se pudieron cargar las actividades.");
        setActivities([]);
      } else {
        setActivities((activitiesRes.data ?? []) as ActivityRow[]);
      }
    } catch {
      setActivitiesError("No se pudieron cargar las actividades.");
      setActivities([]);
    }

    setLoadingData(false);
  }, [profileId, profileError]);

  useEffect(() => {
    if (profileId != null && profileError == null) void loadData();
  }, [profileId, profileError, loadData]);

  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const getProjectName = (id: string) => projectMap.get(id) ?? null;

  const today = todayStart();
  const wStart = weekStart();
  const wEnd = weekEnd();

  const tasksNotDone = allTasks.filter((t) => t.status !== "done");
  const overdueTasks = tasksNotDone.filter((t) => isBeforeDay(t.due_date, today));
  const blockedTasks = allTasks.filter((t) => t.status === "blocked");
  const todayTasks = tasksNotDone.filter((t) => isSameDay(t.due_date, today));

  const sortedOpenTasks = sortTasksByPriority(tasksNotDone, today);

  const filteredTaskList =
    taskFilter === "all"
      ? sortedOpenTasks
      : taskFilter === "today"
        ? todayTasks
        : taskFilter === "overdue"
          ? overdueTasks.sort((a, b) => (a.due_date && b.due_date ? new Date(a.due_date).getTime() - new Date(b.due_date).getTime() : 0))
          : blockedTasks.sort((a, b) => (a.due_date && b.due_date ? new Date(a.due_date).getTime() - new Date(b.due_date).getTime() : 0));

  const weekActivities = activities.filter((a) => {
    const d = a.due_date ?? a.start_date;
    return d != null && isInWeek(d, wStart, wEnd);
  });
  const fallbackActivities =
    weekActivities.length > 0 ? weekActivities : sortActivitiesByNearest(activities).slice(0, 15);

  const dueTodayTasksCount = todayTasks.length;
  const dueTodayActivitiesCount = activities.filter((a) => {
    const d = a.due_date ?? a.start_date;
    return d != null && isSameDay(d, today);
  }).length;
  const dueTodayCount = dueTodayTasksCount + dueTodayActivitiesCount;

  const dueThisWeekTasksCount = tasksNotDone.filter((t) => t.due_date != null && isInWeek(t.due_date, wStart, wEnd)).length;
  const dueThisWeekCount = dueThisWeekTasksCount + weekActivities.length;

  const overdueActivitiesCount = activities.filter((a) => {
    const d = a.due_date ?? a.start_date;
    return d != null && isBeforeDay(d, today);
  }).length;
  const overdueCount = overdueTasks.length + overdueActivitiesCount;

  const atRiskList = buildAtRiskList(
    overdueTasks,
    blockedTasks,
    activities,
    tickets,
    today,
    getProjectName,
    8
  );

  const taskGroups = groupTasksByProject(filteredTaskList, getProjectName);
  const showGrouped =
    taskFilter === "all" || taskFilter === "overdue" || taskFilter === "blocked" || taskFilter === "today";

  const openCount = tasksNotDone.length;
  const loading = loadingIdentity || loadingData;

  /** Unified work list: tasks (not done), tickets, activities. */
  const allWorkItems = useMemo((): WorkItem[] => {
    const items: WorkItem[] = [];
    for (const t of tasksNotDone) {
      items.push({
        type: "task",
        id: t.id,
        title: t.title,
        projectId: t.project_id ?? null,
        projectName: t.project_id != null ? getProjectName(t.project_id) : null,
        status: t.status,
        dueDate: t.due_date ?? null,
        updatedAt: (t as ProjectTask & { updated_at?: string }).updated_at ?? t.created_at,
        priority: (t as ProjectTask & { priority?: string }).priority ?? null,
        href: t.project_id != null ? `/projects/${t.project_id}/tasks` : "/my-work",
      });
    }
    for (const t of tickets) {
      items.push({
        type: "ticket",
        id: t.id,
        title: t.title,
        projectId: t.project_id ?? null,
        projectName: t.project_id != null ? getProjectName(t.project_id) : null,
        status: t.status ?? "open",
        dueDate: t.due_date ?? null,
        updatedAt: t.updated_at,
        priority: t.priority ?? null,
        href: `/tickets/${t.id}`,
      });
    }
    for (const a of activities) {
      const updatedAt = (a as ActivityRow & { updated_at?: string }).updated_at ?? a.created_at;
      items.push({
        type: "activity",
        id: a.id,
        title: a.name,
        projectId: a.project_id,
        projectName: getProjectName(a.project_id),
        status: a.status,
        dueDate: a.due_date ?? a.start_date ?? null,
        updatedAt,
        priority: null,
        href: `/projects/${a.project_id}/planning/activities`,
      });
    }
    return items;
  }, [tasksNotDone, tickets, activities, projectMap]);

  const filteredWorkItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list: WorkItem[] = [];
    if (tabFilter === "all" || tabFilter === "active") {
      list = [...allWorkItems];
    } else if (tabFilter === "overdue") {
      list = allWorkItems.filter((w) => {
        if (w.type === "activity" && w.dueDate) return isBeforeDay(w.dueDate, today);
        if (w.type === "task" && w.status !== "done" && w.dueDate) return isBeforeDay(w.dueDate, today);
        return false;
      });
    } else if (tabFilter === "due_today") {
      list = allWorkItems.filter((w) => {
        if (w.type === "activity" && w.dueDate) return isSameDay(w.dueDate, today);
        if (w.type === "task" && w.dueDate) return isSameDay(w.dueDate, today);
        return false;
      });
    } else {
      list = [...allWorkItems].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    if (q) {
      list = list.filter((w) => w.title.toLowerCase().includes(q) || (w.projectName && w.projectName.toLowerCase().includes(q)));
    }
    return list;
  }, [allWorkItems, tabFilter, searchQuery, today]);

  const recentlyUpdatedCount = useMemo(
    () => allWorkItems.filter((w) => isRecentlyUpdated(w.updatedAt)).length,
    [allWorkItems]
  );

  if (loadingIdentity && authUserId == null) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-100">My Work</h1>
        <p className="text-sm text-slate-500">Cargando…</p>
      </div>
    );
  }

  if (profileError != null && profileId == null) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-100">My Work</h1>
        <div className="rounded-xl border border-amber-800/50 bg-amber-950/30 px-5 py-6 text-center">
          <p className="text-sm font-medium text-amber-200">{profileError}</p>
          <p className="mt-1 text-xs text-amber-300/80">No se puede cargar tu trabajo sin un perfil válido.</p>
        </div>
      </div>
    );
  }

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "overdue", label: "Overdue" },
    { key: "due_today", label: "Due today" },
    { key: "active", label: "Active" },
    { key: "recent", label: "Recent" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">My Work</h1>
        <p className="mt-1 text-sm text-slate-400">Your tasks, tickets and recent work in one place.</p>
      </header>

      {pageError != null && (
        <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-5 py-4 text-sm text-red-200">{pageError}</div>
      )}

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <span className="text-xs text-slate-400">Overdue</span>
          <span className="text-sm font-semibold text-amber-300">{loading ? "—" : overdueCount}</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-2">
          <CalendarClock className="h-4 w-4 text-sky-400" />
          <span className="text-xs text-slate-400">Due today</span>
          <span className="text-sm font-semibold text-sky-300">{loading ? "—" : dueTodayCount}</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/10 px-3 py-2">
          <Ticket className="h-4 w-4 text-violet-400" />
          <span className="text-xs text-slate-400">Open tickets</span>
          <span className="text-sm font-semibold text-violet-300">{loading ? "—" : tickets.length}</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2">
          <ListTodo className="h-4 w-4 text-slate-400" />
          <span className="text-xs text-slate-400">Tasks</span>
          <span className="text-sm font-semibold text-slate-200">{loading ? "—" : openCount}</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
          <Clock className="h-4 w-4 text-emerald-400" />
          <span className="text-xs text-slate-400">Recently updated</span>
          <span className="text-sm font-semibold text-emerald-300">{loading ? "—" : recentlyUpdatedCount}</span>
        </div>
      </div>

      {/* Filter bar: tabs + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTabFilter(key)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                tabFilter === key
                  ? "border-slate-600 bg-slate-800 text-slate-100"
                  : "border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800/60 hover:text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="my-work-filter" className="text-xs font-medium text-slate-500 whitespace-nowrap">
            Filter work
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="my-work-filter"
              type="search"
              placeholder="Search by title or project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-w-[200px] rounded-xl border border-slate-800 bg-slate-900/60 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-slate-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Unified work list */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        {tasksError && (
          <p className="text-sm text-amber-400 mb-4">{tasksError}</p>
        )}
        {ticketsError && (
          <p className="text-sm text-amber-400 mb-4">{ticketsError}</p>
        )}
        {activitiesError && (
          <p className="text-sm text-amber-400 mb-4">{activitiesError}</p>
        )}
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Cargando…</p>
        ) : filteredWorkItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-base font-medium text-slate-300">Nothing requires your attention right now.</p>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              When you have tasks, tickets or activities assigned to you, they will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filteredWorkItems.map((item) => (
              <li key={`${item.type}-${item.id}`}>
                <WorkRow item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
