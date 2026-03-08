/**
 * GET /api/metrics/platform
 * Returns platform metrics for the current user (same source of truth as Sapito).
 * Requires auth. Used by dashboard widgets so numbers match the assistant.
 */

import { NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/serverAuth";
import { getPlatformMetrics } from "@/lib/metrics/platformMetrics";

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserIdFromRequest(request);
    const metrics = await getPlatformMetrics(userId);
    return NextResponse.json({
      projects_total: metrics.projects_total,
      projects_active: metrics.projects_active,
      notes_total: metrics.notes_total,
      notes_today: metrics.notes_today,
      tickets_open: metrics.tickets_open,
    });
  } catch (err) {
    console.error("[api/metrics/platform] error", err);
    return NextResponse.json(
      { error: "No se pudieron cargar las métricas." },
      { status: 500 }
    );
  }
}
