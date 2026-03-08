import { NextResponse } from "next/server";
import {
  getProjectSources,
  createProjectSource,
  ProjectNotFoundError,
  type CreateProjectSourcePayload,
} from "@/lib/services/projectService";
import { getCurrentUserIdFromRequest } from "@/lib/auth/serverAuth";

export type { ProjectSourceSummary } from "@/lib/services/projectService";

type RouteParams = { params: Promise<{ id: string }> };

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

const SOURCE_TYPES = [
  "google_drive_folder",
  "google_drive_file",
  "sap_help",
  "official_web",
  "sharepoint_library",
  "confluence_space",
  "jira_project",
  "web_url",
  "manual_upload",
] as const;

function parseLimit(searchParams: URLSearchParams): number {
  const raw = searchParams.get("limit");
  if (raw == null || raw === "") return DEFAULT_LIMIT;
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function isValidSourceType(t: unknown): t is (typeof SOURCE_TYPES)[number] {
  return typeof t === "string" && SOURCE_TYPES.includes(t as (typeof SOURCE_TYPES)[number]);
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;

    if (!projectId?.trim()) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const limit = parseLimit(url.searchParams);

    const result = await getProjectSources(projectId, limit);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ProjectNotFoundError) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("projects/[id]/sources GET error", err);
    return NextResponse.json(
      { error: "Failed to load project sources", details: message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;

    if (!projectId?.trim()) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Invalid body", details: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json(
        { error: "Invalid data", details: "name is required and must be a non-empty string." },
        { status: 400 }
      );
    }

    if (!isValidSourceType(body.source_type)) {
      return NextResponse.json(
        {
          error: "Invalid data",
          details: `source_type must be one of: ${SOURCE_TYPES.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const payload: CreateProjectSourcePayload = {
      name,
      source_type: body.source_type as (typeof SOURCE_TYPES)[number],
      source_url: typeof body.source_url === "string" ? body.source_url.trim() || null : null,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      external_id: typeof body.external_id === "string" ? body.external_id.trim() || null : null,
      integration_id: typeof body.integration_id === "string" ? body.integration_id.trim() || null : null,
      sync_enabled: typeof body.sync_enabled === "boolean" ? body.sync_enabled : false,
    };

    const createdBy = await getCurrentUserIdFromRequest(req);

    const result = await createProjectSource(projectId, payload, createdBy);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ProjectNotFoundError) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("projects/[id]/sources POST error", err);
    return NextResponse.json(
      { error: "Failed to create project source", details: message },
      { status: 500 }
    );
  }
}
