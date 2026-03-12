import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndGlobalPermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type AppRoleOption = {
  id: string;
  key: string;
  name: string;
  scope: "app";
  is_active: boolean;
};

/**
 * GET /api/admin/app-roles
 * Returns active app roles from public.roles (scope='app', is_active=true). Requires view_admin_panel.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthAndGlobalPermission(request, "view_admin_panel");
    if (auth instanceof NextResponse) return auth;

    const { data, error } = await supabaseAdmin
      .from("roles")
      .select("id, key, name, scope, is_active")
      .eq("scope", "app")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("admin/app-roles GET error", error);
      return NextResponse.json(
        { error: "Error al cargar los roles de aplicación." },
        { status: 500 }
      );
    }

    const roles = (data ?? []) as AppRoleOption[];
    return NextResponse.json({ roles });
  } catch (err) {
    console.error("admin/app-roles GET error", err);
    return NextResponse.json(
      { error: "Error al cargar los roles de aplicación." },
      { status: 500 }
    );
  }
}
