import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUserWithRoleFromRequest,
  isProjectOwner,
} from "@/lib/auth/serverAuth";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/permissions
 * Returns { canEdit, canArchive, canDelete } for the current user.
 * - canEdit / canArchive: superadmin or project owner
 * - canDelete: superadmin only
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUserWithRoleFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { canEdit: false, canArchive: false, canDelete: false },
        { status: 200 }
      );
    }

    const { id: projectId } = await params;
    if (!projectId || String(projectId).trim() === "") {
      return NextResponse.json(
        { error: "Se requiere el id del proyecto." },
        { status: 400 }
      );
    }

    const isOwner = await isProjectOwner(user.userId, projectId);
    const canEdit = user.appRole === "superadmin" || isOwner;
    const canArchive = canEdit;
    const canDelete = user.appRole === "superadmin";

    return NextResponse.json({
      canEdit,
      canArchive,
      canDelete,
    });
  } catch (err) {
    console.error("projects permissions GET error", err);
    return NextResponse.json(
      { canEdit: false, canArchive: false, canDelete: false },
      { status: 200 }
    );
  }
}
