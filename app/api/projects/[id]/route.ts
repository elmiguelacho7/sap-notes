import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminFromRequest } from "@/lib/auth/serverAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * DELETE /api/projects/[id]
 * Hard-deletes a project only if it has no related notes or tickets.
 * Authorization: superadmin only.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireSuperAdminFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado. Solo superadministradores pueden eliminar proyectos." },
        { status: 403 }
      );
    }

    const { id: projectId } = await params;
    if (!projectId || String(projectId).trim() === "") {
      return NextResponse.json(
        { error: "Se requiere el id del proyecto." },
        { status: 400 }
      );
    }

    const [notesCount, ticketsCount] = await Promise.all([
      supabaseAdmin
        .from("notes")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId),
      supabaseAdmin
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId),
    ]);

    const n = notesCount.count ?? 0;
    const t = ticketsCount.count ?? 0;

    if (n > 0 || t > 0) {
      return NextResponse.json(
        {
          error:
            "El proyecto no se puede eliminar porque tiene tickets o notas asociadas. Puedes archivarlo.",
        },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) {
      console.error("projects DELETE error", error);
      return NextResponse.json(
        { error: "No se pudo eliminar el proyecto." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("projects DELETE error", err);
    return NextResponse.json(
      { error: "No se pudo eliminar el proyecto." },
      { status: 500 }
    );
  }
}
