import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminFromRequest } from "@/lib/auth/serverAuth";
import { canDeleteUser, deleteUser } from "@/lib/services/adminService";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * DELETE /api/admin/users/:id
 * Physically delete a user only when they have no transactional data.
 * Protections: cannot delete self; cannot delete last superadmin.
 * Returns 409 when user has transactional data (with message to deactivate instead).
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const currentUserId = await requireSuperAdminFromRequest(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: "No autorizado. Solo superadministradores." },
        { status: 403 }
      );
    }

    const { id: targetUserId } = await params;
    if (!targetUserId || String(targetUserId).trim() === "") {
      return NextResponse.json(
        { error: "Se requiere el id del usuario." },
        { status: 400 }
      );
    }

    if (targetUserId === currentUserId) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propio usuario. Usa desactivación si quieres restringir acceso." },
        { status: 400 }
      );
    }

    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("app_role")
      .eq("id", targetUserId)
      .single();

    const targetRole = (targetProfile as { app_role?: string } | null)?.app_role;
    if (targetRole === "superadmin") {
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("app_role", "superadmin");
      if (count !== null && count <= 1) {
        return NextResponse.json(
          { error: "No se puede eliminar el último superadministrador del sistema." },
          { status: 400 }
        );
      }
    }

    const eligibility = await canDeleteUser(targetUserId);
    if (!eligibility.allowed) {
      if (eligibility.reason === "user_has_transactional_data") {
        return NextResponse.json(
          {
            error: "user_has_transactional_data",
            message:
              "Este usuario tiene datos transaccionales (notas, tareas, proyectos, etc.) y no puede ser eliminado. Puedes desactivar el usuario en su lugar.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: eligibility.reason ?? "No se puede eliminar este usuario." },
        { status: 400 }
      );
    }

    await deleteUser(targetUserId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al eliminar el usuario.";
    console.error("admin/users/[id] DELETE error", err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
