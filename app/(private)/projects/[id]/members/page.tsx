"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabaseClient";
import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { PROJECT_WORKSPACE_HERO, PROJECT_WORKSPACE_PAGE } from "@/lib/projectWorkspaceUi";

type ProjectMember = {
  id: string;
  user_id: string;
  project_id: string;
  role: string;
  user_full_name: string | null;
  user_email?: string | null;
  user_app_role: string | null;
};

type PendingInvitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  updated_at: string;
};

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export default function ProjectTeamPage() {
  const t = useTranslations("projects.members");
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [memberQuota, setMemberQuota] = useState<{ atLimit: boolean; current: number; limit: number | null } | null>(null);
  const [pendingInvitationsQuota, setPendingInvitationsQuota] = useState<{ atLimit: boolean; current: number; limit: number | null } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<"owner" | "editor" | "viewer">("editor");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [actionLink, setActionLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);

  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/projects/${projectId}/members`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg((data as { error?: string }).error ?? t("errors.loadTeam"));
        setMembers([]);
        return;
      }
      const payload = data as { members?: ProjectMember[] };
      setMembers(payload.members ?? []);
    } catch {
      setErrorMsg(t("errors.connection"));
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  const [hasGlobalOverride, setHasGlobalOverride] = useState(false);
  const [isExplicitMember, setIsExplicitMember] = useState(false);

  const loadPermissions = useCallback(async () => {
    if (!projectId) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/projects/${projectId}/permissions`, { headers });
      const data = await res.json().catch(() => ({}));
      const perms = data as {
        canManageMembers?: boolean;
        hasGlobalOverride?: boolean;
        isExplicitMember?: boolean;
        memberQuota?: { atLimit: boolean; current: number; limit: number | null };
        pendingInvitationsQuota?: { atLimit: boolean; current: number; limit: number | null };
      };
      setCanManageMembers(perms.canManageMembers === true);
      setHasGlobalOverride(perms.hasGlobalOverride === true);
      setIsExplicitMember(perms.isExplicitMember === true);
      setMemberQuota(perms.memberQuota ?? null);
      setPendingInvitationsQuota(perms.pendingInvitationsQuota ?? null);
    } catch {
      setCanManageMembers(false);
      setHasGlobalOverride(false);
      setIsExplicitMember(false);
    }
  }, [projectId]);

  const loadInvitations = useCallback(async () => {
    if (!projectId || !canManageMembers) return;
    setInvitationsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/projects/${projectId}/invitations`, { headers });
      const data = await res.json().catch(() => ({})) as { invitations?: PendingInvitation[] };
      setInvitations(data.invitations ?? []);
    } catch {
      setInvitations([]);
    } finally {
      setInvitationsLoading(false);
    }
  }, [projectId, canManageMembers]);

  useEffect(() => {
    loadMembers();
    loadPermissions();
  }, [loadMembers, loadPermissions]);

  useEffect(() => {
    if (canManageMembers) loadInvitations();
    else setInvitations([]);
  }, [canManageMembers, loadInvitations]);

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 4000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedEmail = addEmail.trim();
    if (!projectId || !trimmedEmail) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setSubmitError(t("errors.invalidEmail"));
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setSuccessMsg(null);
    setActionLink(null);
    setLinkCopied(false);
    try {
      const headers = await getAuthHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/projects/${projectId}/invitations`, {
        method: "POST",
        headers,
        body: JSON.stringify({ email: trimmedEmail, role: addRole }),
      });
      const data = await res.json().catch(() => ({})) as {
        error?: string;
        added?: boolean;
        invited?: boolean;
        actionLink?: string;
        message?: string;
        emailSent?: boolean;
        success?: boolean;
        mode?: "already_member" | "direct_member_add" | "pending_invitation";
        alreadyMember?: boolean;
        invitationCreated?: boolean;
        quota?: { quotaKey?: string; current?: number; limit?: number | null };
      };
      if (!res.ok) {
        if (res.status === 403) {
          setSubmitError(t("errors.noPermission"));
        } else if (res.status === 409 && data.quota?.limit != null) {
          setSubmitError(t("errors.quotaReached", { current: data.quota.current ?? 0, limit: data.quota.limit ?? 0 }));
        } else {
          setSubmitError(data.error ?? t("errors.addMemberFailed"));
        }
        return;
      }
      if (data.mode === "already_member") {
        setSuccessMsg(data.message ?? t("success.alreadyMember"));
        setAddEmail("");
        setAddRole("editor");
        // Light refresh to ensure UI is in sync, without extra side effects.
        await loadMembers();
        return;
      }
      if (data.added) {
        if (data.mode === "direct_member_add") {
          setSuccessMsg(
            data.message ?? t("success.directAdd")
          );
        } else {
          setSuccessMsg(data.message ?? t("success.memberAdded"));
        }
        setAddEmail("");
        setAddRole("editor");
        await loadMembers();
      } else if (data.invited) {
        if (data.mode === "pending_invitation") {
          if (data.emailSent === true) {
            setSuccessMsg(t("success.inviteSent"));
          } else if (data.actionLink) {
            setSuccessMsg(t("success.inviteNoEmailWithLink"));
          } else {
            setSuccessMsg(t("success.inviteNoEmail"));
          }
        } else {
          setSuccessMsg(data.message ?? t("success.inviteCreated"));
        }
        setAddEmail("");
        if (data.actionLink) setActionLink(data.actionLink);
        await loadInvitations();
      } else {
        setSubmitError(t("errors.unexpectedResponse"));
      }
    } catch {
      setSubmitError(t("errors.connection"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeRole = async (memberId: string, userId: string, newRole: "owner" | "editor" | "viewer") => {
    if (!projectId || !canManageMembers) return;
    setChangingRoleId(memberId);
    setSuccessMsg(null);
    try {
      const headers = await getAuthHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/admin/projects/${projectId}/members`, {
        method: "POST",
        headers,
        body: JSON.stringify({ userId, role: newRole }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; quota?: { current?: number; limit?: number | null } };
      if (!res.ok) {
        if (res.status === 409 && data.quota?.limit != null) {
          setErrorMsg(t("errors.projectQuotaReached", { current: data.quota.current ?? 0, limit: data.quota.limit ?? 0 }));
        } else {
          setErrorMsg(data.error ?? "Error al cambiar el rol.");
        }
        return;
      }
      setSuccessMsg("Rol actualizado.");
      await loadMembers();
    } catch {
      setErrorMsg(t("errors.connection"));
    } finally {
      setChangingRoleId(null);
    }
  };

  const handleRemoveMember = async (member: ProjectMember) => {
    if (!projectId || !canManageMembers) return;
    const owners = members.filter((m) => m.role === "owner");
    if (member.role === "owner" && owners.length <= 1) {
      setErrorMsg(t("errors.cannotRemoveLastOwner"));
      return;
    }
    setRemovingId(member.id);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/admin/projects/${projectId}/members`, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ memberId: member.id }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error ?? "Error al eliminar del equipo.");
        return;
      }
      setSuccessMsg("Miembro eliminado del equipo.");
      await loadMembers();
    } catch {
      setErrorMsg(t("errors.connection"));
    } finally {
      setRemovingId(null);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      const headers = await getAuthHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch("/api/invitations/revoke", {
        method: "POST",
        headers,
        body: JSON.stringify({ invitationId }),
      });
      if (res.ok) await loadInvitations();
    } catch {
      // ignore
    }
  };

  const copyActionLink = async () => {
    if (!actionLink) return;
    try {
      await navigator.clipboard.writeText(actionLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setSubmitError(t("errors.copyFailed"));
    }
  };

  const ownerCount = members.filter((m) => m.role === "owner").length;
  const isLastOwner = (m: ProjectMember) => m.role === "owner" && ownerCount <= 1;

  if (!projectId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-400">{t("missingProjectId")}</p>
      </div>
    );
  }

  return (
    <div className={PROJECT_WORKSPACE_PAGE}>
      <header className={PROJECT_WORKSPACE_HERO}>
        <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
          <Users className="h-5 w-5 text-slate-400" />
          {t("title")}
        </h1>
        <p className="mt-0.5 text-sm text-slate-600">
          {t("subtitle")}
        </p>
        {hasGlobalOverride && !isExplicitMember && (
          <p className="mt-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <strong>{t("globalAccess.title")}</strong> {t("globalAccess.body")}
          </p>
        )}
      </header>

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      {canManageMembers && (
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100 overflow-hidden">
          <div className="border-b border-slate-200/90 px-5 py-4 bg-slate-50/85">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              {t("addMember.title")}
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Introduce el email y el rol.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t("addMember.help")}
            </p>
            {memberQuota?.atLimit && (
              <p className="mt-2 text-sm text-red-700 font-medium">
                {t("addMember.atLimit", { current: memberQuota.current, limit: memberQuota.limit ?? 0 })}
              </p>
            )}
            {memberQuota?.limit != null && !memberQuota.atLimit && memberQuota.current >= memberQuota.limit * 0.8 && (
              <p className="mt-2 text-sm text-amber-400 font-medium">
                {t("addMember.nearLimit", { current: memberQuota.current, limit: memberQuota.limit ?? 0 })}
              </p>
            )}
          </div>
          <div className="p-5">
            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="member-email" className="block text-xs font-medium text-slate-500 mb-1">
                    Email
                  </label>
                  <input
                    id="member-email"
                    type="email"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="usuario@ejemplo.com"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/30"
                    disabled={submitting}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="member-role" className="block text-xs font-medium text-slate-600 mb-1">
                    Rol
                  </label>
                  <select
                    id="member-role"
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as "owner" | "editor" | "viewer")}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/30"
                    disabled={submitting}
                  >
                    <option value="owner">{t("roles.owner")}</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">{t("roles.viewer")}</option>
                  </select>
                </div>
              </div>
              {submitError && <p className="text-sm text-red-700">{submitError}</p>}
              {actionLink && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                  <p className="text-sm text-amber-900">
                    {t("invitation.linkHelp")}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={actionLink}
                      className="flex-1 min-w-[200px] rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs text-slate-700 font-mono"
                    />
                    <button
                      type="button"
                      onClick={copyActionLink}
                      className="rounded-xl border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-200"
                    >
                      {linkCopied ? t("invitation.copied") : t("invitation.copyLink")}
                    </button>
                    <a
                      href={actionLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Abrir enlace
                    </a>
                  </div>
                </div>
              )}
              <button
                type="submit"
                disabled={submitting || memberQuota?.atLimit === true}
                className="rounded-xl rb-btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? t("addMember.adding") : t("addMember.addToTeam")}
              </button>
            </form>
          </div>
        </div>
      )}

      {canManageMembers && (
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100 overflow-hidden">
          <div className="border-b border-amber-200 px-5 py-4 bg-amber-50/80">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-amber-700/90">
              {t("pendingInvites.title")}
            </h2>
            <p className="mt-0.5 text-xs text-amber-700/80">
              {t("pendingInvites.subtitle")}
            </p>
            {pendingInvitationsQuota?.limit != null && (
              <p className="mt-1 text-xs font-medium text-amber-300">
                {pendingInvitationsQuota.current} / {pendingInvitationsQuota.limit} invitaciones pendientes
                {pendingInvitationsQuota.atLimit && t("pendingInvites.maxReached")}
                {!pendingInvitationsQuota.atLimit && pendingInvitationsQuota.current >= (pendingInvitationsQuota.limit ?? 0) * 0.8 && t("pendingInvites.nearLimit")}
              </p>
            )}
          </div>
          <div className="p-5">
            {invitationsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-11/12" />
              </div>
            ) : invitations.length === 0 ? (
              <div className="text-sm text-slate-500 space-y-1">
                <p>{t("pendingInvites.none")}</p>
                <p className="text-xs text-slate-500">
                  {t("pendingInvites.noneHelp")}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200/90">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/85 border-b border-slate-200/90 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Rol</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4">Creada</th>
                      <th className="py-3 px-4 text-right">{t("action")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invitations.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-slate-800">{inv.email}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                            {t(`roles.${inv.role}`)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200/80">
                            {t("pendingInvites.pending")}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {inv.updated_at ? new Date(inv.updated_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleRevokeInvitation(inv.id)}
                            className="text-xs font-medium text-red-700 hover:text-red-900"
                          >
                            {t("pendingInvites.revoke")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100 overflow-hidden">
        <div className="border-b border-slate-200/90 px-5 py-4 bg-slate-50/85">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            {t("teamMembers.title")}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {t("teamMembers.subtitle")}
          </p>
          {memberQuota?.limit != null && (
            <p className="mt-1 text-xs font-medium text-slate-400">
              {memberQuota.current} / {memberQuota.limit} miembros en este proyecto
            </p>
          )}
        </div>
        <div className="p-5">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-10/12" />
            </div>
          ) : members.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              {t("teamMembers.empty")}
            </div>
          ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200/90">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/85 border-b border-slate-200/90 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Nombre</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Rol</th>
                    <th className="py-3 px-4">Estado</th>
                    {canManageMembers && <th className="py-3 px-4 text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-slate-900 font-medium">
                        {member.user_full_name || "—"}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {member.user_email || "—"}
                      </td>
                      <td className="py-3 px-4">
                        {canManageMembers ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleChangeRole(member.id, member.user_id, e.target.value as "owner" | "editor" | "viewer")}
                            disabled={changingRoleId === member.id}
                            className="rounded-xl border border-slate-200/90 bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/30 disabled:opacity-60"
                          >
                            <option value="owner">{t("roles.owner")}</option>
                            <option value="editor">{t("roles.editor")}</option>
                            <option value="viewer">{t("roles.viewer")}</option>
                          </select>
                        ) : (
                          <span className="inline-flex rounded-md bg-[rgb(var(--rb-brand-surface))] px-2 py-0.5 text-xs font-medium text-[rgb(var(--rb-brand-primary-active))] ring-1 ring-[rgb(var(--rb-brand-primary))]/20">
                            {t(`roles.${member.role}`)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200/80">
                          {t("teamMembers.active")}
                        </span>
                      </td>
                      {canManageMembers && (
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member)}
                            disabled={removingId === member.id || isLastOwner(member)}
                            title={isLastOwner(member) ? t("errors.cannotRemoveLastOwner") : t("teamMembers.remove")}
                            className="text-xs font-medium text-red-700 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {removingId === member.id ? t("teamMembers.removing") : t("teamMembers.remove")}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
