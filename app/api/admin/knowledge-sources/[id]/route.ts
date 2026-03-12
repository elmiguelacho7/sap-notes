/**
 * DELETE /api/admin/knowledge-sources/[id]
 * Delete a global knowledge source. Requires manage_knowledge_sources.
 * Only allows deleting scope_type=global sources.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndGlobalPermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuthAndGlobalPermission(request, "manage_knowledge_sources");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json(
        { error: "ID de fuente requerido." },
        { status: 400 }
      );
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("knowledge_sources")
      .select("id, scope_type")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Fuente no encontrada." },
        { status: 404 }
      );
    }

    if ((existing as { scope_type: string }).scope_type !== "global") {
      return NextResponse.json(
        { error: "Solo se pueden eliminar fuentes de conocimiento global." },
        { status: 403 }
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from("knowledge_sources")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("admin/knowledge-sources DELETE error", deleteError);
      return NextResponse.json(
        { error: "Error al eliminar la fuente." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin/knowledge-sources DELETE error", err);
    return NextResponse.json(
      { error: "Error al eliminar la fuente." },
      { status: 500 }
    );
  }
}
