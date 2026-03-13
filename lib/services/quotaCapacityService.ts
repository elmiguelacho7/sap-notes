/**
 * Capacity dashboard data for superadmin: quota usage across users and projects.
 * Thresholds: >= 100% at_limit, >= 80% near_limit, else normal; no limit = unlimited.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";

const NEAR_THRESHOLD = 0.8;
const QUOTA_KEYS = [
  "max_projects_created",
  "max_pending_invitations_per_project",
  "max_members_per_project",
  "max_clients_created",
] as const;

export type QuotaStatus = "unlimited" | "normal" | "near_limit" | "at_limit";

function computeStatus(current: number, limit: number | null): QuotaStatus {
  if (limit === null || limit <= 0) return "unlimited";
  if (current >= limit) return "at_limit";
  if (limit > 0 && current >= limit * NEAR_THRESHOLD) return "near_limit";
  return "normal";
}

function worstStatus(a: QuotaStatus, b: QuotaStatus): QuotaStatus {
  const order: QuotaStatus[] = ["at_limit", "near_limit", "normal", "unlimited"];
  return order[Math.min(order.indexOf(a), order.indexOf(b))];
}

export type UserCapacityRow = {
  userId: string;
  email: string | null;
  fullName: string | null;
  appRole: string;
  projectsUsed: number;
  projectsLimit: number | null;
  clientsUsed: number;
  clientsLimit: number | null;
  hasOverrides: boolean;
  status: QuotaStatus;
};

export type ProjectCapacityRow = {
  projectId: string;
  projectName: string;
  clientName: string | null;
  clientId: string | null;
  membersCurrent: number;
  membersLimit: number | null;
  invitationsCurrent: number;
  invitationsLimit: number | null;
  status: QuotaStatus;
};

export type CapacitySummary = {
  usersAtLimit: number;
  usersNearLimit: number;
  usersWithOverrides: number;
  projectsAtMemberLimit: number;
  projectsNearMemberLimit: number;
  projectsAtInvitationLimit: number;
  projectsNearInvitationLimit: number;
};

export type CapacityFilters = {
  role?: string;
  status?: QuotaStatus;
  overridesOnly?: boolean;
  projectsWithLimitsOnly?: boolean;
};

export type CapacityData = {
  summary: CapacitySummary;
  userUsage: UserCapacityRow[];
  projectUsage: ProjectCapacityRow[];
};

export async function getCapacityData(filters: CapacityFilters = {}): Promise<CapacityData> {
  const [profiles, userLimitsRows, roles, roleLimitsRows, projectsByUser, clientsByUser, projectsWithClient, memberCounts, invitationCounts, owners, managerRoleKeys] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, app_role, full_name, email").order("id"),
    supabaseAdmin.from("user_limits").select("user_id, limit_key, value").in("limit_key", [...QUOTA_KEYS]),
    supabaseAdmin.from("roles").select("id, key").eq("scope", "app"),
    supabaseAdmin.from("role_limits").select("role_id, limit_key, value").in("limit_key", [...QUOTA_KEYS]),
    supabaseAdmin.from("projects").select("created_by"),
    supabaseAdmin.from("clients").select("created_by"),
    supabaseAdmin.from("projects").select("id, name, client_id").order("name"),
    supabaseAdmin.from("project_members").select("project_id"),
    supabaseAdmin.from("project_invitations").select("project_id").eq("status", "pending"),
    supabaseAdmin.from("project_members").select("project_id, user_id").eq("role", "owner"),
    getManagerAppRoleKeys(),
  ]);

  const profilesList = (profiles.data ?? []) as { id: string; app_role: string; full_name: string | null; email: string | null }[];
  const userLimits = new Map<string, Map<string, number>>();
  for (const row of (userLimitsRows.data ?? []) as { user_id: string; limit_key: string; value: number }[]) {
    if (!userLimits.has(row.user_id)) userLimits.set(row.user_id, new Map());
    userLimits.get(row.user_id)!.set(row.limit_key, row.value);
  }
  const roleIdByKey = new Map<string, string>();
  for (const r of (roles.data ?? []) as { id: string; key: string }[]) {
    roleIdByKey.set(r.key.toLowerCase(), r.id);
  }
  const roleLimitsByRoleId = new Map<string, Map<string, number>>();
  for (const row of (roleLimitsRows.data ?? []) as { role_id: string; limit_key: string; value: number }[]) {
    if (!roleLimitsByRoleId.has(row.role_id)) roleLimitsByRoleId.set(row.role_id, new Map());
    roleLimitsByRoleId.get(row.role_id)!.set(row.limit_key, row.value);
  }

  function getEffectiveLimit(userId: string, limitKey: string): number | null {
    const appRole = profilesList.find((p) => p.id === userId)?.app_role?.trim()?.toLowerCase();
    if (appRole === "superadmin") return null;
    const ul = userLimits.get(userId)?.get(limitKey);
    if (ul != null) return ul;
    const roleId = appRole ? roleIdByKey.get(appRole) : null;
    if (!roleId) return null;
    return roleLimitsByRoleId.get(roleId)?.get(limitKey) ?? null;
  }

  const projectsByUserCount = new Map<string, number>();
  for (const row of (projectsByUser.data ?? []) as { created_by: string | null }[]) {
    if (row.created_by) {
      projectsByUserCount.set(row.created_by, (projectsByUserCount.get(row.created_by) ?? 0) + 1);
    }
  }
  const clientsByUserCount = new Map<string, number>();
  for (const row of (clientsByUser.data ?? []) as { created_by: string | null }[]) {
    if (row.created_by) {
      clientsByUserCount.set(row.created_by, (clientsByUserCount.get(row.created_by) ?? 0) + 1);
    }
  }

  const clientIds = Array.from(new Set((projectsWithClient.data ?? []).map((p: { client_id?: string | null }) => p.client_id).filter(Boolean))) as string[];
  let clientsMap = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data: clients } = await supabaseAdmin.from("clients").select("id, name").in("id", clientIds);
    for (const c of (clients ?? []) as { id: string; name: string }[]) {
      clientsMap.set(c.id, c.name ?? "");
    }
  }

  const memberCountByProject = new Map<string, number>();
  for (const row of (memberCounts.data ?? []) as { project_id: string }[]) {
    memberCountByProject.set(row.project_id, (memberCountByProject.get(row.project_id) ?? 0) + 1);
  }
  const invitationCountByProject = new Map<string, number>();
  for (const row of (invitationCounts.data ?? []) as { project_id: string }[]) {
    invitationCountByProject.set(row.project_id, (invitationCountByProject.get(row.project_id) ?? 0) + 1);
  }

  const ownersByProject = new Map<string, Set<string>>();
  for (const row of (owners.data ?? []) as { project_id: string; user_id: string }[]) {
    if (!ownersByProject.has(row.project_id)) ownersByProject.set(row.project_id, new Set());
    ownersByProject.get(row.project_id)!.add(row.user_id);
  }

  const globalManagerIds = new Set(
    profilesList.filter((p) => managerRoleKeys.includes(p.app_role?.trim()?.toLowerCase() ?? "")).map((p) => p.id)
  );

  const userUsage: UserCapacityRow[] = [];
  for (const p of profilesList) {
    const appRole = p.app_role?.trim() ?? "";
    const projectsUsed = projectsByUserCount.get(p.id) ?? 0;
    const projectsLimit = getEffectiveLimit(p.id, "max_projects_created");
    const clientsUsed = clientsByUserCount.get(p.id) ?? 0;
    const clientsLimit = getEffectiveLimit(p.id, "max_clients_created");
    const hasOverrides = userLimits.has(p.id);
    const s1 = computeStatus(projectsUsed, projectsLimit);
    const s2 = computeStatus(clientsUsed, clientsLimit);
    const status = worstStatus(s1, s2);
    userUsage.push({
      userId: p.id,
      email: p.email ?? null,
      fullName: p.full_name ?? null,
      appRole,
      projectsUsed,
      projectsLimit,
      clientsUsed,
      clientsLimit,
      hasOverrides,
      status,
    });
  }

  const projectRows = (projectsWithClient.data ?? []) as { id: string; name: string; client_id: string | null }[];
  const projectUsage: ProjectCapacityRow[] = [];
  for (const proj of projectRows) {
    const managers = new Set(ownersByProject.get(proj.id) ?? []);
    globalManagerIds.forEach((id) => managers.add(id));
    let membersLimit: number | null = null;
    let invitationsLimit: number | null = null;
    for (const uid of Array.from(managers)) {
      const ml = getEffectiveLimit(uid, "max_members_per_project");
      const il = getEffectiveLimit(uid, "max_pending_invitations_per_project");
      if (ml != null) membersLimit = membersLimit === null ? ml : Math.min(membersLimit, ml);
      if (il != null) invitationsLimit = invitationsLimit === null ? il : Math.min(invitationsLimit, il);
    }
    const membersCurrent = memberCountByProject.get(proj.id) ?? 0;
    const invitationsCurrent = invitationCountByProject.get(proj.id) ?? 0;
    const sm = computeStatus(membersCurrent, membersLimit);
    const si = computeStatus(invitationsCurrent, invitationsLimit);
    const status = worstStatus(sm, si);
    projectUsage.push({
      projectId: proj.id,
      projectName: proj.name,
      clientName: proj.client_id ? clientsMap.get(proj.client_id) ?? null : null,
      clientId: proj.client_id,
      membersCurrent,
      membersLimit,
      invitationsCurrent,
      invitationsLimit,
      status,
    });
  }

  const summary: CapacitySummary = {
    usersAtLimit: userUsage.filter((u) => u.status === "at_limit").length,
    usersNearLimit: userUsage.filter((u) => u.status === "near_limit").length,
    usersWithOverrides: userUsage.filter((u) => u.hasOverrides).length,
    projectsAtMemberLimit: projectUsage.filter((p) => p.membersLimit != null && p.membersCurrent >= p.membersLimit).length,
    projectsNearMemberLimit: projectUsage.filter(
      (p) => p.membersLimit != null && p.membersCurrent >= p.membersLimit * NEAR_THRESHOLD && p.membersCurrent < p.membersLimit
    ).length,
    projectsAtInvitationLimit: projectUsage.filter(
      (p) => p.invitationsLimit != null && p.invitationsCurrent >= p.invitationsLimit
    ).length,
    projectsNearInvitationLimit: projectUsage.filter(
      (p) =>
        p.invitationsLimit != null &&
        p.invitationsCurrent >= p.invitationsLimit * NEAR_THRESHOLD &&
        p.invitationsCurrent < p.invitationsLimit
    ).length,
  };

  let filteredUsers = userUsage;
  let filteredProjects = projectUsage;

  if (filters.role?.trim()) {
    const r = filters.role.trim().toLowerCase();
    filteredUsers = filteredUsers.filter((u) => u.appRole.toLowerCase() === r);
  }
  if (filters.status) {
    filteredUsers = filteredUsers.filter((u) => u.status === filters.status);
    filteredProjects = filteredProjects.filter((p) => p.status === filters.status);
  }
  if (filters.overridesOnly) {
    filteredUsers = filteredUsers.filter((u) => u.hasOverrides);
  }
  if (filters.projectsWithLimitsOnly) {
    filteredProjects = filteredProjects.filter((p) => p.membersLimit != null || p.invitationsLimit != null);
  }

  return {
    summary,
    userUsage: filteredUsers,
    projectUsage: filteredProjects,
  };
}

async function getManagerAppRoleKeys(): Promise<string[]> {
  const { data: perms } = await supabaseAdmin
    .from("permissions")
    .select("id")
    .eq("key", "manage_any_project")
    .eq("scope", "app")
    .maybeSingle();
  if (!perms) return [];
  const permId = (perms as { id: string }).id;
  const { data: rp } = await supabaseAdmin
    .from("role_permissions")
    .select("role_id")
    .eq("permission_id", permId);
  if (!rp?.length) return [];
  const roleIds = (rp as { role_id: string }[]).map((x) => x.role_id);
  const { data: roleRows } = await supabaseAdmin.from("roles").select("key").eq("scope", "app").in("id", roleIds);
  return (roleRows ?? []).map((r: { key: string }) => r.key.toLowerCase());
}
