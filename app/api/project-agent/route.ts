import { NextResponse } from "next/server";
import { runProjectAgent, type AgentContext } from "@/lib/langchain/projectAgent";
import {
  getProjectStats,
  getProjectNotes,
  getProjectLinks,
  ProjectNotFoundError,
} from "@/lib/services/projectService";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
    const scope = typeof body.scope === "string" ? body.scope : undefined;

    let context: AgentContext;

    if (projectId) {
      try {
        const [stats, notesResult, linksResult] = await Promise.all([
          getProjectStats(projectId),
          getProjectNotes(projectId, NOTES_LIMIT),
          getProjectLinks(projectId, LINKS_LIMIT),
        ]);
        context = {
          projectId,
          stats,
          notes: notesResult.notes,
          links: linksResult.links,
          mode: "project",
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
    } else {
      context = {
        projectId: null,
        stats: null,
        notes: [],
        links: [],
        mode: "global",
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
