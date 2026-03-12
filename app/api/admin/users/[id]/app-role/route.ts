import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndGlobalPermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteParams = { params: Promise<{ id: string }> };

/** Allowed app_role values; must match DB constraint profiles_app_role_check. */
const ALLOWED_APP_ROLES = ["superadmin", "admin", "consultant", "viewer"] as const;

/**
 * PATCH /api/admin/users/:id/app-role
 * Body: { appRoleKey: string }. Updates profiles.app_role for the given profile/user id.
 * Requires manage_global_roles. Validates appRoleKey against allowed list before update.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuthAndGlobalPermission(request, "manage_global_roles");
    if (auth instanceof NextResponse) return auth;

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
        ? body.appRoleKey.trim().toLowerCase()
        : null;

    if (!appRole) {
      return NextResponse.json(
        { error: "Se requiere appRoleKey (texto)." },
        { status: 400 }
      );
    }

    if (!ALLOWED_APP_ROLES.includes(appRole as (typeof ALLOWED_APP_ROLES)[number])) {
      return NextResponse.json(
        {
          error: `appRoleKey debe ser uno de: ${ALLOWED_APP_ROLES.join(", ")}.`,
        },
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
