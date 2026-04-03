import { NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import {
  deleteTestScript,
  getTestScript,
  updateTestScript,
  type StepPatch,
  type UpdateTestScriptInput,
} from "@/lib/services/testingService";

type RouteParams = { params: Promise<{ id: string; scriptId: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId, scriptId } = await params;
    if (!projectId?.trim() || !scriptId?.trim()) {
      return NextResponse.json({ error: "Project ID and script ID are required" }, { status: 400 });
    }

    const auth = await requireAuthAndProjectPermission(req, projectId, "view_project");
    if (auth instanceof NextResponse) return auth;

    const script = await getTestScript(projectId, scriptId);
    return NextResponse.json(script);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("testing/scripts/[scriptId] GET", err);
    return NextResponse.json({ error: "Failed to load test script", details: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId, scriptId } = await params;
    if (!projectId?.trim() || !scriptId?.trim()) {
      return NextResponse.json({ error: "Project ID and script ID are required" }, { status: 400 });
    }

    const auth = await requireAuthAndProjectPermission(req, projectId, "edit_project");
    if (auth instanceof NextResponse) return auth;

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const patch: UpdateTestScriptInput = {};
    if (typeof body.title === "string") patch.title = body.title;
    if ("objective" in body) patch.objective = typeof body.objective === "string" ? body.objective : null;
    if ("module" in body) patch.module = typeof body.module === "string" ? body.module : null;
    if (typeof body.test_type === "string") patch.test_type = body.test_type;
    if ("priority" in body) patch.priority = typeof body.priority === "string" ? body.priority : null;
    if (typeof body.status === "string") patch.status = body.status;
    if ("preconditions" in body) {
      patch.preconditions = typeof body.preconditions === "string" ? body.preconditions : null;
    }
    if ("test_data" in body) patch.test_data = typeof body.test_data === "string" ? body.test_data : null;
    if ("expected_result" in body) {
      patch.expected_result = typeof body.expected_result === "string" ? body.expected_result : null;
    }
    if ("related_task_id" in body) {
      patch.related_task_id = typeof body.related_task_id === "string" ? body.related_task_id : null;
    }
    if ("related_ticket_id" in body) {
      patch.related_ticket_id = typeof body.related_ticket_id === "string" ? body.related_ticket_id : null;
    }
    if ("related_knowledge_page_id" in body) {
      patch.related_knowledge_page_id =
        typeof body.related_knowledge_page_id === "string" ? body.related_knowledge_page_id : null;
    }

    let steps: StepPatch[] | null | undefined;
    if (Array.isArray(body.steps)) {
      steps = body.steps.map((s, i) => {
        const o = s as Record<string, unknown>;
        return {
          id: typeof o.id === "string" ? o.id : null,
          step_order: typeof o.step_order === "number" ? o.step_order : i,
          instruction: typeof o.instruction === "string" ? o.instruction : "",
          expected_result: typeof o.expected_result === "string" ? o.expected_result : null,
        };
      });
    }

    const script = await updateTestScript(projectId, scriptId, patch, steps ?? null);
    return NextResponse.json(script);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes("related_") || message.includes("title")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("testing/scripts/[scriptId] PATCH", err);
    return NextResponse.json({ error: "Failed to update test script", details: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId, scriptId } = await params;
    if (!projectId?.trim() || !scriptId?.trim()) {
      return NextResponse.json({ error: "Project ID and script ID are required" }, { status: 400 });
    }

    const auth = await requireAuthAndProjectPermission(req, projectId, "edit_project");
    if (auth instanceof NextResponse) return auth;

    await deleteTestScript(projectId, scriptId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("testing/scripts/[scriptId] DELETE", err);
    return NextResponse.json({ error: "Failed to delete test script", details: message }, { status: 500 });
  }
}
