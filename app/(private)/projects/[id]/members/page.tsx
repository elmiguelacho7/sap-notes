"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Users } from "lucide-react";

type ProjectMember = {
  id: string;
  user_id: string;
  project_id: string;
  role: string;
  user_full_name: string | null;
  user_email?: string | null;
  user_app_role: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Propietario",
  editor: "Editor",
  viewer: "Lector",
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
        setErrorMsg((data as { error?: string }).error ?? "Error al cargar el equipo.");
        setMembers([]);
        return;
      }
      const payload = data as { members?: ProjectMember[] };
      setMembers(payload.members ?? []);
    } catch {
      setErrorMsg("Error de conexión.");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

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
      setSubmitError("Introduce una dirección de correo válida.");
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
          setSubmitError("No tiene permiso para gestionar miembros.");
        } else if (res.status === 409 && data.quota?.limit != null) {
          setSubmitError(`Has alcanzado el máximo permitido para este proyecto (${data.quota.current ?? 0} / ${data.quota.limit}).`);
        } else {
          setSubmitError(data.error ?? "No se pudo añadir al miembro.");
        }
        return;
      }
      if (data.mode === "already_member") {
        setSuccessMsg(data.message ?? "El usuario ya pertenece a este proyecto.");
        setAddEmail("");
        setAddRole("editor");
        // Light refresh to ensure UI is in sync, without extra side effects.
        await loadMembers();
        return;
      }
      if (data.added) {
        if (data.mode === "direct_member_add") {
          setSuccessMsg(
            data.message ??
              "El usuario ya existía en la plataforma y se añadió directamente al equipo. No aparecerá en «Invitaciones pendientes»."
          );
        } else {
          setSuccessMsg(data.message ?? "Usuario añadido al proyecto correctamente.");
        }
        setAddEmail("");
        setAddRole("editor");
        await loadMembers();
      } else if (data.invited) {
        if (data.mode === "pending_invitation") {
          if (data.emailSent === true) {
            setSuccessMsg("Se creó una invitación pendiente y se envió el correo.");
          } else if (data.actionLink) {
            setSuccessMsg("Se creó la invitación pendiente, pero no se pudo enviar el correo. Usa el enlace de invitación disponible.");
          } else {
            setSuccessMsg("Se creó la invitación pendiente, pero no se pudo enviar el correo.");
          }
        } else {
          setSuccessMsg(data.message ?? "Invitación creada. El usuario aparecerá en el equipo cuando acepte la invitación.");
        }
        setAddEmail("");
        if (data.actionLink) setActionLink(data.actionLink);
        await loadInvitations();
      } else {
        setSubmitError("Respuesta inesperada del servidor. Inténtalo de nuevo.");
      }
    } catch {
      setSubmitError("Error de conexión.");
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
          setErrorMsg(`Este proyecto ha alcanzado el máximo de miembros permitidos (${data.quota.current ?? 0} / ${data.quota.limit}).`);
        } else {
          setErrorMsg(data.error ?? "Error al cambiar el rol.");
        }
        return;
      }
      setSuccessMsg("Rol actualizado.");
      await loadMembers();
    } catch {
      setErrorMsg("Error de conexión.");
    } finally {
      setChangingRoleId(null);
    }
  };

  const handleRemoveMember = async (member: ProjectMember) => {
    if (!projectId || !canManageMembers) return;
    const owners = members.filter((m) => m.role === "owner");
    if (member.role === "owner" && owners.length <= 1) {
      setErrorMsg("No se puede eliminar al último propietario del proyecto.");
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
      setErrorMsg("Error de conexión.");
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
      setSubmitError("No se pudo copiar al portapapeles.");
    }
  };

  const ownerCount = members.filter((m) => m.role === "owner").length;
  const isLastOwner = (m: ProjectMember) => m.role === "owner" && ownerCount <= 1;

  if (!projectId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-400">No se ha encontrado el identificador del proyecto.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
          <Users className="h-5 w-5 text-slate-500" />
          Equipo
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Miembros del proyecto y sus roles. Quienes tengan permiso pueden añadir miembros, cambiar roles o eliminar del equipo.
        </p>
        {hasGlobalOverride && !isExplicitMember && (
          <p className="mt-2 text-sm text-amber-300 bg-amber-500/15 border border-amber-500/40 rounded-xl px-3 py-2">
            <strong>Acceso global por rol.</strong> Tienes permisos de administrador sobre este proyecto sin ser miembro del equipo. Para aparecer en la lista, un propietario puede añadirte como miembro del proyecto.
          </p>
        )}
      </header>

      {successMsg && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-300">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      {canManageMembers && (
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-lg shadow-black/5 ring-1 ring-slate-700/30 overflow-hidden">
          <div className="border-b border-slate-700/60 px-5 py-4 bg-slate-800/50">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              Añadir miembro
            </h2>
            <p className="mt-0.5 text-sm text-slate-400">
              Introduce el email y el rol.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Si el usuario ya existe en la plataforma, se añadirá al equipo al instante. Si no existe, se creará una invitación pendiente y aparecerá abajo hasta que la acepte.
            </p>
            {memberQuota?.atLimit && (
              <p className="mt-2 text-sm text-red-400 font-medium">
                Has alcanzado el máximo de miembros permitidos para este proyecto ({memberQuota.current} / {memberQuota.limit}). No puedes añadir más hasta que un administrador aumente el límite.
              </p>
            )}
            {memberQuota?.limit != null && !memberQuota.atLimit && memberQuota.current >= memberQuota.limit * 0.8 && (
              <p className="mt-2 text-sm text-amber-400 font-medium">
                Te acercas al límite de miembros ({memberQuota.current} / {memberQuota.limit}). Cuando lo alcances no podrás añadir más hasta que un administrador aumente la cuota.
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    disabled={submitting}
                  >
                    <option value="owner">Propietario</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Lector</option>
                  </select>
                </div>
              </div>
              {submitError && <p className="text-sm text-red-400">{submitError}</p>}
              {actionLink && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/15 p-4 space-y-3">
                  <p className="text-sm text-amber-200">
                    Copia o abre el enlace para que el usuario pueda aceptar la invitación.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={actionLink}
                      className="flex-1 min-w-[200px] rounded-xl border border-slate-600/80 bg-slate-800/80 px-3 py-2 text-xs text-slate-300 font-mono"
                    />
                    <button
                      type="button"
                      onClick={copyActionLink}
                      className="rounded-xl border border-amber-500/50 bg-amber-500/20 px-3 py-2 text-sm font-medium text-amber-200 hover:bg-amber-500/30"
                    >
                      {linkCopied ? "Copiado" : "Copiar enlace de invitación"}
                    </button>
                    <a
                      href={actionLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
                    >
                      Abrir enlace
                    </a>
                  </div>
                </div>
              )}
              <button
                type="submit"
                disabled={submitting || memberQuota?.atLimit === true}
                className="rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Añadiendo…" : "Añadir al equipo"}
              </button>
            </form>
          </div>
        </div>
      )}

      {canManageMembers && (
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-lg shadow-black/5 ring-1 ring-slate-700/30 overflow-hidden">
          <div className="border-b border-amber-500/30 px-5 py-4 bg-amber-500/10">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-amber-400/90">
              Invitaciones pendientes
            </h2>
            <p className="mt-0.5 text-xs text-amber-300/80">
              Usuarios invitados que aún no han aceptado. Aparecerán en «Miembros del equipo» cuando acepten.
            </p>
            {pendingInvitationsQuota?.limit != null && (
              <p className="mt-1 text-xs font-medium text-amber-300">
                {pendingInvitationsQuota.current} / {pendingInvitationsQuota.limit} invitaciones pendientes
                {pendingInvitationsQuota.atLimit && " · Has alcanzado el máximo. No puedes crear más invitaciones hasta que un administrador aumente el límite."}
                {!pendingInvitationsQuota.atLimit && pendingInvitationsQuota.current >= (pendingInvitationsQuota.limit ?? 0) * 0.8 && " · Te acercas al límite."}
              </p>
            )}
          </div>
          <div className="p-5">
            {invitationsLoading ? (
              <p className="text-sm text-slate-500">Cargando invitaciones…</p>
            ) : invitations.length === 0 ? (
              <div className="text-sm text-slate-500 space-y-1">
                <p>No hay invitaciones pendientes.</p>
                <p className="text-xs text-slate-500">
                  Si el email pertenece a un usuario ya registrado, se añadirá directamente al equipo y no aparecerá aquí.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-700/50">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800/50 border-b border-slate-700/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Rol</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4">Creada</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {invitations.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 text-slate-200">{inv.email}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                            {ROLE_LABELS[inv.role] ?? inv.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex rounded-md bg-slate-700/60 px-2 py-0.5 text-xs font-medium text-slate-400">
                            Pendiente
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {inv.updated_at ? new Date(inv.updated_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleRevokeInvitation(inv.id)}
                            className="text-xs font-medium text-red-400 hover:text-red-300"
                          >
                            Revocar
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

      <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-lg shadow-black/5 ring-1 ring-slate-700/30 overflow-hidden">
        <div className="border-b border-slate-700/60 px-5 py-4 bg-slate-800/50">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            Miembros del equipo
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Solo aparecen aquí los usuarios con membresía explícita en el proyecto (tabla de miembros). Quien tenga acceso por rol global no figura en esta lista.
          </p>
          {memberQuota?.limit != null && (
            <p className="mt-1 text-xs font-medium text-slate-400">
              {memberQuota.current} / {memberQuota.limit} miembros en este proyecto
            </p>
          )}
        </div>
        <div className="p-5">
          {loading ? (
            <p className="text-sm text-slate-500">Cargando equipo…</p>
          ) : members.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Aún no hay miembros en este proyecto. Añade al primer miembro arriba si tienes permiso.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-700/50">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-800/50 border-b border-slate-700/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Nombre</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Rol</th>
                    <th className="py-3 px-4">Estado</th>
                    {canManageMembers && <th className="py-3 px-4 text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-slate-100 font-medium">
                        {member.user_full_name || "—"}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {member.user_email || "—"}
                      </td>
                      <td className="py-3 px-4">
                        {canManageMembers ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleChangeRole(member.id, member.user_id, e.target.value as "owner" | "editor" | "viewer")}
                            disabled={changingRoleId === member.id}
                            className="rounded-xl border border-slate-600/80 bg-slate-800/80 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-60"
                          >
                            <option value="owner">{ROLE_LABELS.owner}</option>
                            <option value="editor">{ROLE_LABELS.editor}</option>
                            <option value="viewer">{ROLE_LABELS.viewer}</option>
                          </select>
                        ) : (
                          <span className="inline-flex rounded-md bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-300">
                            {ROLE_LABELS[member.role] ?? member.role}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        <span className="inline-flex rounded-md bg-slate-700/60 px-2 py-0.5 text-xs text-slate-400">
                          Activo
                        </span>
                      </td>
                      {canManageMembers && (
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member)}
                            disabled={removingId === member.id || isLastOwner(member)}
                            title={isLastOwner(member) ? "No se puede eliminar al último propietario" : "Eliminar del equipo"}
                            className="text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {removingId === member.id ? "Eliminando…" : "Eliminar"}
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
