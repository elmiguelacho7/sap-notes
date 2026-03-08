/**
 * Semantic search over knowledge_documents (pgvector) for Sapito.
 * Generates query embedding via OpenAI and runs similarity search in Supabase.
 *
 * Confidentiality by design:
 * - Global knowledge: only chunks with project_id IS NULL (admin-curated, reusable, non-client-specific).
 * - Project knowledge: only chunks for the given project_id. Never cross-project retrieval.
 * - Project agent context = project knowledge first, then global fallback. Other projects' data is never included.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import OpenAI from "openai";

const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const DEFAULT_TOP_K = 5;

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) throw new Error("Missing OPENAI_API_KEY for knowledge search");
  return new OpenAI({ apiKey: key });
}

async function getQueryEmbedding(query: string): Promise<number[]> {
  const openai = getOpenAI();
  const res = await openai.embeddings.create({
    model: OPENAI_EMBEDDING_MODEL,
    input: query.slice(0, 8000),
  });
  const vec = res.data?.[0]?.embedding;
  if (!vec || vec.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Unexpected embedding length: ${vec?.length ?? 0}`);
  }
  return vec;
}

export type KnowledgeChunk = {
  id: string;
  title: string | null;
  content: string;
  source: string | null;
  module: string | null;
  source_name?: string | null;
  external_ref?: string | null;
  scope_type?: "global" | "project" | "user" | null;
};

/** Project memory item (problem/solution from past experience). Ranked first in retrieval. */
export type ProjectMemoryChunk = {
  id: string;
  title: string | null;
  problem: string | null;
  solution: string;
  module: string | null;
  source_type: string | null;
  created_at: string | null;
};

/** Prefer diversity: at most maxPerSource chunks per document (by title), total cap totalMax. */
export function ensureChunkDiversity(
  chunks: KnowledgeChunk[],
  maxPerSource: number = 2,
  totalMax: number = 8
): KnowledgeChunk[] {
  const bySource = new Map<string, KnowledgeChunk[]>();
  for (const c of chunks) {
    const key = (c.title ?? c.source ?? c.id).trim() || c.id;
    const list = bySource.get(key) ?? [];
    list.push(c);
    bySource.set(key, list);
  }
  const out: KnowledgeChunk[] = [];
  const seenIds = new Set<string>();
  for (const [, list] of Array.from(bySource.entries())) {
    for (let i = 0; i < Math.min(maxPerSource, list.length) && out.length < totalMax; i++) {
      const ch = list[i];
      if (!seenIds.has(ch.id)) {
        seenIds.add(ch.id);
        out.push(ch);
      }
    }
  }
  return out;
}

/**
 * Global knowledge context only (project_id IS NULL). For general agent.
 * Never returns project-private data. Global knowledge is admin-curated and reusable.
 */
export async function getGlobalKnowledgeContext(
  query: string,
  topK: number = DEFAULT_TOP_K
): Promise<KnowledgeChunk[]> {
  return searchKnowledge(query, topK);
}

/**
 * Project agent context: project knowledge first, then global fallback.
 * Never retrieves from other projects. Merge and cap to topK.
 * Project knowledge is private to its project; global knowledge is reusable fallback.
 * Confidentiality: only project_id = current project and project_id IS NULL are queried; no other project's chunks are ever included.
 */
export async function getProjectKnowledgeContext(
  projectId: string,
  query: string,
  topK: number = DEFAULT_TOP_K
): Promise<KnowledgeChunk[]> {
  if (!projectId?.trim() || !query?.trim()) return [];
  // Confidentiality: only this project's chunks + global (project_id IS NULL). Never other projects.

  const projectLimit = Math.max(1, Math.ceil(topK * 0.6));
  const globalLimit = Math.max(0, topK - projectLimit);

  const [projectChunks, globalChunks] = await Promise.all([
    searchProjectKnowledge(projectId, query, projectLimit),
    globalLimit > 0 ? getGlobalKnowledgeContext(query, globalLimit) : Promise.resolve([]),
  ]);

  const seen = new Set<string>();
  const merged: KnowledgeChunk[] = [];
  for (const c of projectChunks) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      merged.push(c);
    }
  }
  for (const c of globalChunks) {
    if (!seen.has(c.id) && merged.length < topK) {
      seen.add(c.id);
      merged.push(c);
    }
  }
  return merged;
}

/**
 * Run semantic search over global knowledge_documents only (project_id IS NULL).
 * For project-scoped retrieval use searchProjectKnowledge or getProjectKnowledgeContext.
 */
export async function searchKnowledge(
  query: string,
  topK: number = DEFAULT_TOP_K
): Promise<KnowledgeChunk[]> {
  if (!query?.trim()) return [];

  try {
    const queryEmbedding = await getQueryEmbedding(query.trim());
    const { data, error } = await supabaseAdmin.rpc("search_knowledge_documents", {
      query_embedding: queryEmbedding,
      match_limit: Math.min(Math.max(1, topK), 20),
    });

    if (error) {
      console.error("[knowledgeSearch] RPC error", error.message);
      return [];
    }

    const rows = (data ?? []) as Array<{
      id: string;
      title: string | null;
      content: string;
      source: string | null;
      module: string | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      title: r.title ?? null,
      content: r.content ?? "",
      source: r.source ?? null,
      module: r.module ?? null,
    }));
  } catch (err) {
    console.error("[knowledgeSearch] searchKnowledge error", err);
    return [];
  }
}

/**
 * Project-scoped semantic search. Use for Sapito when answering in project context.
 * Internal project knowledge is primary; external SAP/community sources are a future secondary layer.
 */
export async function searchProjectKnowledge(
  projectId: string,
  query: string,
  topK: number = DEFAULT_TOP_K
): Promise<KnowledgeChunk[]> {
  if (!projectId?.trim() || !query?.trim()) return [];

  try {
    const queryEmbedding = await getQueryEmbedding(query.trim());
    const { data, error } = await supabaseAdmin.rpc("search_project_knowledge_documents", {
      p_project_id: projectId,
      query_embedding: queryEmbedding,
      match_limit: Math.min(Math.max(1, topK), 20),
    });

    if (error) {
      console.error("[knowledgeSearch] searchProjectKnowledge RPC error", error.message);
      return [];
    }

    const rows = (data ?? []) as Array<{
      id: string;
      title: string | null;
      content: string;
      source: string | null;
      module: string | null;
      source_name?: string | null;
      external_ref?: string | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      title: r.title ?? null,
      content: r.content ?? "",
      source: r.source ?? null,
      module: r.module ?? null,
      source_name: r.source_name ?? null,
      external_ref: r.external_ref ?? null,
    }));
  } catch (err) {
    console.error("[knowledgeSearch] searchProjectKnowledge error", err);
    return [];
  }
}

const DEFAULT_MEMORY_TOP_K = 4;

/**
 * Search project_knowledge_memory by project_id and user_id (filtered). Used first in ranking.
 */
export async function searchProjectMemory(
  projectId: string,
  userId: string | null,
  query: string,
  topK: number = DEFAULT_MEMORY_TOP_K
): Promise<ProjectMemoryChunk[]> {
  if (!projectId?.trim() || !query?.trim()) return [];

  try {
    const queryEmbedding = await getQueryEmbedding(query.trim());
    const { data, error } = await supabaseAdmin.rpc("search_project_knowledge_memory", {
      p_project_id: projectId,
      p_user_id: userId ?? null,
      query_embedding: queryEmbedding,
      match_limit: Math.min(Math.max(1, topK), 20),
    });

    if (error) {
      console.error("[knowledgeSearch] searchProjectMemory RPC error", error.message);
      return [];
    }

    const rows = (data ?? []) as Array<{
      id: string;
      title: string | null;
      problem: string | null;
      solution: string;
      module: string | null;
      source_type: string | null;
      created_at: string | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      title: r.title ?? null,
      problem: r.problem ?? null,
      solution: r.solution ?? "",
      module: r.module ?? null,
      source_type: r.source_type ?? null,
      created_at: r.created_at ?? null,
    }));
  } catch (err) {
    console.error("[knowledgeSearch] searchProjectMemory error", err);
    return [];
  }
}

/**
 * Multi-tenant semantic search: strict isolation by scope (global / project / user).
 * - If projectId is set: returns (global) OR (project AND project_id = projectId) OR (user AND user_id = userId), ordered project > user > global.
 * - If projectId is not set: returns only global.
 * Never returns project docs for other projects or user docs for other users.
 */
export type MultiTenantRetrievalResult = {
  chunks: KnowledgeChunk[];
  scopeBreakdown: { project: number; user: number; global: number };
};

export async function searchMultiTenantKnowledge(
  projectId: string | null,
  userId: string | null,
  query: string,
  topK: number = DEFAULT_TOP_K
): Promise<MultiTenantRetrievalResult> {
  const scopeBreakdown = { project: 0, user: 0, global: 0 };
  if (!query?.trim()) return { chunks: [], scopeBreakdown };

  try {
    const queryEmbedding = await getQueryEmbedding(query.trim());
    const { data, error } = await supabaseAdmin.rpc("search_knowledge_documents_multitenant", {
      p_project_id: projectId ?? null,
      p_user_id: userId ?? null,
      query_embedding: queryEmbedding,
      match_limit: Math.min(Math.max(1, topK), 50),
    });

    if (error) {
      console.error("[knowledgeSearch] searchMultiTenantKnowledge RPC error", error.message);
      return { chunks: [], scopeBreakdown };
    }

    const rows = (data ?? []) as Array<{
      id: string;
      title: string | null;
      content: string;
      source: string | null;
      module: string | null;
      source_name?: string | null;
      external_ref?: string | null;
      scope_type?: string | null;
    }>;

    const chunks: KnowledgeChunk[] = rows.map((r) => {
      const scope = (r.scope_type === "project" || r.scope_type === "user" || r.scope_type === "global") ? r.scope_type : null;
      if (scope === "project") scopeBreakdown.project++;
      else if (scope === "user") scopeBreakdown.user++;
      else if (scope === "global") scopeBreakdown.global++;
      return {
        id: r.id,
        title: r.title ?? null,
        content: r.content ?? "",
        source: r.source ?? null,
        module: r.module ?? null,
        source_name: r.source_name ?? null,
        external_ref: r.external_ref ?? null,
        scope_type: scope,
      };
    });

    return { chunks, scopeBreakdown };
  } catch (err) {
    console.error("[knowledgeSearch] searchMultiTenantKnowledge error", err);
    return { chunks: [], scopeBreakdown };
  }
}
