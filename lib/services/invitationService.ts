import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateInvitationToken, hashToken } from "@/lib/invitationToken";

export type ProjectMemberRole = "owner" | "editor" | "viewer";

export type ProjectInvitationRow = {
  id: string;
  project_id: string;
  email: string;
  role: string;
  token_hash: string;
  invited_by: string | null;
  status: string;
  expires_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Create a new pending invitation with a secure token. Returns the raw token for the link.
 */
export async function createProjectInvitation(
  projectId: string,
  email: string,
  role: ProjectMemberRole,
  invitedBy: string | null
): Promise<{ rawToken: string; invitationId: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("Email requerido.");

  const { raw, hash } = generateInvitationToken();

  const { data, error } = await supabaseAdmin
    .from("project_invitations")
    .insert({
      project_id: projectId,
      email: normalized,
      role,
      token_hash: hash,
      invited_by: invitedBy,
      status: "pending",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message || "Error al crear la invitación.");
  if (!data?.id) throw new Error("Error al crear la invitación.");

  return { rawToken: raw, invitationId: (data as { id: string }).id };
}

/** Row shape when looking up by token (any status). */
export type InvitationByTokenRow = {
  id: string;
  project_id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  invited_by: string | null;
};

/**
 * Find invitation by token hash only (any status). Used to distinguish invalid vs expired vs not-pending.
 */
export async function getInvitationByTokenHash(rawToken: string): Promise<InvitationByTokenRow | null> {
  const hash = hashToken(rawToken);
  const { data, error } = await supabaseAdmin
    .from("project_invitations")
    .select("id, project_id, email, role, status, expires_at, invited_by")
    .eq("token_hash", hash)
    .maybeSingle();

  if (error || !data) return null;
  return data as InvitationByTokenRow;
}

/**
 * Find a pending, non-expired invitation by token (hash match).
 * Returns invited_by for quota checks on accept (inviter's limit applies).
 */
export async function findInvitationByToken(rawToken: string): Promise<InvitationByTokenRow | null> {
  const row = await getInvitationByTokenHash(rawToken);
  if (!row || row.status !== "pending" || new Date(row.expires_at) <= new Date()) return null;
  return row;
}

/**
 * Mark an invitation as expired (status = 'expired'). Used when we detect expires_at <= now() on a pending row.
 */
export async function markInvitationExpired(invitationId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("project_invitations")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("id", invitationId);

  if (error) throw new Error(error.message || "Error al actualizar la invitación.");
}

/**
 * Mark invitation as accepted and set accepted_by, accepted_at, updated_at.
 */
export async function markInvitationAccepted(
  invitationId: string,
  acceptedBy: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("project_invitations")
    .update({
      status: "accepted",
      accepted_by: acceptedBy,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitationId);

  if (error) throw new Error(error.message || "Error al actualizar la invitación.");
}

/**
 * Revoke an invitation (set status = 'revoked').
 */
export async function revokeInvitation(invitationId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("project_invitations")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", invitationId);

  if (error) throw new Error(error.message || "Error al revocar la invitación.");
}

/**
 * List pending invitations for a project (for owners/superadmin).
 */
export async function getProjectPendingInvitations(projectId: string): Promise<
  Array<{
    id: string;
    email: string;
    role: string;
    status: string;
    expires_at: string;
    updated_at: string;
  }>
> {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("project_invitations")
    .select("id, email, role, status, expires_at, updated_at")
    .eq("project_id", projectId)
    .in("status", ["pending"])
    .gt("expires_at", nowIso)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("getProjectPendingInvitations failed", error);
    return [];
  }

  const rows = (data ?? []) as Array<{ id: string; email: string; role: string; status: string; expires_at: string; updated_at: string }>;
  return rows;
}
