import { NextResponse } from "next/server";
import {
  getProjectStats,
  ProjectNotFoundError,
} from "@/lib/services/projectService";

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
