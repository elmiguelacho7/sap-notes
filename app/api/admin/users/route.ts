import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminFromRequest } from "@/lib/auth/serverAuth";
import {
  getAllUsersWithRoles,
  updateUserAppRole,
  createAdminUser,
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
      app_role?: string;
    };

    const targetUserId =
      typeof body.userId === "string" && body.userId.trim() !== ""
        ? body.userId.trim()
        : null;
    const rawRole = body.appRole ?? body.app_role;
    const appRole =
      rawRole === "superadmin" || rawRole === "admin" || rawRole === "consultant" || rawRole === "viewer"
        ? (rawRole as AppRole)
        : null;

    if (!targetUserId || !appRole) {
      return NextResponse.json(
        {
          error:
            "Se requieren userId y appRole válidos (appRole: 'superadmin' | 'admin' | 'consultant' | 'viewer').",
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

/**
 * POST /api/admin/users
 * Create/invite a user. Body: { email, full_name?, app_role? }.
 * Superadmin only. Creates auth user and profile.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireSuperAdminFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: "No autorizado. Solo superadministradores." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      email?: string;
      full_name?: string;
      app_role?: string;
    };

    const email =
      typeof body.email === "string" && body.email.trim() !== ""
        ? body.email.trim()
        : null;

    if (!email) {
      return NextResponse.json(
        { error: "Se requiere el email del usuario." },
        { status: 400 }
      );
    }

    const appRole =
      body.app_role === "superadmin" || body.app_role === "admin" || body.app_role === "consultant" || body.app_role === "viewer"
        ? (body.app_role as AppRole)
        : undefined;

    const result = await createAdminUser({
      email,
      full_name: typeof body.full_name === "string" ? body.full_name : undefined,
      app_role: appRole,
    });

    return NextResponse.json({
      id: result.id,
      email: result.email,
      message: "Usuario creado correctamente.",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al crear el usuario.";
    console.error("admin/users POST error", err);
    if (message.includes("Ya existe")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
