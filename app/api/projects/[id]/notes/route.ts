import { NextResponse } from "next/server";
import {
  getProjectNotes,
  createProjectNote,
  ProjectNotFoundError,
  type CreateNotePayload,
} from "@/lib/services/projectService";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import {
  extractKnowledgeFromNote,
  storeProjectMemory,
} from "@/lib/ai/projectMemory";
import {
  extractProjectMemoryFromNote,
  storeExtractedProjectMemory,
} from "@/lib/ai/projectMemoryExtractor";

export type { NoteSummary } from "@/lib/services/projectService";

type RouteParams = { params: Promise<{ id: string }> };

type PostBody = {
  title?: unknown;
  module?: unknown;
  scope_items?: unknown;
  body?: unknown;
  error_code?: unknown;
  web_link_1?: unknown;
  web_link_2?: unknown;
  extra_info?: unknown;
  is_knowledge_base?: unknown;
};

function toOptString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s === "" ? null : s;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function parseLimit(searchParams: URLSearchParams): number {
  const raw = searchParams.get("limit");
  if (raw == null || raw === "") return DEFAULT_LIMIT;
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;

    if (!projectId || String(projectId).trim() === "") {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    const auth = await requireAuthAndProjectPermission(req, projectId, "view_project_notes");
    if (auth instanceof NextResponse) return auth;

    const url = new URL(req.url);
    const limit = parseLimit(url.searchParams);

    const result = await getProjectNotes(projectId, limit);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ProjectNotFoundError) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("projects/[id]/notes GET error", err);
    return NextResponse.json(
      {
        error: "Failed to load project notes",
        details: message,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;

    if (!projectId || String(projectId).trim() === "") {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    const auth = await requireAuthAndProjectPermission(req, projectId, "create_project_notes");
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    let body: PostBody;
    try {
      body = (await req.json()) as PostBody;
    } catch {
      return NextResponse.json(
        {
          error: "Invalid note data",
          details: "Request body must be valid JSON.",
        },
        { status: 400 }
      );
    }

    const title = toOptString(body.title);
    if (!title) {
      return NextResponse.json(
        {
          error: "Invalid note data",
          details: "title is required and must be a non-empty string.",
        },
        { status: 400 }
      );
    }

    let scope_item: string | null = null;
    if (Array.isArray(body.scope_items)) {
      const parts = body.scope_items
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean);
      scope_item = parts.length > 0 ? parts.join(",") : null;
    }

    const isKnowledgeBase =
      body.is_knowledge_base === true || body.is_knowledge_base === "true";

    const payload: CreateNotePayload = {
      title,
      body: toOptString(body.body),
      module: toOptString(body.module),
      scope_item,
      error_code: toOptString(body.error_code),
      web_link_1: toOptString(body.web_link_1),
      web_link_2: toOptString(body.web_link_2),
      extra_info: toOptString(body.extra_info),
      is_knowledge_base: isKnowledgeBase,
    };

    const result = await createProjectNote(projectId, payload);

    const record = extractKnowledgeFromNote(
      payload.title,
      payload.body ?? null,
      payload.module ?? null
    );
    if (record.solution.trim()) {
      storeProjectMemory(projectId, userId ?? null, record, "project_note").catch((err) =>
        console.error("[notes] project memory store failed", err)
      );
    }

    const noteText = [payload.title, payload.body].filter(Boolean).join("\n\n");
    if (noteText.trim().length >= 10) {
      const noteId = result.note?.id ?? null;
      extractProjectMemoryFromNote(noteText)
        .then((items) => {
          if (items.length > 0) {
            return storeExtractedProjectMemory(
              projectId,
              "project_note",
              noteId,
              items
            );
          }
        })
        .catch((err) => console.error("[notes] project memory extraction failed", err));
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ProjectNotFoundError) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("projects/[id]/notes POST error", err);
    return NextResponse.json(
      {
        error: "Failed to create project note",
        details: message,
      },
      { status: 500 }
    );
  }
}
