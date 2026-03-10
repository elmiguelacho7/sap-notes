import { NextResponse } from "next/server";
import { getProjectMemory, ProjectNotFoundError } from "@/lib/services/projectService";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireProjectAccess } from "@/lib/auth/serverAuth";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;

    if (!projectId?.trim()) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    const access = await requireProjectAccess(req, projectId);
    if ("error" in access) {
      if (access.error === "unauthorized") {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: "You do not have access to this project" },
        { status: 403 }
      );
    }

    const { projectId: _pid, memories } = await getProjectMemory(projectId);

    const { data: projectRow } = await supabaseAdmin
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single();

    const projectName = (projectRow as { name?: string } | null)?.name ?? null;

    return NextResponse.json({
      projectId: _pid,
      projectName,
      memories,
    });
  } catch (err) {
    if (err instanceof ProjectNotFoundError) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("projects/[id]/brain GET error", err);
    return NextResponse.json(
      { error: "Failed to load project brain", details: message },
      { status: 500 }
    );
  }
}
