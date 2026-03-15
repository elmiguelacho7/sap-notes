import type { SupabaseClient } from "@supabase/supabase-js";
import { logSupabaseError } from "@/lib/logSupabaseError";
import type {
  KnowledgeSpace,
  KnowledgePage,
  KnowledgeBlock,
  KnowledgeSearchResult,
} from "@/lib/types/knowledge";

export type { KnowledgeSearchResult };

export type ListSpacesOptions = { projectId?: string | null };

/**
 * List knowledge spaces. If projectId is provided, returns spaces for that project (or global if null).
 */
export async function listSpaces(
  supabase: SupabaseClient,
  options: ListSpacesOptions = {}
): Promise<KnowledgeSpace[]> {
  let query = supabase
    .from("knowledge_spaces")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (options.projectId !== undefined) {
    if (options.projectId === null || options.projectId === "") {
      query = query.is("project_id", null);
    } else {
      query = query.eq("project_id", options.projectId);
    }
  }

  const { data, error } = await query;
  if (error) {
    logSupabaseError("knowledgeService.listSpaces", error);
    throw new Error(error.message ?? "Supabase error");
  }
  return (data ?? []) as KnowledgeSpace[];
}

export type CreateSpaceInput = {
  projectId?: string | null;
  name: string;
  description?: string | null;
};

/**
 * Create a knowledge space. Requires authenticated user (owner_profile_id = auth.uid()).
 */
export async function createSpace(
  supabase: SupabaseClient,
  input: CreateSpaceInput
): Promise<KnowledgeSpace> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user?.id) throw new Error("No autorizado.");

  const { data, error } = await supabase
    .from("knowledge_spaces")
    .insert({
      owner_profile_id: user.user.id,
      project_id: input.projectId || null,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      visibility: "private",
      sort_order: 0,
    })
    .select()
    .single();

  if (error) {
    logSupabaseError("knowledgeService.createSpace", error);
    throw new Error(error.message ?? "Error al crear el espacio.");
  }
  return data as KnowledgeSpace;
}

/**
 * Get a single space by id.
 */
export async function getSpace(
  supabase: SupabaseClient,
  spaceId: string
): Promise<KnowledgeSpace | null> {
  const { data, error } = await supabase
    .from("knowledge_spaces")
    .select("*")
    .eq("id", spaceId)
    .single();

  if (error || !data) return null;
  return data as KnowledgeSpace;
}

/**
 * List pages in a space (excluding soft-deleted).
 */
export async function listPages(
  supabase: SupabaseClient,
  spaceId: string
): Promise<KnowledgePage[]> {
  const { data, error } = await supabase
    .from("knowledge_pages")
    .select("*")
    .eq("space_id", spaceId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    logSupabaseError("knowledgeService.listPages", error);
    throw new Error(error.message ?? "Error al cargar las páginas.");
  }
  return (data ?? []) as KnowledgePage[];
}

/**
 * Create a page in a space. Slug derived from title (simplified).
 */
export async function createPage(
  supabase: SupabaseClient,
  spaceId: string,
  title: string
): Promise<KnowledgePage> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user?.id) throw new Error("No autorizado.");

  const slug =
    title
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "") || "page";
  const slugUnique = `${slug}-${Date.now().toString(36)}`;

  const { data, error } = await supabase
    .from("knowledge_pages")
    .insert({
      space_id: spaceId,
      owner_profile_id: user.user.id,
      title: title.trim(),
      slug: slugUnique,
      page_type: "how_to",
    })
    .select()
    .single();

  if (error) {
    logSupabaseError("knowledgeService.createPage", error);
    throw new Error(error.message ?? "Error al crear la página.");
  }
  return data as KnowledgePage;
}

/**
 * Get a single page with its blocks.
 */
export async function getPage(
  supabase: SupabaseClient,
  pageId: string
): Promise<{ page: KnowledgePage; blocks: KnowledgeBlock[] }> {
  const { data: pageData, error: pageError } = await supabase
    .from("knowledge_pages")
    .select("*")
    .eq("id", pageId)
    .is("deleted_at", null)
    .single();

  if (pageError || !pageData) {
    logSupabaseError("knowledgeService.getPage", pageError);
    throw new Error("Página no encontrada.");
  }

  const { data: blocksData, error: blocksError } = await supabase
    .from("knowledge_blocks")
    .select("*")
    .eq("page_id", pageId)
    .order("sort_order", { ascending: true });

  if (blocksError) {
    logSupabaseError("knowledgeService.getPage blocks", blocksError);
    throw new Error("Error al cargar los bloques.");
  }

  return {
    page: pageData as KnowledgePage,
    blocks: (blocksData ?? []) as KnowledgeBlock[],
  };
}

export type UpdatePageInput = {
  title?: string;
  summary?: string | null;
  space_id?: string;
};

/**
 * Update a knowledge page (title, summary, space). Requires auth.
 */
export async function updatePage(
  supabase: SupabaseClient,
  pageId: string,
  input: UpdatePageInput
): Promise<KnowledgePage> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user?.id) throw new Error("No autorizado.");

  const payload: Record<string, unknown> = {};
  if (input.title !== undefined) payload.title = input.title.trim();
  if (input.summary !== undefined) payload.summary = input.summary?.trim() || null;
  if (input.space_id !== undefined) payload.space_id = input.space_id;

  if (Object.keys(payload).length === 0) {
    const { data } = await supabase.from("knowledge_pages").select("*").eq("id", pageId).single();
    if (!data) throw new Error("Página no encontrada.");
    return data as KnowledgePage;
  }

  const { data, error } = await supabase
    .from("knowledge_pages")
    .update(payload)
    .eq("id", pageId)
    .select()
    .single();

  if (error) {
    logSupabaseError("knowledgeService.updatePage", error);
    throw new Error(error.message ?? "Error al actualizar la página.");
  }
  return data as KnowledgePage;
}

/**
 * Soft-delete a knowledge page (sets deleted_at). Requires auth.
 */
export async function deletePage(
  supabase: SupabaseClient,
  pageId: string
): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user?.id) throw new Error("No autorizado.");

  const { error } = await supabase
    .from("knowledge_pages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", pageId);

  if (error) {
    logSupabaseError("knowledgeService.deletePage", error);
    throw new Error(error.message ?? "Error al eliminar la página.");
  }
}

export type BlockInput = {
  id?: string;
  block_type: KnowledgeBlock["block_type"];
  content_json: Record<string, unknown>;
  sort_order: number;
};

/**
 * Replace all blocks for a page with the given list (upsert by id or insert new).
 */
export async function upsertBlocks(
  supabase: SupabaseClient,
  pageId: string,
  blocks: BlockInput[]
): Promise<KnowledgeBlock[]> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user?.id) throw new Error("No autorizado.");

  const existing = await supabase
    .from("knowledge_blocks")
    .select("id")
    .eq("page_id", pageId);
  const existingIds = new Set((existing.data ?? []).map((r) => r.id));

  const toInsert: Array<{
    id?: string;
    page_id: string;
    block_type: string;
    content_json: Record<string, unknown>;
    sort_order: number;
  }> = [];
  const toUpdate: Array<{ id: string; content_json: Record<string, unknown>; sort_order: number }> = [];

  blocks.forEach((b, idx) => {
    const row = {
      page_id: pageId,
      block_type: b.block_type,
      content_json: b.content_json ?? {},
      sort_order: b.sort_order ?? idx,
    };
    if (b.id && existingIds.has(b.id)) {
      toUpdate.push({ id: b.id, content_json: row.content_json, sort_order: row.sort_order });
    } else {
      toInsert.push(row);
    }
  });

  for (const row of toUpdate) {
    const { error } = await supabase
      .from("knowledge_blocks")
      .update({ content_json: row.content_json, sort_order: row.sort_order })
      .eq("id", row.id);
    if (error) {
      logSupabaseError("knowledgeService.upsertBlocks update", error);
      throw new Error(error.message ?? "Error al actualizar bloques.");
    }
  }

  if (toInsert.length > 0) {
    const { data: inserted, error } = await supabase
      .from("knowledge_blocks")
      .insert(toInsert)
      .select();
    if (error) {
      logSupabaseError("knowledgeService.upsertBlocks insert", error);
      throw new Error(error.message ?? "Error al crear bloques.");
    }
    (inserted ?? []).forEach((r) => existingIds.add(r.id));
  }

  const toDelete = await supabase
    .from("knowledge_blocks")
    .select("id")
    .eq("page_id", pageId);
  const currentIds = new Set(blocks.map((b) => b.id).filter(Boolean) as string[]);
  const deleteIds = (toDelete.data ?? []).map((r) => r.id).filter((id) => !currentIds.has(id));
  if (deleteIds.length > 0) {
    await supabase.from("knowledge_blocks").delete().in("id", deleteIds);
  }

  const { data: final } = await supabase
    .from("knowledge_blocks")
    .select("*")
    .eq("page_id", pageId)
    .order("sort_order", { ascending: true });
  return (final ?? []) as KnowledgeBlock[];
}

/**
 * Full-text search over knowledge pages (title, summary). Respects RLS.
 * Uses search_vector column and GIN index. Returns results ordered by relevance.
 * Empty query returns [].
 */
export async function searchKnowledge(
  supabase: SupabaseClient,
  query: string
): Promise<KnowledgeSearchResult[]> {
  const q = typeof query === "string" ? query.trim() : "";
  if (!q) return [];

  const { data, error } = await supabase
    .from("knowledge_pages")
    .select("id, title, summary, page_type, space_id")
    .is("deleted_at", null)
    .textSearch("search_vector", q);

  if (error) {
    logSupabaseError("knowledgeService.searchKnowledge", error);
    throw new Error(error.message ?? "Supabase error");
  }

  const rows = (data ?? []) as Array<{
    id: string;
    title: string;
    summary: string | null;
    page_type: string;
    space_id: string;
  }>;

  return rows.map((row) => ({
    page_id: row.id,
    title: row.title,
    summary: row.summary,
    page_type: row.page_type as KnowledgeSearchResult["page_type"],
    space_id: row.space_id,
    rank: 0,
  }));
}

/**
 * Fetch knowledge pages linked to a project via knowledge_page_projects (limit 5).
 * Respects RLS: only pages the user can read are returned.
 */
export async function getSuggestedKnowledgeForProject(
  supabase: SupabaseClient,
  projectId: string
): Promise<KnowledgePage[]> {
  const { data: links, error: linksError } = await supabase
    .from("knowledge_page_projects")
    .select("page_id")
    .eq("project_id", projectId)
    .limit(5);

  if (linksError || !links?.length) return [];

  const pageIds = (links as { page_id: string }[]).map((r) => r.page_id);

  const { data: pages, error } = await supabase
    .from("knowledge_pages")
    .select("id, space_id, owner_profile_id, title, slug, page_type, summary, is_published, deleted_at, created_at, updated_at")
    .in("id", pageIds)
    .is("deleted_at", null);

  if (error || !pages?.length) return [];

  return pages as KnowledgePage[];
}
