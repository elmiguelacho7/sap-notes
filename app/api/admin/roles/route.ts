import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndGlobalPermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type RoleWithPermissions = {
  id: string;
  scope: string;
  key: string;
  name: string;
  is_active: boolean;
  permissions: { id: string; key: string; name: string }[];
};

/**
 * GET /api/admin/roles
 * Returns all roles with their permissions (grouped). Requires manage_global_roles.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthAndGlobalPermission(request, "manage_global_roles");
    if (auth instanceof NextResponse) return auth;

    const [rolesRes, permsRes, rpRes] = await Promise.all([
      supabaseAdmin.from("roles").select("id, scope, key, name, is_active").order("scope").order("key"),
      supabaseAdmin.from("permissions").select("id, scope, key, name").order("scope").order("key"),
      supabaseAdmin.from("role_permissions").select("role_id, permission_id"),
    ]);

    if (rolesRes.error) {
      console.error("admin/roles GET roles", rolesRes.error);
      return NextResponse.json(
        { error: "Error al cargar los roles." },
        { status: 500 }
      );
    }
    if (permsRes.error) {
      console.error("admin/roles GET permissions", permsRes.error);
      return NextResponse.json(
        { error: "Error al cargar los permisos." },
        { status: 500 }
      );
    }
    if (rpRes.error) {
      console.error("admin/roles GET role_permissions", rpRes.error);
      return NextResponse.json(
        { error: "Error al cargar la asignación de permisos." },
        { status: 500 }
      );
    }

    const roles = (rolesRes.data ?? []) as { id: string; scope: string; key: string; name: string; is_active: boolean }[];
    const perms = (permsRes.data ?? []) as { id: string; scope: string; key: string; name: string }[];
    const rp = (rpRes.data ?? []) as { role_id: string; permission_id: string }[];

    const permById = new Map(perms.map((p) => [p.id, p]));
    const permsByRoleId = new Map<string, { id: string; key: string; name: string }[]>();
    for (const row of rp) {
      const p = permById.get(row.permission_id);
      if (!p) continue;
      const list = permsByRoleId.get(row.role_id) ?? [];
      list.push({ id: p.id, key: p.key, name: p.name });
      permsByRoleId.set(row.role_id, list);
    }

    const rolesWithPermissions: RoleWithPermissions[] = roles.map((r) => ({
      id: r.id,
      scope: r.scope,
      key: r.key,
      name: r.name,
      is_active: r.is_active,
      permissions: permsByRoleId.get(r.id) ?? [],
    }));

    return NextResponse.json({ roles: rolesWithPermissions, permissions: perms });
  } catch (err) {
    console.error("admin/roles GET error", err);
    return NextResponse.json(
      { error: "Error al cargar los roles." },
      { status: 500 }
    );
  }
}
