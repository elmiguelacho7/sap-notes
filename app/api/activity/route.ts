/**
 * GET /api/activity
 * Returns last 20 system activity events for the current user's scope.
 * Event types: project_created, task_created, ticket_closed, knowledge_added, user_invited.
 */

import { NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/serverAuth";
import { getUserProjectIds } from "@/lib/metrics/platformMetrics";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ActivityEvent = {
  id: string;
  type: "project_created" | "task_created" | "ticket_closed" | "note_created" | "user_invited";
  title: string;
  date: string;
  link: string;
  projectName?: string | null;
  projectId?: string | null;
};

const LIMIT = 20;

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ events: [] }, { status: 200 });
    }

    const projectIds = await getUserProjectIds(userId);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("app_role")
      .eq("id", userId)
      .maybeSingle();
    const isSuperadmin = (profile as { app_role?: string } | null)?.app_role === "superadmin";

    const events: ActivityEvent[] = [];

    if (projectIds.length > 0 || isSuperadmin) {
      const projFilter = isSuperadmin ? undefined : projectIds;
      const inFilter = projFilter && projFilter.length > 0 ? projFilter : ["00000000-0000-0000-0000-000000000000"];

      const [projectsRes, tasksRes, ticketsRes, notesRes, invitationsRes] = await Promise.all([
        isSuperadmin
          ? supabaseAdmin.from("projects").select("id, name, created_at").order("created_at", { ascending: false }).limit(5)
          : supabaseAdmin.from("projects").select("id, name, created_at").in("id", inFilter).order("created_at", { ascending: false }).limit(5),
        isSuperadmin
          ? supabaseAdmin.from("project_tasks").select("id, project_id, title, created_at").order("created_at", { ascending: false }).limit(5)
          : projFilter?.length
            ? supabaseAdmin.from("project_tasks").select("id, project_id, title, created_at").in("project_id", projFilter).order("created_at", { ascending: false }).limit(5)
            : Promise.resolve({ data: [] }),
        isSuperadmin
          ? supabaseAdmin.from("tickets").select("id, project_id, title, status, updated_at").in("status", ["closed", "resolved"]).order("updated_at", { ascending: false }).limit(5)
          : projFilter?.length
            ? supabaseAdmin.from("tickets").select("id, project_id, title, status, updated_at").in("project_id", projFilter).in("status", ["closed", "resolved"]).order("updated_at", { ascending: false }).limit(5)
            : Promise.resolve({ data: [] }),
        isSuperadmin
          ? supabaseAdmin.from("notes").select("id, project_id, title, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(5)
          : projFilter?.length
            ? supabaseAdmin.from("notes").select("id, project_id, title, created_at").is("deleted_at", null).in("project_id", projFilter).order("created_at", { ascending: false }).limit(5)
            : Promise.resolve({ data: [] }),
        isSuperadmin
          ? supabaseAdmin.from("project_invitations").select("id, project_id, email, created_at").order("created_at", { ascending: false }).limit(5)
          : projFilter?.length
            ? supabaseAdmin.from("project_invitations").select("id, project_id, email, created_at").in("project_id", projFilter).order("created_at", { ascending: false }).limit(5)
            : Promise.resolve({ data: [] }),
      ]);

      const projectRows = (projectsRes.data ?? []) as { id: string; name: string | null; created_at: string }[];
      const taskRows = (tasksRes.data ?? []) as { id: string; project_id: string; title: string | null; created_at: string }[];
      const ticketRows = (ticketsRes.data ?? []) as { id: string; project_id: string | null; title: string | null; updated_at: string }[];
      const noteRows = (notesRes.data ?? []) as { id: string; project_id: string | null; title: string | null; created_at: string }[];
      const invRows = (invitationsRes.data ?? []) as { id: string; project_id: string; email: string; created_at: string }[];

      const projectNames = new Map<string, string>();
      const allIds = Array.from(
        new Set([
          ...projectRows.map((p) => p.id),
          ...taskRows.map((t) => t.project_id),
          ...ticketRows.map((t) => t.project_id),
          ...noteRows.map((n) => n.project_id),
          ...invRows.map((i) => i.project_id),
        ].filter((id): id is string => typeof id === "string" && id.length > 0))
      );
      if (allIds.length > 0) {
        const { data: names } = await supabaseAdmin.from("projects").select("id, name").in("id", allIds);
        (names ?? []).forEach((r: { id: string; name?: string | null }) => { projectNames.set(r.id, r.name ?? ""); });
      }

      projectRows.forEach((p) => {
        events.push({
          id: `project-${p.id}`,
          type: "project_created",
          title: p.name ?? "Proyecto",
          date: p.created_at,
          link: `/projects/${p.id}`,
          projectName: p.name ?? null,
          projectId: p.id,
        });
      });
      taskRows.forEach((t) => {
        events.push({
          id: `task-${t.id}`,
          type: "task_created",
          title: t.title ?? "Tarea",
          date: t.created_at,
          link: `/projects/${t.project_id}/tasks`,
          projectName: projectNames.get(t.project_id) ?? null,
          projectId: t.project_id,
        });
      });
      ticketRows.forEach((t) => {
        events.push({
          id: `ticket-${t.id}`,
          type: "ticket_closed",
          title: t.title ?? "Ticket",
          date: t.updated_at,
          link: t.project_id ? `/projects/${t.project_id}/tickets` : `/tickets/${t.id}`,
          projectName: t.project_id ? projectNames.get(t.project_id) ?? null : null,
          projectId: t.project_id ?? null,
        });
      });
      noteRows.forEach((n) => {
        events.push({
          id: `note-${n.id}`,
          type: "note_created",
          title: n.title ?? "Nota",
          date: n.created_at,
          link: `/notes/${n.id}`,
          projectName: n.project_id ? projectNames.get(n.project_id) ?? null : null,
          projectId: n.project_id ?? null,
        });
      });
      invRows.forEach((i) => {
        events.push({
          id: `inv-${i.id}`,
          type: "user_invited",
          title: `Invitación a ${i.email}`,
          date: i.created_at,
          link: `/projects/${i.project_id}/members`,
          projectName: projectNames.get(i.project_id) ?? null,
          projectId: i.project_id,
        });
      });
    }

    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const last20 = events.slice(0, LIMIT);

    return NextResponse.json({ events: last20 });
  } catch (err) {
    console.error("[api/activity] error", err);
    return NextResponse.json({ events: [] }, { status: 200 });
  }
}
