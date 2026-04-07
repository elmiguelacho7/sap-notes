import { NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import { getTestingControlSummary } from "@/lib/services/testingService";

type RouteParams = { params: Promise<unknown> };

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId } = (await params) as { id: string };
    if (!projectId?.trim()) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }
    const auth = await requireAuthAndProjectPermission(req, projectId, "view_project");
    if (auth instanceof NextResponse) return auth;
    const data = await getTestingControlSummary(projectId);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("testing/control-summary GET", err);
    return NextResponse.json({ error: "Failed to load testing summary", details: message }, { status: 500 });
  }
}
