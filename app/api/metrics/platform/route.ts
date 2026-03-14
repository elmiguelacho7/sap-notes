/**
 * GET /api/metrics/platform
 * Returns platform metrics for the current user (same source of truth as Sapito).
 * Includes extended KPIs for dashboard: tasks_due_today, clients_count, knowledge_entries_count.
 */

import { NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/serverAuth";
import { getPlatformMetrics, getUserProjectIds } from "@/lib/metrics/platformMetrics";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserIdFromRequest(request);
    const metrics = await getPlatformMetrics(userId);

    let tasks_due_today = 0;
    let clients_count = 0;
    let knowledge_entries_count = 0;
    let overdue_tasks_count = 0;
    let projects_without_recent_activity_count = 0;

    if (userId) {
      const projectIds = await getUserProjectIds(userId);
      const { data: profile } = await supabaseAdmin.from("profiles").select("app_role").eq("id", userId).maybeSingle();
      const isSuperadmin = (profile as { app_role?: string } | null)?.app_role === "superadmin";
      const today = new Date().toISOString().slice(0, 10);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const fromIso = sevenDaysAgo.toISOString();

      if (projectIds.length > 0 || isSuperadmin) {
        const [
          tasksRes,
          clientsRes,
          knowledgeSpacesRes,
          overdueRes,
          recentActivityRes,
        ] = await Promise.all([
          projectIds.length > 0
            ? supabaseAdmin.from("project_tasks").select("id", { count: "exact", head: true }).in("project_id", projectIds).eq("due_date", today)
            : Promise.resolve({ count: 0 }),
          isSuperadmin
            ? supabaseAdmin.from("clients").select("id", { count: "exact", head: true })
            : Promise.resolve({ count: 0 }),
          isSuperadmin
            ? supabaseAdmin.from("knowledge_spaces").select("id", { count: "exact", head: true })
            : projectIds.length > 0
              ? supabaseAdmin.from("knowledge_spaces").select("id", { count: "exact", head: true }).or("project_id.is.null,project_id.in.(" + projectIds.join(",") + ")")
              : Promise.resolve({ count: 0 } as { count: number }),
          projectIds.length > 0
            ? supabaseAdmin
                .from("project_tasks")
                .select("id", { count: "exact", head: true })
                .in("project_id", projectIds)
                .lt("due_date", today)
                .or("status.is.null,status.not.ilike.done")
            : Promise.resolve({ count: 0 }),
          projectIds.length > 0
            ? (async () => {
                const { data: recent } = await supabaseAdmin
                  .from("project_activities")
                  .select("project_id")
                  .in("project_id", projectIds)
                  .gte("updated_at", fromIso);
                const idsWithRecent = new Set((recent ?? []).map((r: { project_id: string }) => r.project_id));
                return { count: projectIds.filter((id) => !idsWithRecent.has(id)).length };
              })()
            : Promise.resolve({ count: 0 }),
        ]);
        tasks_due_today = typeof tasksRes.count === "number" ? tasksRes.count : 0;
        clients_count = typeof clientsRes.count === "number" ? clientsRes.count : 0;
        knowledge_entries_count = typeof knowledgeSpacesRes.count === "number" ? knowledgeSpacesRes.count : 0;
        overdue_tasks_count = typeof overdueRes.count === "number" ? overdueRes.count : 0;
        projects_without_recent_activity_count =
          typeof recentActivityRes.count === "number" ? recentActivityRes.count : 0;
      }
    }

    return NextResponse.json({
      projects_total: metrics.projects_total,
      projects_active: metrics.projects_active,
      notes_total: metrics.notes_total,
      notes_today: metrics.notes_today,
      tickets_open: metrics.tickets_open,
      tasks_due_today: tasks_due_today,
      clients_count,
      knowledge_entries_count,
      overdue_tasks_count,
      projects_without_recent_activity_count,
    });
  } catch (err) {
    console.error("[api/metrics/platform] error", err);
    return NextResponse.json(
      { error: "No se pudieron cargar las métricas." },
      { status: 500 }
    );
  }
}
