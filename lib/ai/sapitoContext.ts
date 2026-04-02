/**
 * Sapito Brain v1 — context builder.
 * Decides what structured data to fetch based on scope and builds a compact text summary
 * for injection into the assistant system prompt.
 *
 * Single engine: delegates to GlobalContextResolver or ProjectContextResolver by scope.
 * - Global/notes: only global SAP knowledge + official SAP; no project data.
 * - Project: project memory + project docs + global fallback; never other projects.
 */

import { resolveGlobalContext, resolveProjectContext } from "@/lib/ai/contextResolvers";
import type { SapIntentCategory } from "@/lib/ai/sapitoIntent";

export type SapitoScope = "global" | "project" | "notes";

export type BuildSapitoContextParams = {
  scope: SapitoScope;
  projectId?: string | null;
  userId?: string | null;
  message?: string;
  sapIntent?: SapIntentCategory;
};

export type RetrievalDebug = {
  chunkCount: number;
  documentTitles: string[];
  usedRetrieval: boolean;
  threshold?: string;
  /** When true, answer should start with "Based on previous SAP project experience..." */
  usedProjectMemory?: boolean;
  memoryCount?: number;
};

/**
 * Phase 5: Retrieval observability trace (safe, lightweight).
 * Should be returned only in development/debug contexts.
 */
export type RetrievalTrace = {
  mode: "global" | "project" | "notes";
  detectedIntent?: string | null;
  detectedV2Intent?: string | null;
  sapTaxonomy?: { domains: string[]; themes: string[]; matched: string[] } | null;
  queriedGroups: string[];
  skippedGroups: string[];
  earlyExit?: boolean;
  strongEvidence?: boolean;
  fallbackConsidered?: boolean;
  winningSourceLabels?: string[];
};

/**
 * Builds context string and optional retrieval debug for the model prompt.
 * Delegates to context resolvers by mode; kept for backward compatibility (e.g. direct callers with scope).
 */
export async function buildSapitoContext(
  params: BuildSapitoContextParams
): Promise<{ contextText: string; retrievalDebug?: RetrievalDebug; retrievalTrace?: RetrievalTrace }> {
  const { scope, projectId, userId, message, sapIntent } = params;
  if (scope === "project" && projectId?.trim()) {
    const result = await resolveProjectContext({
      projectId: projectId.trim(),
      userId: userId ?? null,
      message: message ?? "",
      sapIntent,
    });
    return { contextText: result.contextText, retrievalDebug: result.retrievalDebug, retrievalTrace: result.retrievalTrace };
  }
  const notesVariant = scope === "notes";
  const result = await resolveGlobalContext({
    message: message ?? "",
    sapIntent,
    notesVariant,
    userId: userId ?? undefined,
  });
  return { contextText: result.contextText, retrievalDebug: result.retrievalDebug, retrievalTrace: result.retrievalTrace };
}

