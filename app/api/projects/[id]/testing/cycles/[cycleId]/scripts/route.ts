import { NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import { addScriptsToCycle } from "@/lib/services/testingService";

type RouteParams = { params: Promise<unknown> };

export async function POST(req: Request, { params }: RouteParams) {
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
    const raw = body.script_ids;
    const script_ids = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
    await addScriptsToCycle(projectId, cycleId, script_ids);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("testing/cycles/scripts POST", err);
    return NextResponse.json({ error: "Failed to add scripts to cycle", details: message }, { status: 500 });
  }
}
