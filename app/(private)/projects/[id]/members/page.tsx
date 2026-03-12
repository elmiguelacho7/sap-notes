"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Users } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type ProjectMember = {
  id: string;
  user_id: string;
  project_id: string;
  role: string;
  user_full_name: string | null;
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
  created_at: string;
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

export default function ProjectMembersPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [canAdd, setCanAdd] = useState(false);

  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<"owner" | "editor" | "viewer">("editor");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [actionLink, setActionLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/projects/${projectId}/members`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg((data as { error?: string }).error ?? "Error al cargar los miembros.");
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

  const loadPermissions = useCallback(async () => {
    if (!projectId) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/projects/${projectId}/permissions`, { headers });
      const data = await res.json().catch(() => ({}));
      const perms = data as { canManageMembers?: boolean };
      setCanAdd(perms.canManageMembers === true);
    } catch {
      setCanAdd(false);
    }
  }, [projectId]);

  const loadInvitations = useCallback(async () => {
    if (!projectId || !canAdd) return;
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
  }, [projectId, canAdd]);

  useEffect(() => {
    loadMembers();
    loadPermissions();
  }, [loadMembers, loadPermissions]);

  useEffect(() => {
    if (canAdd) loadInvitations();
    else setInvitations([]);
  }, [canAdd, loadInvitations]);

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!projectId || !addEmail.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    setActionLink(null);
    setLinkCopied(false);
    try {
      const headers = await getAuthHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/projects/${projectId}/invitations`, {
        method: "POST",
        headers,
        body: JSON.stringify({ email: addEmail.trim(), role: addRole }),
      });
      const data = await res.json().catch(() => ({})) as {
        error?: string;
        added?: boolean;
        invited?: boolean;
        actionLink?: string;
        message?: string;
      };
      if (!res.ok) {
        setSubmitError(data.error ?? "Error al añadir el miembro.");
        return;
      }
      if (data.added) {
        setSubmitSuccess("Miembro agregado.");
        setAddEmail("");
        setAddRole("editor");
        await loadMembers();
      } else if (data.invited) {
        setSubmitSuccess("Invitación enviada.");
        setAddEmail("");
        if (data.actionLink) {
          setActionLink(data.actionLink);
        }
        await loadInvitations();
      }
    } catch {
      setSubmitError("Error de conexión.");
    } finally {
      setSubmitting(false);
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

  if (!projectId) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <p className="text-sm text-slate-600">No se ha encontrado el identificador del proyecto.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-indigo-600"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver al proyecto
        </Link>

        <header>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-slate-500" />
            Miembros del proyecto
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestiona quién tiene acceso a este proyecto. Solo propietarios y superadministradores pueden añadir miembros.
          </p>
        </header>

        {errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {canAdd && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/50">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Añadir miembro
              </h2>
              <p className="mt-0.5 text-sm text-slate-600">
                Introduce el email y el rol. Si el usuario ya existe se añadirá al proyecto; si no, recibirá una invitación por correo y se añadirá al registrarse.
              </p>
            </div>
            <div className="p-5">
              <form onSubmit={handleAddMember} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="member-email" className="block text-xs font-medium text-slate-600 mb-1">
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
                {submitError && (
                  <p className="text-sm text-red-600">{submitError}</p>
                )}
                {submitSuccess && !actionLink && (
                  <p className="text-sm text-green-700">{submitSuccess}</p>
                )}
                {actionLink && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                    <p className="text-sm text-amber-800">
                      No se pudo enviar el correo. Copia este enlace y compártelo con el usuario para que acepte la invitación.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={actionLink}
                        className="flex-1 min-w-[200px] rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-slate-700 font-mono"
                      />
                      <button
                        type="button"
                        onClick={copyActionLink}
                        className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        {linkCopied ? "Copiado" : "Copiar enlace"}
                      </button>
                    </div>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Añadiendo…" : "Añadir miembro"}
                </button>
              </form>
            </div>
          </div>
        )}

        {canAdd && (invitations.length > 0 || invitationsLoading) && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/50">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Invitaciones pendientes
              </h2>
              <p className="mt-0.5 text-sm text-slate-600">
                Invitaciones enviadas que aún no han sido aceptadas. Puedes revocarlas.
              </p>
            </div>
            <div className="p-5">
              {invitationsLoading ? (
                <p className="text-sm text-slate-500">Cargando…</p>
              ) : invitations.length === 0 ? (
                <p className="text-sm text-slate-500">No hay invitaciones pendientes.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Rol</th>
                        <th className="py-3 px-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invitations.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 text-slate-900">{inv.email}</td>
                          <td className="py-3 px-4">
                            <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                              {ROLE_LABELS[inv.role] ?? inv.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleRevokeInvitation(inv.id)}
                              className="text-xs font-medium text-red-600 hover:text-red-700"
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

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/50">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Miembros actuales
            </h2>
          </div>
          <div className="p-5">
            {loading ? (
              <p className="text-sm text-slate-500">Cargando miembros…</p>
            ) : members.length === 0 ? (
              <p className="text-sm text-slate-500">Aún no hay miembros asignados a este proyecto.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="py-3 px-4">Usuario</th>
                      <th className="py-3 px-4">Rol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {members.map((member) => (
                      <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-slate-900">
                          {member.user_full_name || "Usuario sin nombre"}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                            {ROLE_LABELS[member.role] ?? member.role}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
