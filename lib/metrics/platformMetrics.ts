/**
 * Shared metrics resolvers — single source of truth for platform and project metrics.
 * Used by: dashboard API, Sapito (global and project), and any UI that shows counts.
 * Access rule: projects the user is a member of (project_members) OR projects they own (projects.created_by).
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ==========================
// Types
// ==========================

export type PlatformMetrics = {
  projects_total: number;
  projects_active: number;
  notes_total: number;
  notes_today: number;
  tickets_open: number;
};

export type ProjectMetrics = {
  projectId: string;
  projectName?: string;
  projectStatus?: string;
  openTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  openTickets: number;
  highPriorityTickets: number;
  overdueActivities: number;
  upcomingActivities: number;
  totalNotes: number;
};

// ==========================
// Helpers: user's project IDs (single source of truth for access)
// ==========================

/**
 * Returns project IDs accessible to the user:
 * 1. Projects where the user is in project_members
 * 2. Projects where projects.created_by = userId (owner/creator)
 * No duplicates. Used by metrics, resolution, and any logic that must match UI visibility.
 */
export async function getUserProjectIds(userId: string | null): Promise<string[]> {
  if (!userId?.trim()) return [];

  const [memberRes, ownerRes] = await Promise.all([
    supabaseAdmin
      .from("project_members")
      .select("project_id")
      .eq("user_id", userId),
    supabaseAdmin
      .from("projects")
      .select("id")
      .eq("created_by", userId),
  ]);

  if (memberRes.error) {
    console.error("[platformMetrics] getUserProjectIds (members) error", memberRes.error.message);
  }
  if (ownerRes.error) {
    if (ownerRes.error.code !== "42703") {
      console.error("[platformMetrics] getUserProjectIds (owned) error", ownerRes.error.message);
    }
  }

  const fromMembers = (memberRes.data ?? [])
    .map((r: { project_id?: string }) => r.project_id)
    .filter((id): id is string => typeof id === "string" && id.trim() !== "");
  const fromOwned = (ownerRes.data ?? [])
    .map((r: { id?: string }) => r.id)
    .filter((id): id is string => typeof id === "string" && id.trim() !== "");

  const merged = Array.from(new Set([...fromMembers, ...fromOwned]));

  if (process.env.NODE_ENV === "development" && merged.length > 0) {
    const ownedCount = fromOwned.length;
    const memberOnlyCount = fromMembers.filter((id) => !fromOwned.includes(id)).length;
    const memberCount = fromMembers.length;
    const { data: projectNames } = await supabaseAdmin
      .from("projects")
      .select("name")
      .in("id", merged.slice(0, 10));
    const namesPreview = (projectNames ?? []).map((r: { name?: string | null }) => r.name ?? "").filter(Boolean);
    console.log("[Project access audit]", {
      userId: userId.slice(0, 8) + "…",
      ownedProjectCount: ownedCount,
      memberProjectCount: memberCount,
      mergedAccessibleProjectCount: merged.length,
      mergedAccessibleProjectNamesPreview: namesPreview.slice(0, 5),
    });
  }

  return merged;
}

// ==========================
// getPlatformMetrics(userId)
// ==========================

/**
 * Platform metrics scoped to the user: only projects they are a member of,
 * notes in those projects, tickets in those projects.
 * Uses RPC get_platform_metrics for single source of truth (dashboard and Sapito).
 */
export async function getPlatformMetrics(userId: string | null): Promise<PlatformMetrics> {
  const fallback: PlatformMetrics = {
    projects_total: 0,
    projects_active: 0,
    notes_total: 0,
    notes_today: 0,
    tickets_open: 0,
  };

  if (!userId?.trim()) {
    return fallback;
  }

  try {
    const { data, error } = await supabaseAdmin.rpc("get_platform_metrics", {
      p_user_id: userId,
    });

    if (error) {
      console.error("[platformMetrics] get_platform_metrics RPC error", error.message);
      return fallback;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== "object") {
      return fallback;
    }

    const r = row as {
      projects_total?: number | null;
      projects_active?: number | null;
      notes_total?: number | null;
      notes_today?: number | null;
      tickets_open?: number | null;
    };

    return {
      projects_total: Number(r.projects_total ?? 0),
      projects_active: Number(r.projects_active ?? 0),
      notes_total: Number(r.notes_total ?? 0),
      notes_today: Number(r.notes_today ?? 0),
      tickets_open: Number(r.tickets_open ?? 0),
    };
  } catch (err) {
    console.error("[platformMetrics] getPlatformMetrics error", err);
    return fallback;
  }
}

// ==========================
// getProjectMetrics(projectId, userId)
// ==========================

/**
 * Project metrics for a single project. Verifies user has access (member or owner) before returning data.
 * Uses RPC get_project_metrics for single source of truth. Returns null if project not found or user does not have access.
 */
export async function getProjectMetrics(
  projectId: string,
  userId: string | null
): Promise<ProjectMetrics | null> {
  if (!projectId?.trim()) return null;
  if (!userId?.trim()) return null;

  try {
    const { data, error } = await supabaseAdmin.rpc("get_project_metrics", {
      p_project_id: projectId,
      p_user_id: userId,
    });

    if (error) {
      console.error("[platformMetrics] get_project_metrics RPC error", projectId, error.message);
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== "object") {
      return null;
    }

    const r = row as {
      project_id?: string | null;
      project_name?: string | null;
      project_status?: string | null;
      open_tasks?: number | null;
      overdue_tasks?: number | null;
      blocked_tasks?: number | null;
      open_tickets?: number | null;
      high_priority_tickets?: number | null;
      overdue_activities?: number | null;
      upcoming_activities?: number | null;
      total_notes?: number | null;
    };

    return {
      projectId: r.project_id ?? projectId,
      projectName: r.project_name ?? undefined,
      projectStatus: r.project_status ?? undefined,
      openTasks: Number(r.open_tasks ?? 0),
      overdueTasks: Number(r.overdue_tasks ?? 0),
      blockedTasks: Number(r.blocked_tasks ?? 0),
      openTickets: Number(r.open_tickets ?? 0),
      highPriorityTickets: Number(r.high_priority_tickets ?? 0),
      overdueActivities: Number(r.overdue_activities ?? 0),
      upcomingActivities: Number(r.upcoming_activities ?? 0),
      totalNotes: Number(r.total_notes ?? 0),
    };
  } catch (err) {
    console.error("[platformMetrics] getProjectMetrics error", projectId, err);
    return null;
  }
}
