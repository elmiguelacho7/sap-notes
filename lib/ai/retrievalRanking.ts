/**
 * Phase 3: Retrieval refinement utilities.
 * Metadata-aware ranking + explicit semantic grouping helpers.
 *
 * These helpers are pure and safe: they never fetch data, only rank/label retrieved chunks.
 */
import type { KnowledgeChunk } from "@/lib/ai/knowledgeSearch";
import { getConnectedDocumentMetadata } from "@/lib/ai/connectedSourceMetadata";
import { detectSapTaxonomy } from "@/lib/ai/sapTaxonomy";
import { classifySource, governanceWeight } from "@/lib/ai/sourceGovernance";

export type SourceSemanticGroup =
  | "project_memory"
  | "project_documents"
  | "connected_documents_project"
  | "connected_documents_global"
  | "global_knowledge"
  | "sap_general_knowledge"
  | "external_sap_fallback";

export type RankChunkOptions = {
  mode: "global" | "project";
  v2Intent?: string | null;
  query: string;
  projectId?: string | null;
};

function norm(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function extractSapComponentSignals(q: string): string[] {
  const m = norm(q);
  const out = new Set<string>();
  // Common SAP module short codes (not exhaustive).
  const matches = m.match(/\b(sd|mm|fi|co|pp|qm|pm|ps|ewm|wm|bw|crm)\b/g);
  matches?.forEach((x) => out.add(x.toUpperCase()));
  // Component-like patterns: SD-BF, MM-IM, etc.
  const compMatches = q.match(/\b[A-Z]{2,3}-[A-Z]{2,3}\b/g);
  compMatches?.slice(0, 6).forEach((x) => out.add(x.toUpperCase()));
  return Array.from(out);
}

function queryTokens(q: string): Set<string> {
  const t = norm(q).replace(/[^a-z0-9]+/g, " ");
  return new Set(t.split(" ").filter((x) => x.length >= 3).slice(0, 24));
}

function isConnectedChunk(ch: KnowledgeChunk): boolean {
  return (ch.external_ref ?? "").trim() !== "" || (ch.source_type ?? "").toLowerCase().includes("drive");
}

export function semanticGroupForChunk(ch: KnowledgeChunk, mode: "global" | "project"): SourceSemanticGroup {
  // External fallback is injected separately (not a KnowledgeChunk), so never returned here.
  if (isConnectedChunk(ch)) {
    const scope = ch.scope_type ?? null;
    if (scope === "project" || (mode === "project" && scope !== "global")) return "connected_documents_project";
    return "connected_documents_global";
  }
  if (mode === "project" && (ch.scope_type === "project" || ch.scope_type === "user")) return "project_documents";
  return "global_knowledge";
}

function scoreChunk(ch: KnowledgeChunk, opts: RankChunkOptions): number {
  const qTokens = queryTokens(opts.query);
  const sapSignals = extractSapComponentSignals(opts.query);
  const taxonomy = detectSapTaxonomy(opts.query);
  const meta = getConnectedDocumentMetadata(ch, { projectId: opts.projectId ?? null });
  const sourceClass = classifySource(ch, opts.mode);

  let score = 0;

  // Base preference by scope (confidence-aware ordering starts here).
  if (opts.mode === "project") {
    if (ch.scope_type === "project") score += 30;
    else if (ch.scope_type === "user") score += 20;
    else if (ch.scope_type === "global") score += 10;
  } else {
    // global mode: only global should be present; still weight explicit global higher.
    if (ch.scope_type === "global") score += 20;
  }

  // Phase 5 governance weight: prefer higher quality sources for broad SAP queries.
  score += governanceWeight(sourceClass);

  // Connected-source questions: prioritize connected docs, especially with richer metadata.
  const wantsConnected = opts.v2Intent === "needs_connected_sources" || opts.v2Intent === "project_documentation_lookup";
  if (wantsConnected) {
    if (isConnectedChunk(ch)) score += 35;
    if (meta.provider !== "unknown") score += 5;
    if ((ch.mime_type ?? "").trim()) score += 2;
    if ((ch.document_type ?? "").trim()) score += 2;
    if ((ch.source_url ?? "").trim()) score += 1;
  }

  // SAP troubleshooting: prefer topic/component alignment.
  const isTroubleshooting = opts.v2Intent === "sap_error_troubleshooting";
  if (isTroubleshooting) {
    if (sapSignals.length > 0) {
      const comp = (ch.sap_component ?? "").toUpperCase();
      if (comp && sapSignals.some((s) => comp.includes(s))) score += 18;
      const mod = (ch.module ?? "").toUpperCase();
      if (mod && sapSignals.some((s) => mod.includes(s))) score += 10;
    }
    // Error-like terms inside chunk title can be helpful.
    const title = norm(ch.title ?? "");
    if (title.includes("error") || title.includes("dump") || title.includes("st22")) score += 6;
  }

  // Generic relevance boost using lightweight token overlap on metadata keywords + title/source_name.
  const hay = [meta.keywords.join(" "), ch.title ?? "", ch.source_name ?? "", ch.topic ?? "", ch.sap_component ?? ""]
    .join(" ")
    .toLowerCase();
  qTokens.forEach((tok) => {
    if (hay.includes(tok)) score += 2;
  });

  // Phase 5 taxonomy boosts: if query indicates domain/theme, prefer chunks that align.
  if (taxonomy.domains.length > 0) {
    const mod = (ch.module ?? "").toLowerCase();
    taxonomy.domains.forEach((d) => {
      if (mod.includes(d)) score += 4;
    });
  }
  if (taxonomy.themes.length > 0) {
    const topic = (ch.topic ?? "").toLowerCase();
    taxonomy.themes.forEach((t) => {
      if (topic.includes(t.replace(/_/g, " "))) score += 5;
    });
  }

  // Prefer earlier chunks slightly (chunk_index: 0 often has overview/title section).
  if (typeof ch.chunk_index === "number" && ch.chunk_index === 0) score += 2;

  return score;
}

/**
 * Sort chunks by metadata-aware score (descending).
 * Stable tie-break: keep original order.
 */
export function rankKnowledgeChunks(chunks: KnowledgeChunk[], opts: RankChunkOptions): KnowledgeChunk[] {
  const scored = chunks.map((c, idx) => ({ c, idx, s: scoreChunk(c, opts) }));
  scored.sort((a, b) => (b.s - a.s) || (a.idx - b.idx));
  return scored.map((x) => x.c);
}

