import { NextResponse } from "next/server";
import {
  getProjectStats,
  ProjectNotFoundError,
} from "@/lib/services/projectService";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/stats
 * Project stats (notes/tickets counts etc.). Requires view_project.
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;

    if (!projectId || String(projectId).trim() === "") {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    const auth = await requireAuthAndProjectPermission(req, projectId, "view_project");
    if (auth instanceof NextResponse) return auth;

    const result = await getProjectStats(projectId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ProjectNotFoundError) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("projects/[id]/stats GET error", err);
    return NextResponse.json(
      {
        error: "Failed to load project stats",
        details: message,
      },
      { status: 500 }
    );
  }
}
