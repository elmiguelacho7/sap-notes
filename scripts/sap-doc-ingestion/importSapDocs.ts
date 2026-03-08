/**
 * SAP Documentation Ingestion Pipeline
 *
 * Steps: fetch SAP docs → clean HTML → convert to text/markdown → chunk → embed → insert into knowledge_documents.
 *
 * Usage:
 *   npx tsx scripts/sap-doc-ingestion/importSapDocs.ts
 *   SAP_DOC_SOURCES=/path/to/sources.json (optional; see SapDocSource type)
 *
 * Each inserted record includes: title, module, topic, source, document_type, source_url, content, embedding.
 * project_id is NULL (global SAP knowledge).
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const CHUNK_MAX_CHARS = 2800;

export type SapDocSource = {
  url: string;
  title: string;
  module: string;
  topic: string;
  document_type?: "sap_help" | "sap_official";
};

export type SapDocChunk = {
  title: string;
  content: string;
  source: string;
  module: string;
  topic: string;
  document_type: string;
  source_url: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!openaiKey) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: openaiKey });

/** Strip HTML tags and normalize whitespace. */
function cleanHtml(html: string): string {
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

/** Fetch URL and return text; on failure returns null. */
async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Sapito-SAP-Doc-Ingestion/1.0" } });
    if (!res.ok) return null;
    const html = await res.text();
    return cleanHtml(html);
  } catch {
    return null;
  }
}

function chunkDocument(
  text: string,
  meta: { title: string; source: string; module: string; topic: string; document_type: string; source_url: string }
): SapDocChunk[] {
  const chunks: SapDocChunk[] = [];
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return chunks;

  const paragraphs = normalized.split(/\n\s*\n/);
  let current = "";
  let currentLen = 0;

  for (const para of paragraphs) {
    const len = para.length + 2;
    if (currentLen + len > CHUNK_MAX_CHARS && currentLen > 0) {
      chunks.push({
        title: chunks.length === 0 ? meta.title : `${meta.title} (part ${chunks.length + 1})`,
        content: current.trim(),
        source: meta.source,
        module: meta.module,
        topic: meta.topic,
        document_type: meta.document_type,
        source_url: meta.source_url,
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
      title: chunks.length === 0 ? meta.title : `${meta.title} (part ${chunks.length + 1})`,
      content: current.trim(),
      source: meta.source,
      module: meta.module,
      topic: meta.topic,
      document_type: meta.document_type,
      source_url: meta.source_url,
    });
  }
  return chunks;
}

async function getEmbedding(text: string): Promise<number[]> {
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

async function main() {
  const sourcesPath = process.env.SAP_DOC_SOURCES || path.join(__dirname, "sources.json");
  let sources: SapDocSource[] = [];

  if (fs.existsSync(sourcesPath)) {
    const raw = fs.readFileSync(sourcesPath, "utf-8");
    sources = JSON.parse(raw) as SapDocSource[];
  }

  if (sources.length === 0) {
    console.log("No SAP_DOC_SOURCES found. Add a sources.json with [{ url, title, module, topic, document_type? }]");
    console.log("Example: { \"url\": \"https://help.sap.com/...\", \"title\": \"Sales Organization\", \"module\": \"SD\", \"topic\": \"enterprise_structure\", \"document_type\": \"sap_help\" }");
    return;
  }

  const allChunks: SapDocChunk[] = [];

  for (const src of sources) {
    console.log(`Fetching ${src.title} (${src.url})...`);
    const text = await fetchPage(src.url);
    if (!text || text.length < 100) {
      console.warn(`  Skipped (no or too little content): ${src.title}`);
      continue;
    }
    const meta = {
      title: src.title,
      source: src.document_type === "sap_help" ? "SAP Help" : src.document_type === "sap_official" ? "SAP Official" : "SAP Documentation",
      module: src.module,
      topic: src.topic,
      document_type: src.document_type ?? "sap_help",
      source_url: src.url,
    };
    const chunks = chunkDocument(text, meta);
    allChunks.push(...chunks);
    console.log(`  Chunked into ${chunks.length} chunks.`);
  }

  if (allChunks.length === 0) {
    console.log("No chunks to insert.");
    return;
  }

  console.log(`Total ${allChunks.length} chunks. Generating embeddings and inserting...`);

  let inserted = 0;
  for (const ch of allChunks) {
    try {
      const embedding = await getEmbedding(ch.content);
      const { error } = await supabase.from("knowledge_documents").insert({
        title: ch.title,
        content: ch.content,
        source: ch.source,
        source_name: ch.source,
        module: ch.module,
        topic: ch.topic,
        document_type: ch.document_type,
        source_url: ch.source_url,
        project_id: null,
        scope_type: "global",
        embedding,
      });
      if (error) throw error;
      inserted++;
      if (inserted % 5 === 0) console.log(`  Inserted ${inserted}/${allChunks.length}`);
    } catch (err) {
      console.error(`Failed to insert chunk "${ch.title.slice(0, 40)}..."`, err);
    }
  }

  console.log(`Done. Inserted ${inserted} chunks into knowledge_documents (global SAP knowledge).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
