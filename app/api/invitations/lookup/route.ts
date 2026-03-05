import { NextRequest, NextResponse } from "next/server";
import { findInvitationByToken } from "@/lib/services/invitationService";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/invitations/lookup?token=...
 * Hash token, fetch pending non-expired invitation. Return projectId, projectName, email, role, expiresAt.
 * No auth required (so invitee can see details before logging in).
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token?.trim()) {
      return NextResponse.json(
        { error: "Se requiere el parámetro token." },
        { status: 400 }
      );
    }

    const inv = await findInvitationByToken(token);
    if (!inv) {
      return NextResponse.json(
        { error: "Invitación no encontrada, expirada o ya utilizada." },
        { status: 404 }
      );
    }

    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id, name")
      .eq("id", inv.project_id)
      .single();

    const projectName =
      (project as { name?: string } | null)?.name ?? "Proyecto";

    return NextResponse.json({
      projectId: inv.project_id,
      projectName,
      email: inv.email,
      role: inv.role,
      expiresAt: inv.expires_at,
    });
  } catch (err) {
    console.error("invitations/lookup GET error", err);
    return NextResponse.json(
      { error: "Error al consultar la invitación." },
      { status: 500 }
    );
  }
}
