import { NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import { createTestExecutionEvidence, listEvidenceForExecution, type CreateEvidenceInput } from "@/lib/services/testingService";

type RouteParams = { params: Promise<unknown> };

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId, executionId } = (await params) as { id: string; executionId: string };
    if (!projectId?.trim() || !executionId?.trim()) {
      return NextResponse.json({ error: "Project ID and execution ID are required" }, { status: 400 });
    }
    const auth = await requireAuthAndProjectPermission(req, projectId, "view_project");
    if (auth instanceof NextResponse) return auth;
    const evidence = await listEvidenceForExecution(projectId, executionId);
    return NextResponse.json({ evidence });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("testing/evidence GET", err);
    return NextResponse.json({ error: "Failed to list evidence", details: message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId, executionId } = (await params) as { id: string; executionId: string };
    if (!projectId?.trim() || !executionId?.trim()) {
      return NextResponse.json({ error: "Project ID and execution ID are required" }, { status: 400 });
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
    const input: CreateEvidenceInput = {
      type: typeof body.type === "string" ? body.type : "",
      title: typeof body.title === "string" ? body.title : null,
      description: typeof body.description === "string" ? body.description : null,
      file_path: typeof body.file_path === "string" ? body.file_path : null,
      file_name: typeof body.file_name === "string" ? body.file_name : null,
      mime_type: typeof body.mime_type === "string" ? body.mime_type : null,
      sap_reference: typeof body.sap_reference === "string" ? body.sap_reference : null,
      external_url: typeof body.external_url === "string" ? body.external_url : null,
    };
    const row = await createTestExecutionEvidence(projectId, executionId, userId, input);
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found") || message.includes("Invalid")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("testing/evidence POST", err);
    return NextResponse.json({ error: "Failed to add evidence", details: message }, { status: 500 });
  }
}
