import { NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import { createTestExecutionEvidence } from "@/lib/services/testingService";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { randomUUID } from "crypto";

type RouteParams = { params: Promise<unknown> };

const BUCKET = "testing-evidence";
const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId, executionId } = (await params) as { id: string; executionId: string };
    if (!projectId?.trim() || !executionId?.trim()) {
      return NextResponse.json({ error: "Project ID and execution ID are required" }, { status: 400 });
    }
    const auth = await requireAuthAndProjectPermission(req, projectId, "edit_project");
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 400 });
    }

    const safeName = (file.name || "upload").replace(/[^\w.\-()+ ]/g, "_").slice(0, 180);
    const path = `${projectId}/${executionId}/${randomUUID()}-${safeName}`;

    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (upErr) {
      console.error("testing evidence upload", upErr);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const evidence = await createTestExecutionEvidence(projectId, executionId, userId, {
      type: "attachment",
      title: safeName,
      file_path: path,
      file_name: safeName,
      mime_type: file.type || null,
    });

    return NextResponse.json(evidence, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("testing/evidence/upload POST", err);
    return NextResponse.json({ error: "Failed to upload evidence", details: message }, { status: 500 });
  }
}
