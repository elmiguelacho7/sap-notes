import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndProjectOrGlobalPermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/projects/[id]/archive
 * Sets project status to 'archived'. Requires edit_project on the project or manage_any_project (global write override).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    if (!projectId || String(projectId).trim() === "") {
      return NextResponse.json(
        { error: "Se requiere el id del proyecto." },
        { status: 400 }
      );
    }

    const auth = await requireAuthAndProjectOrGlobalPermission(
      request,
      projectId,
      "edit_project",
      "manage_any_project"
    );
    if (auth instanceof NextResponse) return auth;

    const { error } = await supabaseAdmin
      .from("projects")
      .update({ status: "archived" })
      .eq("id", projectId);

    if (error) {
      console.error("projects archive PATCH error", error);
      return NextResponse.json(
        { error: "No se pudo archivar el proyecto." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("projects archive PATCH error", err);
    return NextResponse.json(
      { error: "No se pudo archivar el proyecto." },
      { status: 500 }
    );
  }
}
