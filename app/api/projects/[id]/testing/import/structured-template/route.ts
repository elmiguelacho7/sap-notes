import { NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import {
  parseRibbitStructuredTemplate,
  StructuredTemplateParseError,
} from "@/lib/testing/structuredTemplate/parseRibbitStructuredTemplate";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

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
      return NextResponse.json({ error: "File too large (max 8 MB)" }, { status: 400 });
    }

    const lower = (file.name || "").toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      return NextResponse.json({ error: "Structured template import expects an Excel file (.xlsx)." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const { draft, warnings, stats } = parseRibbitStructuredTemplate(buf, file.name || "template.xlsx");

    return NextResponse.json({ draft, warnings, stats });
  } catch (err) {
    if (err instanceof StructuredTemplateParseError) {
      return NextResponse.json(
        { error: err.message, code: err.code, detail: err.detail ?? null },
        { status: 400 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("testing/import/structured-template POST", err);
    return NextResponse.json({ error: "Failed to parse structured template", details: message }, { status: 500 });
  }
}
