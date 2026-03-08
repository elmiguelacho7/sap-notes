/**
 * Sapito Brain v1 — context builder.
 * Decides what structured data to fetch based on scope and builds a compact text summary
 * for injection into the assistant system prompt.
 *
 * Retrieval rules (confidentiality by design):
 * - General agent (scope global): only global knowledge (project_id IS NULL). Admin-curated, non-client-specific.
 * - Project agent (scope project): project knowledge first, then global fallback. Never other projects' data.
 * - Project knowledge is private to its project; global knowledge is reusable and must not contain client-specific data.
 */

import {
  getPlatformStats,
  getProjectOverview,
  getNotesInsights,
  type PlatformStats,
  type ProjectOverview,
  type NotesInsights,
} from "@/lib/ai/sapitoTools";
import {
  getGlobalKnowledgeContext,
  searchProjectKnowledge,
  ensureChunkDiversity,
  type KnowledgeChunk,
} from "@/lib/ai/knowledgeSearch";
import { getOfficialSapKnowledgeContext } from "@/lib/ai/officialSapKnowledge";
import { normalizeQueryForSap } from "@/lib/ai/queryNormalize";
import { shouldIncludeWorkspaceSummary, isSapKnowledgeIntent, type SapIntentCategory } from "@/lib/ai/sapitoIntent";

export type SapitoScope = "global" | "project" | "notes";

export type BuildSapitoContextParams = {
  scope: SapitoScope;
  projectId?: string | null;
  message?: string;
  /** When set: only inject platform/project/notes summary for workspace_summary or project_status. */
  sapIntent?: SapIntentCategory;
};

export type RetrievalDebug = {
  chunkCount: number;
  documentTitles: string[];
  usedRetrieval: boolean;
  threshold?: string;
};

/** Max characters per chunk injected into the prompt so the model can answer from full content. */
const CHUNK_CONTENT_CAP = 1000;
/** Max chunks after diversity (project + global combined). */
const MAX_CHUNKS_AFTER_DIVERSITY = 8;
/** Max chunks when SAP intent: prioritize top relevant chunks. */
const MAX_CHUNKS_SAP = 6;
/** Max chunks per document/source when applying diversity. */
const MAX_PER_SOURCE = 2;

/**
 * Builds context string and optional retrieval debug for the model prompt.
 * Retrieval runs for any non-empty message in project/global scope (no heuristic gate).
 * Order: project-specific knowledge first, then global, then official SAP; diversity applied.
 */
export async function buildSapitoContext(
  params: BuildSapitoContextParams
): Promise<{ contextText: string; retrievalDebug?: RetrievalDebug }> {
  const { scope, projectId, message, sapIntent } = params;
  const sections: string[] = [];
  let retrievalDebug: RetrievalDebug | undefined;
  let runRetrieval = false;

  try {
    // Only inject dashboard-style summary when user explicitly asked for workspace or project status.
    const includeSummary = shouldIncludeWorkspaceSummary(sapIntent);
    if (includeSummary) {
      if (scope === "global") {
        const stats = await getPlatformStats();
        sections.push(formatPlatformSummary(stats));
      } else if (scope === "project" && projectId?.trim()) {
        const overview = await getProjectOverview(projectId.trim());
        sections.push(formatProjectSummary(overview));
      } else if (scope === "notes") {
        const insights = await getNotesInsights(10);
        sections.push(formatNotesSummary(insights));
      }

      if (sections.length === 0 && scope === "global") {
        const stats = await getPlatformStats();
        sections.push(formatPlatformSummary(stats));
      }
    }

    // Knowledge retrieval: run for project/global always when hasQuery; for notes run when SAP intent.
    const searchQuery = normalizeQueryForSap(message) || (message ?? "").trim();
    const hasQuery = searchQuery.length > 0;
    runRetrieval =
      hasQuery &&
      (scope === "project" || scope === "global" || (scope === "notes" && isSapKnowledgeIntent(sapIntent)));

    if (runRetrieval) {
      try {
        const isSapIntent = isSapKnowledgeIntent(sapIntent);
        const maxChunks = isSapIntent ? MAX_CHUNKS_SAP : MAX_CHUNKS_AFTER_DIVERSITY;
        if (scope === "project" && projectId?.trim()) {
          const [projectChunks, globalChunks, officialChunks] = await Promise.all([
            searchProjectKnowledge(projectId.trim(), searchQuery, isSapIntent ? 6 : 10),
            getGlobalKnowledgeContext(searchQuery, isSapIntent ? 6 : 6),
            getOfficialSapKnowledgeContext(searchQuery, 2),
          ]);
          const merged: KnowledgeChunk[] = [...projectChunks];
          const seenIds = new Set(projectChunks.map((c) => c.id));
          for (const c of globalChunks) {
            if (!seenIds.has(c.id)) {
              seenIds.add(c.id);
              merged.push(c);
            }
          }
          const diverse = ensureChunkDiversity(
            merged,
            MAX_PER_SOURCE,
            maxChunks
          );
          if (diverse.length > 0) {
            sections.push(formatKnowledgeContext(diverse, true));
            retrievalDebug = {
              chunkCount: diverse.length,
              documentTitles: Array.from(new Set(diverse.map((c) => c.title || "(sin título)"))),
              usedRetrieval: true,
            };
            if (process.env.NODE_ENV === "development") {
              console.log("[Sapito retrieval]", {
                documentsMatched: retrievalDebug.documentTitles.length,
                chunkCount: retrievalDebug.chunkCount,
                documentTitles: retrievalDebug.documentTitles.slice(0, 6),
                sapIntent: isSapIntent,
              });
            }
          }
          if (officialChunks.length > 0) {
            sections.push(formatKnowledgeContext(officialChunks, false));
            if (!retrievalDebug) {
              retrievalDebug = {
                chunkCount: officialChunks.length,
                documentTitles: officialChunks.map((c) => c.title || "(sin título)"),
                usedRetrieval: true,
              };
            } else {
              retrievalDebug.documentTitles = Array.from(
                new Set([...retrievalDebug.documentTitles, ...officialChunks.map((c) => c.title || "(sin título)")])
              );
            }
          }
        } else if (scope === "global" || scope === "notes") {
          const [globalChunks, officialChunks] = await Promise.all([
            getGlobalKnowledgeContext(searchQuery, isSapIntent ? 6 : 10),
            getOfficialSapKnowledgeContext(searchQuery, 2),
          ]);
          const diverse = ensureChunkDiversity(
            globalChunks,
            MAX_PER_SOURCE,
            maxChunks
          );
          if (diverse.length > 0) {
            sections.push(formatKnowledgeContext(diverse, false));
            retrievalDebug = {
              chunkCount: diverse.length,
              documentTitles: Array.from(new Set(diverse.map((c) => c.title || "(sin título)"))),
              usedRetrieval: true,
            };
            if (process.env.NODE_ENV === "development") {
              console.log("[Sapito retrieval]", {
                documentsMatched: retrievalDebug.documentTitles.length,
                chunkCount: retrievalDebug.chunkCount,
                documentTitles: retrievalDebug.documentTitles.slice(0, 6),
                sapIntent: isSapIntent,
              });
            }
          }
          if (officialChunks.length > 0) {
            sections.push(formatKnowledgeContext(officialChunks, false));
            if (!retrievalDebug) {
              retrievalDebug = {
                chunkCount: officialChunks.length,
                documentTitles: officialChunks.map((c) => c.title || "(sin título)"),
                usedRetrieval: true,
              };
            } else {
              retrievalDebug.documentTitles = Array.from(
                new Set([...retrievalDebug.documentTitles, ...officialChunks.map((c) => c.title || "(sin título)")])
              );
            }
          }
        }
      } catch (err) {
        console.error("[sapitoContext] knowledge search error", err);
      }
    }
  } catch (err) {
    console.error("[sapitoContext] buildSapitoContext error", scope, projectId, err);
  }

  const contextText = sections.length === 0 ? "" : sections.join("\n\n");
  const hadQuery = (normalizeQueryForSap(message) || (message ?? "").trim()).length > 0;
  if (hadQuery && runRetrieval && !retrievalDebug) {
    retrievalDebug = { chunkCount: 0, documentTitles: [], usedRetrieval: false };
  }
  if (!retrievalDebug) {
    retrievalDebug = { chunkCount: 0, documentTitles: [], usedRetrieval: false };
  }
  return { contextText, retrievalDebug };
}

function formatKnowledgeContext(chunks: KnowledgeChunk[], fromProject: boolean): string {
  const prefix = fromProject
    ? "Contexto del proyecto (documentos técnicos recuperados):"
    : "Contexto SAP Knowledge (documentación técnica recuperada):";
  const lines: string[] = [prefix];
  for (const c of chunks) {
    const title = c.title || "(sin título)";
    const modulePart = c.module ? ` | Módulo: ${c.module}` : "";
    const sourcePart = c.source_name ? ` | Fuente: ${c.source_name}` : "";
    const content =
      c.content.slice(0, CHUNK_CONTENT_CAP).trim() +
      (c.content.length > CHUNK_CONTENT_CAP ? "…" : "");
    lines.push(`- ${title}${modulePart}${sourcePart}`);
    lines.push(`  Contenido: ${content}`);
  }
  return lines.join("\n");
}

function formatPlatformSummary(s: PlatformStats): string {
  const lines: string[] = [
    "Resumen de la plataforma:",
    `- Proyectos totales: ${s.totalProjects}`,
    `- Proyectos activos (planificado/en progreso): ${s.activeProjects}`,
    `- Total de notas: ${s.totalNotes}`,
    `- Notas creadas hoy: ${s.notesToday}`,
  ];
  if (s.openTickets != null) {
    lines.push(`- Tickets abiertos (plataforma): ${s.openTickets}`);
  }
  return lines.join("\n");
}

function formatProjectSummary(p: ProjectOverview): string {
  const nameLine = p.projectName
    ? `Proyecto: ${p.projectName} (${p.projectId}).`
    : `Proyecto: ${p.projectId}.`;
  const lines: string[] = [
    "Resumen del proyecto:",
    nameLine,
    `- Tareas abiertas: ${p.openTasks}`,
    `- Tareas vencidas: ${p.overdueTasks}`,
    `- Tareas bloqueadas: ${p.blockedTasks}`,
    `- Tickets abiertos: ${p.openTickets}`,
    `- Tickets alta prioridad: ${p.highPriorityTickets}`,
    `- Actividades vencidas: ${p.overdueActivities}`,
    `- Actividades próximas: ${p.upcomingActivities}`,
  ];
  return lines.join("\n");
}

function formatNotesSummary(n: NotesInsights): string {
  const lines: string[] = [
    "Resumen de notas (insights):",
    `- Total de notas: ${n.totalNotes}`,
  ];
  if (n.topModules.length > 0) {
    lines.push(
      `- Módulos más frecuentes: ${n.topModules.map((m) => `${m.name} (${m.count})`).join(", ")}`
    );
  }
  if (n.topErrorCodes.length > 0) {
    lines.push(
      `- Códigos de error más frecuentes: ${n.topErrorCodes.map((e) => `${e.code} (${e.count})`).join(", ")}`
    );
  }
  if (n.topTransactions.length > 0) {
    lines.push(
      `- Transacciones más mencionadas: ${n.topTransactions.map((t) => `${t.code} (${t.count})`).join(", ")}`
    );
  }
  return lines.join("\n");
}
