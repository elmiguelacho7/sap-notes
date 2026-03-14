/**
 * GET /api/search?q=...
 * Global search across projects, tasks, tickets, notes, knowledge spaces/pages, clients.
 * Returns sections for each entity type. Requires auth; scope by user's accessible projects.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/serverAuth";
import { getUserProjectIds } from "@/lib/metrics/platformMetrics";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type SearchResultProject = { id: string; name: string; status: string | null; href: string };
export type SearchResultTask = { id: string; title: string; project_id: string; project_name?: string; href: string };
export type SearchResultTicket = { id: string; title: string; status: string | null; project_id: string | null; href: string };
export type SearchResultNote = { id: string; title: string; project_id: string | null; href: string };
export type SearchResultKnowledge = { id: string; title: string; space_name?: string; href: string };
export type SearchResultClient = { id: string; name: string; href: string };

const LIMIT_PER_SECTION = 8;

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({
        projects: [],
        tasks: [],
        tickets: [],
        notes: [],
        knowledge: [],
        clients: [],
      });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json({
        projects: [],
        tasks: [],
        tickets: [],
        notes: [],
        knowledge: [],
        clients: [],
      });
    }

    const projectIds = await getUserProjectIds(userId);
    const { data: profile } = await supabaseAdmin.from("profiles").select("app_role").eq("id", userId).maybeSingle();
    const isSuperadmin = (profile as { app_role?: string } | null)?.app_role === "superadmin";

    const projFilter = isSuperadmin ? undefined : projectIds;
    const inFilter = projFilter && projFilter.length > 0 ? projFilter : ["00000000-0000-0000-0000-000000000000"];

    const [projectsRes, tasksRes, ticketsRes, notesRes, spacesRes, pagesRes, clientsRes] = await Promise.all([
      isSuperadmin
        ? supabaseAdmin.from("projects").select("id, name, status").or(`name.ilike.%${q}%`).limit(LIMIT_PER_SECTION)
        : supabaseAdmin.from("projects").select("id, name, status").in("id", inFilter).or(`name.ilike.%${q}%`).limit(LIMIT_PER_SECTION),
      projFilter?.length
        ? supabaseAdmin.from("project_tasks").select("id, title, project_id").in("project_id", projFilter).or(`title.ilike.%${q}%`).limit(LIMIT_PER_SECTION)
        : Promise.resolve({ data: [] }),
      projFilter?.length
        ? supabaseAdmin.from("tickets").select("id, title, status, project_id").in("project_id", projFilter).or(`title.ilike.%${q}%`).limit(LIMIT_PER_SECTION)
        : isSuperadmin
          ? supabaseAdmin.from("tickets").select("id, title, status, project_id").or(`title.ilike.%${q}%`).limit(LIMIT_PER_SECTION)
          : Promise.resolve({ data: [] }),
      isSuperadmin
        ? supabaseAdmin.from("notes").select("id, title, project_id").is("deleted_at", null).or(`title.ilike.%${q}%`).limit(LIMIT_PER_SECTION)
        : projFilter?.length
          ? supabaseAdmin.from("notes").select("id, title, project_id").is("deleted_at", null).in("project_id", projFilter).or(`title.ilike.%${q}%`).limit(LIMIT_PER_SECTION)
          : Promise.resolve({ data: [] }),
      isSuperadmin
        ? supabaseAdmin.from("knowledge_spaces").select("id, name").ilike("name", `%${q}%`).limit(LIMIT_PER_SECTION)
        : projFilter?.length
          ? supabaseAdmin.from("knowledge_spaces").select("id, name").or(`project_id.is.null,project_id.in.(${projFilter.join(",")})`).ilike("name", `%${q}%`).limit(LIMIT_PER_SECTION)
          : Promise.resolve({ data: [] }),
      supabaseAdmin.from("knowledge_pages").select("id, title, space_id").or(`title.ilike.%${q}%`).limit(LIMIT_PER_SECTION),
      isSuperadmin
        ? supabaseAdmin.from("clients").select("id, name").or(`name.ilike.%${q}%`).limit(LIMIT_PER_SECTION)
        : Promise.resolve({ data: [] }),
    ]);

    const projects: SearchResultProject[] = (projectsRes.data ?? []).map((p: { id: string; name: string; status: string | null }) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      href: `/projects/${p.id}`,
    }));

    const projectIdsFromTasks = Array.from(new Set((tasksRes.data ?? []).map((t: { project_id: string }) => t.project_id)));
    const projectNames = new Map<string, string>();
    if (projectIdsFromTasks.length > 0) {
      const { data: names } = await supabaseAdmin.from("projects").select("id, name").in("id", projectIdsFromTasks);
      (names ?? []).forEach((r: { id: string; name?: string | null }) => projectNames.set(r.id, r.name ?? ""));
    }

    const tasks: SearchResultTask[] = (tasksRes.data ?? []).map((t: { id: string; title: string; project_id: string }) => ({
      id: t.id,
      title: t.title ?? "",
      project_id: t.project_id,
      project_name: projectNames.get(t.project_id),
      href: `/projects/${t.project_id}/tasks`,
    }));

    const tickets: SearchResultTicket[] = (ticketsRes.data ?? []).map((t: { id: string; title: string; status: string | null; project_id: string | null }) => ({
      id: t.id,
      title: t.title ?? "",
      status: t.status,
      project_id: t.project_id,
      href: t.project_id ? `/projects/${t.project_id}/tickets` : `/tickets/${t.id}`,
    }));

    const notes: SearchResultNote[] = (notesRes.data ?? []).map((n: { id: string; title: string; project_id: string | null }) => ({
      id: n.id,
      title: n.title ?? "",
      project_id: n.project_id,
      href: `/notes/${n.id}`,
    }));

    const spaceIds = (pagesRes.data ?? []).map((p: { space_id?: string }) => p.space_id).filter(Boolean);
    const spaceNames = new Map<string, string>();
    if (spaceIds.length > 0) {
      const { data: spaces } = await supabaseAdmin.from("knowledge_spaces").select("id, name").in("id", spaceIds);
      (spaces ?? []).forEach((s: { id: string; name?: string | null }) => spaceNames.set(s.id, s.name ?? ""));
    }
    const knowledge: SearchResultKnowledge[] = [
      ...(spacesRes.data ?? []).map((s: { id: string; name: string }) => ({
        id: s.id,
        title: s.name,
        space_name: s.name,
        href: "/knowledge",
      })),
      ...(pagesRes.data ?? []).map((p: { id: string; title: string; space_id?: string }) => ({
        id: p.id,
        title: p.title ?? "",
        space_name: spaceNames.get(p.space_id ?? "") ?? undefined,
        href: `/knowledge/${p.id}`,
      })),
    ].slice(0, LIMIT_PER_SECTION);

    const clients: SearchResultClient[] = (clientsRes.data ?? []).map((c: { id: string; name: string }) => ({
      id: c.id,
      name: c.name,
      href: "/clients",
    }));

    return NextResponse.json({
      projects,
      tasks,
      tickets,
      notes,
      knowledge,
      clients,
    });
  } catch (err) {
    console.error("[api/search] error", err);
    return NextResponse.json(
      { projects: [], tasks: [], tickets: [], notes: [], knowledge: [], clients: [] },
      { status: 200 }
    );
  }
}
