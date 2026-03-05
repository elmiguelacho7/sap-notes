import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/serverAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  findInvitationByToken,
  markInvitationAccepted,
} from "@/lib/services/invitationService";

/**
 * POST /api/invitations/accept
 * Body: { token: string }. Requires authenticated user.
 * Verifies email match, inserts project_members, marks invitation accepted.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: "Debes iniciar sesión para aceptar la invitación." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as { token?: string };
    const token = typeof body.token === "string" ? body.token.trim() : null;
    if (!token) {
      return NextResponse.json(
        { error: "Se requiere el token de invitación." },
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

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single();

    let userEmail: string | null = (profile as { email?: string } | null)?.email ?? null;
    if (!userEmail) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      userEmail = authUser?.user?.email ?? null;
    }

    if (!userEmail || userEmail.toLowerCase().trim() !== inv.email.toLowerCase().trim()) {
      return NextResponse.json(
        {
          error: "El correo de tu cuenta no coincide con la invitación.",
          currentEmail: userEmail ?? "(no disponible)",
          invitationEmail: inv.email,
        },
        { status: 403 }
      );
    }

    await supabaseAdmin.from("project_members").upsert(
      {
        project_id: inv.project_id,
        user_id: userId,
        role: inv.role,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,user_id" }
    );

    await markInvitationAccepted(inv.id, userId);

    return NextResponse.json({ ok: true, projectId: inv.project_id });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al aceptar la invitación.";
    console.error("invitations/accept POST error", err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
