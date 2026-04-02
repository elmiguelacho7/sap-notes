/**
 * Sapito context resolvers — clean separation by mode.
 * Single engine uses one of these to load context; no project data in global, strict isolation in project.
 */

import {
  getPlatformStats,
  getProjectOverview,
  getNotesInsights,
  executeSapitoTool,
  type PlatformStats,
  type ProjectOverview,
  type NotesInsights,
  type AnalyzeProjectHealthResult,
} from "@/lib/ai/sapitoTools";
import { getProjectMetrics } from "@/lib/metrics/platformMetrics";
import {
  searchMultiTenantKnowledge,
  searchProjectMemory,
  getExtractedProjectMemory,
  ensureChunkDiversity,
  searchKnowledgePagesFullText,
  type KnowledgeChunk,
  type ProjectMemoryChunk,
  type KnowledgePageHit,
  type ExtractedProjectMemoryRow,
} from "@/lib/ai/knowledgeSearch";
import { getOfficialSapKnowledgeContext } from "@/lib/ai/officialSapKnowledge";
import { normalizeQueryForSap } from "@/lib/ai/queryNormalize";
import { shouldIncludeWorkspaceSummary, isSapKnowledgeIntent, isWeeklyFocusIntent, type SapIntentCategory, type SapitoIntentRoute } from "@/lib/ai/sapitoIntent";
import type { RetrievalDebug } from "@/lib/ai/sapitoContext";
import { analyzeWeeklyFocus, type WeeklyFocusResult } from "@/lib/ai/workspaceFocus";
import type { ProjectRiskReport } from "@/lib/ai/projectRisk";
import { rankKnowledgeChunks } from "@/lib/ai/retrievalRanking";
import { getExternalSapFallbackProvider } from "@/lib/ai/externalSapFallback";

const CHUNK_CONTENT_CAP = 1000;
const MAX_CHUNKS_AFTER_DIVERSITY = 8;
const MAX_CHUNKS_SAP = 6;
const MAX_PER_SOURCE = 2;
const MAX_MEMORY_ITEMS = 4;

function detectProjectHealthIntent(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("project health") ||
    m.includes("how healthy") ||
    m.includes("is this project healthy") ||
    m.includes("analyze project health")
  );
}

function detectProjectRiskIntent(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("project risk") ||
    m.includes("what risks exist in this project") ||
    m.includes("is this project in danger") ||
    m.includes("is this project at risk") ||
    m.includes("what should worry me") ||
    m.includes("riesgos del proyecto") ||
    m.includes("qué riesgos hay en este proyecto") ||
    m.includes("este proyecto está en riesgo") ||
    /que\s+riesgos\s+hay/i.test(m) ||
    /riesgos\s+del\s+proyecto/i.test(m)
  );
}

function formatProjectHealthContext(result: AnalyzeProjectHealthResult): string {
  const lines: string[] = [
    "Análisis de salud del proyecto (usa como fuente de verdad para resumir estado y riesgos):",
    `- Puntuación de salud: ${result.healthScore}/100`,
    `- Estado: ${result.status}`,
    `- Señales: tareas vencidas ${result.signals.overdueTasks}, tickets abiertos ${result.signals.openTickets}, actividad reciente (7 días) ${result.signals.recentActivity}, fases retrasadas ${result.signals.delayedPhases}`,
  ];
  if (result.recommendations.length > 0) {
    lines.push("- Recomendaciones: " + result.recommendations.join("; "));
  }
  return lines.join("\n");
}

function formatWeeklyFocusContext(result: WeeklyFocusResult): string {
  const lines: string[] = [
    "Enfoque semanal (usa como fuente de verdad; responde con ## Weekly Focus, ### Priority 1/2/..., ### Recommended next actions):",
    "Prioridades:",
  ];
  result.priorities.forEach((p, i) => {
    lines.push(`- Prioridad ${i + 1}: ${p.title}. ${p.reason}`);
  });
  lines.push("Acciones recomendadas: " + result.recommendedNextActions.join("; "));
  return lines.join("\n");
}

function formatProjectRiskContext(result: ProjectRiskReport): string {
  const lines: string[] = [
    "## Project Risk Radar",
    `Risk level: ${result.level}`,
    `Summary: ${result.summary}`,
    "Signals:",
    ...result.signals.map((s) => `- ${s.label}: ${s.value} (${s.severity}) — ${s.reason}`),
    "Recommendations:",
    ...result.recommendations.map((r) => `- ${r}`),
    "",
    "Responde usando la estructura: ## Project Risk Radar, ### Risk level, ### Main signals, ### Recommended actions. No uses documentación SAP.",
  ];
  return lines.join("\n");
}

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

/** Extracted project memory from notes (project_memory table). Primary evidence for project-history questions. */
function formatExtractedProjectMemoryContext(items: ExtractedProjectMemoryRow[]): string {
  if (items.length === 0) return "";
  const lines: string[] = [
    "Memoria del proyecto extraída de notas (problemas, soluciones, decisiones, lecciones; usa como fuente principal para preguntas sobre la historia del proyecto):",
  ];
  const summaryCap = 600;
  for (const m of items) {
    const titlePart = m.title?.trim() ? `[${m.memory_type}] ${m.title}` : `[${m.memory_type}]`;
    const summary = m.summary.slice(0, summaryCap).trim() + (m.summary.length > summaryCap ? "…" : "");
    lines.push(`- ${titlePart}: ${summary}`);
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

function formatExternalSapFallback(docs: Array<{ title: string; snippet: string; source_url?: string | null; provider?: string }>): string {
  if (docs.length === 0) return "";
  const lines: string[] = [
    "External SAP fallback (siempre indica que es una fuente externa; úsala solo si no hay suficiente evidencia interna):",
  ];
  for (const d of docs) {
    const url = d.source_url?.trim() ? ` | URL: ${d.source_url.trim()}` : "";
    const prov = d.provider ? ` | Provider: ${d.provider}` : "";
    const snippet = (d.snippet ?? "").trim().slice(0, 900) + ((d.snippet ?? "").trim().length > 900 ? "…" : "");
    lines.push(`- ${d.title}${prov}${url}`);
    if (snippet) lines.push(`  Snippet: ${snippet}`);
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

/** Full-text knowledge pages (title/summary). Complementary to vector search; keep concise. */
function formatFullTextKnowledgePagesContext(pages: KnowledgePageHit[]): string {
  if (pages.length === 0) return "";
  const lines: string[] = [
    "Páginas de conocimiento (búsqueda por texto en título/resumen; usa como complemento):",
  ];
  for (const p of pages) {
    const title = p.title ?? "(sin título)";
    const summary = p.summary ? p.summary.trim() : "";
    lines.push(`- ${title}${summary ? ` — ${summary}` : ""}`);
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
  retrievalTrace?: import("@/lib/ai/sapitoContext").RetrievalTrace;
};

export type GlobalResolverParams = {
  message: string;
  sapIntent?: SapIntentCategory;
  /** Sapito 2.0 Phase 1 intent route (optional, additive). */
  sapitoRoute?: SapitoIntentRoute;
  /** When true, include notes insights instead of platform stats for workspace summary (e.g. notes page). */
  notesVariant?: boolean;
  /** User id for scoped platform metrics (required for counts to match dashboard). */
  userId?: string | null;
  /** User JWT so full-text knowledge search runs with RLS (optional). */
  accessToken?: string | null;
};

/**
 * GlobalContextResolver — global SAP Copilot.
 * Loads only: global SAP knowledge, official SAP docs. Optionally platform summary or notes insights.
 * Does NOT load project summaries, project memory, or any project-scoped data.
 */
export async function resolveGlobalContext(
  params: GlobalResolverParams
): Promise<ResolverResult> {
  const { message, sapIntent, notesVariant, userId, sapitoRoute } = params;
  const accessToken = params.accessToken ?? null;
  const sections: string[] = [];
  const retrievalScopes: string[] = [];
  let retrievalDebug: RetrievalDebug = { chunkCount: 0, documentTitles: [], usedRetrieval: false };
  const queriedGroups: string[] = [];
  const skippedGroups: string[] = [];
  let fallbackConsidered = false;

  const includeSummary = shouldIncludeWorkspaceSummary(sapIntent);
  if (includeSummary) {
    if (notesVariant) {
      const insights = await getNotesInsights(userId ?? null, 10);
      sections.push(formatNotesSummary(insights));
      retrievalScopes.push("notes_insights");
    } else {
      const stats = await getPlatformStats(userId ?? null);
      sections.push(formatPlatformSummary(stats));
      retrievalScopes.push("platform_summary");
    }
  }

  if (isWeeklyFocusIntent(sapIntent) && userId) {
    try {
      const focusResult = await analyzeWeeklyFocus(userId);
      sections.push(formatWeeklyFocusContext(focusResult));
      retrievalScopes.push("weekly_focus");
    } catch (err) {
      console.error("[GlobalContextResolver] analyzeWeeklyFocus error", err);
    }
  }

  const searchQuery = normalizeQueryForSap(message) || (message ?? "").trim();
  const runRetrieval = searchQuery.length > 0 && !isWeeklyFocusIntent(sapIntent);
  if (runRetrieval) {
    try {
      // Sapito 2.0 Phase 1: deterministic narrowing by v2 intent (optional).
      // Keep v1 behavior as fallback when sapitoRoute is absent.
      const v2Intent = sapitoRoute?.intent;
      const wantsConnected = sapitoRoute?.needsConnectedSources === true || v2Intent === "needs_connected_sources";

      const isSapIntent = isSapKnowledgeIntent(sapIntent);
      const maxChunks = isSapIntent ? MAX_CHUNKS_SAP : MAX_CHUNKS_AFTER_DIVERSITY;

      // Decide which retrieval groups to run.
      const shouldRunOfficialSap =
        v2Intent == null
          ? true
          : v2Intent === "sap_error_troubleshooting" ||
            v2Intent === "sap_configuration" ||
            v2Intent === "sap_process_explanation" ||
            v2Intent === "sap_best_practice" ||
            v2Intent === "sap_comparison_or_design" ||
            v2Intent === "sap_general_knowledge" ||
            v2Intent === "project_plus_sap_general";

      const shouldRunKnowledgeDocs =
        v2Intent == null ? true : v2Intent !== "project_status" && v2Intent !== "project_operational_summary";

      const shouldRunFullTextPages =
        accessToken != null && accessToken.trim() !== "" && (v2Intent == null || v2Intent !== "project_status");

      // External SAP fallback slot (architecture): only for global SAP intents when internal retrieval is weak.
      const shouldConsiderExternalFallback =
        v2Intent === "sap_general_knowledge" ||
        v2Intent === "sap_error_troubleshooting" ||
        v2Intent === "sap_configuration" ||
        v2Intent === "sap_process_explanation" ||
        v2Intent === "sap_best_practice" ||
        v2Intent === "sap_comparison_or_design";

      // Keep backward compatible scope labels (official_sap) while adding semantic group (sap_general_knowledge).
      if (shouldRunOfficialSap) retrievalScopes.push("official_sap", "sap_general_knowledge");
      if (shouldRunKnowledgeDocs) retrievalScopes.push("global_knowledge");
      if (shouldRunOfficialSap) queriedGroups.push("official_sap");
      else skippedGroups.push("official_sap");
      if (shouldRunKnowledgeDocs) queriedGroups.push("global_knowledge");
      else skippedGroups.push("global_knowledge");

      // Global mode: official SAP + global multitenant (which becomes global-only when p_project_id is NULL).
      const [officialChunks, multiResult] = await Promise.all([
        shouldRunOfficialSap ? getOfficialSapKnowledgeContext(searchQuery, 4) : Promise.resolve([]),
        shouldRunKnowledgeDocs
          ? searchMultiTenantKnowledge(null, null, searchQuery, isSapIntent ? 8 : 12)
          : Promise.resolve({ chunks: [], scopeBreakdown: { project: 0, user: 0, global: 0 } }),
      ]);

      // Connected sources first-class: for now, recognize connected docs as chunks with external_ref (Drive file/folder ids, etc).
      const connectedChunksRaw = wantsConnected
        ? (multiResult.chunks ?? []).filter((c) => (c.external_ref ?? "").trim() !== "")
        : [];
      const connectedChunks = connectedChunksRaw.length > 0
        ? rankKnowledgeChunks(connectedChunksRaw, { mode: "global", v2Intent: v2Intent ?? null, query: searchQuery })
        : [];
      const remainingChunks = (multiResult.chunks ?? []).filter((c) => !connectedChunksRaw.includes(c));

      const officialIds = new Set(officialChunks.map((c) => c.id));
      const otherChunks = remainingChunks.filter((c) => !officialIds.has(c.id));
      const diverse = ensureChunkDiversity(otherChunks, MAX_PER_SOURCE, maxChunks);

      if (connectedChunks.length > 0) {
        sections.push(formatKnowledgeContext(ensureChunkDiversity(connectedChunks, 2, Math.min(6, maxChunks)), false));
        // Keep backward compatible label (connected_documents) while adding semantic group.
        retrievalScopes.push("connected_documents", "connected_documents_global");
        retrievalDebug = {
          chunkCount: connectedChunks.length,
          documentTitles: Array.from(new Set(connectedChunks.map((c) => c.title || c.source_name || "(sin título)"))),
          usedRetrieval: true,
        };
      }

      if (officialChunks.length > 0) {
        sections.push(formatOfficialSapContext(officialChunks));
        if (!retrievalDebug.usedRetrieval) {
          retrievalDebug = {
            chunkCount: officialChunks.length,
            documentTitles: Array.from(new Set(officialChunks.map((c) => c.title || "(sin título)"))),
            usedRetrieval: true,
          };
        } else {
          retrievalDebug.documentTitles = Array.from(
            new Set([...(retrievalDebug.documentTitles ?? []), ...officialChunks.map((c) => c.title || "(sin título)")])
          );
          retrievalDebug.chunkCount = (retrievalDebug.chunkCount ?? 0) + officialChunks.length;
        }
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
            new Set([...(retrievalDebug.documentTitles ?? []), ...diverse.map((c) => c.title || "(sin título)")])
          );
          retrievalDebug.chunkCount = (retrievalDebug.chunkCount ?? 0) + diverse.length;
        }
      }

      // External SAP fallback (disabled provider by default): only when no internal evidence was found.
      if (shouldConsiderExternalFallback && officialChunks.length === 0 && connectedChunks.length === 0 && diverse.length === 0) {
        const provider = getExternalSapFallbackProvider();
        fallbackConsidered = true;
        if (provider.enabled()) {
          try {
            const docs = await provider.search({ query: searchQuery, topK: 3 });
            if (docs.length > 0) {
              sections.push(formatExternalSapFallback(docs));
              retrievalScopes.push("external_sap_fallback");
              retrievalDebug.documentTitles = Array.from(
                new Set([...(retrievalDebug.documentTitles ?? []), ...docs.map((d) => d.title)])
              );
            }
          } catch (err) {
            console.error("[GlobalContextResolver] external fallback error", err);
          }
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

      // Full-text knowledge pages (complementary to vector search).
      if (shouldRunFullTextPages) {
        const fullTextPages = await searchKnowledgePagesFullText(searchQuery, 4, { accessToken });
        if (fullTextPages.length > 0) {
          sections.push(formatFullTextKnowledgePagesContext(fullTextPages));
          retrievalScopes.push("fulltext_knowledge_pages");
          retrievalDebug.documentTitles = Array.from(
            new Set([...(retrievalDebug.documentTitles ?? []), ...fullTextPages.map((p) => p.title ?? "(sin título)")])
          );
          retrievalDebug.chunkCount = (retrievalDebug.chunkCount ?? 0) + fullTextPages.length;
        }
      }
    } catch (err) {
      console.error("[GlobalContextResolver] retrieval error", err);
    }
  }

  const contextText = sections.length === 0 ? "" : sections.join("\n\n");
  const retrievalTrace = {
    mode: notesVariant ? ("notes" as const) : ("global" as const),
    detectedIntent: sapIntent ?? null,
    detectedV2Intent: sapitoRoute?.intent ?? null,
    sapTaxonomy: sapitoRoute?.sapTaxonomy
      ? { domains: sapitoRoute.sapTaxonomy.domains, themes: sapitoRoute.sapTaxonomy.themes, matched: sapitoRoute.sapTaxonomy.matched }
      : null,
    queriedGroups,
    skippedGroups,
    earlyExit: false,
    strongEvidence: (retrievalScopes.includes("official_sap") || retrievalScopes.includes("global_knowledge") || retrievalScopes.includes("connected_documents_global")) ? true : false,
    fallbackConsidered,
    winningSourceLabels: Array.from(new Set(retrievalScopes)).slice(0, 12),
  };
  return { contextText, retrievalDebug, retrievalScopes, retrievalTrace };
}

export type ProjectResolverParams = {
  projectId: string;
  userId: string | null;
  message: string;
  sapIntent?: SapIntentCategory;
  /** Sapito 2.0 Phase 1 intent route (optional, additive). */
  sapitoRoute?: SapitoIntentRoute;
  /** User JWT so full-text knowledge search runs with RLS (optional). */
  accessToken?: string | null;
};

/**
 * ProjectContextResolver — Project Copilot.
 * Loads: project memory, project-scoped documents, global SAP fallback, official SAP.
 * Optionally project overview when workspace summary intent. Never loads another project's data.
 */
export async function resolveProjectContext(
  params: ProjectResolverParams
): Promise<ResolverResult> {
  const { projectId, userId, message, sapIntent, sapitoRoute } = params;
  const accessToken = params.accessToken ?? null;
  const sections: string[] = [];
  const retrievalScopes: string[] = [];
  let retrievalDebug: RetrievalDebug = { chunkCount: 0, documentTitles: [], usedRetrieval: false };
  const queriedGroups: string[] = [];
  const skippedGroups: string[] = [];
  let earlyExit = false;
  let strongEvidence = false;

  const includeSummary = shouldIncludeWorkspaceSummary(sapIntent);
  if (includeSummary) {
    const metrics = await getProjectMetrics(projectId, userId);
    if (metrics) {
      const overview: ProjectOverview = {
        projectId: metrics.projectId,
        projectName: metrics.projectName,
        openTasks: metrics.openTasks,
        overdueTasks: metrics.overdueTasks,
        blockedTasks: metrics.blockedTasks,
        openTickets: metrics.openTickets,
        highPriorityTickets: metrics.highPriorityTickets,
        overdueActivities: metrics.overdueActivities,
        upcomingActivities: metrics.upcomingActivities,
      };
      sections.push(formatProjectSummary(overview));
      retrievalScopes.push("project_summary");
    } else {
      const overview = await getProjectOverview(projectId);
      sections.push(formatProjectSummary(overview));
      retrievalScopes.push("project_summary");
    }
  }

  if (detectProjectHealthIntent(message) && projectId && userId) {
    if (process.env.NODE_ENV === "development") {
      console.log("[Project health intent]", { message, projectId, triggered: true });
    }
    try {
      const healthResult = (await executeSapitoTool(
        "analyze_project_health",
        { projectId },
        userId
      )) as AnalyzeProjectHealthResult;
      sections.push(formatProjectHealthContext(healthResult));
      retrievalScopes.push("project_health");
    } catch (err) {
      console.error("[ProjectContextResolver] analyze_project_health error", err);
    }
  }

  if (detectProjectRiskIntent(message) && projectId && userId) {
    if (process.env.NODE_ENV === "development") {
      console.log("[Project risk intent]", { message, projectId, triggered: true });
    }
    try {
      const riskResult = (await executeSapitoTool(
        "analyze_project_risk",
        { projectId },
        userId
      )) as ProjectRiskReport;
      sections.push(formatProjectRiskContext(riskResult));
      retrievalScopes.push("project_risk");
    } catch (err) {
      console.error("[ProjectContextResolver] analyze_project_risk error", err);
    }
  }

  if (isWeeklyFocusIntent(sapIntent) && userId) {
    try {
      const focusResult = await analyzeWeeklyFocus(userId, projectId);
      sections.push(formatWeeklyFocusContext(focusResult));
      retrievalScopes.push("weekly_focus");
    } catch (err) {
      console.error("[ProjectContextResolver] analyzeWeeklyFocus error", err);
    }
  }

  const searchQuery = normalizeQueryForSap(message) || (message ?? "").trim();
  const runRetrieval = searchQuery.length > 0 && !isWeeklyFocusIntent(sapIntent) && !detectProjectRiskIntent(message);
  if (runRetrieval) {
    try {
      const v2Intent = sapitoRoute?.intent;
      const wantsConnected = sapitoRoute?.needsConnectedSources === true || v2Intent === "needs_connected_sources";

      const isSapIntent = isSapKnowledgeIntent(sapIntent);
      const maxChunks = isSapIntent ? MAX_CHUNKS_SAP : MAX_CHUNKS_AFTER_DIVERSITY;
      const topK = isSapIntent ? 8 : 14;

      // Phase 1: explicit priority rules + evidence-first early exits.
      const isHistoryOrDecision =
        v2Intent === "project_history" ||
        v2Intent === "project_decision" ||
        v2Intent === "project_issue_resolution";
      const isDocLookup = v2Intent === "project_documentation_lookup";
      const isOperational = v2Intent === "project_status" || v2Intent === "project_operational_summary";

      // Narrow retrieval groups.
      const shouldRunProjectMemory = !isOperational;
      // Confidence-aware retrieval ordering:
      // - History/decision: memory first; docs only when explicitly needed.
      // - Docs lookup: favor docs/connected.
      // - SAP troubleshooting/design: allow docs even in project mode, but prefer project/connected first via ranking.
      const shouldRunKnowledgeDocs =
        !isOperational && (isDocLookup || wantsConnected || !isHistoryOrDecision);
      // Only consult official SAP in project mode when the question is clearly SAP-general/troubleshooting/design,
      // or when connected/docs retrieval is empty (handled by existing evidence-first logic).
      const shouldRunOfficialSap =
        !isOperational && (isSapIntent || v2Intent === "project_plus_sap_general");
      const shouldRunFullTextPages =
        !isOperational && accessToken != null && accessToken.trim() !== "";

      const [memoryChunks, extractedMemory] = await Promise.all([
        shouldRunProjectMemory ? searchProjectMemory(projectId, userId, searchQuery, MAX_MEMORY_ITEMS) : Promise.resolve([]),
        shouldRunProjectMemory ? getExtractedProjectMemory(projectId, 12) : Promise.resolve([]),
      ]);
      if (shouldRunProjectMemory) queriedGroups.push("project_memory");
      else skippedGroups.push("project_memory");

      const hasStrongProjectMemory = extractedMemory.length > 0 || memoryChunks.length > 0;
      const shouldSkipDocsDueToStrongEvidence =
        isHistoryOrDecision && hasStrongProjectMemory && !isDocLookup && !wantsConnected;
      if (shouldSkipDocsDueToStrongEvidence) earlyExit = true;

      const [multiResult, officialChunks] = await Promise.all([
        shouldRunKnowledgeDocs && !shouldSkipDocsDueToStrongEvidence
          ? searchMultiTenantKnowledge(projectId, userId, searchQuery, topK)
          : Promise.resolve({ chunks: [], scopeBreakdown: { project: 0, user: 0, global: 0 } }),
        shouldRunOfficialSap && !shouldSkipDocsDueToStrongEvidence
          ? getOfficialSapKnowledgeContext(searchQuery, 4)
          : Promise.resolve([]),
      ]);
      if (shouldRunKnowledgeDocs && !shouldSkipDocsDueToStrongEvidence) queriedGroups.push("project_documents");
      else skippedGroups.push("project_documents");
      if (shouldRunOfficialSap && !shouldSkipDocsDueToStrongEvidence) queriedGroups.push("official_sap");
      else skippedGroups.push("official_sap");

      const memoriesFound = memoryChunks.length;
      const projectsUsed = memoriesFound > 0 ? [projectId] : [];
      console.log("[Sapito memory retrieval]", { memoriesFound, projectsUsed, extractedCount: extractedMemory.length, v2Intent });

      const multiChunks = multiResult.chunks;
      const officialIds = new Set(officialChunks.map((c) => c.id));
      const connectedChunksRaw = wantsConnected
        ? multiChunks.filter((c) => (c.external_ref ?? "").trim() !== "")
        : [];
      const connectedChunks = connectedChunksRaw.length > 0
        ? rankKnowledgeChunks(connectedChunksRaw, { mode: "project", v2Intent: v2Intent ?? null, query: searchQuery, projectId })
        : [];
      const remainingChunks = multiChunks.filter((c) => !connectedChunksRaw.includes(c));
      const otherChunks = remainingChunks.filter((c) => !officialIds.has(c.id));
      const diverse = ensureChunkDiversity(otherChunks, MAX_PER_SOURCE, maxChunks);

      console.log("[Sapito multi-tenant retrieval]", {
        userId,
        projectId,
        documentsRetrieved: multiChunks.length,
        officialCount: officialChunks.length,
        connectedCount: connectedChunks.length,
        scopeBreakdown: multiResult.scopeBreakdown,
        v2Intent,
        skippedDocs: shouldSkipDocsDueToStrongEvidence,
      });

      if (extractedMemory.length > 0) {
        sections.push(formatExtractedProjectMemoryContext(extractedMemory));
        retrievalScopes.push("project_memory");
        retrievalDebug = {
          chunkCount: extractedMemory.length,
          documentTitles: extractedMemory.map((m) => m.title ?? m.memory_type).filter(Boolean),
          usedRetrieval: true,
          usedProjectMemory: true,
          memoryCount: extractedMemory.length,
        };
      }

      if (memoryChunks.length > 0) {
        sections.push(formatProjectMemoryContext(memoryChunks));
        if (!retrievalScopes.includes("project_memory")) retrievalScopes.push("project_memory");
        retrievalDebug = {
          chunkCount: (retrievalDebug.chunkCount ?? 0) + memoryChunks.length,
          documentTitles: [...(retrievalDebug.documentTitles ?? [])],
          usedRetrieval: true,
          usedProjectMemory: true,
          memoryCount: (retrievalDebug.memoryCount ?? 0) + memoryChunks.length,
        };
      }

      // Project mode order: memory → connected docs → project/global docs → official SAP (official is support/fallback).
      if (connectedChunks.length > 0) {
        sections.push(formatKnowledgeContext(ensureChunkDiversity(connectedChunks, 2, Math.min(6, maxChunks)), true));
        // Keep backward compatible label (connected_documents) while adding semantic group.
        retrievalScopes.push("connected_documents", "connected_documents_project");
        retrievalDebug = {
          chunkCount: (retrievalDebug.chunkCount ?? 0) + connectedChunks.length,
          documentTitles: Array.from(
            new Set([...(retrievalDebug.documentTitles ?? []), ...connectedChunks.map((c) => c.title || c.source_name || "(sin título)")])
          ).slice(0, 30),
          usedRetrieval: true,
          usedProjectMemory: retrievalDebug.usedProjectMemory ?? false,
          memoryCount: retrievalDebug.memoryCount ?? 0,
        };
      }

      if (diverse.length > 0) {
        sections.push(formatKnowledgeContext(diverse, true));
        retrievalScopes.push("project_documents");
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
        retrievalScopes.push("official_sap", "sap_general_knowledge");
        retrievalDebug.documentTitles = Array.from(
          new Set([...retrievalDebug.documentTitles, ...officialChunks.map((c) => c.title || "(sin título)")])
        );
        retrievalDebug.chunkCount = (retrievalDebug.chunkCount ?? 0) + officialChunks.length;
      }

      strongEvidence =
        retrievalScopes.includes("project_memory") ||
        retrievalScopes.includes("project_documents") ||
        retrievalScopes.includes("connected_documents_project");

      // Full-text knowledge pages (complementary to vector search).
      if (shouldRunFullTextPages && !shouldSkipDocsDueToStrongEvidence) {
        const fullTextPages = await searchKnowledgePagesFullText(searchQuery, 3, { accessToken });
        if (fullTextPages.length > 0) {
          sections.push(formatFullTextKnowledgePagesContext(fullTextPages));
          retrievalScopes.push("fulltext_knowledge_pages");
          retrievalDebug.documentTitles = Array.from(
            new Set([...(retrievalDebug.documentTitles ?? []), ...fullTextPages.map((p) => p.title ?? "(sin título)")])
          );
          retrievalDebug.chunkCount = (retrievalDebug.chunkCount ?? 0) + fullTextPages.length;
        }
      }
    } catch (err) {
      console.error("[ProjectContextResolver] retrieval error", err);
    }
  }

  const contextText = sections.length === 0 ? "" : sections.join("\n\n");
  const retrievalTrace = {
    mode: "project" as const,
    detectedIntent: sapIntent ?? null,
    detectedV2Intent: sapitoRoute?.intent ?? null,
    sapTaxonomy: sapitoRoute?.sapTaxonomy
      ? { domains: sapitoRoute.sapTaxonomy.domains, themes: sapitoRoute.sapTaxonomy.themes, matched: sapitoRoute.sapTaxonomy.matched }
      : null,
    queriedGroups,
    skippedGroups,
    earlyExit,
    strongEvidence,
    fallbackConsidered: false,
    winningSourceLabels: Array.from(new Set(retrievalScopes)).slice(0, 12),
  };
  return { contextText, retrievalDebug, retrievalScopes, retrievalTrace };
}
