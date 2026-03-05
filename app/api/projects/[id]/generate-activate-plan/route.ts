import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/serverAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateActivatePlan } from "@/lib/activate/generateActivatePlan";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/[id]/generate-activate-plan
 * Generates project_phases, project_activities, project_tasks from templates.
 * Idempotent: if phases exist, returns skipped.
 * Requires auth and project access (member or service).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado." },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;
    if (!projectId?.trim()) {
      return NextResponse.json(
        { error: "Se requiere el id del proyecto." },
        { status: 400 }
      );
    }

    const { data: member } = await supabaseAdmin
      .from("project_members")
      .select("project_id")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("app_role")
      .eq("id", userId)
      .single();

    const isSuperAdmin = profile?.app_role === "superadmin";
    if (!member && !isSuperAdmin) {
      return NextResponse.json(
        { error: "No tienes acceso a este proyecto." },
        { status: 403 }
      );
    }

    const result = await generateActivatePlan(projectId);

    if (!result.ok) {
      const status = result.error === "missing_dates" ? 400 : 500;
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          message:
            result.error === "missing_dates"
              ? "El proyecto debe tener fecha de inicio y fecha de fin planificada."
              : result.error,
        },
        { status }
      );
    }

    if (result.skipped) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: result.reason,
        phasesCreated: 0,
        activitiesCreated: 0,
        tasksCreated: 0,
      });
    }

    return NextResponse.json({
      ok: true,
      skipped: false,
      phasesCreated: result.phasesCreated,
      activitiesCreated: result.activitiesCreated,
      tasksCreated: result.tasksCreated,
    });
  } catch (err) {
    console.error("generate-activate-plan error", err);
    return NextResponse.json(
      { ok: false, error: "Error al generar el plan del proyecto." },
      { status: 500 }
    );
  }
}
