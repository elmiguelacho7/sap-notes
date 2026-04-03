import { NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import { parseSapTestScriptFile } from "@/lib/testing/sapScriptImport";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024;

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    if (!projectId?.trim()) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const auth = await requireAuthAndProjectPermission(req, projectId, "edit_project");
    if (auth instanceof NextResponse) return auth;

    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 12 MB)" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const { draft, warnings } = await parseSapTestScriptFile(buf, file.name || "import");

    return NextResponse.json({ draft, warnings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("Unsupported file type")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("testing/import/parse POST", err);
    return NextResponse.json({ error: "Failed to parse file", details: message }, { status: 500 });
  }
}
