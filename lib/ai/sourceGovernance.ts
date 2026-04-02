/**
 * Phase 5: Source governance model (lightweight).
 * Classifies retrieved content into source classes and provides ranking weights.
 */
import type { KnowledgeChunk } from "@/lib/ai/knowledgeSearch";

export type SourceClass =
  | "official_sap"
  | "curated_internal"
  | "connected_project"
  | "connected_global"
  | "project_memory"
  | "project_notes"
  | "reusable_platform_knowledge"
  | "external_supporting"
  | "unknown";

function isConnected(ch: KnowledgeChunk): boolean {
  return (ch.external_ref ?? "").trim() !== "" || (ch.source_type ?? "").toLowerCase().includes("drive");
}

export function classifySource(ch: KnowledgeChunk, mode: "global" | "project"): SourceClass {
  const docType = (ch.document_type ?? "").toLowerCase().trim();
  const sourceType = (ch.source_type ?? "").toLowerCase().trim();
  const scope = ch.scope_type ?? null;

  // Official SAP content is explicitly tagged by ingest.
  if (docType === "sap_help" || docType === "sap_official" || sourceType === "sap_help" || sourceType === "official_web") {
    return "official_sap";
  }

  // Connected docs (Drive/etc).
  if (isConnected(ch)) {
    if (scope === "project" || (mode === "project" && scope !== "global")) return "connected_project";
    return "connected_global";
  }

  // Platform/global reusable knowledge (admin-curated).
  if (scope === "global") {
    if (docType === "curated" || docType === "platform" || sourceType.includes("curated")) return "curated_internal";
    return "reusable_platform_knowledge";
  }

  // Project/user scoped docs (non-connected) are still project evidence.
  if (scope === "project" || scope === "user") {
    return "curated_internal";
  }

  return "unknown";
}

export function governanceWeight(cls: SourceClass): number {
  switch (cls) {
    case "official_sap":
      return 18;
    case "connected_project":
      return 14;
    case "connected_global":
      return 10;
    case "curated_internal":
      return 9;
    case "reusable_platform_knowledge":
      return 6;
    case "project_notes":
      return 6;
    case "project_memory":
      return 16;
    case "external_supporting":
      return 3;
    default:
      return 0;
  }
}

