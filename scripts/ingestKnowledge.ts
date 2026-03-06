/**
 * Ingest technical documents into knowledge_documents for Sapito semantic search.
 *
 * Usage:
 *   DOCUMENTS_DIR=./scripts/documents npx tsx scripts/ingestKnowledge.ts
 *   (or set DOCUMENTS_DIR in .env.local and run from project root)
 *
 * Expects DOCUMENTS_DIR to contain .txt or .md files. Each file becomes one or more
 * chunks (by content length). Chunk size target: ~500–800 tokens (~2000–3200 chars).
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const CHUNK_TARGET_CHARS = 2400;
const CHUNK_MAX_CHARS = 3200;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
const documentsDir =
  process.env.DOCUMENTS_DIR || path.join(process.cwd(), "scripts", "documents");

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

type DocChunk = {
  title: string;
  content: string;
  source: string;
  module: string;
};

function extractModuleFromPath(filePath: string): string {
  const name = path.basename(filePath, path.extname(filePath));
  const upper = name.replace(/[^A-Za-z0-9]/g, " ").trim();
  return upper.slice(0, 80) || "general";
}

function chunkText(text: string, source: string, title: string, moduleLabel: string): DocChunk[] {
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
  if (!fs.existsSync(documentsDir)) {
    fs.mkdirSync(documentsDir, { recursive: true });
    console.log(`Created ${documentsDir}. Add .txt or .md files and run again.`);
    return;
  }

  const files = fs.readdirSync(documentsDir).filter((f) => /\.(txt|md)$/i.test(f));
  if (files.length === 0) {
    console.log(`No .txt or .md files in ${documentsDir}.`);
    return;
  }

  const allChunks: DocChunk[] = [];
  for (const file of files) {
    const filePath = path.join(documentsDir, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const title = path.basename(file, path.extname(file));
    const source = file;
    const moduleLabel = extractModuleFromPath(filePath);
    const chunks = chunkText(raw, source, title, moduleLabel);
    allChunks.push(...chunks);
  }

  console.log(`Found ${files.length} files, ${allChunks.length} chunks. Generating embeddings...`);

  let inserted = 0;
  for (const ch of allChunks) {
    try {
      const embedding = await getEmbedding(ch.content);
      const { error } = await supabase.from("knowledge_documents").insert({
        title: ch.title,
        content: ch.content,
        source: ch.source,
        module: ch.module,
        embedding,
      });
      if (error) throw error;
      inserted++;
      if (inserted % 5 === 0) console.log(`  Inserted ${inserted}/${allChunks.length}`);
    } catch (err) {
      console.error(`Failed to ingest chunk "${ch.title.slice(0, 40)}..."`, err);
    }
  }

  console.log(`Done. Inserted ${inserted} chunks into knowledge_documents.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
