import { NextRequest, NextResponse } from "next/server";
import { requireAuthAndProjectOrGlobalPermission } from "@/lib/auth/permissions";
import { checkQuota } from "@/lib/auth/quota";
import {
  getProjectMembers,
  setProjectMember,
  removeProjectMember,
  type ProjectMemberRole,
} from "@/lib/services/adminService";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/projects/[id]/members
 * List members. Requires manage_any_project (global) or manage_project_members (on this project).
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id: projectId } = await context.params;
    if (!projectId || projectId.trim() === "") {
      return NextResponse.json(
        { error: "projectId es obligatorio." },
        { status: 400 }
      );
    }
    const auth = await requireAuthAndProjectOrGlobalPermission(
      request,
      projectId,
      "manage_project_members",
      "manage_any_project"
    );
    if (auth instanceof NextResponse) return auth;

    const members = await getProjectMembers(projectId);
    return NextResponse.json({ members });
  } catch (err) {
    console.error("admin/projects/[id]/members GET error", err);
    return NextResponse.json(
      { error: "Error al cargar los miembros del proyecto." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/projects/[id]/members
 * Add/update member. Requires manage_any_project (global) or manage_project_members (on this project).
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id: projectId } = await context.params;
    if (!projectId || projectId.trim() === "") {
      return NextResponse.json(
        { error: "projectId es obligatorio." },
        { status: 400 }
      );
    }
    const auth = await requireAuthAndProjectOrGlobalPermission(
      request,
      projectId,
      "manage_project_members",
      "manage_any_project"
    );
    if (auth instanceof NextResponse) return auth;

    const body = (await request.json()) as {
      userId?: string;
      role?: string;
    };

    const targetUserId =
      typeof body.userId === "string" && body.userId.trim() !== ""
        ? body.userId.trim()
        : null;
    const role =
      body.role === "owner" || body.role === "editor" || body.role === "viewer"
        ? (body.role as ProjectMemberRole)
        : null;

    if (!targetUserId || !role) {
      return NextResponse.json(
        {
          error:
            "Se requieren userId y role válidos (role: 'owner' | 'editor' | 'viewer').",
        },
        { status: 400 }
      );
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

    const member = await setProjectMember(projectId, targetUserId, role);
    return NextResponse.json({ member });
  } catch (err) {
    console.error("admin/projects/[id]/members POST error", err);
    return NextResponse.json(
      { error: "Error al asignar el miembro al proyecto." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as { memberId?: string };
    const memberId =
      typeof body.memberId === "string" && body.memberId.trim() !== ""
        ? body.memberId.trim()
        : null;

    if (!memberId) {
      return NextResponse.json(
        { error: "Se requiere memberId en el body." },
        { status: 400 }
      );
    }

    const { data: memberRow } = await supabaseAdmin
      .from("project_members")
      .select("project_id")
      .eq("id", memberId)
      .maybeSingle();

    const projectId = (memberRow as { project_id?: string } | null)?.project_id?.trim() ?? null;
    if (!projectId) {
      return NextResponse.json(
        { error: "Miembro no encontrado." },
        { status: 404 }
      );
    }

    const auth = await requireAuthAndProjectOrGlobalPermission(
      request,
      projectId,
      "manage_project_members",
      "manage_any_project"
    );
    if (auth instanceof NextResponse) return auth;

    await removeProjectMember(memberId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("admin/projects/[id]/members DELETE error", err);
    return NextResponse.json(
      { error: "Error al eliminar el miembro del proyecto." },
      { status: 500 }
    );
  }
}
