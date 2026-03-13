import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndGlobalPermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
const QUOTA_KEYS = [
  "max_projects_created",
  "max_pending_invitations_per_project",
  "max_members_per_project",
  "max_clients_created",
] as const;

/**
 * GET /api/admin/quotas
 * Returns role limits for app roles (Phase 1: max_projects_created, max_pending_invitations_per_project).
 * Requires manage_platform_settings (superadmin).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthAndGlobalPermission(request, "manage_platform_settings");
    if (auth instanceof NextResponse) return auth;

    const { data: roles } = await supabaseAdmin
      .from("roles")
      .select("id, key, name")
      .eq("scope", "app")
      .order("key");

    if (!roles?.length) {
      return NextResponse.json({ roleLimits: [] });
    }

    const { data: roleLimitsRows } = await supabaseAdmin
      .from("role_limits")
      .select("role_id, limit_key, value")
      .in("limit_key", [...QUOTA_KEYS]);

    const limitsByRoleId = new Map<string, Record<string, number>>();
    for (const r of roles as { id: string; key: string; name: string }[]) {
      limitsByRoleId.set(r.id, {});
    }
    for (const row of (roleLimitsRows ?? []) as { role_id: string; limit_key: string; value: number }[]) {
      if (!QUOTA_KEYS.includes(row.limit_key as (typeof QUOTA_KEYS)[number])) continue;
      const m = limitsByRoleId.get(row.role_id);
      if (m) m[row.limit_key] = row.value;
    }

    const roleLimits = (roles as { id: string; key: string; name: string }[]).map((r) => ({
      roleId: r.id,
      roleKey: r.key,
      roleName: r.name,
      limits: limitsByRoleId.get(r.id) ?? {},
    }));

    return NextResponse.json({ roleLimits });
  } catch (err) {
    console.error("admin/quotas GET error", err);
    return NextResponse.json(
      { error: "Error al cargar los límites." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/quotas
 * Body: { roleKey: string, limits: { max_projects_created?: number, max_pending_invitations_per_project?: number, max_members_per_project?: number, max_clients_created?: number } }.
 * Upserts role_limits for the given app role. Value must be positive integer; omit or 0 to remove limit (unlimited).
 * Requires manage_platform_settings (superadmin).
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuthAndGlobalPermission(request, "manage_platform_settings");
    if (auth instanceof NextResponse) return auth;

    const body = (await request.json()) as { roleKey?: string; limits?: Record<string, number> };
    const roleKey = typeof body.roleKey === "string" ? body.roleKey.trim().toLowerCase() : null;
    const limits = body.limits && typeof body.limits === "object" ? body.limits : {};

    if (!roleKey) {
      return NextResponse.json(
        { error: "Se requiere roleKey." },
        { status: 400 }
      );
    }

    const { data: roleRow } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("scope", "app")
      .eq("key", roleKey)
      .maybeSingle();

    if (!roleRow) {
      return NextResponse.json(
        { error: "Rol no encontrado." },
        { status: 404 }
      );
    }

    const roleId = (roleRow as { id: string }).id;

    for (const key of QUOTA_KEYS) {
      const raw = limits[key];
      const value = typeof raw === "number" && Number.isInteger(raw) && raw > 0 ? raw : null;

      if (value !== null) {
        const { error: upsertError } = await supabaseAdmin
          .from("role_limits")
          .upsert(
            { role_id: roleId, limit_key: key, value, updated_at: new Date().toISOString() },
            { onConflict: "role_id,limit_key", ignoreDuplicates: false }
          );
        if (upsertError) {
          console.error("admin/quotas PUT upsert", upsertError);
          return NextResponse.json(
            { error: "Error al guardar el límite." },
            { status: 500 }
          );
        }
      } else {
        await supabaseAdmin
          .from("role_limits")
          .delete()
          .eq("role_id", roleId)
          .eq("limit_key", key);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin/quotas PUT error", err);
    return NextResponse.json(
      { error: "Error al guardar los límites." },
      { status: 500 }
    );
  }
}
