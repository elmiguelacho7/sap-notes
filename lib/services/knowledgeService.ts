import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ==========================
// Types
// ==========================

export type KnowledgeEntry = {
  id: string;
  project_id: string | null;
  user_id: string;
  title: string;
  content: string;
  module: string | null;
  scope_item: string | null;
  topic_type: string;
  source: string;
  source_ref: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateKnowledgeEntryInput = {
  projectId?: string | null;
  userId: string;
  title: string;
  content: string;
  module?: string | null;
  scopeItem?: string | null;
  topicType: string;
  source: string;
  sourceRef?: string | null;
};

export type SearchKnowledgeEntriesParams = {
  projectId?: string | null;
  /** When true and projectId is set, include global entries (project_id IS NULL). Default true. */
  includeGlobal?: boolean;
  module?: string | null;
  scopeItem?: string | null;
  topicType?: string | null;
  /** Free text search in title and content (ilike). */
  query?: string | null;
  limit?: number;
};

const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 50;

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit < 1) return DEFAULT_SEARCH_LIMIT;
  return Math.min(Math.floor(limit), MAX_SEARCH_LIMIT);
}

// ==========================
// Create
// ==========================

export async function createKnowledgeEntry(
  input: CreateKnowledgeEntryInput
): Promise<KnowledgeEntry> {
  const { data, error } = await supabaseAdmin
    .from("knowledge_entries")
    .insert({
      project_id: input.projectId ?? null,
      user_id: input.userId,
      title: input.title.trim(),
      content: input.content.trim(),
      module: input.module ?? null,
      scope_item: input.scopeItem ?? null,
      topic_type: input.topicType.trim(),
      source: input.source.trim(),
      source_ref: input.sourceRef ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(
      `knowledgeService.createKnowledgeEntry failed: ${error.message}`
    );
  }

  return data as KnowledgeEntry;
}

// ==========================
// Search
// ==========================

export async function searchKnowledgeEntries(
  params: SearchKnowledgeEntriesParams
): Promise<KnowledgeEntry[]> {
  const limit = clampLimit(params.limit ?? DEFAULT_SEARCH_LIMIT);
  const includeGlobal = params.includeGlobal !== false;

  let q = supabaseAdmin
    .from("knowledge_entries")
    .select("id, project_id, user_id, title, content, module, scope_item, topic_type, source, source_ref, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  // Project filter: exact project, or project + global when includeGlobal
  if (params.projectId != null && params.projectId.trim() !== "") {
    if (includeGlobal) {
      q = q.or(`project_id.eq.${params.projectId},project_id.is.null`);
    } else {
      q = q.eq("project_id", params.projectId);
    }
  } else {
    // No projectId: only global entries
    q = q.is("project_id", null);
  }

  if (params.module != null && params.module.trim() !== "") {
    q = q.eq("module", params.module.trim());
  }
  if (params.scopeItem != null && params.scopeItem.trim() !== "") {
    q = q.eq("scope_item", params.scopeItem.trim());
  }
  if (params.topicType != null && params.topicType.trim() !== "") {
    q = q.eq("topic_type", params.topicType.trim());
  }

  // Free text search: title or content ilike %query%
  const queryTrim = params.query?.trim();
  if (queryTrim && queryTrim.length > 0) {
    const pattern = `%${queryTrim}%`;
    q = q.or(`title.ilike.${pattern},content.ilike.${pattern}`);
  }

  const { data, error } = await q;

  if (error) {
    throw new Error(
      `knowledgeService.searchKnowledgeEntries failed: ${error.message}`
    );
  }

  return (data ?? []) as KnowledgeEntry[];
}
