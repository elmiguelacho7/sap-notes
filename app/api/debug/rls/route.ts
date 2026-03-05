import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminFromRequest } from "@/lib/auth/serverAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/debug/rls
 * Debug-only. Returns current user id, project_ids where user is member,
 * and whether project_tasks INSERT policy would pass for a given project_id.
 * Protected: superadmin only.
 *
 * Query:
 *   project_id (optional) — if provided, response includes insertPolicyPasses (true if user is member of that project).
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireSuperAdminFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado. Solo superadministradores." },
        { status: 403 }
      );
    }

    const { data: rows, error } = await supabaseAdmin
      .from("project_members")
      .select("project_id")
      .eq("user_id", userId);

    if (error) {
      console.error("debug/rls project_members error", error);
      return NextResponse.json(
        { error: "Error al leer project_members." },
        { status: 500 }
      );
    }

    const projectIds = (rows ?? [])
      .map((r) => (r as { project_id: string }).project_id)
      .filter(Boolean);

    const url = new URL(request.url);
    const projectIdParam = url.searchParams.get("project_id")?.trim() ?? null;

    const response: {
      userId: string;
      projectIds: string[];
      insertPolicyPasses?: boolean;
    } = {
      userId,
      projectIds,
    };

    if (projectIdParam) {
      response.insertPolicyPasses = projectIds.includes(projectIdParam);
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error("debug/rls error", err);
    return NextResponse.json(
      { error: "Error en el endpoint de depuración." },
      { status: 500 }
    );
  }
}
