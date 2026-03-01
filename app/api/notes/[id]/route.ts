import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminFromRequest } from "@/lib/auth/serverAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/notes/[id]
 * Update note fields (e.g. is_knowledge_base). Auth: superadmin or project member with edit.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: noteId } = await params;
    if (!noteId || String(noteId).trim() === "") {
      return NextResponse.json(
        { error: "Se requiere el id de la nota." },
        { status: 400 }
      );
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
