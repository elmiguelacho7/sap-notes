import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminFromRequest } from "@/lib/auth/serverAuth";
import {
  getAllUsersWithRoles,
  updateUserAppRole,
  type AppRole,
} from "@/lib/services/adminService";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSuperAdminFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado. Solo superadministradores." },
        { status: 403 }
      );
    }

    const users = await getAllUsersWithRoles();
    return NextResponse.json({ users });
  } catch (err) {
    console.error("admin/users GET error", err);
    return NextResponse.json(
      { error: "Error al cargar los usuarios." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireSuperAdminFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado. Solo superadministradores." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      userId?: string;
      appRole?: string;
    };

    const targetUserId =
      typeof body.userId === "string" && body.userId.trim() !== ""
        ? body.userId.trim()
        : null;
    const appRole =
      body.appRole === "superadmin" || body.appRole === "consultant"
        ? (body.appRole as AppRole)
        : null;

    if (!targetUserId || !appRole) {
      return NextResponse.json(
        {
          error:
            "Se requieren userId y appRole válidos (appRole: 'superadmin' | 'consultant').",
        },
        { status: 400 }
      );
    }

    await updateUserAppRole(targetUserId, appRole);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("admin/users PATCH error", err);
    return NextResponse.json(
      { error: "Error al actualizar el rol del usuario." },
      { status: 500 }
    );
  }
}
