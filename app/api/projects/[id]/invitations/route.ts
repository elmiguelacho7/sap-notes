import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUserWithRoleFromRequest,
  isProjectOwner,
} from "@/lib/auth/serverAuth";
import {
  getProjectMembers,
  setProjectMember,
  findUserIdByEmail,
  type ProjectMemberRole,
} from "@/lib/services/adminService";
import {
  createProjectInvitation,
  getProjectPendingInvitations,
  type ProjectMemberRole as InvitationRole,
} from "@/lib/services/invitationService";
import { sendInvitationEmail } from "@/lib/email/sendInvitationEmail";

/**
 * Project invitations API.
 *
 * TEST CHECKLIST (manual):
 * - Invite existing user (email already in auth/profiles) -> user is added to project_members, response { added: true }.
 * - Invite new email -> invitation created, email sent (or actionLink returned), response { invited: true }; open /invite?token=... -> sign in -> accept -> user becomes member.
 * - Expired token: GET /api/invitations/lookup?token=expired_token -> 404 or error; invite page shows "Invitación no válida".
 * - Wrong logged-in email: accept with token for A while logged in as B -> 403 with message showing current vs invitation email.
 */
type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/invitations
 * List pending invitations for the project. Owner or superadmin only.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUserWithRoleFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "No autorizado. Inicia sesión." },
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

    const isOwner = await isProjectOwner(user.userId, projectId);
    if (user.appRole !== "superadmin" && !isOwner) {
      return NextResponse.json(
        { error: "Solo el propietario o un superadmin puede ver las invitaciones." },
        { status: 403 }
      );
    }

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
 * Owner or superadmin only.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUserWithRoleFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "No autorizado. Inicia sesión." },
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

    const isOwner = await isProjectOwner(user.userId, projectId);
    if (user.appRole !== "superadmin" && !isOwner) {
      return NextResponse.json(
        { error: "No tienes permiso para invitar a este proyecto." },
        { status: 403 }
      );
    }

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
      await setProjectMember(projectId, targetUserId, role as ProjectMemberRole);
      return NextResponse.json({ added: true });
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
      (request.nextUrl?.origin && !request.nextUrl.origin.includes("localhost")
        ? request.nextUrl.origin
        : undefined) ||
      (typeof process.env.VERCEL_URL === "string"
        ? `https://${process.env.VERCEL_URL}`
        : undefined);

    const inviteLink = appUrl
      ? `${appUrl.replace(/\/$/, "")}/invite?token=${encodeURIComponent(rawToken)}`
      : "";

    let emailSent = false;
    if (inviteLink) {
      try {
        await sendInvitationEmail(email, inviteLink, projectId);
        emailSent = true;
      } catch (err) {
        console.warn("sendInvitationEmail failed", err);
      }
    }

    if (emailSent) {
      return NextResponse.json({ invited: true, invitationId });
    }
    return NextResponse.json({
      invited: true,
      invitationId,
      actionLink: inviteLink || undefined,
      message: "Invitación creada. No se pudo enviar el correo; comparte el enlace con el usuario.",
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
