import { NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import { parsePatchAndSteps } from "@/app/api/projects/[id]/testing/scripts/parseBody";
import { deleteTestScript, getTestScript, updateTestScript } from "@/lib/services/testingService";

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

    const { patch, steps } = parsePatchAndSteps(body);

    const script = await updateTestScript(projectId, scriptId, patch, steps);
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
