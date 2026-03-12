import { NextResponse } from "next/server";
import { runProjectAgent, type AgentContext } from "@/lib/langchain/projectAgent";
import {
  getProjectStats,
  getProjectNotes,
  getProjectLinks,
  ProjectNotFoundError,
} from "@/lib/services/projectService";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveGlobalContext, resolveProjectContext } from "@/lib/ai/contextResolvers";
import { type RetrievalDebug } from "@/lib/ai/sapitoContext";
import { classifySapIntent, shouldIncludeWorkspaceSummary, isProjectStatusQuestion, isProjectHistoryQuestion, hasProjectEvidence, hasStrongProjectHistoryEvidence, getProjectHistoryMatchReason } from "@/lib/ai/sapitoIntent";
import {
  resolveProjectByName,
  extractProjectNameFromMessage,
  isAmbiguousProjectQuestion,
} from "@/lib/ai/projectResolution";
import { getProjectMetrics } from "@/lib/metrics/platformMetrics";
import { getCurrentUserIdFromRequest, getAccessTokenFromRequest } from "@/lib/auth/serverAuth";
import { requireAuthAndProjectPermission, requireAuthAndGlobalPermission } from "@/lib/auth/permissions";

/** Human-readable grounding labels for UI. */
const GROUNDING_LABELS: Record<string, string> = {
  platform_summary: "Basado en las métricas actuales del workspace.",
  project_summary: "Basado en el contexto actual del proyecto.",
  notes_insights: "Basado en el resumen de notas.",
  project_memory: "Basado en experiencia previa del proyecto.",
  project_documents: "Según la documentación sincronizada del proyecto.",
  official_sap: "Según la documentación SAP indexada.",
  fulltext_knowledge_pages: "Según páginas de conocimiento (búsqueda por texto).",
  global_knowledge: "Según la documentación sincronizada.",
  weekly_focus: "Basado en las prioridades y el enfoque semanal del workspace.",
  project_health: "Basado en el análisis de salud del proyecto.",
  project_risk: "Basado en el Project Risk Radar del proyecto.",
  general: "Respuesta general.",
};

/** Assistant mode: global (SAP Copilot) or project (Project Copilot). Single engine, behavior by mode. */
export type SapitoMode = "global" | "project";

function getGroundingLabel(scopes: string[], resolvedProjectTitle?: string | null): string {
  if (resolvedProjectTitle) {
    return `Basado en el contexto del proyecto "${resolvedProjectTitle}".`;
  }
  if (scopes.includes("platform_summary")) return GROUNDING_LABELS.platform_summary;
  if (scopes.includes("project_summary")) return GROUNDING_LABELS.project_summary;
  if (scopes.includes("notes_insights")) return GROUNDING_LABELS.notes_insights;
  if (scopes.includes("weekly_focus")) return GROUNDING_LABELS.weekly_focus;
  if (scopes.includes("project_health")) return GROUNDING_LABELS.project_health;
  if (scopes.includes("project_risk")) return GROUNDING_LABELS.project_risk;
  if (scopes.includes("project_memory")) return GROUNDING_LABELS.project_memory;
  if (scopes.includes("official_sap") && scopes.includes("fulltext_knowledge_pages")) {
    return "Según documentación SAP y páginas de conocimiento.";
  }
  if (scopes.includes("official_sap")) return GROUNDING_LABELS.official_sap;
  if (scopes.includes("fulltext_knowledge_pages")) return GROUNDING_LABELS.fulltext_knowledge_pages;
  if (scopes.some((s) => s.includes("document") || s.includes("knowledge")))
    return GROUNDING_LABELS.project_documents;
  return GROUNDING_LABELS.general;
}

const NOTES_LIMIT = 30;
const LINKS_LIMIT = 20;

export async function POST(req: Request) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { error: "Método no permitido." },
      { status: 405 }
    );
  }

  try {
    // Request body: projectId and userId optional; message required
    const body = (await req.json()) as {
      projectId?: string | null;
      message?: string;
      userId?: string | null;
      sessionId?: string;
      scope?: string;
      mode?: string;
    };

    const message =
      typeof body.message === "string" ? body.message.trim() : "";
    const rawProjectId = body.projectId;
    const projectId =
      typeof rawProjectId === "string" && rawProjectId.trim() !== ""
        ? rawProjectId.trim()
        : null;
    const userId =
      typeof body.userId === "string" && body.userId.trim() !== ""
        ? body.userId.trim()
        : null;

    // For global project resolution and platform metrics, ensure we have a user (fallback from request auth)
    let effectiveUserId: string | null = userId;
    if (!effectiveUserId && (body.mode === "global" || !body.projectId)) {
      effectiveUserId = await getCurrentUserIdFromRequest(req);
    }
    if (effectiveUserId && !userId) {
      effectiveUserId = effectiveUserId.trim() || null;
    }

    const accessToken = await getAccessTokenFromRequest(req);

    if (!message) {
      return NextResponse.json(
        {
          error: "Faltan campos obligatorios: message debe ser un texto no vacío.",
        },
        { status: 400 }
      );
    }

    const sessionId =
      typeof body.sessionId === "string" && body.sessionId.trim()
        ? body.sessionId.trim()
        : "no-session";
    const scopeParam = typeof body.scope === "string" ? body.scope : undefined;
    const modeParam = body.mode === "global" || body.mode === "project" ? body.mode : undefined;

    // PART 1: mode = global | project (explicit or derived). Strict: project requires projectId; global never uses projectId for retrieval.
    const mode: SapitoMode =
      modeParam ?? (projectId != null ? "project" : "global");

    if (mode === "project" && !projectId) {
      return NextResponse.json(
        { error: "En modo proyecto se requiere projectId." },
        { status: 400 }
      );
    }

    const effectiveProjectId = mode === "global" ? null : projectId;

    // In project mode, enforce use_project_ai before loading any project data.
    if (mode === "project" && effectiveProjectId) {
      const authResult = await requireAuthAndProjectPermission(req, effectiveProjectId, "use_project_ai");
      if (authResult instanceof NextResponse) return authResult;
    }
    // Global mode: require authentication and use_global_ai.
    if (mode === "global") {
      const authResult = await requireAuthAndGlobalPermission(req, "use_global_ai");
      if (authResult instanceof NextResponse) return authResult;
      effectiveUserId = authResult.userId;
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[Sapito guard entered]", {
        endpoint: "/api/project-agent",
        mode,
        message: message.slice(0, 100),
        projectId: effectiveProjectId ?? null,
      });
    }

    let sapIntent = classifySapIntent(message, effectiveProjectId ?? undefined);
    // Ensure project-status questions in project mode never get generic (so we use PROJECT prompt and inject context).
    if (mode === "project" && effectiveProjectId && sapIntent === "generic" && isProjectStatusQuestion(message)) {
      sapIntent = "project_status";
    }
    const includeWorkspaceSummary = shouldIncludeWorkspaceSummary(sapIntent);

    let context: AgentContext;
    let retrievalScopes: string[] = [];
    let resolvedProjectId: string | null = null;
    let resolvedProjectTitle: string | null = null;

    if (mode === "project" && effectiveProjectId) {
      try {
        const [stats, notesResult, linksResult, resolverResult] =
          await Promise.all([
            getProjectStats(effectiveProjectId),
            getProjectNotes(effectiveProjectId, NOTES_LIMIT),
            getProjectLinks(effectiveProjectId, LINKS_LIMIT),
            resolveProjectContext({
              projectId: effectiveProjectId,
              userId,
              message,
              sapIntent,
              accessToken: accessToken ?? undefined,
            }),
          ]);
        const { contextText: sapitoContextSummary, retrievalDebug, retrievalScopes: scopes } = resolverResult;
        retrievalScopes = scopes;
        const isProjectHistory = isProjectHistoryQuestion(message);
        context = {
          projectId: effectiveProjectId,
          stats,
          notes: notesResult.notes,
          links: linksResult.links,
          mode: "project",
          sapitoContextSummary: sapitoContextSummary ?? "",
          sapIntent,
          retrievalDebug: retrievalDebug ?? { chunkCount: 0, documentTitles: [], usedRetrieval: false },
          isProjectHistoryQuestion: isProjectHistory,
        };

        if (process.env.NODE_ENV === "development") {
          console.log("[Sapito project-history guard]", {
            message: message.slice(0, 120),
            isProjectHistoryQuestion: isProjectHistory,
            matchedRule: getProjectHistoryMatchReason(message) ?? undefined,
            retrievalScopes,
            hasProjectEvidence: hasProjectEvidence(retrievalScopes),
            hasStrongProjectHistoryEvidence: hasStrongProjectHistoryEvidence(retrievalScopes),
          });
        }

        if (isProjectHistory && !hasStrongProjectHistoryEvidence(retrievalScopes)) {
          if (process.env.NODE_ENV === "development") {
            console.log("[Sapito guard fallback returned]", { message: message.slice(0, 80) });
          }
          const hint =
            stats != null
              ? `En este proyecto hay ${stats.total_notes ?? 0} notas registradas${(stats.error_notes ?? 0) > 0 ? ` y ${stats.error_notes} notas con error` : ""}. `
              : "";
          const reply = `No he encontrado aún evidencia documentada específica del proyecto sobre problemas resueltos, decisiones o soluciones anteriores.

${hint}Te sugiero revisar:
- Notas del proyecto
- Tickets
- Actividades y tareas
- Entradas de conocimiento

Si documentas la solución o la decisión, Sapito podrá usarla la próxima vez.`;
          return NextResponse.json({ reply, grounded: false });
        }
      } catch (err) {
        if (err instanceof ProjectNotFoundError) {
          return NextResponse.json(
            { error: "Proyecto no encontrado." },
            { status: 404 }
          );
        }
        throw err;
      }
    } else {
      // Global mode: handle project-specific and ambiguous project questions
      const projectName = extractProjectNameFromMessage(message);
      const ambiguousProject = isAmbiguousProjectQuestion(message) && !projectName;

      if (ambiguousProject) {
        if (process.env.NODE_ENV === "development") {
          console.log("[Sapito global] ambiguous project question, asking clarification");
        }
        const reply =
          "¿Sobre qué proyecto quieres el resumen? Indica el nombre del proyecto (por ejemplo: \"Resumen del proyecto Sauleda\") o abre un proyecto y pregunta desde ahí.";
        return NextResponse.json({ reply, grounded: false });
      }

      let resolvedProjectSummary: string | null = null;

      if (projectName) {
        const result = await resolveProjectByName(effectiveUserId ?? null, projectName);
        if (process.env.NODE_ENV === "development" && "debug" in result && result.debug) {
          const d = result.debug;
          console.log("[Global project resolution debug]", {
            originalMessage: message,
            detectedIntent: sapIntent,
            userId: userId ? `${userId.slice(0, 8)}…` : null,
            effectiveUserId: effectiveUserId ? `${effectiveUserId.slice(0, 8)}…` : null,
            extractedProjectName: projectName,
            accessibleProjectIdsCount: d.accessibleProjectIdsCount,
            accessibleProjectNamesFull: d.accessibleProjectNamesFull,
            normalizedExtractedName: d.normalizedExtractedName,
            normalizedAccessibleProjectNames: d.normalizedAccessibleProjectNames,
            matchStrategyUsed: d.matchStrategyUsed,
            matchResult: d.matchResult,
            matchedProjectId: d.matchedProjectId,
            matchedProjectTitle: d.matchedProjectTitle,
          });
        }
        if (result.kind === "none") {
          if (process.env.NODE_ENV === "development") {
            console.log("[Sapito global] no project match", projectName);
          }
          const reply =
            "No encontré ningún proyecto con ese nombre en tu workspace. Comprueba el nombre o abre el proyecto y pregunta desde ahí.";
          return NextResponse.json({ reply, grounded: false });
        }
        if (result.kind === "multiple") {
          if (process.env.NODE_ENV === "development") {
            console.log("[Sapito global] multiple projects match", result.projectNames);
          }
          const list = result.projectNames.slice(0, 5).join(", ");
          const reply =
            `Hay más de un proyecto que podría coincidir: ${list}. Indica el nombre completo del proyecto o abre el que quieras y pregunta desde ahí.`;
          return NextResponse.json({ reply, grounded: false });
        }
        const resolved = result.project;
        resolvedProjectId = resolved.projectId;
        resolvedProjectTitle = resolved.projectName;
        const metrics = await getProjectMetrics(resolved.projectId, effectiveUserId ?? null);
        if (metrics) {
          resolvedProjectSummary = [
            "Resumen del proyecto (solicitado por nombre):",
            `Proyecto: ${resolved.projectName} (${resolved.projectId}).`,
            `- Tareas abiertas: ${metrics.openTasks}`,
            `- Tareas vencidas: ${metrics.overdueTasks}`,
            `- Tareas bloqueadas: ${metrics.blockedTasks}`,
            `- Tickets abiertos: ${metrics.openTickets}`,
            `- Tickets alta prioridad: ${metrics.highPriorityTickets}`,
            `- Actividades vencidas: ${metrics.overdueActivities}`,
            `- Actividades próximas: ${metrics.upcomingActivities}`,
          ].join("\n");
        }
      }

      const notesVariant = scopeParam === "notes" || scopeParam === "global-notes";
      const resolverResult = await resolveGlobalContext({
        message,
        sapIntent,
        notesVariant,
        userId: effectiveUserId ?? undefined,
        accessToken: accessToken ?? undefined,
      });
      const { contextText: sapitoContextSummary, retrievalDebug, retrievalScopes: scopes } = resolverResult;
      retrievalScopes = scopes;
      const combinedSummary =
        resolvedProjectSummary != null
          ? resolvedProjectSummary + "\n\n" + (sapitoContextSummary ?? "")
          : sapitoContextSummary ?? "";
      if (resolvedProjectId && process.env.NODE_ENV === "development") {
        console.log("[Sapito global] resolved project for question", {
          resolvedProjectId,
          resolvedProjectTitle,
          usedProjectMetrics: !!resolvedProjectSummary,
        });
      }
      context = {
        projectId: null,
        stats: null,
        notes: [],
        links: [],
        mode: notesVariant ? "notes" : "global",
        sapitoContextSummary: combinedSummary,
        sapIntent,
        retrievalDebug: retrievalDebug ?? { chunkCount: 0, documentTitles: [], usedRetrieval: false },
      };
    }

    console.log("[Sapito mode routing]", {
      mode,
      userId: userId ?? null,
      projectId: effectiveProjectId ?? null,
      intent: sapIntent,
      workspaceContextIncluded: includeWorkspaceSummary,
      retrievalScopes,
    });

    if (process.env.NODE_ENV === "development") {
      console.log("[Sapito retrieval]", {
        userId: effectiveUserId ?? null,
        mode,
        projectId: effectiveProjectId ?? null,
        retrievalScopes,
        query: message,
      });
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[Sapito diagnostics]", {
        mode,
        detectedIntent: sapIntent,
        workspaceMetricsUsed: retrievalScopes.includes("platform_summary"),
        projectMetricsUsed: retrievalScopes.includes("project_summary") || !!resolvedProjectId,
        resolvedProjectId: resolvedProjectId ?? null,
        resolvedProjectTitle: resolvedProjectTitle ?? null,
        groundingSource: getGroundingLabel(retrievalScopes, resolvedProjectTitle),
        userIdFromBody: userId ?? null,
        effectiveUserId: effectiveUserId ?? null,
      });
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[Sapito LLM called]", { mode, message: message.slice(0, 80) });
    }
    const reply = await runProjectAgent({
      message,
      context,
      sessionId,
    });

    try {
      const { error: logError } = await supabaseAdmin
        .from("conversation_logs")
        .insert({
          project_id: effectiveProjectId ?? null,
          user_id: effectiveUserId ?? "00000000-0000-0000-0000-000000000000",
          mode: mode === "project" ? "project" : "global",
          user_message: message,
          assistant_reply: reply,
        });
      if (logError) {
        console.error(
          "project-agent conversation_logs insert failed",
          logError.message ?? logError
        );
      }
    } catch (logErr) {
      console.error(
        "project-agent conversation_logs insert failed",
        logErr instanceof Error ? logErr.message : logErr
      );
    }

    console.log("project-agent success");
    const groundingLabel = getGroundingLabel(retrievalScopes, resolvedProjectTitle);
    const payload: { reply: string; grounded?: boolean; groundingLabel?: string; debug?: RetrievalDebug } = {
      reply,
      grounded: (context.retrievalDebug?.usedRetrieval ?? false) === true,
      groundingLabel,
    };
    if (process.env.NODE_ENV === "development" && context.retrievalDebug) {
      payload.debug = context.retrievalDebug;
    }
    return NextResponse.json(payload);
  } catch (err) {
    console.error("project-agent API error", err);
    return NextResponse.json(
      {
        error:
          "Ha ocurrido un error al procesar la solicitud del asistente.",
      },
      { status: 500 }
    );
  }
}
