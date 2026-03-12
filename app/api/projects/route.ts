import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndGlobalPermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST /api/projects
 * Create a new project. Requires global permission create_project.
 * Sets created_by so the DB trigger adds the creator as owner in project_members.
 * Does not create phases or generate plan; client may call generate-activate-plan or createDefaultPhasesForProject after.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthAndGlobalPermission(request, "create_project");
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    let body: {
      name?: string;
      description?: string | null;
      client_id?: string | null;
      environment_type?: string;
      status?: string;
      start_date?: string | null;
      planned_end_date?: string | null;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { error: "Cuerpo JSON inválido." },
        { status: 400 }
      );
    }

    const name =
      typeof body.name === "string" && body.name.trim() !== ""
        ? body.name.trim()
        : null;
    if (!name) {
      return NextResponse.json(
        { error: "Se requiere el nombre del proyecto." },
        { status: 400 }
      );
    }

    const description =
      typeof body.description === "string"
        ? (body.description.trim() || null)
        : null;
    const clientId =
      typeof body.client_id === "string" && body.client_id.trim() !== ""
        ? body.client_id.trim()
        : null;
    const environmentType =
      typeof body.environment_type === "string" && body.environment_type.trim() !== ""
        ? body.environment_type.trim()
        : "cloud_public";
    const status =
      typeof body.status === "string" && body.status.trim() !== ""
        ? body.status.trim()
        : "planned";
    const startDate =
      typeof body.start_date === "string" && body.start_date.trim() !== ""
        ? body.start_date.trim()
        : null;
    const plannedEndDate =
      typeof body.planned_end_date === "string" && body.planned_end_date.trim() !== ""
        ? body.planned_end_date.trim()
        : null;

    const { data: project, error } = await supabaseAdmin
      .from("projects")
      .insert({
        name,
        description: description ?? null,
        client_id: clientId ?? null,
        environment_type: environmentType,
        status,
        start_date: startDate ?? null,
        planned_end_date: plannedEndDate ?? null,
        created_by: userId,
      })
      .select("id, name, status, start_date, planned_end_date, created_by")
      .single();

    if (error) {
      console.error("POST /api/projects insert error", error);
      return NextResponse.json(
        { error: error.message ?? "Error al crear el proyecto." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        id: (project as { id: string }).id,
        name: (project as { name: string }).name,
        status: (project as { status?: string }).status,
        start_date: (project as { start_date?: string | null }).start_date ?? null,
        planned_end_date: (project as { planned_end_date?: string | null }).planned_end_date ?? null,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/projects error", err);
    return NextResponse.json(
      { error: "Error al crear el proyecto." },
      { status: 500 }
    );
  }
}
