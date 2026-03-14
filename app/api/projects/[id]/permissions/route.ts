import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithRoleFromRequest } from "@/lib/auth/serverAuth";
import { hasProjectPermission, hasGlobalPermission, isExplicitProjectMember } from "@/lib/auth/permissions";
import { checkQuota } from "@/lib/auth/quota";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/permissions
 * Returns { canEdit, canArchive, canDelete, canManageMembers, canEditProjectNotes, canDeleteProjectNotes, canManageProjectTickets } for the current user.
 * - canEdit / canArchive: from project permission edit_project (e.g. project owner).
 * - canDelete: edit_project on this project (owner can delete own) OR delete_any_project (global).
 * - canManageMembers: manage_project_members on this project OR manage_any_project (global).
 * - canEditProjectNotes / canDeleteProjectNotes: edit_project_notes / delete_project_notes on this project (for notes UI).
 * - canManageProjectTickets: manage_project_tickets on this project (for tickets UI).
 * - hasGlobalOverride: true if user can access this project via global role (e.g. view_all_projects, manage_any_project) without being in project_members.
 * - isExplicitMember: true if user has a row in project_members for this project.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUserWithRoleFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { canEdit: false, canArchive: false, canDelete: false, canManageMembers: false, canEditProjectNotes: false, canDeleteProjectNotes: false, canManageProjectTickets: false, canUseProjectAI: false, hasGlobalOverride: false, isExplicitMember: false, memberQuota: null, pendingInvitationsQuota: null },
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

    const canEdit = await hasProjectPermission(user.userId, projectId, "edit_project");
    const canArchive = canEdit;
    const canDelete =
      (await hasProjectPermission(user.userId, projectId, "edit_project")) ||
      (await hasGlobalPermission(user.userId, "delete_any_project"));
    const canManageMembers =
      (await hasProjectPermission(user.userId, projectId, "manage_project_members")) ||
      (await hasGlobalPermission(user.userId, "manage_any_project"));
    const canEditProjectNotes = await hasProjectPermission(user.userId, projectId, "edit_project_notes");
    const canDeleteProjectNotes = await hasProjectPermission(user.userId, projectId, "delete_project_notes");
    const canManageProjectTickets = await hasProjectPermission(user.userId, projectId, "manage_project_tickets");
    const canUseProjectAI = await hasProjectPermission(user.userId, projectId, "use_project_ai");

    const [hasGlobalOverride, isExplicitMember] = await Promise.all([
      Promise.all([
        hasGlobalPermission(user.userId, "view_all_projects"),
        hasGlobalPermission(user.userId, "manage_any_project"),
        hasGlobalPermission(user.userId, "delete_any_project"),
      ]).then(([v, m, d]) => v || m || d),
      isExplicitProjectMember(user.userId, projectId),
    ]);

    let memberQuota: { atLimit: boolean; current: number; limit: number | null } | null = null;
    let pendingInvitationsQuota: { atLimit: boolean; current: number; limit: number | null } | null = null;
    if (canManageMembers) {
      const [memberQ, invQ] = await Promise.all([
        checkQuota(user.userId, "max_members_per_project", projectId),
        checkQuota(user.userId, "max_pending_invitations_per_project", projectId),
      ]);
      memberQuota = { atLimit: !memberQ.allowed, current: memberQ.current, limit: memberQ.limit };
      pendingInvitationsQuota = { atLimit: !invQ.allowed, current: invQ.current, limit: invQ.limit };
    }

    return NextResponse.json({
      canEdit,
      canArchive,
      canDelete,
      canManageMembers,
      canEditProjectNotes,
      canDeleteProjectNotes,
      canManageProjectTickets,
      canUseProjectAI,
      hasGlobalOverride,
      isExplicitMember,
      memberQuota,
      pendingInvitationsQuota,
    });
  } catch (err) {
    console.error("projects permissions GET error", err);
    return NextResponse.json(
      {
        canEdit: false,
        canArchive: false,
        canDelete: false,
        canManageMembers: false,
        canEditProjectNotes: false,
        canDeleteProjectNotes: false,
        canManageProjectTickets: false,
        canUseProjectAI: false,
        hasGlobalOverride: false,
        isExplicitMember: false,
        memberQuota: null,
        pendingInvitationsQuota: null,
      },
      { status: 200 }
    );
  }
}
