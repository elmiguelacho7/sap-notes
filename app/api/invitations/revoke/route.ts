import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { revokeInvitation } from "@/lib/services/invitationService";

/**
 * POST /api/invitations/revoke
 * Body: { invitationId: string }. Resolves project from invitation, then requires manage_project_members on that project.
 */
export async function POST(request: NextRequest) {
  try {
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

    const projectId = (inv as { project_id: string }).project_id;
    const auth = await requireAuthAndProjectPermission(request, projectId, "manage_project_members");
    if (auth instanceof NextResponse) return auth;

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
