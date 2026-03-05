import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminFromRequest } from "@/lib/auth/serverAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/users/:id/app-role
 * Body: { appRoleKey: string }. Updates profiles.app_role for the given profile/user id.
 * Superadmin only. Stored value is the role key from RBAC (e.g. superadmin, consultant).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const body = (await request.json()) as { appRoleKey?: string };
    const appRole =
      typeof body.appRoleKey === "string" && body.appRoleKey.trim() !== ""
        ? body.appRoleKey.trim()
        : null;

    if (!appRole) {
      return NextResponse.json(
        { error: "Se requiere appRoleKey (texto)." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ app_role: appRole })
      .eq("id", targetUserId);

    if (error) {
      console.error("admin/users/[id]/app-role PATCH error", error);
      return NextResponse.json(
        { error: error.message ?? "Error al actualizar el rol del usuario." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("admin/users/[id]/app-role PATCH error", err);
    return NextResponse.json(
      { error: "Error al actualizar el rol del usuario." },
      { status: 500 }
    );
  }
}
