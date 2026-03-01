import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUserWithRoleFromRequest,
  isProjectOwner,
} from "@/lib/auth/serverAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/projects/[id]/archive
 * Sets project status to 'archived'. Authorization: superadmin or project owner.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUserWithRoleFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "No autorizado. Inicia sesión para continuar." },
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

    const canArchive =
      user.appRole === "superadmin" ||
      (await isProjectOwner(user.userId, projectId));

    if (!canArchive) {
      return NextResponse.json(
        { error: "No tienes permiso para archivar este proyecto." },
        { status: 403 }
      );
    }

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
