import { NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import { createTestCycle, listTestCyclesForProject, type CreateTestCycleInput } from "@/lib/services/testingService";

type RouteParams = { params: Promise<unknown> };

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId } = (await params) as { id: string };
    if (!projectId?.trim()) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }
    const auth = await requireAuthAndProjectPermission(req, projectId, "view_project");
    if (auth instanceof NextResponse) return auth;
    const cycles = await listTestCyclesForProject(projectId);
    return NextResponse.json({ cycles });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("testing/cycles GET", err);
    return NextResponse.json({ error: "Failed to list cycles", details: message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId } = (await params) as { id: string };
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
    const input: CreateTestCycleInput = {
      name: typeof body.name === "string" ? body.name : "",
      description: typeof body.description === "string" ? body.description : null,
      status: typeof body.status === "string" ? body.status : null,
      owner_profile_id: typeof body.owner_profile_id === "string" ? body.owner_profile_id : null,
      planned_start_date: typeof body.planned_start_date === "string" ? body.planned_start_date : null,
      planned_end_date: typeof body.planned_end_date === "string" ? body.planned_end_date : null,
      goal: typeof body.goal === "string" ? body.goal : null,
      scope_summary: typeof body.scope_summary === "string" ? body.scope_summary : null,
    };
    const cycle = await createTestCycle(projectId, userId, input);
    return NextResponse.json(cycle, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("required")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("testing/cycles POST", err);
    return NextResponse.json({ error: "Failed to create cycle", details: message }, { status: 500 });
  }
}
