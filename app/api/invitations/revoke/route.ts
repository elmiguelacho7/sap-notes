import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUserWithRoleFromRequest,
  isProjectOwner,
} from "@/lib/auth/serverAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { revokeInvitation } from "@/lib/services/invitationService";

/**
 * POST /api/invitations/revoke
 * Body: { invitationId: string }. Owner or superadmin only. Sets status = 'revoked'.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserWithRoleFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "No autorizado. Inicia sesión." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as { invitationId?: string };
    const invitationId =
      typeof body.invitationId === "string" ? body.invitationId.trim() : null;
    if (!invitationId) {
      return NextResponse.json(
        { error: "Se requiere invitationId." },
        { status: 400 }
      );
    }

    const { data: inv } = await supabaseAdmin
      .from("project_invitations")
      .select("project_id")
      .eq("id", invitationId)
      .single();

    if (!inv?.project_id) {
      return NextResponse.json(
        { error: "Invitación no encontrada." },
        { status: 404 }
      );
    }

    const isOwner = await isProjectOwner(user.userId, (inv as { project_id: string }).project_id);
    if (user.appRole !== "superadmin" && !isOwner) {
      return NextResponse.json(
        { error: "No tienes permiso para revocar esta invitación." },
        { status: 403 }
      );
    }

    await revokeInvitation(invitationId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al revocar la invitación.";
    console.error("invitations/revoke POST error", err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
