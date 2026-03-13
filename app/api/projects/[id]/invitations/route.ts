import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import {
  getProjectMembers,
  setProjectMember,
  findUserIdByEmail,
  isUserProjectMember,
  type ProjectMemberRole,
} from "@/lib/services/adminService";
import {
  createProjectInvitation,
  getProjectPendingInvitations,
  type ProjectMemberRole as InvitationRole,
} from "@/lib/services/invitationService";
import { sendInvitationEmail } from "@/lib/email/sendInvitationEmail";
import { checkQuota } from "@/lib/auth/quota";

/**
 * Project invitations API.
 * GET: list pending invitations. POST: create invitation or add existing user.
 * Both require manage_project_members on the project.
 */
type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/invitations
 * List pending invitations. Requires manage_project_members on the project.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    if (!projectId?.trim()) {
      return NextResponse.json(
        { error: "Se requiere el id del proyecto." },
        { status: 400 }
      );
    }

    const auth = await requireAuthAndProjectPermission(request, projectId, "manage_project_members");
    if (auth instanceof NextResponse) return auth;

    const invitations = await getProjectPendingInvitations(projectId);
    return NextResponse.json({ invitations });
  } catch (err) {
    console.error("projects/[id]/invitations GET error", err);
    return NextResponse.json(
      { error: "Error al cargar las invitaciones." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/invitations
 * Body: { email: string, role: string }.
 * If user exists -> add to project_members, return { added: true }.
 * Else -> create invitation with token, send email, return { invited: true }.
 * Requires manage_project_members on the project.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    if (!projectId?.trim()) {
      return NextResponse.json(
        { error: "Se requiere el id del proyecto." },
        { status: 400 }
      );
    }

    const auth = await requireAuthAndProjectPermission(request, projectId, "manage_project_members");
    if (auth instanceof NextResponse) return auth;
    const user = { userId: auth.userId };

    const body = (await request.json()) as { email?: string; role?: string };
    const emailRaw =
      typeof body.email === "string" && body.email.trim() !== ""
        ? body.email.trim()
        : null;
    const role =
      body.role === "owner" || body.role === "editor" || body.role === "viewer"
        ? (body.role as InvitationRole)
        : null;

    if (!emailRaw || !role) {
      return NextResponse.json(
        { error: "Se requieren email y role (owner | editor | viewer)." },
        { status: 400 }
      );
    }

    const email = emailRaw.toLowerCase().trim();

    const targetUserId = await findUserIdByEmail(email);
    if (targetUserId) {
      const alreadyMember = await isUserProjectMember(projectId, targetUserId);
      if (alreadyMember) {
        return NextResponse.json({
          success: true,
          mode: "already_member",
          added: false,
          invited: false,
          alreadyMember: true,
          message: "El usuario ya pertenece a este proyecto.",
        });
      }

      const memberQuota = await checkQuota(auth.userId, "max_members_per_project", projectId);
      if (!memberQuota.allowed) {
        return NextResponse.json(
          {
            error: "Has alcanzado el máximo de miembros permitidos para este proyecto.",
            quota: { quotaKey: "max_members_per_project", current: memberQuota.current, limit: memberQuota.limit },
          },
          { status: 409 }
        );
      }
      await setProjectMember(projectId, targetUserId, role as ProjectMemberRole);
      return NextResponse.json({
        success: true,
        mode: "direct_member_add",
        added: true,
        invited: false,
        message: "El usuario ya existía y fue añadido directamente al equipo.",
      });
    }

    const pending = await getProjectPendingInvitations(projectId);
    const alreadyInvited = pending.some((inv) => inv.email.toLowerCase() === email);
    if (alreadyInvited) {
      return NextResponse.json(
        { error: "Ya existe una invitación pendiente para este correo. Revoca la anterior en «Invitaciones pendientes» si quieres reenviar." },
        { status: 400 }
      );
    }

    const quota = await checkQuota(auth.userId, "max_pending_invitations_per_project", projectId);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: "Has alcanzado el máximo de invitaciones pendientes para este proyecto.",
          quota: { quotaKey: "max_pending_invitations_per_project", current: quota.current, limit: quota.limit },
        },
        { status: 409 }
      );
    }

    const { rawToken, invitationId } = await createProjectInvitation(
      projectId,
      email,
      role,
      user.userId
    );

    const appUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      request.nextUrl?.origin ||
      (typeof process.env.VERCEL_URL === "string"
        ? `https://${process.env.VERCEL_URL}`
        : undefined);

    const inviteLink = appUrl
      ? `${appUrl.replace(/\/$/, "")}/invite?token=${encodeURIComponent(rawToken)}`
      : "";

    let emailSent = false;
    let emailDebugReason: string | null = null;
    if (inviteLink) {
      const result = await sendInvitationEmail(email, inviteLink, projectId);
      emailSent = result.sent;
      emailDebugReason = result.error ?? null;
      if (!result.sent) {
        console.error("Invitation email send failed", {
          projectId,
          email,
          from: result.from,
          reason: result.error,
        });
      }
    }

    const isDev = process.env.NODE_ENV !== "production";

    if (emailSent) {
      return NextResponse.json({
        success: true,
        mode: "pending_invitation",
        invited: true,
        added: false,
        invitationCreated: true,
        invitationId,
        emailSent: true,
        message: "Se creó una invitación pendiente y se envió el correo.",
        ...(isDev && { emailDebug: null }),
      });
    }
    if (inviteLink) {
      return NextResponse.json({
        success: true,
        mode: "pending_invitation",
        invited: true,
        added: false,
        invitationCreated: true,
        invitationId,
        emailSent: false,
        actionLink: inviteLink,
        message: "Se creó una invitación pendiente; no se pudo enviar el correo. Usa el enlace de abajo para invitar al usuario.",
        ...(isDev && { emailDebug: emailDebugReason }),
      });
    }
    return NextResponse.json({
      success: true,
      mode: "pending_invitation",
      invited: true,
      added: false,
      invitationCreated: true,
      invitationId,
      emailSent: false,
      message: "Se creó una invitación pendiente pero no se pudo generar el enlace (configura NEXT_PUBLIC_SITE_URL o NEXT_PUBLIC_APP_URL). Revisa la sección «Invitaciones pendientes».",
      ...(isDev && { emailDebug: emailDebugReason }),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al procesar la invitación.";
    console.error("projects/[id]/invitations POST error", err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
