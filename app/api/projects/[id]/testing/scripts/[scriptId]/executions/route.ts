import { NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import { createTestExecution, listExecutionsForScript, type CreateExecutionInput } from "@/lib/services/testingService";

type RouteParams = { params: Promise<{ id: string; scriptId: string }> };

function parseLimit(searchParams: URLSearchParams): number {
  const raw = searchParams.get("limit");
  if (raw == null || raw === "") return 50;
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1) return 50;
  return Math.min(n, 100);
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId, scriptId } = await params;
    if (!projectId?.trim() || !scriptId?.trim()) {
      return NextResponse.json({ error: "Project ID and script ID are required" }, { status: 400 });
    }

    const auth = await requireAuthAndProjectPermission(req, projectId, "view_project");
    if (auth instanceof NextResponse) return auth;

    const url = new URL(req.url);
    const limit = parseLimit(url.searchParams);
    const executions = await listExecutionsForScript(projectId, scriptId, limit);
    return NextResponse.json({ executions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("testing/executions GET", err);
    return NextResponse.json({ error: "Failed to list executions", details: message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId, scriptId } = await params;
    if (!projectId?.trim() || !scriptId?.trim()) {
      return NextResponse.json({ error: "Project ID and script ID are required" }, { status: 400 });
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

    const input: CreateExecutionInput = {
      result: typeof body.result === "string" ? body.result : "not_run",
      actual_result: typeof body.actual_result === "string" ? body.actual_result : null,
      evidence_notes: typeof body.evidence_notes === "string" ? body.evidence_notes : null,
      defect_ticket_id: typeof body.defect_ticket_id === "string" ? body.defect_ticket_id : null,
    };

    const execution = await createTestExecution(projectId, scriptId, userId, input);
    return NextResponse.json(execution, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes("defect_ticket")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("testing/executions POST", err);
    return NextResponse.json({ error: "Failed to record execution", details: message }, { status: 500 });
  }
}
