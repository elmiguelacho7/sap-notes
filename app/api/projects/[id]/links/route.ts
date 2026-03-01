import { NextResponse } from "next/server";
import {
  getProjectLinks,
  createProjectLink,
  ProjectNotFoundError,
  type CreateLinkPayload,
} from "@/lib/services/projectService";

export type { ProjectLinkSummary } from "@/lib/services/projectService";

type RouteParams = { params: Promise<{ id: string }> };

type PostBody = {
  name?: unknown;
  url?: unknown;
  link_type?: unknown;
};

const DEFAULT_LINK_TYPE = "Otro";

const DEFAULT_LIMIT = 10;
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

    const result = await getProjectLinks(projectId, limit);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ProjectNotFoundError) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("projects/[id]/links GET error", err);
    return NextResponse.json(
      {
        error: "Failed to load project links",
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

    let body: PostBody;
    try {
      body = (await req.json()) as PostBody;
    } catch {
      return NextResponse.json(
        {
          error: "Invalid link data",
          details: "Request body must be valid JSON.",
        },
        { status: 400 }
      );
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const linkTypeRaw =
      body.link_type == null || body.link_type === ""
        ? DEFAULT_LINK_TYPE
        : typeof body.link_type === "string"
          ? body.link_type.trim() || DEFAULT_LINK_TYPE
          : DEFAULT_LINK_TYPE;

    if (!name) {
      return NextResponse.json(
        {
          error: "Invalid link data",
          details: "name is required and must be a non-empty string.",
        },
        { status: 400 }
      );
    }

    if (!url) {
      return NextResponse.json(
        {
          error: "Invalid link data",
          details: "url is required and must be a non-empty string.",
        },
        { status: 400 }
      );
    }

    if (!url.toLowerCase().startsWith("http")) {
      return NextResponse.json(
        {
          error: "Invalid link data",
          details: "url must start with http.",
        },
        { status: 400 }
      );
    }

    const payload: CreateLinkPayload = {
      name,
      url,
      link_type: linkTypeRaw,
    };

    const result = await createProjectLink(projectId, payload);

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ProjectNotFoundError) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("projects/[id]/links POST error", err);
    return NextResponse.json(
      {
        error: "Failed to create project link",
        details: message,
      },
      { status: 500 }
    );
  }
}
