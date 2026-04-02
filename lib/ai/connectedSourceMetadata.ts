/**
 * Phase 2: Connected-source metadata enrichment.
 * Converts knowledge_documents chunk fields into a stable, extensible metadata shape.
 *
 * No DB changes required: fields are optional and derived when present.
 */
import type { KnowledgeChunk } from "@/lib/ai/knowledgeSearch";

export type ConnectedSourceProvider =
  | "google_drive"
  | "notion"
  | "confluence"
  | "sharepoint"
  | "web"
  | "unknown";

export type ConnectedSourceScope = "global" | "project" | "user" | "unknown";

export type ConnectedDocumentMetadata = {
  provider: ConnectedSourceProvider;
  connector_name: string;
  scope: ConnectedSourceScope;
  /** Project id when known by caller context (not always present in chunks). */
  project_id?: string | null;
  source_type?: string | null;
  document_type?: string | null;
  mime_type?: string | null;
  title?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  external_ref?: string | null;
  source_ref?: string | null;
  topic?: string | null;
  sap_component?: string | null;
  keywords: string[];
};

function normalizeToken(s: string): string {
  return s
    .toLowerCase()
    // Avoid unicode property escapes to keep older TS targets happy.
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function providerFromSourceType(sourceType: string | null | undefined): ConnectedSourceProvider {
  const s = (sourceType ?? "").toLowerCase().trim();
  if (!s) return "unknown";
  if (s.includes("google") || s.includes("drive")) return "google_drive";
  if (s.includes("notion")) return "notion";
  if (s.includes("confluence")) return "confluence";
  if (s.includes("sharepoint")) return "sharepoint";
  if (s.includes("web") || s.includes("url")) return "web";
  return "unknown";
}

function connectorNameFor(provider: ConnectedSourceProvider): string {
  if (provider === "google_drive") return "Google Drive";
  if (provider === "notion") return "Notion";
  if (provider === "confluence") return "Confluence";
  if (provider === "sharepoint") return "SharePoint";
  if (provider === "web") return "Web";
  return "Connected documents";
}

function scopeFromChunk(chunk: KnowledgeChunk): ConnectedSourceScope {
  if (chunk.scope_type === "global") return "global";
  if (chunk.scope_type === "project") return "project";
  if (chunk.scope_type === "user") return "user";
  return "unknown";
}

function extractKeywords(chunk: KnowledgeChunk): string[] {
  const out = new Set<string>();
  const candidates: Array<string | null | undefined> = [
    chunk.module,
    chunk.topic,
    chunk.sap_component,
    chunk.document_type,
    chunk.source_type,
    chunk.source_name,
    chunk.title,
  ];
  for (const c of candidates) {
    if (!c) continue;
    const norm = normalizeToken(c);
    if (!norm) continue;
    // Keep up to 3 tokens per candidate to stay lightweight.
    norm.split(/\s+/g).slice(0, 3).forEach((t) => {
      if (t.length >= 3) out.add(t);
    });
  }
  // SAP T-codes are high-signal.
  const tcodeMatches = (chunk.content ?? "").match(/\b[A-Z]{1,2}\d{2,3}N?\b/g);
  if (tcodeMatches) {
    tcodeMatches.slice(0, 6).forEach((t) => out.add(t.toLowerCase()));
  }
  return Array.from(out).slice(0, 12);
}

/**
 * Enrich a chunk into connected-document metadata.
 * This is intentionally tolerant: works even when only external_ref is present.
 */
export function getConnectedDocumentMetadata(
  chunk: KnowledgeChunk,
  opts?: { projectId?: string | null }
): ConnectedDocumentMetadata {
  const provider = providerFromSourceType(chunk.source_type ?? null);
  const connector_name = connectorNameFor(provider);
  const scope = scopeFromChunk(chunk);
  const external_ref = (chunk.external_ref ?? "").trim() || null;
  const source_ref = (chunk.source ?? "").trim() || null;
  return {
    provider,
    connector_name,
    scope,
    project_id: opts?.projectId ?? null,
    source_type: chunk.source_type ?? null,
    document_type: chunk.document_type ?? null,
    mime_type: chunk.mime_type ?? null,
    title: chunk.title ?? null,
    source_name: chunk.source_name ?? null,
    source_url: chunk.source_url ?? null,
    external_ref,
    source_ref,
    topic: chunk.topic ?? null,
    sap_component: chunk.sap_component ?? null,
    keywords: extractKeywords(chunk),
  };
}

