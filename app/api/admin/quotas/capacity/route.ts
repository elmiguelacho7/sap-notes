import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndGlobalPermission } from "@/lib/auth/permissions";
import { getCapacityData, type CapacityFilters, type QuotaStatus } from "@/lib/services/quotaCapacityService";

/**
 * GET /api/admin/quotas/capacity
 * Returns capacity dashboard data: summary counts, per-user usage, per-project usage.
 * Query: role, status, overridesOnly, projectsWithLimitsOnly (filters for tables; summary is global).
 * Requires manage_platform_settings (superadmin).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthAndGlobalPermission(request, "manage_platform_settings");
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role") ?? undefined;
    const status = searchParams.get("status") as QuotaStatus | null;
    const overridesOnly = searchParams.get("overridesOnly") === "true";
    const projectsWithLimitsOnly = searchParams.get("projectsWithLimitsOnly") === "true";

    const filters: CapacityFilters = {};
    if (role) filters.role = role;
    if (status && ["unlimited", "normal", "near_limit", "at_limit"].includes(status)) filters.status = status;
    if (overridesOnly) filters.overridesOnly = true;
    if (projectsWithLimitsOnly) filters.projectsWithLimitsOnly = true;

    const data = await getCapacityData(filters);
    return NextResponse.json(data);
  } catch (err) {
    console.error("admin/quotas/capacity GET error", err);
    return NextResponse.json(
      { error: "Error al cargar los datos de capacidad." },
      { status: 500 }
    );
  }
}
