import { NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import { patchCycleScriptMember, removeScriptFromCycle } from "@/lib/services/testingService";

type RouteParams = { params: Promise<unknown> };

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId, cycleId, scriptId } = (await params) as {
      id: string;
      cycleId: string;
      scriptId: string;
    };
    if (!projectId?.trim() || !cycleId?.trim() || !scriptId?.trim()) {
      return NextResponse.json({ error: "Project, cycle, and script IDs are required" }, { status: 400 });
    }
    const auth = await requireAuthAndProjectPermission(req, projectId, "edit_project");
    if (auth instanceof NextResponse) return auth;
    await removeScriptFromCycle(projectId, cycleId, scriptId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("testing/cycle script DELETE", err);
    return NextResponse.json({ error: "Failed to remove script from cycle", details: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId, cycleId, scriptId } = (await params) as {
      id: string;
      cycleId: string;
      scriptId: string;
    };
    if (!projectId?.trim() || !cycleId?.trim() || !scriptId?.trim()) {
      return NextResponse.json({ error: "Project, cycle, and script IDs are required" }, { status: 400 });
    }
    const auth = await requireAuthAndProjectPermission(req, projectId, "edit_project");
    if (auth instanceof NextResponse) return auth;
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const member = await patchCycleScriptMember(projectId, cycleId, scriptId, {
      assignee_profile_id:
        "assignee_profile_id" in body
          ? typeof body.assignee_profile_id === "string"
            ? body.assignee_profile_id
            : null
          : undefined,
      priority: "priority" in body ? (typeof body.priority === "string" ? body.priority : null) : undefined,
      notes: "notes" in body ? (typeof body.notes === "string" ? body.notes : null) : undefined,
      status_override:
        "status_override" in body
          ? typeof body.status_override === "string"
            ? body.status_override
            : null
          : undefined,
    });
    return NextResponse.json(member);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("testing/cycle script PATCH", err);
    return NextResponse.json({ error: "Failed to update cycle script", details: message }, { status: 500 });
  }
}
