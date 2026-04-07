import { NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import {
  buildRibbitTemplateXlsxBuffer,
  RIBBIT_TEMPLATE_DOWNLOAD_NAME,
} from "@/lib/testing/structuredTemplate/generateRibbitTemplateXlsx";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    if (!projectId?.trim()) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const auth = await requireAuthAndProjectPermission(req, projectId, "view_project");
    if (auth instanceof NextResponse) return auth;

    const buf = buildRibbitTemplateXlsxBuffer();
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${RIBBIT_TEMPLATE_DOWNLOAD_NAME}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("testing/template GET", err);
    return NextResponse.json({ error: "Failed to build template" }, { status: 500 });
  }
}
