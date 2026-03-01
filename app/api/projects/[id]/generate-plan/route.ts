import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/serverAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateInitialActivatePlan } from "@/lib/services/projectPlanningService";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/[id]/generate-plan
 * Generates SAP Activate plan (activities from templates) for the project.
 * Uses project start_date and planned_end_date. Requires auth.
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

    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id, start_date, planned_end_date")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: "Proyecto no encontrado." },
        { status: 404 }
      );
    }

    const startDate = (project as { start_date?: string | null }).start_date;
    const plannedEndDate = (project as { planned_end_date?: string | null }).planned_end_date;

    if (!startDate || !plannedEndDate) {
      return NextResponse.json(
        { error: "El proyecto debe tener fecha de inicio y fecha de fin planificada para generar el plan." },
        { status: 400 }
      );
    }

    const result = await generateInitialActivatePlan(projectId, startDate, plannedEndDate);

    if (result.error) {
      return NextResponse.json(
        { error: result.error, created: result.created },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, created: result.created });
  } catch (err) {
    console.error("generate-plan error", err);
    return NextResponse.json(
      { error: "Error al generar el plan del proyecto." },
      { status: 500 }
    );
  }
}
