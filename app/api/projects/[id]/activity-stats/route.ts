import { NextResponse } from "next/server";
import { getProjectActivityStats } from "@/lib/services/projectService";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/activity-stats
 * Activity stats for the project. Requires view_project_activities.
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

    const auth = await requireAuthAndProjectPermission(req, projectId, "view_project_activities");
    if (auth instanceof NextResponse) return auth;

    const result = await getProjectActivityStats(projectId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("projects/[id]/activity-stats GET error", err);
    return NextResponse.json(
      {
        error: "Failed to load activity stats",
        details: message,
      },
      { status: 500 }
    );
  }
}
