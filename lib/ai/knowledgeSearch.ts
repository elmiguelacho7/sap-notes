/**
 * Semantic search over knowledge_documents (pgvector) for Sapito.
 * Generates query embedding via OpenAI and runs similarity search in Supabase.
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
};

/**
 * Run semantic search over knowledge_documents. Returns top 5 (or topK) chunks by cosine similarity.
 * On failure returns empty array and logs; does not throw to keep Sapito stable.
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
