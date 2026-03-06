/**
 * Sapito Brain v1 — server-side tools that query Supabase for structured context.
 * Used by the context builder to feed the assistant with platform, project, and notes data.
 * All functions are defensive: on failure they return safe defaults and log; they do not throw to callers.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";

const todayIso = () => new Date().toISOString().slice(0, 10);

// ==========================
// Types (output shapes)
// ==========================

export type PlatformStats = {
  totalProjects: number;
  activeProjects: number;
  totalNotes: number;
  notesToday: number;
  openTickets?: number;
};

export type ProjectOverview = {
  projectId: string;
  projectName?: string;
  openTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  openTickets: number;
  highPriorityTickets: number;
  overdueActivities: number;
  upcomingActivities: number;
};

export type NotesInsights = {
  totalNotes: number;
  topModules: Array<{ name: string; count: number }>;
  topErrorCodes: Array<{ code: string; count: number }>;
  topTransactions: Array<{ code: string; count: number }>;
};

// ==========================
// getPlatformStats
// ==========================

/**
 * Returns a compact global platform summary.
 * Uses: projects (status for active), notes (deleted_at null), tickets (open = not closed).
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  const fallback: PlatformStats = {
    totalProjects: 0,
    activeProjects: 0,
    totalNotes: 0,
    notesToday: 0,
    openTickets: 0,
  };

  try {
    const [projectsRes, notesTotalRes, notesTodayRes, ticketsRes] =
      await Promise.all([
        supabaseAdmin
          .from("projects")
          .select("id, status", { count: "exact", head: false }),
        supabaseAdmin
          .from("notes")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null),
        supabaseAdmin
          .from("notes")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .gte("created_at", `${todayIso()}T00:00:00.000Z`),
        supabaseAdmin
          .from("tickets")
          .select("id", { count: "exact", head: true })
          .neq("status", "closed"),
      ]);

    const totalProjects = projectsRes.data?.length ?? 0;
    const activeProjects =
      projectsRes.data?.filter(
        (p: { status?: string }) =>
          p?.status === "planned" || p?.status === "in_progress"
      ).length ?? 0;
    const totalNotes = notesTotalRes.count ?? 0;
    const notesToday = notesTodayRes.count ?? 0;
    const openTickets = ticketsRes.count ?? 0;

    return {
      totalProjects,
      activeProjects,
      totalNotes,
      notesToday,
      openTickets,
    };
  } catch (err) {
    console.error("[sapitoTools] getPlatformStats error", err);
    return fallback;
  }
}

// ==========================
// getProjectOverview
// ==========================

/**
 * Returns a compact project health summary for a given project_id.
 * Uses: projects (name), project_tasks (status, due_date), tickets (status, priority), project_activities (due_date).
 */
export async function getProjectOverview(
  projectId: string
): Promise<ProjectOverview> {
  const fallback: ProjectOverview = {
    projectId,
    projectName: undefined,
    openTasks: 0,
    overdueTasks: 0,
    blockedTasks: 0,
    openTickets: 0,
    highPriorityTickets: 0,
    overdueActivities: 0,
    upcomingActivities: 0,
  };

  if (!projectId?.trim()) return fallback;

  try {
    const today = todayIso();

    const [projectRes, tasksRes, ticketsRes, activitiesRes] = await Promise.all([
      supabaseAdmin
        .from("projects")
        .select("id, name")
        .eq("id", projectId)
        .maybeSingle(),
      supabaseAdmin
        .from("project_tasks")
        .select("id, status, due_date")
        .eq("project_id", projectId),
      supabaseAdmin
        .from("tickets")
        .select("id, status, priority")
        .eq("project_id", projectId),
      supabaseAdmin
        .from("project_activities")
        .select("id, due_date")
        .eq("project_id", projectId),
    ]);

    const projectName =
      (projectRes.data as { name?: string } | null)?.name ?? undefined;
    const tasks = (tasksRes.data ?? []) as Array<{
      status?: string;
      due_date?: string | null;
    }>;
    const tickets = (ticketsRes.data ?? []) as Array<{
      status?: string;
      priority?: string;
    }>;
    const activities = (activitiesRes.data ?? []) as Array<{
      due_date?: string | null;
    }>;

    const openTasks = tasks.filter(
      (t) => (t.status ?? "").toLowerCase() !== "done"
    ).length;
    const overdueTasks = tasks.filter(
      (t) =>
        t.due_date &&
        t.due_date < today &&
        (t.status ?? "").toLowerCase() !== "done"
    ).length;
    const blockedTasks = tasks.filter(
      (t) => (t.status ?? "").toLowerCase() === "blocked"
    ).length;
    const openTickets = tickets.filter(
      (t) => (t.status ?? "").toLowerCase() !== "closed"
    ).length;
    const highPriorityTickets = tickets.filter(
      (t) =>
        (t.priority ?? "").toLowerCase() === "high" ||
        (t.priority ?? "").toLowerCase() === "urgent"
    ).length;
    const overdueActivities = activities.filter(
      (a) => a.due_date && a.due_date < today
    ).length;
    const upcomingActivities = activities.filter(
      (a) => a.due_date && a.due_date >= today
    ).length;

    return {
      projectId,
      projectName,
      openTasks,
      overdueTasks,
      blockedTasks,
      openTickets,
      highPriorityTickets,
      overdueActivities,
      upcomingActivities,
    };
  } catch (err) {
    console.error("[sapitoTools] getProjectOverview error", projectId, err);
    return fallback;
  }
}

// ==========================
// getNotesInsights
// ==========================

/**
 * Returns a compact insight summary about notes (modules, error codes, transactions).
 * Uses all non-deleted notes; aggregates in memory for top N.
 */
export async function getNotesInsights(topN = 10): Promise<NotesInsights> {
  const fallback: NotesInsights = {
    totalNotes: 0,
    topModules: [],
    topErrorCodes: [],
    topTransactions: [],
  };

  try {
    const { data: rows, error } = await supabaseAdmin
      .from("notes")
      .select("module, error_code, transaction")
      .is("deleted_at", null);

    if (error) {
      console.error("[sapitoTools] getNotesInsights query error", error);
      return fallback;
    }

    const list = (rows ?? []) as Array<{
      module?: string | null;
      error_code?: string | null;
      transaction?: string | null;
    }>;

    const totalNotes = list.length;
    const moduleCounts = new Map<string, number>();
    const errorCounts = new Map<string, number>();
    const transactionCounts = new Map<string, number>();

    for (const row of list) {
      const mod = (row.module ?? "").trim();
      if (mod) moduleCounts.set(mod, (moduleCounts.get(mod) ?? 0) + 1);
      const err = (row.error_code ?? "").trim();
      if (err) errorCounts.set(err, (errorCounts.get(err) ?? 0) + 1);
      const tx = (row.transaction ?? "").trim();
      if (tx) transactionCounts.set(tx, (transactionCounts.get(tx) ?? 0) + 1);
    }

    const sortTop = (
      map: Map<string, number>
    ): Array<{ name?: string; code?: string; count: number }> =>
      Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([key, count]) => ({ name: key, code: key, count }));

    const topModules = sortTop(moduleCounts).map(({ name, count }) => ({
      name: name ?? "",
      count,
    }));
    const topErrorCodes = sortTop(errorCounts).map(({ code, count }) => ({
      code: code ?? "",
      count,
    }));
    const topTransactions = sortTop(transactionCounts).map(({ code, count }) => ({
      code: code ?? "",
      count,
    }));

    return {
      totalNotes,
      topModules,
      topErrorCodes,
      topTransactions,
    };
  } catch (err) {
    console.error("[sapitoTools] getNotesInsights error", err);
    return fallback;
  }
}
