import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndProjectPermission } from "@/lib/auth/permissions";
import {
  getProjectMembers,
  setProjectMember,
  findUserIdByEmail,
  upsertProjectInvitation,
  inviteUserByEmailWithResult,
  generateMagicLinkForInvite,
  type ProjectMemberRole,
} from "@/lib/services/adminService";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/members
 * Returns project members. Requires view_project (any project member can view).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    if (!projectId || String(projectId).trim() === "") {
      return NextResponse.json(
        { error: "Se requiere el id del proyecto." },
        { status: 400 }
      );
    }

    const auth = await requireAuthAndProjectPermission(request, projectId, "view_project");
    if (auth instanceof NextResponse) return auth;

    try {
      const members = await getProjectMembers(projectId);
      return NextResponse.json({ members });
    } catch (err) {
      console.warn("projects/[id]/members GET getProjectMembers error", err);
      return NextResponse.json({ members: [] });
    }
  } catch (err) {
    console.error("projects/[id]/members GET error", err);
    return NextResponse.json(
      { error: "Error al cargar los miembros del proyecto." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/members
 * Add or invite by email. Body: { email, role }.
 * Requires manage_project_members on the project.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    if (!projectId || String(projectId).trim() === "") {
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
        ? (body.role as ProjectMemberRole)
        : null;

    if (!emailRaw || !role) {
      return NextResponse.json(
        {
          error:
            "Se requieren email y role (owner | editor | viewer).",
        },
        { status: 400 }
      );
    }

    const email = emailRaw.toLowerCase().trim();

    const targetUserId = await findUserIdByEmail(email);

    if (targetUserId) {
      const member = await setProjectMember(projectId, targetUserId, role);
      return NextResponse.json({
        status: "added",
        member,
        message: "Miembro añadido.",
      });
    }

    await upsertProjectInvitation(projectId, email, role, user.userId);

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (request.nextUrl?.origin && !request.nextUrl.origin.includes("localhost")
        ? request.nextUrl.origin
        : undefined) ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof process.env.VERCEL_URL === "string"
        ? `https://${process.env.VERCEL_URL}`
        : undefined);

    const inviteResult = await inviteUserByEmailWithResult(email, siteUrl);

    if (inviteResult.error) {
      const { message, status, code } = inviteResult.error;
      console.warn("projects/[id]/members POST inviteUserByEmail failed", {
        message,
        status,
        code,
        email,
      });

      try {
        const actionLink = await generateMagicLinkForInvite(
          email,
          siteUrl || request.nextUrl?.origin || ""
        );
        return NextResponse.json({
          status: "invited_failed",
          message:
            "No se pudo enviar el correo automáticamente. Copia este enlace y envíaselo al usuario.",
          actionLink,
          inviteError: { message, status, code },
        });
      } catch (linkErr) {
        const linkMsg =
          linkErr instanceof Error ? linkErr.message : "Error al generar enlace.";
        console.error("projects/[id]/members POST generateMagicLink error", linkErr);
        return NextResponse.json(
          {
            error: `Invitación por correo fallida: ${message}. ${linkMsg}`,
            inviteError: { message, status, code },
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      status: "invited",
      message:
        "Invitación enviada. El usuario deberá registrarse para quedar añadido al proyecto.",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al procesar la solicitud.";
    console.error("projects/[id]/members POST error", err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
