import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ==========================
// Types
// ==========================

export type AppRole = "superadmin" | "consultant";

export type ProjectMemberRole = "owner" | "editor" | "viewer";

export type UserWithRole = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  app_role: string;
};

export type ProjectMemberWithProfile = {
  id: string;
  user_id: string;
  project_id: string;
  role: ProjectMemberRole;
  user_full_name?: string | null;
  user_app_role?: string;
};

// ==========================
// getAllUsersWithRoles
// ==========================

/**
 * Returns all users with their profile data (id, full_name, app_role).
 * Tries to attach email from Auth when available.
 */
export async function getAllUsersWithRoles(): Promise<UserWithRole[]> {
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, app_role")
    .order("id", { ascending: true });

  if (profilesError) {
    throw new Error(
      `Failed to load profiles: ${profilesError.message}`
    );
  }

  const list = (profiles ?? []) as { id: string; full_name: string | null; email: string | null; app_role: string }[];

  // Prefer email from profiles; optionally enrich from Auth when available
  try {
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });
    const users = authData?.users ?? [];
    const emailById = new Map(users.map((u) => [u.id, u.email ?? null]));

    return list.map((p) => ({
      id: p.id,
      email: emailById.get(p.id) ?? p.email ?? null,
      full_name: p.full_name ?? null,
      app_role: p.app_role,
    }));
  } catch {
    return list.map((p) => ({
      id: p.id,
      email: p.email ?? null,
      full_name: p.full_name ?? null,
      app_role: p.app_role,
    }));
  }
}

// ==========================
// updateUserAppRole
// ==========================

export async function updateUserAppRole(
  userId: string,
  appRole: AppRole
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ app_role: appRole })
    .eq("id", userId);

  if (error) {
    throw new Error(
      `Failed to update user app role: ${error.message}`
    );
  }
}

// ==========================
// getProjectMembers
// ==========================

export async function getProjectMembers(
  projectId: string
): Promise<ProjectMemberWithProfile[]> {
  const { data, error } = await supabaseAdmin
    .from("project_members")
    .select(
      `
      id,
      user_id,
      project_id,
      role,
      profiles (
        full_name,
        app_role
      )
    `
    )
    .eq("project_id", projectId)
    .order("role", { ascending: true });

  if (error) {
    throw new Error(
      `Failed to load project members: ${error.message}`
    );
  }

  const rows = (data ?? []) as Array<{
    id: string;
    user_id: string;
    project_id: string;
    role: string;
    profiles: { full_name: string | null; app_role: string } | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    project_id: row.project_id,
    role: row.role as ProjectMemberRole,
    user_full_name: row.profiles?.full_name ?? null,
    user_app_role: row.profiles?.app_role,
  }));
}

// ==========================
// setProjectMember
// ==========================

export async function setProjectMember(
  projectId: string,
  userId: string,
  role: ProjectMemberRole
): Promise<ProjectMemberWithProfile> {
  const { data, error } = await supabaseAdmin
    .from("project_members")
    .upsert(
      { project_id: projectId, user_id: userId, role, updated_at: new Date().toISOString() },
      { onConflict: "project_id,user_id" }
    )
    .select(
      `
      id,
      user_id,
      project_id,
      role,
      profiles (
        full_name,
        app_role
      )
    `
    )
    .single();

  if (error) {
    throw new Error(
      `Failed to set project member: ${error.message}`
    );
  }

  const row = data as {
    id: string;
    user_id: string;
    project_id: string;
    role: string;
    profiles: { full_name: string | null; app_role: string } | null;
  };

  return {
    id: row.id,
    user_id: row.user_id,
    project_id: row.project_id,
    role: row.role as ProjectMemberRole,
    user_full_name: row.profiles?.full_name ?? null,
    user_app_role: row.profiles?.app_role,
  };
}

// ==========================
// removeProjectMember
// ==========================

export async function removeProjectMember(
  projectMemberId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("project_members")
    .delete()
    .eq("id", projectMemberId);

  if (error) {
    throw new Error(
      `Failed to remove project member: ${error.message}`
    );
  }
}
