"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";

async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

type AdminUser = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  app_role: string;
  is_active: boolean;
};

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Superadministrador",
  admin: "Administrador",
  consultant: "Consultor",
  viewer: "Lector",
};

/** Stable technical values for DB; labels for display. Must match PATCH allowed list. */
const APP_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "superadmin", label: ROLE_LABELS.superadmin },
  { value: "admin", label: ROLE_LABELS.admin },
  { value: "consultant", label: ROLE_LABELS.consultant },
  { value: "viewer", label: ROLE_LABELS.viewer },
];

function RoleSelect({
  user,
  onUpdated,
  getAuthHeaders,
  disabled,
}: {
  user: AdminUser;
  onUpdated: () => void;
  getAuthHeaders: () => Promise<Record<string, string>>;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const appRoleKey = e.target.value;
    if (appRoleKey === user.app_role || loading || disabled) return;
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/admin/users/${user.id}/app-role`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ appRoleKey }),
      });
      if (res.ok) await onUpdated();
    } finally {
      setLoading(false);
    }
  };
  return (
    <select
      value={user.app_role}
      onChange={handleChange}
      disabled={disabled || loading}
      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
      aria-label={`Rol de ${user.full_name || user.email}`}
    >
      {APP_ROLE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
      {user.app_role && !ROLE_LABELS[user.app_role] && (
        <option value={user.app_role}>{user.app_role}</option>
      )}
    </select>
  );
}

function ActivationButton({
  user,
  onUpdated,
  getAuthHeaders,
}: {
  user: AdminUser;
  onUpdated: () => void;
  getAuthHeaders: () => Promise<Record<string, string>>;
}) {
  const t = useTranslations("admin.users");
  const [loading, setLoading] = useState(false);
  const handleToggle = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/admin/users/${user.id}/activation`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      if (!res.ok) return;
      await onUpdated();
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className={
        user.is_active
          ? "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60 transition-colors"
          : "rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
      }
    >
      {loading ? "…" : user.is_active ? t("deactivate") : t("activate")}
    </button>
  );
}

function DeleteUserButton({
  user,
  onDeleted,
  getAuthHeaders,
  disabled,
}: {
  user: AdminUser;
  onDeleted: () => void;
  getAuthHeaders: () => Promise<Record<string, string>>;
  disabled?: boolean;
}) {
  const t = useTranslations("admin.users");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  const handleDeleteClick = () => {
    setBlockedMessage(null);
    setModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    setLoading(true);
    setBlockedMessage(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE", headers });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (res.status === 409) {
        setBlockedMessage(
          data.message ?? "This user has transactional data and cannot be deleted. You can deactivate the user instead."
        );
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setBlockedMessage(data.error ?? t("errors.deleteFailed"));
        setLoading(false);
        return;
      }
      setModalOpen(false);
      await onDeleted();
    } catch {
      setBlockedMessage(t("errors.connection"));
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    if (!loading) {
      setModalOpen(false);
      setBlockedMessage(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleDeleteClick}
        disabled={disabled || loading}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60 transition-colors"
      >
        {t("actions.delete")}
      </button>
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" role="dialog" aria-modal="true" aria-labelledby="delete-user-title">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl p-6">
            <h2 id="delete-user-title" className="text-lg font-semibold text-slate-900 mb-2">
              {t("delete.title")}
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              {t("delete.bodyPrefix")} <strong>{user.full_name || user.email || t("delete.thisUser")}</strong>{t("delete.bodySuffix")}
            </p>
            {blockedMessage && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {blockedMessage}
              </div>
            )}
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={loading}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {t("actions.cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={loading}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {loading ? t("deleting") : t("actions.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function AdminUsersPage() {
  const t = useTranslations("admin.users");
  const [loading, setLoading] = useState(true);
  const [appRole, setAppRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [appRoleNew, setAppRoleNew] = useState<string>("consultant");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch("/api/admin/users", { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? t("errors.loadUsers"));
        setUsers([]);
        return;
      }
      setUsers((data as { users?: AdminUser[] }).users ?? []);
    } catch {
      setError(t("errors.connection"));
      setUsers([]);
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled || !user) {
          setAppRole(null);
          setLoading(false);
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("app_role")
          .eq("id", user.id)
          .single();
        if (cancelled) return;
        setAppRole((profile as { app_role?: string } | null)?.app_role ?? null);
        setCurrentUserId(user.id);
        if ((profile as { app_role?: string } | null)?.app_role === "superadmin") {
          await loadUsers();
        }
      } catch {
        if (!cancelled) setAppRole(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void init();
    return () => { cancelled = true; };
  }, [loadUsers]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || creating) return;
    setCreating(true);
    setCreateError(null);
    setCreateSuccess(null);
    try {
      const headers = await getAdminAuthHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: email.trim(),
          full_name: fullName.trim() || undefined,
          app_role: appRoleNew,
        }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; message?: string };
      if (!res.ok) {
        setCreateError(data.error ?? t("errors.createUser"));
        return;
      }
      setCreateSuccess(t("success.userCreated"));
      setEmail("");
      setFullName("");
      setAppRoleNew("consultant");
      await loadUsers();
    } catch {
      setCreateError(t("errors.connection"));
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <PageShell wide={false}>
        <div className="py-12 text-center">
          <p className="text-sm text-slate-500">{t("loading")}</p>
        </div>
      </PageShell>
    );
  }

  if (appRole !== "superadmin") {
    return (
      <PageShell wide={false}>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-12 text-center">
          <p className="text-sm font-medium text-slate-700">Acceso restringido</p>
          <p className="mt-1 text-sm text-slate-500">
            Solo los administradores pueden ver esta página.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell wide={false}>
      <div className="space-y-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-indigo-600"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("backToAdmin")}
        </Link>

        <PageHeader
          title={t("title")}
          description="Crear usuarios y gestionar activación. Los usuarios creados por un administrador quedan activos; los que se registran por la página pública quedan pendientes hasta activación."
          actions={
            <Link
              href="/admin"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Panel Admin
            </Link>
          }
        />

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/50">
            <h2 className="text-sm font-semibold text-slate-900">{t("createUser")}</h2>
            <p className="text-xs text-slate-500 mt-1">Los usuarios creados aquí quedan activos de inmediato.</p>
          </div>
          <form onSubmit={handleCreate} className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="new-email" className="block text-xs font-medium text-slate-600 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="new-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={creating}
                  required
                />
              </div>
              <div>
                <label htmlFor="new-fullname" className="block text-xs font-medium text-slate-600 mb-1">
                  Nombre
                </label>
                <input
                  id="new-fullname"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t("fullNamePlaceholder")}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={creating}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label htmlFor="new-role" className="block text-xs font-medium text-slate-600 mb-1">
                  Rol
                </label>
                <select
                  id="new-role"
                  value={appRoleNew}
                  onChange={(e) => setAppRoleNew(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={creating}
                >
                  {APP_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={creating || !email.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 mt-6"
              >
                {creating ? t("creating") : t("createUser")}
              </button>
            </div>
            {createError && (
              <p className="text-sm text-red-600">{createError}</p>
            )}
            {createSuccess && (
              <p className="text-sm text-green-700">{createSuccess}</p>
            )}
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/50">
            <h2 className="text-sm font-semibold text-slate-900">{t("existingUsers")}</h2>
            <p className="text-xs text-slate-500 mt-1">
              Nombre, email (identidad de inicio de sesión), rol global y estado de activación. Activa o desactiva el acceso desde aquí.
            </p>
          </div>
          <div className="p-5">
            {users.length === 0 ? (
              <p className="text-sm text-slate-500">Aún no hay usuarios. Crea uno arriba.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                    {users.filter((u) => !u.is_active).length} pendientes
                  </span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                    {users.filter((u) => u.is_active).length} activos
                  </span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <th className="py-3 px-4">Nombre</th>
                        <th className="py-3 px-4">Email (login)</th>
                        <th className="py-3 px-4">Rol global</th>
                        <th className="py-3 px-4">Estado</th>
                        <th className="py-3 px-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-medium text-slate-900">{u.full_name ?? "—"}</td>
                          <td className="py-3 px-4 text-slate-700">{u.email ?? "—"}</td>
                          <td className="py-3 px-4">
                            <RoleSelect
                              user={u}
                              onUpdated={loadUsers}
                              getAuthHeaders={getAdminAuthHeaders}
                              disabled={u.id === currentUserId}
                            />
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${u.is_active ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                              {u.is_active ? t("active") : t("pending")}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2 flex-wrap">
                              <ActivationButton user={u} onUpdated={loadUsers} getAuthHeaders={getAdminAuthHeaders} />
                              <DeleteUserButton
                                user={u}
                                onDeleted={loadUsers}
                                getAuthHeaders={getAdminAuthHeaders}
                                disabled={u.id === currentUserId}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
