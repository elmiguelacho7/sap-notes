/**
 * Curated SAP documentation ingestion — single-URL only, no crawling.
 * Used by admin sync (sap_help / official_web sources) and optionally by scripts.
 * Fetches one page → cleans HTML → chunks → embeds → stores in knowledge_documents
 * with scope_type = global, document_type = sap_help | sap_official.
 */

import * as crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getEmbedding } from "./ingestHelpers";

const CHUNK_MAX_CHARS = 2800;

export type CuratedSapChunk = {
  title: string;
  content: string;
  source: string;
  source_name: string;
  module: string;
  topic: string;
  document_type: string;
  source_url: string;
  chunk_index: number;
};

/** Strip scripts, styles, tags; normalize whitespace and entities. */
export function cleanHtmlForSap(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

/** Fetch URL and return raw HTML; returns null on failure. */
export async function fetchUrlAsText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Sapito-SAP-Doc-Ingestion/1.0" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Chunk plain text for SAP doc; preserves title/source/module/topic/document_type/source_url. */
export function chunkTextForSapDoc(
  text: string,
  meta: {
    title: string;
    source: string;
    source_name: string;
    module: string;
    topic: string;
    document_type: string;
    source_url: string;
  }
): CuratedSapChunk[] {
  const chunks: CuratedSapChunk[] = [];
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return chunks;

  const paragraphs = normalized.split(/\n\s*\n/);
  let current = "";
  let currentLen = 0;
  let index = 0;

  for (const para of paragraphs) {
    const len = para.length + 2;
    if (currentLen + len > CHUNK_MAX_CHARS && currentLen > 0) {
      chunks.push({
        title: index === 0 ? meta.title : `${meta.title} (part ${index + 1})`,
        content: current.trim(),
        source: meta.source,
        source_name: meta.source_name,
        module: meta.module,
        topic: meta.topic,
        document_type: meta.document_type,
        source_url: meta.source_url,
        chunk_index: index,
      });
      current = "";
      currentLen = 0;
      index++;
    }
    if (para.trim()) {
      current += (current ? "\n\n" : "") + para.trim();
      currentLen = current.length;
    }
  }
  if (current.trim()) {
    chunks.push({
      title: index === 0 ? meta.title : `${meta.title} (part ${index + 1})`,
      content: current.trim(),
      source: meta.source,
      source_name: meta.source_name,
      module: meta.module,
      topic: meta.topic,
      document_type: meta.document_type,
      source_url: meta.source_url,
      chunk_index: index,
    });
  }
  return chunks;
}

/** Stable source identifier for a URL (one page = one source; replace on re-sync). */
export function sourceIdForCuratedUrl(documentType: string, url: string): string {
  const hash = crypto.createHash("sha256").update(url).digest("hex").slice(0, 16);
  return `${documentType}:${hash}`;
}

export type IngestCuratedSapPageParams = {
  url: string;
  title: string;
  module: string;
  topic: string;
  document_type: "sap_help" | "sap_official";
  source_name: string;
};

/**
 * Fetch one curated SAP page, clean, chunk, embed, and insert into knowledge_documents.
 * Deletes existing chunks for this source (same url) before insert. Only processes this single URL.
 * Returns number of chunks inserted; throws on critical failure.
 */
export async function ingestCuratedSapPage(
  params: IngestCuratedSapPageParams
): Promise<{ chunksInserted: number }> {
  const { url, title, module: moduleLabel, topic, document_type, source_name } = params;
  const source = sourceIdForCuratedUrl(document_type, url);

  const html = await fetchUrlAsText(url);
  if (!html || html.length < 100) {
    throw new Error(`No or insufficient content from URL (${url.slice(0, 60)}...)`);
  }

  const text = cleanHtmlForSap(html);
  if (!text || text.length < 100) {
    throw new Error("Content too short after cleaning");
  }

  const chunks = chunkTextForSapDoc(text, {
    title,
    source,
    source_name,
    module: moduleLabel,
    topic,
    document_type,
    source_url: url,
  });

  if (chunks.length === 0) {
    return { chunksInserted: 0 };
  }

  const { data: existing } = await supabaseAdmin
    .from("knowledge_documents")
    .select("id")
    .eq("source", source);
  const ids = (existing ?? []).map((r) => (r as { id: string }).id);
  if (ids.length > 0) {
    const { error: delErr } = await supabaseAdmin
      .from("knowledge_documents")
      .delete()
      .in("id", ids);
    if (delErr) throw new Error(`Failed to delete existing chunks: ${delErr.message}`);
  }

  let chunksInserted = 0;
  for (const ch of chunks) {
    const embedding = await getEmbedding(ch.content);
    const { error } = await supabaseAdmin.from("knowledge_documents").insert({
      title: ch.title,
      content: ch.content,
      source: ch.source,
      source_name: ch.source_name,
      module: ch.module,
      topic: ch.topic,
      document_type: ch.document_type,
      source_url: ch.source_url,
      chunk_index: ch.chunk_index,
      project_id: null,
      scope_type: "global",
      embedding,
    });
    if (error) throw new Error(`Insert chunk failed: ${error.message}`);
    chunksInserted++;
  }

  return { chunksInserted };
}
