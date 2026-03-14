/**
 * RBAC permission helpers. Built on existing structure:
 * - Global: profiles.app_role -> roles (scope='app') -> role_permissions -> permissions
 * - Project: project_members.role -> roles (scope='project') -> role_permissions -> permissions
 *
 * Use in API routes and server code. Safe to call with invalid userId/projectId (returns false).
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentUserIdFromRequest } from "@/lib/auth/serverAuth";

/** Thrown when the user is authenticated but lacks the required permission. Return 403. */
export class PermissionDeniedError extends Error {
  readonly statusCode = 403;
  constructor(permissionKey: string, scope: "global" | "project" = "global") {
    super(`Permission denied: ${permissionKey} (${scope})`);
    this.name = "PermissionDeniedError";
  }
}

/**
 * Requires the user to have the given global permission. Throws PermissionDeniedError if not.
 * Call after authenticating (userId must be non-null). Use in API routes and return 403 when caught.
 */
export async function requireGlobalPermission(
  userId: string,
  permissionKey: string
): Promise<void> {
  if (!userId?.trim()) throw new PermissionDeniedError(permissionKey, "global");
  const has = await hasGlobalPermission(userId, permissionKey);
  if (!has) throw new PermissionDeniedError(permissionKey, "global");
}

/**
 * Requires the user to have the given project permission. Throws PermissionDeniedError if not.
 * Call after authenticating and resolving projectId. Use in API routes and return 403 when caught.
 */
export async function requireProjectPermission(
  userId: string,
  projectId: string,
  permissionKey: string
): Promise<void> {
  if (!userId?.trim() || !projectId?.trim()) throw new PermissionDeniedError(permissionKey, "project");
  const has = await hasProjectPermission(userId, projectId, permissionKey);
  if (!has) throw new PermissionDeniedError(permissionKey, "project");
}

/**
 * Authenticates the request and requires the given global permission.
 * Returns { userId } on success, or a NextResponse for 401/403 that the route should return.
 */
export async function requireAuthAndGlobalPermission(
  request: Request,
  permissionKey: string
): Promise<{ userId: string } | NextResponse> {
  const userId = await getCurrentUserIdFromRequest(request);
  if (!userId?.trim()) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    await requireGlobalPermission(userId, permissionKey);
    return { userId };
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return NextResponse.json({ error: "No tiene permiso para esta acción." }, { status: 403 });
    }
    throw e;
  }
}

/**
 * Authenticates the request and requires the given project permission.
 * Returns { userId } on success, or a NextResponse for 401/403 that the route should return.
 */
export async function requireAuthAndProjectPermission(
  request: Request,
  projectId: string,
  permissionKey: string
): Promise<{ userId: string } | NextResponse> {
  const userId = await getCurrentUserIdFromRequest(request);
  if (!userId?.trim()) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!projectId?.trim()) {
    return NextResponse.json({ error: "Proyecto no especificado." }, { status: 400 });
  }
  try {
    await requireProjectPermission(userId, projectId, permissionKey);
    return { userId };
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return NextResponse.json({ error: "No tiene permiso para esta acción." }, { status: 403 });
    }
    throw e;
  }
}

/**
 * For admin-style routes: requires either the global permission (e.g. manage_any_project for write override)
 * or the project permission (e.g. manage_project_members). Returns { userId } or NextResponse.
 */
export async function requireAuthAndProjectOrGlobalPermission(
  request: Request,
  projectId: string,
  projectPermissionKey: string,
  globalPermissionKey: string
): Promise<{ userId: string } | NextResponse> {
  const userId = await getCurrentUserIdFromRequest(request);
  if (!userId?.trim()) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!projectId?.trim()) {
    return NextResponse.json({ error: "Proyecto no especificado." }, { status: 400 });
  }
  const hasGlobal = await hasGlobalPermission(userId, globalPermissionKey);
  if (hasGlobal) return { userId };
  try {
    await requireProjectPermission(userId, projectId, projectPermissionKey);
    return { userId };
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return NextResponse.json({ error: "No tiene permiso para esta acción." }, { status: 403 });
    }
    throw e;
  }
}

/**
 * Returns true if the user has the given global (app) permission.
 * Derives from profiles.app_role -> roles -> role_permissions.
 */
export async function hasGlobalPermission(
  userId: string,
  permissionKey: string
): Promise<boolean> {
  if (!userId?.trim() || !permissionKey?.trim()) return false;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("app_role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile?.app_role) return false;

  const appRole = String(profile.app_role).trim().toLowerCase();

  const { data: roleRow, error: roleError } = await supabaseAdmin
    .from("roles")
    .select("id")
    .eq("scope", "app")
    .eq("key", appRole)
    .maybeSingle();

  if (roleError || !roleRow) return false;

  const { data: permRow, error: permError } = await supabaseAdmin
    .from("permissions")
    .select("id")
    .eq("scope", "app")
    .eq("key", permissionKey.trim())
    .maybeSingle();

  if (permError || !permRow) return false;

  const { data: rp, error: rpError } = await supabaseAdmin
    .from("role_permissions")
    .select("role_id")
    .eq("role_id", roleRow.id)
    .eq("permission_id", permRow.id)
    .maybeSingle();

  return !rpError && !!rp;
}

/**
 * Returns true if the user has the given project permission in the given project.
 * Derives from project_members.role -> roles -> role_permissions.
 */
export async function hasProjectPermission(
  userId: string,
  projectId: string,
  permissionKey: string
): Promise<boolean> {
  if (!userId?.trim() || !projectId?.trim() || !permissionKey?.trim()) return false;

  const { data: member, error: memberError } = await supabaseAdmin
    .from("project_members")
    .select("role")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (memberError || !member?.role) return false;

  const roleKey = String((member as { role: string }).role).trim().toLowerCase();

  const { data: roleRow, error: roleError } = await supabaseAdmin
    .from("roles")
    .select("id")
    .eq("scope", "project")
    .eq("key", roleKey)
    .maybeSingle();

  if (roleError || !roleRow) return false;

  const { data: permRow, error: permError } = await supabaseAdmin
    .from("permissions")
    .select("id")
    .eq("scope", "project")
    .eq("key", permissionKey.trim())
    .maybeSingle();

  if (permError || !permRow) return false;

  const { data: rp, error: rpError } = await supabaseAdmin
    .from("role_permissions")
    .select("role_id")
    .eq("role_id", roleRow.id)
    .eq("permission_id", permRow.id)
    .maybeSingle();

  return !rpError && !!rp;
}

/**
 * Returns true if the user has a row in project_members for the given project (explicit membership).
 * Use to distinguish "member of team" from "access via global role only".
 */
export async function isExplicitProjectMember(
  userId: string,
  projectId: string
): Promise<boolean> {
  if (!userId?.trim() || !projectId?.trim()) return false;
  const { data, error } = await supabaseAdmin
    .from("project_members")
    .select("id")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .maybeSingle();
  return !error && !!data;
}

/** Global permission keys (app scope). Use with hasGlobalPermission. */
export const GLOBAL_PERMISSION_KEYS = [
  "view_dashboard",
  "view_admin_panel",
  "manage_users",
  "manage_global_roles",
  "manage_user_activation",
  "manage_clients",
  "create_project",
  "view_all_projects",
  "manage_any_project",
  "delete_any_project",
  "manage_knowledge_sources",
  "view_global_notes",
  "manage_global_notes",
  "view_global_metrics",
  "manage_platform_settings",
  "use_global_ai",
] as const;

/** Project permission keys (project scope). Use with hasProjectPermission. */
export const PROJECT_PERMISSION_KEYS = [
  "view_project",
  "edit_project",
  "manage_project_members",
  "view_project_notes",
  "create_project_notes",
  "edit_project_notes",
  "delete_project_notes",
  "view_project_tasks",
  "manage_project_tasks",
  "view_project_activities",
  "manage_project_activities",
  "view_project_tickets",
  "manage_project_tickets",
  "view_project_knowledge",
  "manage_project_knowledge",
  "use_project_ai",
] as const;
