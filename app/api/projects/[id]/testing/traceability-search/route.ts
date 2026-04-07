import { NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import { searchTestingTraceability } from "@/lib/services/testingService";

type RouteParams = { params: Promise<{ id: string }> };

const KINDS = new Set(["task", "ticket", "page"]);

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    if (!projectId?.trim()) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const auth = await requireAuthAndProjectPermission(req, projectId, "view_project");
    if (auth instanceof NextResponse) return auth;

    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") ?? "";
    const q = url.searchParams.get("q") ?? "";
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? parseInt(limitRaw, 10) : 20;

    if (!KINDS.has(kind)) {
      return NextResponse.json({ error: "Invalid kind (task, ticket, or page)" }, { status: 400 });
    }

    const hits = await searchTestingTraceability(
      projectId,
      kind as "task" | "ticket" | "page",
      q,
      Number.isFinite(limit) ? limit : 20
    );
    return NextResponse.json({ hits });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("testing/traceability-search GET", err);
    return NextResponse.json({ error: "Search failed", details: message }, { status: 500 });
  }
}
