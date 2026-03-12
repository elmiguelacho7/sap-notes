import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndProjectPermission, requireAuthAndGlobalPermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/notes/[id]
 * Update note fields (e.g. is_knowledge_base). Requires edit_project_notes (project notes) or manage_global_notes (global notes).
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
    if (projectId != null && projectId.trim() !== "") {
      const auth = await requireAuthAndProjectPermission(request, projectId, "edit_project_notes");
      if (auth instanceof NextResponse) return auth;
    } else {
      const auth = await requireAuthAndGlobalPermission(request, "manage_global_notes");
      if (auth instanceof NextResponse) return auth;
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
 * Soft-deletes a note (sets deleted_at). Requires delete_project_notes (project notes) or manage_global_notes (global notes).
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
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
    if (projectId != null && projectId.trim() !== "") {
      const auth = await requireAuthAndProjectPermission(request, projectId, "delete_project_notes");
      if (auth instanceof NextResponse) return auth;
    } else {
      const auth = await requireAuthAndGlobalPermission(request, "manage_global_notes");
      if (auth instanceof NextResponse) return auth;
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
