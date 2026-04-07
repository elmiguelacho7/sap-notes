import { NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import { patchTestExecutionDefectTicket } from "@/lib/services/testingService";

type RouteParams = { params: Promise<{ id: string; executionId: string }> };

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId, executionId } = await params;
    if (!projectId?.trim() || !executionId?.trim()) {
      return NextResponse.json({ error: "Project ID and execution ID are required" }, { status: 400 });
    }

    const auth = await requireAuthAndProjectPermission(req, projectId, "edit_project");
    if (auth instanceof NextResponse) return auth;

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const defectTicketId = typeof body.defect_ticket_id === "string" ? body.defect_ticket_id.trim() : "";
    if (!defectTicketId) {
      return NextResponse.json({ error: "defect_ticket_id is required" }, { status: 400 });
    }

    const execution = await patchTestExecutionDefectTicket(projectId, executionId, defectTicketId);
    return NextResponse.json(execution);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes("defect_ticket")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("testing/executions/[executionId] PATCH", err);
    return NextResponse.json({ error: "Failed to update execution", details: message }, { status: 500 });
  }
}
