/**
 * Shared knowledge ingestion: chunking and embeddings for Sapito.
 * Used by scripts/ingestKnowledge.ts and Google Drive sync.
 */

import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
const CHUNK_MAX_CHARS = 3200;

export type DocChunk = {
  title: string;
  content: string;
  source: string;
  module: string;
};

/**
 * Chunk text by paragraphs, same strategy as scripts/ingestKnowledge.ts.
 */
export function chunkText(
  text: string,
  source: string,
  title: string,
  moduleLabel: string
): DocChunk[] {
  const chunks: DocChunk[] = [];
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return chunks;

  const paragraphs = normalized.split(/\n\s*\n/);
  let current = "";
  let currentLen = 0;

  for (const para of paragraphs) {
    const len = para.length + 2;
    if (currentLen + len > CHUNK_MAX_CHARS && currentLen > 0) {
      chunks.push({
        title: chunks.length === 0 ? title : `${title} (part ${chunks.length + 1})`,
        content: current.trim(),
        source,
        module: moduleLabel,
      });
      current = "";
      currentLen = 0;
    }
    if (para.trim()) {
      current += (current ? "\n\n" : "") + para.trim();
      currentLen = current.length;
    }
  }
  if (current.trim()) {
    chunks.push({
      title: chunks.length === 0 ? title : `${title} (part ${chunks.length + 1})`,
      content: current.trim(),
      source,
      module: moduleLabel,
    });
  }
  return chunks;
}

/**
 * Derive a short module label from a file name (no path).
 */
export function moduleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  const cleaned = base.replace(/[^A-Za-z0-9]/g, " ").trim().slice(0, 80);
  return cleaned || "general";
}

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) throw new Error("Missing OPENAI_API_KEY for knowledge embeddings");
    _openai = new OpenAI({ apiKey: key });
  }
  return _openai;
}

/**
 * Generate embedding for a chunk. Truncates input to 8000 chars.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI();
  const res = await openai.embeddings.create({
    model: OPENAI_EMBEDDING_MODEL,
    input: text.slice(0, 8000),
  });
  const vec = res.data?.[0]?.embedding;
  if (!vec || vec.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Unexpected embedding length: ${vec?.length ?? 0}`);
  }
  return vec;
}

/**
 * Insert chunks into knowledge_documents with embeddings.
 * Returns number of rows inserted.
 */
export async function insertChunksIntoKnowledge(chunks: DocChunk[]): Promise<number> {
  let inserted = 0;
  for (const ch of chunks) {
    const embedding = await getEmbedding(ch.content);
    const { error } = await supabaseAdmin.from("knowledge_documents").insert({
      title: ch.title,
      content: ch.content,
      source: ch.source,
      module: ch.module,
      embedding,
    });
    if (error) throw error;
    inserted++;
  }
  return inserted;
}

/**
 * Delete knowledge_documents rows with the exact source string.
 * Used for duplicate strategy: delete old docs for this source then reinsert.
 */
export async function deleteKnowledgeBySource(source: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("knowledge_documents")
    .select("id")
    .eq("source", source);
  if (error) throw error;
  const ids = (data ?? []).map((r) => (r as { id: string }).id);
  if (ids.length === 0) return 0;
  const { error: delError } = await supabaseAdmin
    .from("knowledge_documents")
    .delete()
    .in("id", ids);
  if (delError) throw delError;
  return ids.length;
}
