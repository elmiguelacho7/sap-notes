import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndGlobalPermission } from "@/lib/auth/permissions";
import { getEffectiveLimit, QUOTA_KEYS } from "@/lib/auth/quota";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteParams = { params: Promise<{ userId: string }> };

/**
 * GET /api/admin/quotas/user/[userId]
 * Returns effective quota configuration for a user: app role, role defaults, user overrides, effective limits.
 * Requires manage_platform_settings (superadmin).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuthAndGlobalPermission(request, "manage_platform_settings");
    if (auth instanceof NextResponse) return auth;

    const { userId } = await params;
    if (!userId?.trim()) {
      return NextResponse.json({ error: "Se requiere userId." }, { status: 400 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("app_role")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    const appRole = (profile as { app_role?: string | null }).app_role?.trim()?.toLowerCase() ?? null;

    const roleLimits: Record<string, number> = {};
    const userOverrides: Record<string, number> = {};
    const effectiveLimits: Record<string, number | null> = {};

    if (appRole) {
      const { data: roleRow } = await supabaseAdmin
        .from("roles")
        .select("id")
        .eq("scope", "app")
        .eq("key", appRole)
        .maybeSingle();

      if (roleRow) {
        const roleId = (roleRow as { id: string }).id;
        const { data: rlRows } = await supabaseAdmin
          .from("role_limits")
          .select("limit_key, value")
          .eq("role_id", roleId)
          .in("limit_key", [...QUOTA_KEYS]);
        for (const row of (rlRows ?? []) as { limit_key: string; value: number }[]) {
          if (QUOTA_KEYS.includes(row.limit_key as (typeof QUOTA_KEYS)[number]))
            roleLimits[row.limit_key] = row.value;
        }
      }
    }

    const { data: ulRows } = await supabaseAdmin
      .from("user_limits")
      .select("limit_key, value")
      .eq("user_id", userId)
      .in("limit_key", [...QUOTA_KEYS]);
    for (const row of (ulRows ?? []) as { limit_key: string; value: number }[]) {
      if (QUOTA_KEYS.includes(row.limit_key as (typeof QUOTA_KEYS)[number]))
        userOverrides[row.limit_key] = row.value;
    }

    for (const key of QUOTA_KEYS) {
      effectiveLimits[key] = await getEffectiveLimit(userId, key);
    }

    return NextResponse.json({
      userId,
      appRole,
      roleLimits,
      userOverrides,
      effectiveLimits,
    });
  } catch (err) {
    console.error("admin/quotas/user GET error", err);
    return NextResponse.json(
      { error: "Error al cargar los límites del usuario." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/quotas/user/[userId]
 * Body: { overrides: { max_projects_created?: number, ... } }.
 * Saves or removes user-level overrides. Positive integer = set override; omit or 0 = remove (fall back to role).
 * Requires manage_platform_settings (superadmin).
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuthAndGlobalPermission(request, "manage_platform_settings");
    if (auth instanceof NextResponse) return auth;

    const { userId } = await params;
    if (!userId?.trim()) {
      return NextResponse.json({ error: "Se requiere userId." }, { status: 400 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    const body = (await request.json()) as { overrides?: Record<string, number> };
    const overrides = body.overrides && typeof body.overrides === "object" ? body.overrides : {};

    for (const key of QUOTA_KEYS) {
      const raw = overrides[key];
      const value = typeof raw === "number" && Number.isInteger(raw) && raw > 0 ? raw : null;

      if (value !== null) {
        const { error: upsertError } = await supabaseAdmin
          .from("user_limits")
          .upsert(
            { user_id: userId, limit_key: key, value, updated_at: new Date().toISOString() },
            { onConflict: "user_id,limit_key", ignoreDuplicates: false }
          );
        if (upsertError) {
          console.error("admin/quotas/user PUT upsert", upsertError);
          return NextResponse.json(
            { error: "Error al guardar el límite." },
            { status: 500 }
          );
        }
      } else {
        await supabaseAdmin
          .from("user_limits")
          .delete()
          .eq("user_id", userId)
          .eq("limit_key", key);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin/quotas/user PUT error", err);
    return NextResponse.json(
      { error: "Error al guardar los límites del usuario." },
      { status: 500 }
    );
  }
}
