import { NextResponse } from "next/server";
import { createKnowledgeEntry } from "@/lib/services/knowledgeService";
import {
  getProjectKnowledgeNotes,
  ProjectNotFoundError,
} from "@/lib/services/projectService";

type RouteParams = { params: Promise<{ id: string }> };

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

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

    const url = new URL(req.url);
    const limit = parseLimit(url.searchParams);

    const result = await getProjectKnowledgeNotes(projectId, limit);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ProjectNotFoundError) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("projects/[id]/knowledge GET error", err);
    return NextResponse.json(
      { error: "Failed to load knowledge notes", details: message },
      { status: 500 }
    );
  }
}

type PostBody = {
  userId?: unknown;
  title?: unknown;
  content?: unknown;
  module?: unknown;
  scopeItem?: unknown;
  topicType?: unknown;
  source?: unknown;
  sourceRef?: unknown;
};

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s === "" ? null : s;
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

    let body: PostBody;
    try {
      body = (await req.json()) as PostBody;
    } catch {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: "Request body must be valid JSON.",
        },
        { status: 400 }
      );
    }

    const userId = nonEmptyString(body.userId);
    const title = nonEmptyString(body.title);
    const content = nonEmptyString(body.content);
    const topicType = nonEmptyString(body.topicType);
    const source = nonEmptyString(body.source);

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required and must be a non-empty string." },
        { status: 400 }
      );
    }
    if (!title) {
      return NextResponse.json(
        { error: "title is required and must be a non-empty string." },
        { status: 400 }
      );
    }
    if (!content) {
      return NextResponse.json(
        { error: "content is required and must be a non-empty string." },
        { status: 400 }
      );
    }
    if (!topicType) {
      return NextResponse.json(
        { error: "topicType is required and must be a non-empty string." },
        { status: 400 }
      );
    }
    if (!source) {
      return NextResponse.json(
        { error: "source is required and must be a non-empty string." },
        { status: 400 }
      );
    }

    const moduleVal =
      body.module != null && body.module !== ""
        ? nonEmptyString(body.module)
        : null;
    const scopeItemVal =
      body.scopeItem != null && body.scopeItem !== ""
        ? nonEmptyString(body.scopeItem)
        : null;
    const sourceRefVal =
      body.sourceRef != null && body.sourceRef !== ""
        ? nonEmptyString(body.sourceRef)
        : null;

    const entry = await createKnowledgeEntry({
      projectId,
      userId,
      title,
      content,
      module: moduleVal,
      scopeItem: scopeItemVal,
      topicType,
      source,
      sourceRef: sourceRefVal,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("projects/[id]/knowledge POST error", err);
    return NextResponse.json(
      {
        error: "Failed to create knowledge entry",
        details: message,
      },
      { status: 500 }
    );
  }
}
