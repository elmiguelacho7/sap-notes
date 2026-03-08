/**
 * Sapito context resolvers — clean separation by mode.
 * Single engine uses one of these to load context; no project data in global, strict isolation in project.
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
  searchMultiTenantKnowledge,
  searchProjectMemory,
  ensureChunkDiversity,
  type KnowledgeChunk,
  type ProjectMemoryChunk,
} from "@/lib/ai/knowledgeSearch";
import { getOfficialSapKnowledgeContext } from "@/lib/ai/officialSapKnowledge";
import { normalizeQueryForSap } from "@/lib/ai/queryNormalize";
import { shouldIncludeWorkspaceSummary, isSapKnowledgeIntent, type SapIntentCategory } from "@/lib/ai/sapitoIntent";
import type { RetrievalDebug } from "@/lib/ai/sapitoContext";

const CHUNK_CONTENT_CAP = 1000;
const MAX_CHUNKS_AFTER_DIVERSITY = 8;
const MAX_CHUNKS_SAP = 6;
const MAX_PER_SOURCE = 2;
const MAX_MEMORY_ITEMS = 4;

function formatProjectMemoryContext(memories: ProjectMemoryChunk[]): string {
  const lines: string[] = [
    "Experiencia previa del proyecto SAP (usa cuando sea relevante; si usas esta experiencia, empieza la respuesta con: \"Based on previous SAP project experience...\"):",
  ];
  for (const m of memories) {
    const titlePart = m.title ? `Título: ${m.title}` : "";
    const problemPart = m.problem ? `Problema: ${m.problem}` : "";
    const solutionPart = `Solución: ${m.solution.slice(0, CHUNK_CONTENT_CAP).trim()}${m.solution.length > CHUNK_CONTENT_CAP ? "…" : ""}`;
    const modulePart = m.module ? `Módulo: ${m.module}` : "";
    lines.push(`- ${[titlePart, problemPart, solutionPart, modulePart].filter(Boolean).join(" | ")}`);
  }
  return lines.join("\n");
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

/** Official SAP docs: instruct model to ground with 'According to SAP documentation...' when used. */
function formatOfficialSapContext(chunks: KnowledgeChunk[]): string {
  const lines: string[] = [
    "Documentación oficial SAP indexada (según la documentación SAP…). Si usas este contenido, inicia la respuesta con: \"According to SAP documentation...\" o \"Según la documentación SAP...\":",
  ];
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
  if (s.openTickets != null) lines.push(`- Tickets abiertos (plataforma): ${s.openTickets}`);
  return lines.join("\n");
}

function formatProjectSummary(p: ProjectOverview): string {
  const nameLine = p.projectName ? `Proyecto: ${p.projectName} (${p.projectId}).` : `Proyecto: ${p.projectId}.`;
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
  const lines: string[] = ["Resumen de notas (insights):", `- Total de notas: ${n.totalNotes}`];
  if (n.topModules.length > 0)
    lines.push(`- Módulos más frecuentes: ${n.topModules.map((m) => `${m.name} (${m.count})`).join(", ")}`);
  if (n.topErrorCodes.length > 0)
    lines.push(`- Códigos de error más frecuentes: ${n.topErrorCodes.map((e) => `${e.code} (${e.count})`).join(", ")}`);
  if (n.topTransactions.length > 0)
    lines.push(`- Transacciones más mencionadas: ${n.topTransactions.map((t) => `${t.code} (${t.count})`).join(", ")}`);
  return lines.join("\n");
}

export type ResolverResult = {
  contextText: string;
  retrievalDebug: RetrievalDebug;
  retrievalScopes: string[];
};

export type GlobalResolverParams = {
  message: string;
  sapIntent?: SapIntentCategory;
  /** When true, include notes insights instead of platform stats for workspace summary (e.g. notes page). */
  notesVariant?: boolean;
};

/**
 * GlobalContextResolver — global SAP Copilot.
 * Loads only: global SAP knowledge, official SAP docs. Optionally platform summary or notes insights.
 * Does NOT load project summaries, project memory, or any project-scoped data.
 */
export async function resolveGlobalContext(
  params: GlobalResolverParams
): Promise<ResolverResult> {
  const { message, sapIntent, notesVariant } = params;
  const sections: string[] = [];
  const retrievalScopes: string[] = [];
  let retrievalDebug: RetrievalDebug = { chunkCount: 0, documentTitles: [], usedRetrieval: false };

  const includeSummary = shouldIncludeWorkspaceSummary(sapIntent);
  if (includeSummary) {
    if (notesVariant) {
      const insights = await getNotesInsights(10);
      sections.push(formatNotesSummary(insights));
      retrievalScopes.push("notes_insights");
    } else {
      const stats = await getPlatformStats();
      sections.push(formatPlatformSummary(stats));
      retrievalScopes.push("platform_summary");
    }
  }

  const searchQuery = normalizeQueryForSap(message) || (message ?? "").trim();
  const runRetrieval = searchQuery.length > 0;
  if (runRetrieval) {
    try {
      const isSapIntent = isSapKnowledgeIntent(sapIntent);
      const maxChunks = isSapIntent ? MAX_CHUNKS_SAP : MAX_CHUNKS_AFTER_DIVERSITY;
      retrievalScopes.push("official_sap", "global_knowledge");

      // Global mode: 1) official SAP knowledge, 2) other global knowledge.
      const [officialChunks, multiResult] = await Promise.all([
        getOfficialSapKnowledgeContext(searchQuery, 4),
        searchMultiTenantKnowledge(null, null, searchQuery, isSapIntent ? 6 : 10),
      ]);

      const officialIds = new Set(officialChunks.map((c) => c.id));
      const otherChunks = (multiResult.chunks ?? []).filter((c) => !officialIds.has(c.id));
      const diverse = ensureChunkDiversity(otherChunks, MAX_PER_SOURCE, maxChunks);

      if (officialChunks.length > 0) {
        sections.push(formatOfficialSapContext(officialChunks));
        retrievalDebug = {
          chunkCount: officialChunks.length,
          documentTitles: Array.from(new Set(officialChunks.map((c) => c.title || "(sin título)"))),
          usedRetrieval: true,
        };
      }
      if (diverse.length > 0) {
        sections.push(formatKnowledgeContext(diverse, false));
        if (!retrievalDebug.usedRetrieval) {
          retrievalDebug = {
            chunkCount: diverse.length,
            documentTitles: Array.from(new Set(diverse.map((c) => c.title || "(sin título)"))),
            usedRetrieval: true,
          };
        } else {
          retrievalDebug.documentTitles = Array.from(
            new Set([...retrievalDebug.documentTitles, ...diverse.map((c) => c.title || "(sin título)")])
          );
          retrievalDebug.chunkCount = (retrievalDebug.chunkCount ?? 0) + diverse.length;
        }
      }

      if (officialChunks.length === 0 && diverse.length === 0) {
        console.log("[Sapito multi-tenant retrieval]", {
          userId: null,
          projectId: null,
          documentsRetrieved: 0,
          scopeBreakdown: multiResult.scopeBreakdown,
        });
      } else {
        console.log("[Sapito multi-tenant retrieval]", {
          userId: null,
          projectId: null,
          documentsRetrieved: officialChunks.length + diverse.length,
          officialCount: officialChunks.length,
          otherGlobalCount: diverse.length,
          scopeBreakdown: multiResult.scopeBreakdown,
        });
      }
    } catch (err) {
      console.error("[GlobalContextResolver] retrieval error", err);
    }
  }

  const contextText = sections.length === 0 ? "" : sections.join("\n\n");
  return { contextText, retrievalDebug, retrievalScopes };
}

export type ProjectResolverParams = {
  projectId: string;
  userId: string | null;
  message: string;
  sapIntent?: SapIntentCategory;
};

/**
 * ProjectContextResolver — Project Copilot.
 * Loads: project memory, project-scoped documents, global SAP fallback, official SAP.
 * Optionally project overview when workspace summary intent. Never loads another project's data.
 */
export async function resolveProjectContext(
  params: ProjectResolverParams
): Promise<ResolverResult> {
  const { projectId, userId, message, sapIntent } = params;
  const sections: string[] = [];
  const retrievalScopes: string[] = [];
  let retrievalDebug: RetrievalDebug = { chunkCount: 0, documentTitles: [], usedRetrieval: false };

  const includeSummary = shouldIncludeWorkspaceSummary(sapIntent);
  if (includeSummary) {
    const overview = await getProjectOverview(projectId);
    sections.push(formatProjectSummary(overview));
    retrievalScopes.push("project_summary");
  }

  const searchQuery = normalizeQueryForSap(message) || (message ?? "").trim();
  const runRetrieval = searchQuery.length > 0;
  if (runRetrieval) {
    try {
      const isSapIntent = isSapKnowledgeIntent(sapIntent);
      const maxChunks = isSapIntent ? MAX_CHUNKS_SAP : MAX_CHUNKS_AFTER_DIVERSITY;
      const topK = isSapIntent ? 6 : 10;

      retrievalScopes.push("project_memory", "project_documents", "global_fallback", "official_sap");
      const [memoryChunks, multiResult, officialChunks] = await Promise.all([
        searchProjectMemory(projectId, userId, searchQuery, MAX_MEMORY_ITEMS),
        searchMultiTenantKnowledge(projectId, userId, searchQuery, topK),
        getOfficialSapKnowledgeContext(searchQuery, 4),
      ]);

      const memoriesFound = memoryChunks.length;
      const projectsUsed = memoriesFound > 0 ? [projectId] : [];
      console.log("[Sapito memory retrieval]", { memoriesFound, projectsUsed });

      const multiChunks = multiResult.chunks;
      const officialIds = new Set(officialChunks.map((c) => c.id));
      const otherChunks = multiChunks.filter((c) => !officialIds.has(c.id));
      const diverse = ensureChunkDiversity(otherChunks, MAX_PER_SOURCE, maxChunks);

      console.log("[Sapito multi-tenant retrieval]", {
        userId,
        projectId,
        documentsRetrieved: multiChunks.length,
        officialCount: officialChunks.length,
        scopeBreakdown: multiResult.scopeBreakdown,
      });

      if (memoryChunks.length > 0) {
        sections.push(formatProjectMemoryContext(memoryChunks));
        retrievalDebug = {
          chunkCount: memoryChunks.length,
          documentTitles: [],
          usedRetrieval: true,
          usedProjectMemory: true,
          memoryCount: memoryChunks.length,
        };
      }

      // Project mode order: memory → project/global docs → official SAP (so official is support/fallback).
      if (diverse.length > 0) {
        sections.push(formatKnowledgeContext(diverse, true));
        retrievalDebug = {
          chunkCount: (retrievalDebug.chunkCount ?? 0) + diverse.length,
          documentTitles: Array.from(new Set(diverse.map((c) => c.title || "(sin título)"))),
          usedRetrieval: true,
          usedProjectMemory: retrievalDebug.usedProjectMemory ?? false,
          memoryCount: retrievalDebug.memoryCount ?? 0,
        };
      }
      if (officialChunks.length > 0) {
        sections.push(formatOfficialSapContext(officialChunks));
        retrievalDebug.documentTitles = Array.from(
          new Set([...retrievalDebug.documentTitles, ...officialChunks.map((c) => c.title || "(sin título)")])
        );
        retrievalDebug.chunkCount = (retrievalDebug.chunkCount ?? 0) + officialChunks.length;
      }
    } catch (err) {
      console.error("[ProjectContextResolver] retrieval error", err);
    }
  }

  const contextText = sections.length === 0 ? "" : sections.join("\n\n");
  return { contextText, retrievalDebug, retrievalScopes };
}
