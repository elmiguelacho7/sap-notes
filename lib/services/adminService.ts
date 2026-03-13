import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ==========================
// Types
// ==========================

export type AppRole = "superadmin" | "admin" | "consultant" | "viewer";

export type ProjectMemberRole = "owner" | "editor" | "viewer";

export type UserWithRole = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  app_role: string;
  is_active: boolean;
};

export type ProjectMemberRow = {
  id: string;
  user_id: string;
  project_id: string;
  role: ProjectMemberRole;
  /** Name from profiles.full_name; can be null. */
  user_full_name: string | null;
  /** Email from profiles; can be null. */
  user_email: string | null;
  /** app_role from profiles join; can be null or undefined. */
  user_app_role: string | null | undefined;
};

export type ProjectMemberWithProfile = ProjectMemberRow;

// ==========================
// findUserIdByEmail
// ==========================

/**
 * Resolves auth user id from email: profiles.email first (case-insensitive), then auth.users.
 * Returns null if not found.
 */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle();

  if (profile?.id) return (profile as { id: string }).id;

  const { data: authData } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 1000,
  });
  const user = (authData?.users ?? []).find(
    (u) => u.email?.toLowerCase() === normalized
  );
  return user?.id ?? null;
}

// ==========================
// createAdminUser
// ==========================

export type CreateAdminUserInput = {
  email: string;
  full_name?: string | null;
  app_role?: AppRole;
};

/**
 * Creates an auth user (email_confirm: true) and ensures a profiles row exists.
 * Returns { id, email }. Throws on duplicate email or other error.
 */
export async function createAdminUser(
  input: CreateAdminUserInput
): Promise<{ id: string; email: string }> {
  const email = input.email.trim();
  if (!email) throw new Error("Email is required");

  const appRole: AppRole =
    input.app_role === "superadmin" || input.app_role === "admin" || input.app_role === "consultant" || input.app_role === "viewer"
      ? input.app_role
      : "consultant";
  const fullName = input.full_name?.trim() ?? null;

  const { data: authUser, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

  if (authError) {
    if (authError.message?.toLowerCase().includes("already been registered")) {
      throw new Error("Ya existe un usuario con ese email.");
    }
    throw new Error(authError.message || "Error al crear el usuario.");
  }

  if (!authUser?.user?.id) {
    throw new Error("Error al crear el usuario.");
  }

  const userId = authUser.user.id;

  if (process.env.NODE_ENV === "development") {
    console.debug("[createAdminUser] Upserting profile with is_active = true (admin-created user).");
  }

  await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      app_role: appRole,
      is_active: true,
    },
    { onConflict: "id" }
  );

  return { id: userId, email: authUser.user.email ?? email };
}

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
    .select("id, full_name, email, app_role, is_active")
    .order("id", { ascending: true });

  if (profilesError) {
    throw new Error(
      `Failed to load profiles: ${profilesError.message}`
    );
  }

  const list = (profiles ?? []) as {
    id: string;
    full_name: string | null;
    email: string | null;
    app_role: string;
    is_active: boolean;
  }[];

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
      is_active: p.is_active === true,
    }));
  } catch {
    return list.map((p) => ({
      id: p.id,
      email: p.email ?? null,
      full_name: p.full_name ?? null,
      app_role: p.app_role,
      is_active: p.is_active === true,
    }));
  }
}

// ==========================
// setUserActivation
// ==========================

export async function setUserActivation(
  userId: string,
  isActive: boolean
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);

  if (error) {
    throw new Error(
      `Failed to update user activation: ${error.message}`
    );
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

/** Raw shape from Supabase project_members + profiles join. */
type SupabaseProjectMemberRow = {
  id: string;
  user_id: string;
  project_id: string;
  role: string;
  profiles: {
    full_name: string | null;
    email: string | null;
    app_role: string | null;
  } | null;
};

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
      profiles!project_members_user_id_fkey (
        full_name,
        email,
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
  const rows = (data ?? []) as unknown as SupabaseProjectMemberRow[];

  const members: ProjectMemberWithProfile[] = rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    project_id: row.project_id,
    role: row.role as ProjectMemberRole,
    user_full_name: row.profiles?.full_name ?? null,
    user_email: row.profiles?.email ?? null,
    user_app_role: row.profiles?.app_role ?? null,
  }));

  return members;
}

// ==========================
// isUserProjectMember
// ==========================

export async function isUserProjectMember(
  projectId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return false;

  return !!data;
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
      profiles!project_members_user_id_fkey (
        full_name,
        email,
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
  const row = data as unknown as SupabaseProjectMemberRow;

  return {
    id: row.id,
    user_id: row.user_id,
    project_id: row.project_id,
    role: row.role as ProjectMemberRole,
    user_full_name: row.profiles?.full_name ?? null,
    user_email: row.profiles?.email ?? null,
    user_app_role: row.profiles?.app_role ?? null,
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

// ==========================
// project_invitations (invite by email)
// ==========================

/**
 * Upsert a pending project invitation. Uses service role.
 * ON CONFLICT (project_id, email) updates role, status, invited_by, invited_at.
 */
export async function upsertProjectInvitation(
  projectId: string,
  email: string,
  role: ProjectMemberRole,
  invitedBy: string | null
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("Email requerido.");

  const { error } = await supabaseAdmin
    .from("project_invitations")
    .upsert(
      {
        project_id: projectId,
        email: normalized,
        role,
        status: "pending",
        invited_by: invitedBy,
        invited_at: new Date().toISOString(),
      },
      { onConflict: "project_id,email" }
    );

  if (error) {
    throw new Error(
      error.message || "Error al guardar la invitación."
    );
  }
}

/**
 * Send Supabase invite email. Uses auth.admin.inviteUserByEmail.
 * redirectTo should be the app URL where the user lands after accepting (e.g. /auth/callback).
 */
export async function sendInviteEmail(
  email: string,
  options?: { redirectTo?: string }
): Promise<void> {
  const result = await inviteUserByEmailWithResult(
    email,
    options?.redirectTo
  );
  if (result.error) {
    if (result.error.message?.toLowerCase().includes("already been registered")) {
      throw new Error("Ya existe un usuario con ese email.");
    }
    throw new Error(result.error.message || "Error al enviar la invitación.");
  }
}

/**
 * Call inviteUserByEmail and return raw result for logging/debugging.
 */
export async function inviteUserByEmailWithResult(
  email: string,
  redirectTo?: string
): Promise<{
  data: unknown;
  error: { message: string; status?: number; code?: string } | null;
}> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return { data: null, error: { message: "Email requerido." } };
  }

  const baseUrl =
    redirectTo ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof process.env.VERCEL_URL === "string"
      ? `https://${process.env.VERCEL_URL}`
      : undefined);

  const redirectToFinal = baseUrl
    ? `${baseUrl.replace(/\/$/, "")}/auth/callback`
    : undefined;

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    normalized,
    redirectToFinal ? { redirectTo: redirectToFinal } : {}
  );

  return {
    data,
    error: error
      ? {
          message: error.message,
          status: (error as { status?: number }).status,
          code: (error as { code?: string }).code,
        }
      : null,
  };
}

/**
 * Generate a magic link for signup (fallback when invite email fails).
 * Returns the action_link so it can be sent manually.
 */
export async function generateMagicLinkForInvite(
  email: string,
  redirectTo: string
): Promise<string> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("Email requerido.");

  const redirectToFinal = `${redirectTo.replace(/\/$/, "")}/auth/callback`;

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: normalized,
    options: { redirectTo: redirectToFinal },
  });

  if (error) {
    throw new Error(error.message || "Error al generar el enlace.");
  }

  const link =
    (data as { properties?: { action_link?: string } })?.properties
      ?.action_link ?? (data as { action_link?: string })?.action_link ?? "";

  if (!link) {
    throw new Error("No se pudo generar el enlace de invitación.");
  }

  return link;
}

// ==========================
// User deletion (safe: only when no transactional data)
// ==========================

/** Result of eligibility check for physical user deletion. */
export type UserDeletionEligibility = {
  allowed: boolean;
  reason?: string;
};

/**
 * Checks whether a user can be physically deleted.
 * Deletion is blocked if the user has any transactional data (notes, tickets, tasks, etc.).
 * project_members and project_invitations are not considered blocking; they are cleaned up during deletion.
 */
export async function canDeleteUser(userId: string): Promise<UserDeletionEligibility> {
  if (!userId?.trim()) {
    return { allowed: false, reason: "User id is required." };
  }

  const tablesToCheck: { table: string; column: string }[] = [
    { table: "conversation_logs", column: "user_id" },
    { table: "project_tasks", column: "assignee_profile_id" },
    { table: "project_activities", column: "owner_profile_id" },
    { table: "knowledge_sources", column: "created_by" },
    { table: "knowledge_documents", column: "user_id" },
    { table: "external_integrations", column: "owner_profile_id" },
    { table: "projects", column: "created_by" },
    { table: "knowledge_spaces", column: "owner_profile_id" },
    { table: "knowledge_pages", column: "owner_profile_id" },
  ];

  for (const { table, column } of tablesToCheck) {
    try {
      const { data, error } = await supabaseAdmin
        .from(table as "profiles")
        .select("id")
        .eq(column as "id", userId)
        .limit(1)
        .maybeSingle();

      if (error) {
        if (error.code === "PGRST116" || error.message?.includes("column") || error.message?.includes("does not exist")) {
          continue;
        }
        throw new Error(`${table}.${column}: ${error.message}`);
      }
      if (data) {
        return {
          allowed: false,
          reason: "user_has_transactional_data",
        };
      }
    } catch (err) {
      if (err instanceof Error && (err.message.includes("column") || err.message.includes("does not exist"))) {
        continue;
      }
      throw err;
    }
  }

  const optionalChecks: { table: string; column: string }[] = [
    { table: "notes", column: "created_by" },
    { table: "tickets", column: "created_by" },
    { table: "tasks", column: "created_by" },
  ];
  for (const { table, column } of optionalChecks) {
    try {
      const { data } = await supabaseAdmin
        .from(table as "profiles")
        .select("id")
        .eq(column as "id", userId)
        .limit(1)
        .maybeSingle();
      if (data) {
        return { allowed: false, reason: "user_has_transactional_data" };
      }
    } catch {
      // Column or table may not exist; skip
    }
  }

  return { allowed: true };
}

/**
 * Physically deletes a user after eligibility has been confirmed.
 * Cleans up project_members and project_invitations references, then deletes profile and auth user.
 */
export async function deleteUser(userId: string): Promise<void> {
  if (!userId?.trim()) {
    throw new Error("User id is required.");
  }

  const eligibility = await canDeleteUser(userId);
  if (!eligibility.allowed) {
    throw new Error(
      eligibility.reason === "user_has_transactional_data"
        ? "User has transactional data and cannot be deleted."
        : eligibility.reason ?? "User cannot be deleted."
    );
  }

  await supabaseAdmin.from("project_members").delete().eq("user_id", userId);
  await supabaseAdmin.from("project_invitations").update({ invited_by: null }).eq("invited_by", userId);
  await supabaseAdmin.from("project_invitations").update({ accepted_by: null }).eq("accepted_by", userId);

  const { error: profileError } = await supabaseAdmin.from("profiles").delete().eq("id", userId);
  if (profileError) {
    throw new Error(`Failed to delete profile: ${profileError.message}`);
  }

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authError) {
    throw new Error(`Failed to delete auth user: ${authError.message}`);
  }
}
