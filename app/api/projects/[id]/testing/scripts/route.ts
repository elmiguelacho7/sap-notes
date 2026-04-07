import { NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import { buildCreateInput } from "@/app/api/projects/[id]/testing/scripts/parseBody";
import { createTestScript, listTestScriptsForProject } from "@/lib/services/testingService";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    if (!projectId?.trim()) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const auth = await requireAuthAndProjectPermission(req, projectId, "view_project");
    if (auth instanceof NextResponse) return auth;

    const data = await listTestScriptsForProject(projectId);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("testing/scripts GET", err);
    return NextResponse.json({ error: "Failed to list test scripts", details: message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  let projectIdForLog = "";
  try {
    const { id: projectId } = await params;
    projectIdForLog = projectId ?? "";
    if (!projectId?.trim()) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const auth = await requireAuthAndProjectPermission(req, projectId, "edit_project");
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const input = buildCreateInput(body);

    const script = await createTestScript(projectId, userId, input);
    return NextResponse.json(script, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const stack = err instanceof Error ? err.stack : undefined;
    if (message.includes("required")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[testing/scripts POST] create failed", {
      projectId: projectIdForLog,
      message,
      stack,
      cause: err instanceof Error && "cause" in err ? String((err as Error & { cause?: unknown }).cause) : undefined,
    });
    return NextResponse.json(
      { error: "Failed to create test script", code: "create_test_script_failed" },
      { status: 500 }
    );
  }
}
