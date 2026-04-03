import { NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import {
  createTestScript,
  listTestScriptsForProject,
  type CreateTestScriptInput,
} from "@/lib/services/testingService";

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
  try {
    const { id: projectId } = await params;
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

    const stepsRaw = body.steps;
    const steps =
      Array.isArray(stepsRaw)
        ? stepsRaw.map((s) => {
            const o = s as Record<string, unknown>;
            return {
              instruction: typeof o.instruction === "string" ? o.instruction : "",
              expected_result: typeof o.expected_result === "string" ? o.expected_result : null,
            };
          })
        : undefined;

    const input: CreateTestScriptInput = {
      title: typeof body.title === "string" ? body.title : "",
      objective: typeof body.objective === "string" ? body.objective : null,
      module: typeof body.module === "string" ? body.module : null,
      test_type: typeof body.test_type === "string" ? body.test_type : null,
      priority: typeof body.priority === "string" ? body.priority : null,
      status: typeof body.status === "string" ? body.status : null,
      preconditions: typeof body.preconditions === "string" ? body.preconditions : null,
      test_data: typeof body.test_data === "string" ? body.test_data : null,
      expected_result: typeof body.expected_result === "string" ? body.expected_result : null,
      related_task_id: typeof body.related_task_id === "string" ? body.related_task_id : null,
      related_ticket_id: typeof body.related_ticket_id === "string" ? body.related_ticket_id : null,
      related_knowledge_page_id:
        typeof body.related_knowledge_page_id === "string" ? body.related_knowledge_page_id : null,
      steps,
    };

    const script = await createTestScript(projectId, userId, input);
    return NextResponse.json(script, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("required")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("testing/scripts POST", err);
    return NextResponse.json({ error: "Failed to create test script", details: message }, { status: 500 });
  }
}
