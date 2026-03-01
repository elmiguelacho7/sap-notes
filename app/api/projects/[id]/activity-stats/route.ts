import { NextResponse } from "next/server";
import { getProjectActivityStats } from "@/lib/services/projectService";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;

    if (!projectId || String(projectId).trim() === "") {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

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
