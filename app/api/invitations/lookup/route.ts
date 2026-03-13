import { NextRequest, NextResponse } from "next/server";
import {
  findInvitationByToken,
  getInvitationByTokenHash,
  markInvitationExpired,
} from "@/lib/services/invitationService";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/invitations/lookup?token=...
 * Hash token, fetch pending non-expired invitation. Return projectId, projectName, email, role, expiresAt.
 * Enforces expiration and status; returns specific error reason (invalid / expired / already used).
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

    let inv = await findInvitationByToken(token);
    if (inv) {
      // Valid pending, non-expired — continue to return project details below.
    } else {
      const row = await getInvitationByTokenHash(token);
      if (!row) {
        return NextResponse.json(
          { error: "Invitación no encontrada o token no válido.", reason: "invalid" },
          { status: 404 }
        );
      }
      if (row.status !== "pending") {
        return NextResponse.json(
          {
            error:
              row.status === "accepted"
                ? "Esta invitación ya fue aceptada."
                : row.status === "revoked"
                  ? "Esta invitación fue revocada."
                  : "Esta invitación ya no está disponible.",
            reason: "not_pending",
          },
          { status: 404 }
        );
      }
      const now = new Date();
      if (new Date(row.expires_at) <= now) {
        try {
          await markInvitationExpired(row.id);
        } catch {
          // Best-effort; still return expired to the user.
        }
        return NextResponse.json(
          { error: "Esta invitación ha expirado.", reason: "expired" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Invitación no encontrada o no válida." },
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
