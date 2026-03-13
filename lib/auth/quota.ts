/**
 * Quota enforcement. Evaluation: user override -> role default -> unlimited.
 * Superadmin is always treated as unlimited.
 * Supported keys: max_projects_created, max_pending_invitations_per_project,
 * max_members_per_project, max_clients_created.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const QUOTA_KEYS = [
  "max_projects_created",
  "max_pending_invitations_per_project",
  "max_members_per_project",
  "max_clients_created",
] as const;

export type QuotaKey = (typeof QUOTA_KEYS)[number];

export type CheckQuotaResult = {
  allowed: boolean;
  current: number;
  limit: number | null;
};

/**
 * Returns the effective limit for the user (user override > role default > null = unlimited).
 * Superadmin always returns null (unlimited).
 */
export async function getEffectiveLimit(
  userId: string,
  limitKey: string,
  _projectId?: string
): Promise<number | null> {
  if (!userId?.trim() || !limitKey?.trim()) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("app_role")
    .eq("id", userId)
    .maybeSingle();

  const appRole = (profile as { app_role?: string } | null)?.app_role?.trim()?.toLowerCase();
  if (appRole === "superadmin") return null;

  const key = limitKey.trim();

  const { data: userLimit } = await supabaseAdmin
    .from("user_limits")
    .select("value")
    .eq("user_id", userId)
    .eq("limit_key", key)
    .maybeSingle();

  if (userLimit && typeof (userLimit as { value: number }).value === "number")
    return (userLimit as { value: number }).value;

  if (!appRole) return null;

  const { data: roleRow } = await supabaseAdmin
    .from("roles")
    .select("id")
    .eq("scope", "app")
    .eq("key", appRole)
    .maybeSingle();

  if (!roleRow) return null;

  const { data: roleLimit } = await supabaseAdmin
    .from("role_limits")
    .select("value")
    .eq("role_id", (roleRow as { id: string }).id)
    .eq("limit_key", key)
    .maybeSingle();

  if (roleLimit && typeof (roleLimit as { value: number }).value === "number")
    return (roleLimit as { value: number }).value;

  return null;
}

/**
 * Returns current usage for the given quota key.
 */
export async function getCurrentUsage(
  userId: string,
  limitKey: string,
  projectId?: string
): Promise<number> {
  const key = limitKey.trim();

  if (key === "max_projects_created") {
    const { count, error } = await supabaseAdmin
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("created_by", userId);
    if (error) return 0;
    return count ?? 0;
  }

  if (key === "max_pending_invitations_per_project" && projectId?.trim()) {
    const { count, error } = await supabaseAdmin
      .from("project_invitations")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId.trim())
      .eq("status", "pending");
    if (error) return 0;
    return count ?? 0;
  }

  if (key === "max_members_per_project" && projectId?.trim()) {
    const { count, error } = await supabaseAdmin
      .from("project_members")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId.trim());
    if (error) return 0;
    return count ?? 0;
  }

  if (key === "max_clients_created") {
    const { count, error } = await supabaseAdmin
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("created_by", userId);
    if (error) return 0;
    return count ?? 0;
  }

  return 0;
}

/**
 * Checks whether the user is within quota. Returns { allowed, current, limit }.
 * Superadmin is always allowed (limit null).
 */
export async function checkQuota(
  userId: string,
  limitKey: string,
  projectId?: string
): Promise<CheckQuotaResult> {
  const current = await getCurrentUsage(userId, limitKey, projectId);
  const limit = await getEffectiveLimit(userId, limitKey, projectId);

  if (limit === null) return { allowed: true, current, limit: null };
  return {
    allowed: current < limit,
    current,
    limit,
  };
}
