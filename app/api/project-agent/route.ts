import { NextResponse } from "next/server";
import { runProjectAgent, type AgentContext } from "@/lib/langchain/projectAgent";
import {
  getProjectStats,
  getProjectNotes,
  getProjectLinks,
  ProjectNotFoundError,
} from "@/lib/services/projectService";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildSapitoContext, type SapitoScope } from "@/lib/ai/sapitoContext";

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

    // Sapito Brain v1: determine scope for context (global | project | notes)
    const scope: SapitoScope =
      projectId != null
        ? "project"
        : scopeParam === "notes" || scopeParam === "global-notes"
          ? "notes"
          : "global";

    let context: AgentContext;

    if (projectId) {
      try {
        const [stats, notesResult, linksResult, sapitoContextSummary] =
          await Promise.all([
            getProjectStats(projectId),
            getProjectNotes(projectId, NOTES_LIMIT),
            getProjectLinks(projectId, LINKS_LIMIT),
            buildSapitoContext({ scope: "project", projectId, message }),
          ]);
        context = {
          projectId,
          stats,
          notes: notesResult.notes,
          links: linksResult.links,
          mode: "project",
          sapitoContextSummary: sapitoContextSummary ?? "",
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
      console.log("project-agent API hit", {
        projectId,
        sessionId,
        scope,
        mode: "project",
      });
    } else if (scope === "notes") {
      const sapitoContextSummary = await buildSapitoContext({
        scope: "notes",
        message,
      });
      context = {
        projectId: null,
        stats: null,
        notes: [],
        links: [],
        mode: "notes",
        sapitoContextSummary: sapitoContextSummary ?? "",
      };
      console.log("project-agent API hit", { sessionId, scope, mode: "notes" });
    } else {
      const sapitoContextSummary = await buildSapitoContext({
        scope: "global",
        message,
      });
      context = {
        projectId: null,
        stats: null,
        notes: [],
        links: [],
        mode: "global",
        sapitoContextSummary: sapitoContextSummary ?? "",
      };
      console.log("project-agent API hit", {
        sessionId,
        scope,
        mode: "global",
      });
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
          project_id: projectId ?? null,
          user_id: userId ?? "00000000-0000-0000-0000-000000000000",
          mode: projectId ? "project" : "global",
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
    return NextResponse.json({ reply });
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
