import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminFromRequest } from "@/lib/auth/serverAuth";
import {
  getProjectMembers,
  setProjectMember,
  removeProjectMember,
  type ProjectMemberRole,
} from "@/lib/services/adminService";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const userId = await requireSuperAdminFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado. Solo superadministradores." },
        { status: 403 }
      );
    }

    const { id: projectId } = await context.params;
    if (!projectId || projectId.trim() === "") {
      return NextResponse.json(
        { error: "projectId es obligatorio." },
        { status: 400 }
      );
    }

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

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const userId = await requireSuperAdminFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado. Solo superadministradores." },
        { status: 403 }
      );
    }

    const { id: projectId } = await context.params;
    if (!projectId || projectId.trim() === "") {
      return NextResponse.json(
        { error: "projectId es obligatorio." },
        { status: 400 }
      );
    }

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
    const userId = await requireSuperAdminFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado. Solo superadministradores." },
        { status: 403 }
      );
    }

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
