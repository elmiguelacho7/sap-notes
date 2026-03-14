/**
 * GET /api/metrics/team-workload
 * Returns task count by assigned user for projects visible to the current user.
 * Used for Team Workload dashboard section. Respects project membership / superadmin.
 */

import { NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/serverAuth";
import { getUserProjectIds } from "@/lib/metrics/platformMetrics";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type TeamWorkloadUser = { id: string; name: string; taskCount: number };

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ users: [] });
    }

    const projectIds = await getUserProjectIds(userId);
    const { data: profile } = await supabaseAdmin.from("profiles").select("app_role").eq("id", userId).maybeSingle();
    const isSuperadmin = (profile as { app_role?: string } | null)?.app_role === "superadmin";

    if (!isSuperadmin && projectIds.length === 0) {
      return NextResponse.json({ users: [] });
    }

    const tasksQuery = supabaseAdmin
      .from("project_tasks")
      .select("assignee_profile_id")
      .not("assignee_profile_id", "is", null)
      .or("status.is.null,status.not.ilike.done");

    const { data: tasks } = isSuperadmin
      ? await tasksQuery
      : await tasksQuery.in("project_id", projectIds);

    const countByAssignee: Record<string, number> = {};
    (tasks ?? []).forEach((t: { assignee_profile_id: string | null }) => {
      const id = t.assignee_profile_id ?? "";
      if (!id) return;
      countByAssignee[id] = (countByAssignee[id] ?? 0) + 1;
    });

    const assigneeIds = Object.keys(countByAssignee);
    if (assigneeIds.length === 0) {
      return NextResponse.json({ users: [] });
    }

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", assigneeIds);

    const nameById = new Map<string, string>(
      (profiles ?? []).map((p: { id: string; full_name: string | null }) => [
        p.id,
        (p.full_name ?? "Sin nombre").trim() || "Sin nombre",
      ])
    );

    const users: TeamWorkloadUser[] = assigneeIds
      .map((id) => ({
        id,
        name: nameById.get(id) ?? "Sin nombre",
        taskCount: countByAssignee[id] ?? 0,
      }))
      .sort((a, b) => b.taskCount - a.taskCount)
      .slice(0, 8);

    return NextResponse.json({ users });
  } catch (err) {
    console.error("[api/metrics/team-workload] error", err);
    return NextResponse.json({ users: [] }, { status: 200 });
  }
}
