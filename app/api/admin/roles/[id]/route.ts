import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndGlobalPermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/roles/:id
 * Body: { is_active: boolean }. Toggle role active state. Requires manage_global_roles.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuthAndGlobalPermission(request, "manage_global_roles");
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Se requiere el id del rol." },
        { status: 400 }
      );
    }

    const body = (await request.json()) as { is_active?: boolean };
    const isActive =
      typeof body.is_active === "boolean" ? body.is_active : undefined;

    if (isActive === undefined) {
      return NextResponse.json(
        { error: "Se requiere is_active (boolean)." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("roles")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, scope, key, name, is_active")
      .single();

    if (error) {
      console.error("admin/roles PATCH error", error);
      return NextResponse.json(
        { error: "Error al actualizar el rol." },
        { status: 500 }
      );
    }

    return NextResponse.json({ role: data });
  } catch (err) {
    console.error("admin/roles PATCH error", err);
    return NextResponse.json(
      { error: "Error al actualizar el rol." },
      { status: 500 }
    );
  }
}
