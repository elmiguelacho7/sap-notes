import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminFromRequest, getCurrentUserWithRoleFromRequest, isProjectMember } from "@/lib/auth/serverAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/notes/[id]
 * Update note fields (e.g. is_knowledge_base). Auth: superadmin or project member (for project notes); global notes require superadmin.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUserWithRoleFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "No autorizado. Debes iniciar sesión." },
        { status: 401 }
      );
    }

    const { id: noteId } = await params;
    if (!noteId || String(noteId).trim() === "") {
      return NextResponse.json(
        { error: "Se requiere el id de la nota." },
        { status: 400 }
      );
    }

    const { data: noteRow, error: fetchError } = await supabaseAdmin
      .from("notes")
      .select("project_id")
      .eq("id", noteId)
      .maybeSingle();

    if (fetchError || !noteRow) {
      return NextResponse.json(
        { error: "No se encontró la nota." },
        { status: 404 }
      );
    }

    const projectId = (noteRow as { project_id: string | null }).project_id;
    if (projectId == null) {
      if (user.appRole !== "superadmin") {
        return NextResponse.json(
          { error: "No autorizado. Solo superadministradores pueden editar notas globales." },
          { status: 403 }
        );
      }
    } else {
      if (user.appRole !== "superadmin" && !(await isProjectMember(user.userId, projectId))) {
        return NextResponse.json(
          { error: "No autorizado. No eres miembro del proyecto de esta nota." },
          { status: 403 }
        );
      }
    }

    let body: { is_knowledge_base?: boolean };
    try {
      body = (await request.json()) as { is_knowledge_base?: boolean };
    } catch {
      return NextResponse.json(
        { error: "Cuerpo JSON inválido." },
        { status: 400 }
      );
    }

    if (typeof body.is_knowledge_base !== "boolean") {
      return NextResponse.json(
        { error: "is_knowledge_base debe ser un booleano." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("notes")
      .update({ is_knowledge_base: body.is_knowledge_base })
      .eq("id", noteId);

    if (error) {
      if (error.code === "42703") {
        return NextResponse.json(
          {
            error:
              "No se pudo actualizar. Aplica la migración que añade is_knowledge_base a la tabla notes.",
          },
          { status: 500 }
        );
      }
      console.error("notes PATCH error", error);
      return NextResponse.json(
        { error: "No se pudo actualizar la nota." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("notes PATCH error", err);
    return NextResponse.json(
      { error: "No se pudo actualizar la nota." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notes/[id]
 * Soft-deletes a note (sets deleted_at). Requires notes.deleted_at column (see migration 20250228200000_notes_add_deleted_at.sql).
 * Authorization: superadmin only.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireSuperAdminFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado. Solo superadministradores pueden eliminar notas." },
        { status: 403 }
      );
    }

    const { id: noteId } = await params;
    if (!noteId || String(noteId).trim() === "") {
      return NextResponse.json(
        { error: "Se requiere el id de la nota." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("notes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", noteId);

    if (error) {
      if (error.code === "42703") {
        return NextResponse.json(
          {
            error:
              "No se pudo eliminar la nota. Aplica la migración que añade la columna deleted_at a la tabla notes.",
          },
          { status: 500 }
        );
      }
      console.error("notes DELETE error", error);
      return NextResponse.json(
        { error: "No se pudo eliminar la nota." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("notes DELETE error", err);
    return NextResponse.json(
      { error: "No se pudo eliminar la nota." },
      { status: 500 }
    );
  }
}
