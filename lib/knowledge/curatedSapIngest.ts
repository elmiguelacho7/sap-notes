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
const MIN_CONTENT_LENGTH = 100;

/** Domain-based URL classification for curated SAP sources. */
export type CuratedUrlDomainType = "sap_help" | "sap_community" | "other";

/**
 * Derive domain type from URL. Does not fetch; classification only.
 * - help.sap.com => sap_help
 * - community.sap.com => sap_community
 * - other => other (treated as official_web for ingestion)
 */
export function getDomainTypeFromUrl(url: string): CuratedUrlDomainType | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.toLowerCase();
    if (host === "help.sap.com" || host.endsWith(".help.sap.com")) return "sap_help";
    if (host === "community.sap.com" || host.endsWith(".community.sap.com")) return "sap_community";
    return "other";
  } catch {
    return null;
  }
}

/**
 * Suggested source_type for a URL based on domain.
 * sap_community and other both map to official_web (curated public pages).
 */
export function getSuggestedSourceTypeFromUrl(url: string): "sap_help" | "official_web" | null {
  const domainType = getDomainTypeFromUrl(url);
  if (domainType === "sap_help") return "sap_help";
  if (domainType === "sap_community" || domainType === "other") return "official_web";
  return null;
}

export type UrlValidationResult = {
  ok: boolean;
  error?: string;
  warning?: string;
  domainType: CuratedUrlDomainType | null;
};

/**
 * Validate that the source type matches the URL domain.
 * - sap_help: only help.sap.com URLs.
 * - community.sap.com must NOT be used as sap_help (JS-protected / anti-bot).
 * - official_web / sap_official: any domain (community, other).
 */
export function validateUrlForSourceType(
  url: string,
  sourceType: string
): UrlValidationResult {
  const domainType = getDomainTypeFromUrl(url);
  if (domainType == null) {
    return { ok: false, error: "URL no válida.", domainType: null };
  }

  const trimmed = url.trim();
  if (!trimmed || !trimmed.startsWith("http")) {
    return { ok: false, error: "La URL debe ser http o https.", domainType };
  }

  if (sourceType === "sap_help") {
    if (domainType !== "sap_help") {
      if (domainType === "sap_community") {
        return {
          ok: false,
          error:
            "SAP Community (community.sap.com) no debe usarse como SAP Help Portal. Esas páginas suelen requerir JavaScript. Usa tipo «Official SAP web» para páginas de Community.",
          domainType,
        };
      }
      return {
        ok: false,
        error: "SAP Help Portal solo admite URLs de help.sap.com. Para otros dominios usa «Official SAP web».",
        domainType,
      };
    }
    return { ok: true, domainType };
  }

  if (sourceType === "official_web" || sourceType === "sap_official") {
    return { ok: true, domainType };
  }

  return { ok: true, domainType };
}

/** Patterns that indicate the page requires JavaScript or bot verification; ingestion cannot proceed. */
const ANTIBOT_JS_PATTERNS = [
  /javascript\s+is\s+disabled/i,
  /please\s+enable\s+javascript/i,
  /enable\s+javascript\s+to\s+run/i,
  /verify\s+(that\s+)?you('re| are)\s+not\s+a\s+robot/i,
  /recaptcha|reCAPTCHA/i,
  /captcha/i,
  /enable\s+js\s+and\s+reload/i,
  /you\s+need\s+to\s+enable\s+javascript/i,
  /javascript\s+required/i,
  /turn\s+on\s+javascript/i,
];

const ANTIBOT_JS_MESSAGE =
  "The source page requires JavaScript or bot verification and cannot be indexed by the current ingestion pipeline.";

/**
 * Detect anti-bot or JavaScript-required responses. Checks raw HTML and cleaned text.
 * Returns an error message if detected; otherwise null.
 */
export function detectAntibotOrJsRequired(html: string, cleanedText: string): string | null {
  const combined = `${html}\n${cleanedText}`;
  for (const pattern of ANTIBOT_JS_PATTERNS) {
    if (pattern.test(combined)) {
      return ANTIBOT_JS_MESSAGE;
    }
  }
  if (cleanedText.trim().length < MIN_CONTENT_LENGTH) {
    return ANTIBOT_JS_MESSAGE;
  }
  return null;
}

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

/** Fetch URL and return raw HTML with metadata for logging. */
export async function fetchUrlAsText(
  url: string
): Promise<{ html: string | null; status?: number; contentType?: string }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Sapito-SAP-Doc-Ingestion/1.0" },
    });
    const contentType = res.headers.get("content-type") ?? undefined;
    if (!res.ok) {
      if (process.env.NODE_ENV === "development") {
        console.log("[curated SAP ingest] fetch failed", { url: url.slice(0, 80), status: res.status, contentType });
      }
      return { html: null, status: res.status, contentType };
    }
    const html = await res.text();
    return { html, status: res.status, contentType };
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[curated SAP ingest] fetch error", url.slice(0, 80), err);
    }
    return { html: null };
  }
}

/**
 * Try to extract main content from SAP Help / doc-style HTML to reduce nav/footer noise.
 * Tries in order: main, article, #content, .topic-content, .content, role=main, then full HTML.
 * Server-side only; no browser automation.
 */
function extractMainContentFromSapHelp(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return html;

  // Try <main>...</main>
  const mainMatch = trimmed.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch && mainMatch[1].trim().length > 200) return mainMatch[1].trim();

  // Try <article>...</article>
  const articleMatch = trimmed.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch && articleMatch[1].trim().length > 200) return articleMatch[1].trim();

  // Try id="content" or id='content'
  const idContentMatch = trimmed.match(/<[a-z][a-z0-9]*\b[^>]*\bid=["']content["'][^>]*>([\s\S]*?)<\/[a-z][a-z0-9]*>/i);
  if (idContentMatch && idContentMatch[1].trim().length > 200) return idContentMatch[1].trim();

  // Try class containing "topic-content" (common on SAP Help)
  const topicContentMatch = trimmed.match(/<[a-z][a-z0-9]*\b[^>]*\bclass=["'][^"']*topic-content[^"']*["'][^>]*>([\s\S]*?)<\/[a-z][a-z0-9]*>/i);
  if (topicContentMatch && topicContentMatch[1].trim().length > 200) return topicContentMatch[1].trim();

  // Try class containing "content" (e.g. sap-help-content, main-content)
  const classContentMatch = trimmed.match(/<[a-z][a-z0-9]*\b[^>]*\bclass=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/[a-z][a-z0-9]*>/i);
  if (classContentMatch && classContentMatch[1].trim().length > 200) return classContentMatch[1].trim();

  // Try role="main"
  const roleMainMatch = trimmed.match(/<[a-z][a-z0-9]*\b[^>]*\brole=["']main["'][^>]*>([\s\S]*?)<\/[a-z][a-z0-9]*>/i);
  if (roleMainMatch && roleMainMatch[1].trim().length > 200) return roleMainMatch[1].trim();

  return html;
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

  // Fallback: if no paragraph breaks (e.g. SAP Help single block), split by size
  if (chunks.length === 0 && normalized.length >= MIN_CONTENT_LENGTH) {
    let start = 0;
    let chunkIndex = 0;
    while (start < normalized.length) {
      let end = Math.min(start + CHUNK_MAX_CHARS, normalized.length);
      if (end < normalized.length) {
        const lastSpace = normalized.lastIndexOf(" ", end);
        if (lastSpace > start + CHUNK_MAX_CHARS / 2) end = lastSpace + 1;
      }
      const slice = normalized.slice(start, end).trim();
      if (slice) {
        chunks.push({
          title: chunkIndex === 0 ? meta.title : `${meta.title} (part ${chunkIndex + 1})`,
          content: slice,
          source: meta.source,
          source_name: meta.source_name,
          module: meta.module,
          topic: meta.topic,
          document_type: meta.document_type,
          source_url: meta.source_url,
          chunk_index: chunkIndex,
        });
        chunkIndex++;
      }
      start = end;
    }
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
 * Returns number of chunks inserted; throws on critical failure with precise messages.
 */
export async function ingestCuratedSapPage(
  params: IngestCuratedSapPageParams
): Promise<{ chunksInserted: number }> {
  const { url, title, module: moduleLabel, topic, document_type, source_name } = params;
  const source = sourceIdForCuratedUrl(document_type, url);
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    console.log("[curated SAP ingest] url", url.slice(0, 100));
  }

  const fetchResult = await fetchUrlAsText(url);
  const { html: rawHtml, status: fetchStatus, contentType } = fetchResult;

  if (isDev) {
    console.log("[curated SAP ingest] fetch status", fetchStatus, "content-type", contentType ?? "n/a", "raw html length", rawHtml?.length ?? 0);
  }

  if (!rawHtml || rawHtml.length < 100) {
    if (fetchStatus != null && fetchStatus >= 200 && fetchStatus < 300) {
      throw new Error(
        "Fetched SAP Help page successfully, but no readable content could be extracted from the HTML."
      );
    }
    throw new Error(`No or insufficient content from URL (${url.slice(0, 60)}...). Status: ${fetchStatus ?? "network error"}.`);
  }

  const extractedHtml = extractMainContentFromSapHelp(rawHtml);
  const text = cleanHtmlForSap(extractedHtml);

  if (isDev) {
    console.log("[curated SAP ingest] cleaned text length", text.length, "preview", text.slice(0, 500));
  }

  const antibotError = detectAntibotOrJsRequired(rawHtml, text);
  if (antibotError) {
    throw new Error(antibotError);
  }
  if (!text || text.length < MIN_CONTENT_LENGTH) {
    throw new Error(
      `Extracted text too short (${(text?.length ?? 0)} chars). No readable content could be extracted from the HTML.`
    );
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

  if (isDev) {
    console.log("[curated SAP ingest] chunk count", chunks.length);
  }

  if (chunks.length === 0) {
    throw new Error("0 chunks generated.");
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

  if (isDev) {
    console.log("[curated SAP ingest] embeddings started, chunks to process", chunks.length);
  }

  let chunksInserted = 0;
  for (const ch of chunks) {
    let embedding: number[];
    try {
      embedding = await getEmbedding(ch.content);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Embedding generation failed: ${msg}`);
    }
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
    if (error) {
      throw new Error(`Insert chunk failed: ${error.message}`);
    }
    chunksInserted++;
    if (isDev && chunksInserted === 1) {
      console.log("[curated SAP ingest] DB insert started, first chunk inserted");
    }
  }

  if (isDev) {
    console.log("[curated SAP ingest] final inserted chunk count", chunksInserted);
  }

  return { chunksInserted };
}
