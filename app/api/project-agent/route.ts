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
import { classifySapIntent, shouldIncludeWorkspaceSummary } from "@/lib/ai/sapitoIntent";

/** Assistant mode: global (SAP Copilot) or project (Project Copilot). Single engine, behavior by mode. */
export type SapitoMode = "global" | "project";

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

    const sapIntent = classifySapIntent(message);
    const includeWorkspaceSummary = shouldIncludeWorkspaceSummary(sapIntent);

    let context: AgentContext;
    let retrievalScopes: string[] = [];

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
            }),
          ]);
        const { contextText: sapitoContextSummary, retrievalDebug, retrievalScopes: scopes } = resolverResult;
        retrievalScopes = scopes;
        context = {
          projectId: effectiveProjectId,
          stats,
          notes: notesResult.notes,
          links: linksResult.links,
          mode: "project",
          sapitoContextSummary: sapitoContextSummary ?? "",
          sapIntent,
          retrievalDebug: retrievalDebug ?? { chunkCount: 0, documentTitles: [], usedRetrieval: false },
        };
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
      const notesVariant = scopeParam === "notes" || scopeParam === "global-notes";
      const resolverResult = await resolveGlobalContext({
        message,
        sapIntent,
        notesVariant,
      });
      const { contextText: sapitoContextSummary, retrievalDebug, retrievalScopes: scopes } = resolverResult;
      retrievalScopes = scopes;
      context = {
        projectId: null,
        stats: null,
        notes: [],
        links: [],
        mode: notesVariant ? "notes" : "global",
        sapitoContextSummary: sapitoContextSummary ?? "",
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
          user_id: userId ?? "00000000-0000-0000-0000-000000000000",
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
    const payload: { reply: string; grounded?: boolean; debug?: RetrievalDebug } = {
      reply,
      grounded: (context.retrievalDebug?.usedRetrieval ?? false) === true,
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
