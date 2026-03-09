import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminFromRequest } from "@/lib/auth/serverAuth";
import { setUserActivation } from "@/lib/services/adminService";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendActivationNotification } from "@/lib/email/sendActivationNotification";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/users/:id/activation
 * Body: { is_active: boolean }. Platform activation only; separate from app_role and project membership.
 * Superadmin only. When activating (is_active: true), sends notification email if Resend is configured.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const currentUserId = await requireSuperAdminFromRequest(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: "No autorizado. Solo superadministradores." },
        { status: 403 }
      );
    }

    const { id: targetUserId } = await params;
    if (!targetUserId || String(targetUserId).trim() === "") {
      return NextResponse.json(
        { error: "Se requiere el id del usuario." },
        { status: 400 }
      );
    }

    const body = (await request.json()) as { is_active?: boolean };
    const isActive = body.is_active === true;

    await setUserActivation(targetUserId, isActive);

    if (isActive) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email, full_name")
        .eq("id", targetUserId)
        .single();
      const email = (profile as { email?: string | null } | null)?.email;
      const fullName = (profile as { full_name?: string | null } | null)?.full_name;
      if (email?.trim()) {
        sendActivationNotification(email.trim(), fullName).catch((err) =>
          console.error("[activation] notification email failed", err)
        );
      }
    }

    return NextResponse.json({ success: true, is_active: isActive });
  } catch (err) {
    console.error("admin/users/[id]/activation PATCH error", err);
    return NextResponse.json(
      { error: "Error al actualizar la activación del usuario." },
      { status: 500 }
    );
  }
}
