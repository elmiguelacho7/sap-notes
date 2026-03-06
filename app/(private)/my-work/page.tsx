"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import type { ProjectTask } from "@/lib/types/projectTasks";
import { CalendarClock, Ban, Ticket, ListTodo, AlertTriangle, ExternalLink } from "lucide-react";

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
// UI building blocks
// ---------------------------------------------------------------------------

function MyWorkStatCard({
  label,
  value,
  caption,
  icon: Icon,
}: {
  label: string;
  value: number;
  caption: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">{caption}</p>
      <Icon className="h-4 w-4 text-slate-300 mt-2" aria-hidden />
    </div>
  );
}

function MyWorkSectionCard({
  title,
  caption,
  children,
  emptyMessage,
  isEmpty,
  errorMessage,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
  emptyMessage: string;
  isEmpty: boolean;
  errorMessage?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{caption}</p>
      </div>
      <div className="p-5">
        {errorMessage ? (
          <p className="text-sm text-amber-700">{errorMessage}</p>
        ) : isEmpty ? (
          <p className="text-sm text-slate-500">{emptyMessage}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function TaskItem({
  task,
  projectName,
  linkToProjectTasks,
}: {
  task: ProjectTask;
  projectName: string | null;
  linkToProjectTasks: string;
}) {
  const statusLabel = TASK_STATUS_LABELS[task.status] ?? task.status;
  const projectId = task.project_id ?? null;
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
      <Link href={linkToProjectTasks} className="block">
        <p className="text-sm font-medium text-slate-900 truncate">{task.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {projectName && <span>{projectName}</span>}
          {task.due_date != null && (
            <span>
              {new Date(task.due_date).toLocaleDateString("es-ES", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {statusLabel}
          </span>
        </div>
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        <Link
          href={linkToProjectTasks}
          className="text-slate-500 hover:text-indigo-600 transition-colors"
        >
          Ver tareas
        </Link>
        {projectId != null && (
          <>
            <span className="text-slate-300">·</span>
            <Link
              href={`/projects/${projectId}`}
              className="text-slate-500 hover:text-indigo-600 transition-colors"
            >
              Ver proyecto
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function TicketItem({ ticket, projectName }: { ticket: TicketRow; projectName: string | null }) {
  const statusLabel = (ticket.status && TICKET_STATUS_LABELS[ticket.status]) ?? ticket.status ?? "—";
  const ticketHref = ticket.project_id != null ? `/projects/${ticket.project_id}/tickets` : `/tickets/${ticket.id}`;
  const openTicketHref = `/tickets/${ticket.id}`;
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
      <Link href={ticketHref} className="block">
        <p className="text-sm font-medium text-slate-900 truncate">{ticket.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {projectName && <span>{projectName}</span>}
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {statusLabel}
          </span>
        </div>
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        <Link href={openTicketHref} className="text-slate-500 hover:text-indigo-600 transition-colors">
          Abrir ticket
        </Link>
        {ticket.project_id != null && (
          <>
            <span className="text-slate-300">·</span>
            <Link
              href={`/projects/${ticket.project_id}`}
              className="text-slate-500 hover:text-indigo-600 transition-colors"
            >
              Ver proyecto
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function ActivityItem({ activity, projectName }: { activity: ActivityRow; projectName: string | null }) {
  const dateVal = activity.due_date ?? activity.start_date;
  const dateStr =
    dateVal != null
      ? new Date(dateVal).toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : null;
  const planningHref = `/projects/${activity.project_id}/planning/activities`;
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
      <Link href={planningHref} className="block">
        <p className="text-sm font-medium text-slate-900 truncate">{activity.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {projectName && <span>{projectName}</span>}
          {dateStr && <span>{dateStr}</span>}
        </div>
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        <Link href={planningHref} className="text-slate-500 hover:text-indigo-600 transition-colors">
          Ver actividades
        </Link>
        <span className="text-slate-300">·</span>
        <Link
          href={`/projects/${activity.project_id}`}
          className="text-slate-500 hover:text-indigo-600 transition-colors"
        >
          Ver proyecto
        </Link>
      </div>
    </div>
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
        .select("id, project_id, activity_id, title, status, due_date, assignee_profile_id, created_at, updated_at")
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

  if (loadingIdentity && authUserId == null) {
    return (
      <PageShell wide>
        <PageHeader title="My Work" description="A personal view of your tasks, tickets and weekly project activity." />
        <div className="space-y-8">
          <p className="text-sm text-slate-500">Cargando…</p>
        </div>
      </PageShell>
    );
  }

  if (profileError != null && profileId == null) {
    return (
      <PageShell wide>
        <PageHeader title="My Work" description="A personal view of your tasks, tickets and weekly project activity." />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-6 text-center">
          <p className="text-sm font-medium text-amber-800">{profileError}</p>
          <p className="mt-1 text-xs text-amber-700">No se puede cargar tu trabajo sin un perfil válido.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell wide>
      <div className="space-y-8">
        <PageHeader
          title="My Work"
          description="A personal view of your tasks, tickets and weekly project activity."
        />

        {pageError != null && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{pageError}</div>
        )}

        <section>
          <h2 className="text-sm font-semibold text-slate-800 mb-1">Resumen</h2>
          <p className="text-xs text-slate-500 mb-5">Tareas y tickets asignados a ti.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <MyWorkStatCard
              label="Tareas abiertas"
              value={loading ? 0 : openCount}
              caption="No completadas"
              icon={ListTodo}
            />
            <MyWorkStatCard
              label="Tareas vencidas"
              value={loading ? 0 : overdueTasks.length}
              caption="Fecha límite pasada"
              icon={CalendarClock}
            />
            <MyWorkStatCard
              label="Tareas bloqueadas"
              value={loading ? 0 : blockedTasks.length}
              caption="En estado bloqueado"
              icon={Ban}
            />
            <MyWorkStatCard
              label="Tickets asignados"
              value={loading ? 0 : tickets.length}
              caption="No cerrados"
              icon={Ticket}
            />
          </div>
        </section>

        <section className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-slate-500">Esta semana:</span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
              Vence hoy: {loading ? "—" : dueTodayCount}
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
              Esta semana: {loading ? "—" : dueThisWeekCount}
            </span>
            <span className="inline-flex items-center rounded-full border border-amber-100 bg-amber-50/80 px-3 py-1 text-xs font-medium text-amber-800">
              Vencido: {loading ? "—" : overdueCount}
            </span>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            {/* Filter bar: client-side only, affects task list below */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500 mr-1">Tareas:</span>
              {(
                [
                  { key: "all" as const, label: "Todas abiertas" },
                  { key: "today" as const, label: "Hoy" },
                  { key: "overdue" as const, label: "Vencidas" },
                  { key: "blocked" as const, label: "Bloqueadas" },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTaskFilter(key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    taskFilter === key
                      ? "bg-slate-800 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <MyWorkSectionCard
              title={taskFilter === "all" ? "Tareas abiertas" : taskFilter === "today" ? "Hoy" : taskFilter === "overdue" ? "Vencidas" : "Bloqueadas"}
              caption={
                taskFilter === "all"
                  ? "Orden: vencidas → bloqueadas → hoy → resto por fecha."
                  : taskFilter === "today"
                    ? "Tareas con fecha límite hoy."
                    : taskFilter === "overdue"
                      ? "Tareas con fecha límite pasada."
                      : "Tareas en estado bloqueado."
              }
              emptyMessage={
                taskFilter === "all"
                  ? "No hay tareas abiertas."
                  : taskFilter === "today"
                    ? "Nada debido hoy."
                    : taskFilter === "overdue"
                      ? "No hay tareas vencidas."
                      : "No hay tareas bloqueadas."
              }
              isEmpty={!loading && filteredTaskList.length === 0}
              errorMessage={tasksError}
            >
              {!loading && filteredTaskList.length > 0 && (
                <>
                  {showGrouped ? (
                    <ul className="space-y-6">
                      {taskGroups.map((group) => (
                        <li key={group.projectId}>
                          <div className="mb-2 flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-800">{group.projectName}</h3>
                            <span className="text-xs text-slate-500">({group.tasks.length})</span>
                          </div>
                          <ul className="space-y-2">
                            {group.tasks.map((task) => (
                              <li key={task.id}>
                                <TaskItem
                                  task={task}
                                  projectName={task.project_id != null ? getProjectName(task.project_id) : "No project"}
                                  linkToProjectTasks={task.project_id != null ? `/projects/${task.project_id}/tasks` : "/my-work"}
                                />
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="space-y-2">
                      {filteredTaskList.map((task) => (
                        <li key={task.id}>
                          <TaskItem
                            task={task}
                            projectName={task.project_id != null ? getProjectName(task.project_id) : "No project"}
                            linkToProjectTasks={task.project_id != null ? `/projects/${task.project_id}/tasks` : "/my-work"}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </MyWorkSectionCard>
          </div>

          <div className="space-y-8">
            {atRiskList.length > 0 && (
              <MyWorkSectionCard
                title="En riesgo"
                caption="Tareas vencidas o bloqueadas, actividades próximas o vencidas, tickets de alta prioridad."
                emptyMessage="Nada en riesgo."
                isEmpty={false}
              >
                <ul className="space-y-2">
                  {atRiskList.map((item) => (
                    <li key={`${item.type}-${item.id}`}>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <Link href={item.href} className="text-sm font-medium text-slate-900 truncate block hover:text-indigo-600">
                              {item.title}
                            </Link>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              {item.projectName && <span>{item.projectName}</span>}
                              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50/80 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                                {item.reason}
                              </span>
                            </div>
                          </div>
                          <Link
                            href={item.href}
                            className="shrink-0 text-slate-400 hover:text-indigo-600 p-1"
                            aria-label="Abrir"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </MyWorkSectionCard>
            )}

            <MyWorkSectionCard
              title="Tickets asignados"
              caption="Tickets asignados a ti, no cerrados."
              emptyMessage="No hay tickets asignados."
              isEmpty={!loading && tickets.length === 0}
              errorMessage={ticketsError}
            >
              {!loading && tickets.length > 0 && (
                <ul className="space-y-2">
                  {tickets.map((t) => (
                    <li key={t.id}>
                      <TicketItem
                        ticket={t}
                        projectName={t.project_id != null ? getProjectName(t.project_id) : null}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </MyWorkSectionCard>

            <MyWorkSectionCard
              title="Actividades esta semana"
              caption="Actividades de proyecto asignadas a ti; si no hay esta semana, se muestran las más próximas."
              emptyMessage="No hay actividades para esta semana."
              isEmpty={!loading && fallbackActivities.length === 0}
              errorMessage={activitiesError}
            >
              {!loading && fallbackActivities.length > 0 && (
                <ul className="space-y-2">
                  {fallbackActivities.map((a) => (
                    <li key={a.id}>
                      <ActivityItem activity={a} projectName={getProjectName(a.project_id)} />
                    </li>
                  ))}
                </ul>
              )}
            </MyWorkSectionCard>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
