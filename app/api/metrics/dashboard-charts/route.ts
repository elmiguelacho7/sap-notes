/**
 * GET /api/metrics/dashboard-charts
 * Returns chart data for dashboard: tickets by status, tickets by client, activity last 30 days.
 */

import { NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/serverAuth";
import { getUserProjectIds } from "@/lib/metrics/platformMetrics";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type TicketsByStatusItem = { status: string; count: number };
export type TicketsByClientItem = { clientName: string; count: number };
export type ActivityDayItem = { date: string; count: number };

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({
        ticketsByStatus: [],
        ticketsByClient: [],
        activityLast30Days: [],
      });
    }

    const projectIds = await getUserProjectIds(userId);
    const { data: profile } = await supabaseAdmin.from("profiles").select("app_role").eq("id", userId).maybeSingle();
    const isSuperadmin = (profile as { app_role?: string } | null)?.app_role === "superadmin";

    const projFilter = isSuperadmin ? undefined : projectIds;
    const inFilter = projFilter && projFilter.length > 0 ? projFilter : ["00000000-0000-0000-0000-000000000000"];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const fromIso = thirtyDaysAgo.toISOString();

    const [ticketsRes, ticketsClientRes, projectsRes, tasksRes, ticketsRes2, notesRes, invRes] = await Promise.all([
      projFilter && projFilter.length > 0
        ? supabaseAdmin.from("tickets").select("status").in("project_id", projFilter)
        : isSuperadmin
          ? supabaseAdmin.from("tickets").select("status")
          : Promise.resolve({ data: [] }),
      projFilter && projFilter.length > 0
        ? supabaseAdmin.from("tickets").select("client_id").not("client_id", "is", null).in("project_id", projFilter)
        : isSuperadmin
          ? supabaseAdmin.from("tickets").select("client_id").not("client_id", "is", null)
          : Promise.resolve({ data: [] }),
      isSuperadmin ? supabaseAdmin.from("projects").select("created_at").gte("created_at", fromIso) : supabaseAdmin.from("projects").select("created_at").in("id", inFilter).gte("created_at", fromIso),
      isSuperadmin
        ? supabaseAdmin.from("project_tasks").select("created_at").gte("created_at", fromIso)
        : projFilter?.length
          ? supabaseAdmin.from("project_tasks").select("created_at").in("project_id", projFilter).gte("created_at", fromIso)
          : Promise.resolve({ data: [] }),
      isSuperadmin
        ? supabaseAdmin.from("tickets").select("updated_at").gte("updated_at", fromIso)
        : projFilter?.length
          ? supabaseAdmin.from("tickets").select("updated_at").in("project_id", projFilter).gte("updated_at", fromIso)
          : Promise.resolve({ data: [] }),
      isSuperadmin
        ? supabaseAdmin.from("notes").select("created_at").is("deleted_at", null).gte("created_at", fromIso)
        : projFilter?.length
          ? supabaseAdmin.from("notes").select("created_at").is("deleted_at", null).in("project_id", projFilter).gte("created_at", fromIso)
          : Promise.resolve({ data: [] }),
      isSuperadmin
        ? supabaseAdmin.from("project_invitations").select("created_at").gte("created_at", fromIso)
        : projFilter?.length
          ? supabaseAdmin.from("project_invitations").select("created_at").in("project_id", projFilter).gte("created_at", fromIso)
          : Promise.resolve({ data: [] }),
    ]);

    const statusCounts: Record<string, number> = {};
    (ticketsRes.data ?? []).forEach((r: { status?: string | null }) => {
      const s = (r.status ?? "open").toString();
      statusCounts[s] = (statusCounts[s] ?? 0) + 1;
    });
    const ticketsByStatus: TicketsByStatusItem[] = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

    const clientIds = Array.from(new Set((ticketsClientRes.data ?? []).map((r: { client_id?: string | null }) => r.client_id).filter((id): id is string => Boolean(id))));
    let ticketsByClient: TicketsByClientItem[] = [];
    if (clientIds.length > 0) {
      const { data: clients } = await supabaseAdmin.from("clients").select("id, name").in("id", clientIds);
      const nameById = new Map<string, string>((clients ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
      const countByClient: Record<string, number> = {};
      (ticketsClientRes.data ?? []).forEach((r: { client_id?: string | null }) => {
        const id = r.client_id ?? "";
        if (!id) return;
        const name = nameById.get(id) ?? "Sin nombre";
        countByClient[name] = (countByClient[name] ?? 0) + 1;
      });
      ticketsByClient = Object.entries(countByClient).map(([clientName, count]) => ({ clientName, count }));
    }

    const dayCounts: Record<string, number> = {};
    for (let d = 0; d < 31; d++) {
      const day = new Date();
      day.setDate(day.getDate() - (30 - d));
      day.setHours(0, 0, 0, 0);
      dayCounts[day.toISOString().slice(0, 10)] = 0;
    }
    const addDay = (iso: string | null | undefined) => {
      if (!iso) return;
      const date = iso.slice(0, 10);
      if (dayCounts[date] !== undefined) dayCounts[date]++;
    };
    (projectsRes.data ?? []).forEach((r: { created_at?: string }) => addDay(r.created_at));
    (tasksRes.data ?? []).forEach((r: { created_at?: string }) => addDay(r.created_at));
    (ticketsRes2.data ?? []).forEach((r: { updated_at?: string }) => addDay(r.updated_at));
    (notesRes.data ?? []).forEach((r: { created_at?: string }) => addDay(r.created_at));
    (invRes.data ?? []).forEach((r: { created_at?: string }) => addDay(r.created_at));
    const activityLast30Days: ActivityDayItem[] = Object.entries(dayCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return NextResponse.json({
      ticketsByStatus,
      ticketsByClient,
      activityLast30Days,
    });
  } catch (err) {
    console.error("[api/metrics/dashboard-charts] error", err);
    return NextResponse.json(
      { ticketsByStatus: [], ticketsByClient: [], activityLast30Days: [] },
      { status: 200 }
    );
  }
}
