import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ==========================
// Types (exported for API routes and consumers)
// ==========================

export type ProjectStatsResult = {
  projectId: string;
  total_notes: number;
  error_notes: number;
  modules_impacted: number;
  last_update_at: string | null;
};

export type ProjectActivityStats = {
  total: number;
  active: number;
  blocked: number;
  overdue: number;
  completed: number;
  completionRate: number;
};

export type NoteSummary = {
  id: string;
  title: string | null;
  body: string | null;
  module: string | null;
  scope_item: string | null;
  error_code: string | null;
  web_link_1: string | null;
  web_link_2: string | null;
  extra_info: string | null;
  created_at: string;
  is_knowledge_base?: boolean;
};

export type ProjectLinkSummary = {
  id: string;
  name: string | null;
  url: string | null;
  link_type: string | null;
  created_at: string;
};

export type CreateNotePayload = {
  title: string;
  body?: string | null;
  module?: string | null;
  scope_item?: string | null;
  error_code?: string | null;
  web_link_1?: string | null;
  web_link_2?: string | null;
  extra_info?: string | null;
  is_knowledge_base?: boolean;
};

export type CreateLinkPayload = {
  name: string;
  url: string;
  link_type?: string | null;
};

export class ProjectNotFoundError extends Error {
  constructor() {
    super("Project not found");
    this.name = "ProjectNotFoundError";
  }
}

// ==========================
// Internal: ensure project exists
// ==========================

async function ensureProjectExists(projectId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .single();

  if (error) {
    throw new ProjectNotFoundError();
  }
}

// ==========================
// Project stats
// ==========================

export async function getProjectStats(
  projectId: string
): Promise<ProjectStatsResult> {
  await ensureProjectExists(projectId);

  const [totalResult, errorResult, moduleResult, lastNoteResult] =
    await Promise.all([
      supabaseAdmin
        .from("notes")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId),
      supabaseAdmin
        .from("notes")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .not("error_code", "is", null),
      supabaseAdmin
        .from("notes")
        .select("module")
        .eq("project_id", projectId)
        .not("module", "is", null),
      supabaseAdmin
        .from("notes")
        .select("created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (totalResult.error) throw totalResult.error;
  if (errorResult.error) throw errorResult.error;
  if (moduleResult.error) throw moduleResult.error;
  if (lastNoteResult.error) throw lastNoteResult.error;

  const total_notes = totalResult.count;
  const error_notes = errorResult.count;
  const moduleRows = moduleResult.data;
  const lastNote = lastNoteResult.data;

  const modulesSet = new Set<string>();
  if (moduleRows) {
    for (const row of moduleRows as { module: string | null }[]) {
      if (row.module != null && String(row.module).trim() !== "") {
        modulesSet.add(String(row.module).trim());
      }
    }
  }

  const last_update_at =
    lastNote && typeof (lastNote as { created_at: string }).created_at === "string"
      ? (lastNote as { created_at: string }).created_at
      : null;

  return {
    projectId,
    total_notes: total_notes ?? 0,
    error_notes: error_notes ?? 0,
    modules_impacted: modulesSet.size,
    last_update_at,
  };
}

// ==========================
// Project activity stats (tasks board)
// ==========================

export async function getProjectActivityStats(
  projectId: string
): Promise<ProjectActivityStats> {
  try {
    await ensureProjectExists(projectId);
  } catch {
    return {
      total: 0,
      active: 0,
      blocked: 0,
      overdue: 0,
      completed: 0,
      completionRate: 0,
    };
  }

  const [tasksRes, statusesRes] = await Promise.all([
    supabaseAdmin
      .from("tasks")
      .select("id, status_id, due_date")
      .eq("project_id", projectId),
    supabaseAdmin
      .from("task_statuses")
      .select("id, code")
      .eq("is_active", true),
  ]);

  if (tasksRes.error) {
    console.error("Error loading activity stats (tasks)", tasksRes.error);
    return {
      total: 0,
      active: 0,
      blocked: 0,
      overdue: 0,
      completed: 0,
      completionRate: 0,
    };
  }

  if (statusesRes.error) {
    console.error("Error loading activity stats (statuses)", statusesRes.error);
    return {
      total: 0,
      active: 0,
      blocked: 0,
      overdue: 0,
      completed: 0,
      completionRate: 0,
    };
  }

  const tasks = (tasksRes.data ?? []) as { id: string; status_id: string; due_date: string | null }[];
  const statusRows = (statusesRes.data ?? []) as { id: string; code: string }[];
  const statusCodeById = new Map<string, string>(statusRows.map((s) => [s.id, s.code]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let completed = 0;
  let blocked = 0;
  let overdue = 0;

  for (const task of tasks) {
    const code = statusCodeById.get(task.status_id) ?? "TODO";
    if (code === "DONE") completed += 1;
    if (code === "BLOCKED") blocked += 1;
    if (code !== "DONE" && task.due_date) {
      const due = new Date(task.due_date);
      due.setHours(0, 0, 0, 0);
      if (due < today) overdue += 1;
    }
  }

  const total = tasks.length;
  const active = Math.max(total - completed, 0);
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    active,
    blocked,
    overdue,
    completed,
    completionRate,
  };
}

// ==========================
// Project notes
// ==========================

export async function getProjectNotes(
  projectId: string,
  limit: number
): Promise<{ projectId: string; notes: NoteSummary[] }> {
  await ensureProjectExists(projectId);

  const { data: notesData, error: notesError } = await supabaseAdmin
    .from("notes")
    .select(
      "id, title, body, module, scope_item, error_code, web_link_1, web_link_2, extra_info, created_at, is_knowledge_base"
    )
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (notesError) {
    throw notesError;
  }

  const notes: NoteSummary[] = (notesData ?? []) as NoteSummary[];

  return { projectId, notes };
}

export async function getProjectKnowledgeNotes(
  projectId: string,
  limit: number
): Promise<{ projectId: string; notes: NoteSummary[] }> {
  await ensureProjectExists(projectId);

  const { data: notesData, error: notesError } = await supabaseAdmin
    .from("notes")
    .select(
      "id, title, body, module, scope_item, error_code, web_link_1, web_link_2, extra_info, created_at, is_knowledge_base"
    )
    .eq("project_id", projectId)
    .eq("is_knowledge_base", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (notesError) {
    throw notesError;
  }

  const notes: NoteSummary[] = (notesData ?? []) as NoteSummary[];

  return { projectId, notes };
}

export async function createProjectNote(
  projectId: string,
  payload: CreateNotePayload
): Promise<{ projectId: string; note: NoteSummary }> {
  await ensureProjectExists(projectId);

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("notes")
    .insert({
      project_id: projectId,
      title: payload.title,
      body: payload.body ?? null,
      module: payload.module ?? null,
      scope_item: payload.scope_item ?? null,
      error_code: payload.error_code ?? null,
      web_link_1: payload.web_link_1 ?? null,
      web_link_2: payload.web_link_2 ?? null,
      extra_info: payload.extra_info ?? null,
      is_knowledge_base: payload.is_knowledge_base ?? false,
    })
    .select(
      "id, title, body, module, scope_item, error_code, web_link_1, web_link_2, extra_info, created_at, is_knowledge_base"
    )
    .single();

  if (insertError) {
    throw insertError;
  }

  const note = inserted as NoteSummary;
  return { projectId, note };
}

// ==========================
// Project links
// ==========================

export async function getProjectLinks(
  projectId: string,
  limit: number
): Promise<{ projectId: string; links: ProjectLinkSummary[] }> {
  await ensureProjectExists(projectId);

  const { data: linksData, error: linksError } = await supabaseAdmin
    .from("project_links")
    .select("id, name, url, link_type, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (linksError) {
    throw linksError;
  }

  const links: ProjectLinkSummary[] =
    (linksData ?? []) as ProjectLinkSummary[];

  return { projectId, links };
}

export async function createProjectLink(
  projectId: string,
  payload: CreateLinkPayload
): Promise<{ projectId: string; link: ProjectLinkSummary }> {
  await ensureProjectExists(projectId);

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("project_links")
    .insert({
      project_id: projectId,
      name: payload.name,
      url: payload.url,
      link_type: payload.link_type ?? null,
    })
    .select("id, name, url, link_type, created_at")
    .single();

  if (insertError) {
    throw insertError;
  }

  const link = inserted as ProjectLinkSummary;
  return { projectId, link };
}

export async function updateProjectLink(
  projectId: string,
  linkId: string,
  payload: { name?: string; url?: string; link_type?: string | null }
): Promise<ProjectLinkSummary> {
  await ensureProjectExists(projectId);

  const { data: updated, error } = await supabaseAdmin
    .from("project_links")
    .update({
      ...(payload.name !== undefined && { name: payload.name }),
      ...(payload.url !== undefined && { url: payload.url }),
      ...(payload.link_type !== undefined && { link_type: payload.link_type }),
    })
    .eq("id", linkId)
    .eq("project_id", projectId)
    .select("id, name, url, link_type, created_at")
    .single();

  if (error) throw error;
  return updated as ProjectLinkSummary;
}

export async function deleteProjectLink(
  projectId: string,
  linkId: string
): Promise<void> {
  await ensureProjectExists(projectId);

  const { error } = await supabaseAdmin
    .from("project_links")
    .delete()
    .eq("id", linkId)
    .eq("project_id", projectId);

  if (error) throw error;
}
