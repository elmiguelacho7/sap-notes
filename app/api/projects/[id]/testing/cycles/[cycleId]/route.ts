import { NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import {
  archiveTestCycle,
  getTestCycleDetail,
  updateTestCycle,
  type UpdateTestCycleInput,
} from "@/lib/services/testingService";

type RouteParams = { params: Promise<unknown> };

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId, cycleId } = (await params) as { id: string; cycleId: string };
    if (!projectId?.trim() || !cycleId?.trim()) {
      return NextResponse.json({ error: "Project ID and cycle ID are required" }, { status: 400 });
    }
    const auth = await requireAuthAndProjectPermission(req, projectId, "view_project");
    if (auth instanceof NextResponse) return auth;
    const data = await getTestCycleDetail(projectId, cycleId);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("testing/cycles/[cycleId] GET", err);
    return NextResponse.json({ error: "Failed to load cycle", details: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId, cycleId } = (await params) as { id: string; cycleId: string };
    if (!projectId?.trim() || !cycleId?.trim()) {
      return NextResponse.json({ error: "Project ID and cycle ID are required" }, { status: 400 });
    }
    const auth = await requireAuthAndProjectPermission(req, projectId, "edit_project");
    if (auth instanceof NextResponse) return auth;
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const patch: UpdateTestCycleInput = {};
    if (typeof body.name === "string") patch.name = body.name;
    if ("description" in body) patch.description = typeof body.description === "string" ? body.description : null;
    if (typeof body.status === "string") patch.status = body.status;
    if ("owner_profile_id" in body) {
      patch.owner_profile_id = typeof body.owner_profile_id === "string" ? body.owner_profile_id : null;
    }
    if ("planned_start_date" in body) {
      patch.planned_start_date = typeof body.planned_start_date === "string" ? body.planned_start_date : null;
    }
    if ("planned_end_date" in body) {
      patch.planned_end_date = typeof body.planned_end_date === "string" ? body.planned_end_date : null;
    }
    if ("actual_start_at" in body) {
      patch.actual_start_at = typeof body.actual_start_at === "string" ? body.actual_start_at : null;
    }
    if ("actual_end_at" in body) {
      patch.actual_end_at = typeof body.actual_end_at === "string" ? body.actual_end_at : null;
    }
    if ("goal" in body) patch.goal = typeof body.goal === "string" ? body.goal : null;
    if ("scope_summary" in body) {
      patch.scope_summary = typeof body.scope_summary === "string" ? body.scope_summary : null;
    }
    const cycle = await updateTestCycle(projectId, cycleId, patch);
    return NextResponse.json(cycle);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("testing/cycles/[cycleId] PATCH", err);
    return NextResponse.json({ error: "Failed to update cycle", details: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId, cycleId } = (await params) as { id: string; cycleId: string };
    if (!projectId?.trim() || !cycleId?.trim()) {
      return NextResponse.json({ error: "Project ID and cycle ID are required" }, { status: 400 });
    }
    const auth = await requireAuthAndProjectPermission(req, projectId, "edit_project");
    if (auth instanceof NextResponse) return auth;
    await archiveTestCycle(projectId, cycleId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("testing/cycles/[cycleId] DELETE", err);
    return NextResponse.json({ error: "Failed to archive cycle", details: message }, { status: 500 });
  }
}
