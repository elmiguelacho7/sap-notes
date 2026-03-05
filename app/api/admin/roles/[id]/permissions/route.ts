import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminFromRequest } from "@/lib/auth/serverAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PUT /api/admin/roles/:id/permissions
 * Body: { permissionIds: string[] }. Replaces the permission set for the role. Superadmin only.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireSuperAdminFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado. Solo superadministradores." },
        { status: 403 }
      );
    }

    const { id: roleId } = await params;
    if (!roleId) {
      return NextResponse.json(
        { error: "Se requiere el id del rol." },
        { status: 400 }
      );
    }

    const body = (await request.json()) as { permissionIds?: string[] };
    const permissionIds = Array.isArray(body.permissionIds)
      ? body.permissionIds.filter((x) => typeof x === "string" && x.trim() !== "")
      : [];

    const { error: delError } = await supabaseAdmin
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId);

    if (delError) {
      console.error("admin/roles permissions PUT delete error", delError);
      return NextResponse.json(
        { error: "Error al actualizar los permisos." },
        { status: 500 }
      );
    }

    if (permissionIds.length > 0) {
      const rows = permissionIds.map((permission_id) => ({
        role_id: roleId,
        permission_id,
      }));
      const { error: insError } = await supabaseAdmin
        .from("role_permissions")
        .insert(rows);

      if (insError) {
        console.error("admin/roles permissions PUT insert error", insError);
        return NextResponse.json(
          { error: "Error al asignar los permisos." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("admin/roles permissions PUT error", err);
    return NextResponse.json(
      { error: "Error al actualizar los permisos." },
      { status: 500 }
    );
  }
}
