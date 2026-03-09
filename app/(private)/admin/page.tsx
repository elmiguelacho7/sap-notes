"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { getSapitoGeneral } from "@/lib/agents/agentRegistry";

/** Returns headers with Bearer token for admin API calls (session is in localStorage). */
async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

type TabId = "users" | "activations" | "knowledge";

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [appRole, setAppRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled || !user) {
          setAppRole(null);
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("app_role, is_active")
          .eq("id", user.id)
          .single();

        if (cancelled) return;
        const row = profile as { app_role?: string; is_active?: boolean } | null;
        if (!row || row.is_active !== true) {
          setAppRole(null);
          setLoading(false);
          return;
        }
        setAppRole((profile as { app_role?: string } | null)?.app_role ?? null);
      } catch {
        if (!cancelled) setAppRole(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void checkAccess();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <PageShell wide={false}>
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-slate-700">Cargando…</p>
          <p className="mt-1 text-sm text-slate-500">Un momento.</p>
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
            Solo los administradores pueden ver este panel.
          </p>
        </div>
      </PageShell>
    );
  }

  return <AdminPanel />;
}

function AdminPanel() {
  const [activeTab, setActiveTab] = useState<TabId>("users");

  return (
    <PageShell wide={false}>
      <div className="space-y-6">
        <PageHeader
          title="Administración de la plataforma"
          description="Usuarios, activaciones, roles globales y fuentes de conocimiento."
        />

        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1.5 text-sm">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`px-3 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "users"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Usuarios
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("activations")}
            className={`px-3 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "activations"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Activaciones
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("knowledge")}
            className={`px-3 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "knowledge"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Knowledge Sources
          </button>
          <a
            href="/admin/roles"
            className="px-3 py-2 rounded-lg font-medium text-slate-500 hover:text-slate-900 hover:bg-white/50 transition-colors"
          >
            Roles globales
          </a>
        </div>

        {activeTab === "users" && <UsersRolesPanel />}
        {activeTab === "activations" && <ActivationsPanel />}
        {activeTab === "knowledge" && <GlobalKnowledgeSourcesPanel />}
      </div>
    </PageShell>
  );
}

function ActivationsPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchUsers() {
      try {
        const headers = await getAdminAuthHeaders();
        const res = await fetch("/api/admin/users", { headers });
        if (cancelled) return;
        if (!res.ok) return;
        const data = (await res.json()) as { users?: AdminUser[] };
        if (cancelled) return;
        setUsers(data.users ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchUsers();
    return () => { cancelled = true; };
  }, []);

  const pending = users.filter((u) => !u.is_active);
  const active = users.filter((u) => u.is_active);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/50">
        <h2 className="text-sm font-semibold text-slate-900">Activación de usuarios</h2>
        <p className="text-xs text-slate-500 mt-1">
          Los usuarios que se registran por la página pública quedan pendientes hasta que un administrador los active.
        </p>
      </div>
      <div className="p-5">
        {loading ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <p className="text-2xl font-semibold text-amber-800">{pending.length}</p>
              <p className="text-sm font-medium text-amber-800">Pendientes</p>
              <p className="text-xs text-amber-700 mt-0.5">Sin acceso a la plataforma</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <p className="text-2xl font-semibold text-emerald-800">{active.length}</p>
              <p className="text-sm font-medium text-emerald-800">Activos</p>
              <p className="text-xs text-emerald-700 mt-0.5">Pueden iniciar sesión</p>
            </div>
          </div>
        )}
        <a
          href="/admin/users"
          className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Gestionar usuarios y activaciones
        </a>
      </div>
    </section>
  );
}

type AdminUser = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  app_role: string;
  is_active: boolean;
};

type AppRoleOption = {
  id: string;
  key: string;
  name: string;
  scope?: "app";
  is_active?: boolean;
};

function UsersRolesPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [appRoles, setAppRoles] = useState<AppRoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [pendingRoles, setPendingRoles] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function fetchUsers() {
      setLoading(true);
      setError(null);
      try {
        const headers = await getAdminAuthHeaders();
        const res = await fetch("/api/admin/users", { headers });
        if (cancelled) return;
        if (!res.ok) {
          setError("No se pudieron cargar los usuarios.");
          setUsers([]);
          setLoading(false);
          return;
        }
        const data = (await res.json()) as { users?: AdminUser[] };
        if (cancelled) return;
        setUsers(data.users ?? []);
      } catch {
        if (!cancelled) {
          setError("No se pudieron cargar los usuarios.");
          setUsers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchAppRoles() {
      setRolesError(null);
      try {
        const headers = await getAdminAuthHeaders();
        const res = await fetch("/api/admin/app-roles", { headers });
        if (cancelled) return;
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setRolesError(data.error ?? "No se pudieron cargar los roles de aplicación.");
          setAppRoles([]);
          return;
        }
        const data = (await res.json()) as { roles?: AppRoleOption[] };
        if (cancelled) return;
        setAppRoles(data.roles ?? []);
      } catch {
        if (!cancelled) {
          setRolesError("No se pudieron cargar los roles de aplicación.");
          setAppRoles([]);
        }
      }
    }

    void fetchAppRoles();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRoleChange = (userId: string, newRoleKey: string) => {
    setSaveMessage(null);
    setPendingRoles((prev) => ({ ...prev, [userId]: newRoleKey }));
  };

  const handleSaveRole = async (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    const newRoleKey = pendingRoles[userId] ?? user.app_role;
    if (newRoleKey === user.app_role) {
      setPendingRoles((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      return;
    }

    setSavingUserId(userId);
    setError(null);
    setSaveMessage(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(`/api/admin/users/${userId}/app-role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ appRoleKey: newRoleKey }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setSaveMessage({ type: "error", text: data.error ?? "No se pudo actualizar el rol." });
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, app_role: newRoleKey } : u))
      );
      setPendingRoles((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setSaveMessage({ type: "success", text: "Rol actualizado correctamente." });
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Usuarios y roles
          </h2>
          <p className="text-xs text-slate-500">
            Define el rol global de cada usuario en la plataforma.
          </p>
        </div>
        <a
          href="/admin/users"
          className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          Gestionar usuarios
        </a>
      </div>

      {rolesError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {rolesError}
        </div>
      )}

      {saveMessage && (
        <div
          className={`rounded-xl border px-4 py-2 text-sm ${
            saveMessage.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando usuarios...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="py-3 px-4">Usuario</th>
                <th className="py-3 px-4">Rol</th>
                <th className="py-3 px-4">Activación</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => {
                const displayName =
                  user.full_name || user.email || "Sin nombre";
                const currentRole =
                  pendingRoles[user.id] ?? user.app_role;
                const roleOptions = appRoles.length > 0
                  ? appRoles
                  : [
                      { id: "consultant", key: "consultant", name: "Consultor" },
                      { id: "superadmin", key: "superadmin", name: "Superadmin" },
                    ];
                return (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-900">
                      {displayName}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={currentRole}
                        onChange={(e) =>
                          handleRoleChange(user.id, e.target.value)
                        }
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        disabled={savingUserId === user.id}
                      >
                        {roleOptions.map((role) => (
                          <option key={role.id} value={role.key}>
                            {role.name}
                          </option>
                        ))}
                        {roleOptions.every((r) => r.key !== currentRole) && currentRole && (
                          <option value={currentRole}>
                            {currentRole}
                          </option>
                        )}
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${user.is_active ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                        {user.is_active ? "Activo" : "Pendiente"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveRole(user.id)}
                          disabled={savingUserId === user.id}
                          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                          {savingUserId === user.id ? "Guardando..." : "Guardar"}
                        </button>
                        <a
                          href="/admin/users"
                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          Gestionar
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

type ProjectMember = {
  id: string;
  user_id: string;
  project_id: string;
  role: "owner" | "editor" | "viewer";
  user_full_name?: string | null;
  user_app_role?: string;
};

const ROLE_LABELS: Record<"owner" | "editor" | "viewer", string> = {
  owner: "Propietario",
  editor: "Editor",
  viewer: "Lector",
};

function ProjectAccessPanel() {
  const [projects, setProjects] = useState<
    { id: string; name: string; status?: string | null }[]
  >([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addUserId, setAddUserId] = useState<string>("");
  const [addRole, setAddRole] = useState<"owner" | "editor" | "viewer" | "">("");
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    async function loadInitial() {
      setLoadingProjects(true);
      try {
        const headers = await getAdminAuthHeaders();
        const [usersRes, projResult] = await Promise.all([
          fetch("/api/admin/users", { headers }),
          supabase
            .from("projects")
            .select("id, name, status")
            .order("name", { ascending: true }),
        ]);

        if (cancelled) return;

        if (!usersRes.ok) {
          setError("Se produjo un error al cargar los datos.");
          setUsers([]);
        } else {
          const usersData = (await usersRes.json()) as { users?: AdminUser[] };
          setUsers(usersData.users ?? []);
        }

        if (projResult.error) {
          setError("Se produjo un error al cargar los datos.");
          setProjects([]);
        } else {
          setProjects((projResult.data ?? []) as { id: string; name: string; status?: string | null }[]);
        }
      } catch {
        if (!cancelled) setError("Se produjo un error al cargar los datos.");
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    }

    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMembers = useCallback(async (projectId: string) => {
    setLoadingMembers(true);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(`/api/admin/projects/${projectId}/members`, { headers });
      if (!res.ok) {
        setError("No se pudieron cargar los miembros del proyecto.");
        setMembers([]);
        return;
      }
      const data = (await res.json()) as { members?: ProjectMember[] };
      setMembers(data.members ?? []);
    } catch {
      setError("No se pudieron cargar los miembros del proyecto.");
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  const handleSelectProject = useCallback(
    (projectId: string) => {
      setSelectedProjectId(projectId);
      void loadMembers(projectId);
    },
    [loadMembers]
  );

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !addUserId.trim() || !addRole) return;

    setSavingMemberId("new");
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(
        `/api/admin/projects/${selectedProjectId}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ userId: addUserId.trim(), role: addRole }),
        }
      );
      if (!res.ok) {
        setError("No se pudo añadir el miembro.");
        return;
      }
      const data = (await res.json()) as { member?: ProjectMember };
      if (data.member) setMembers((prev) => [...prev, data.member!]);
      setAddUserId("");
      setAddRole("");
    } catch {
      setError("No se pudo añadir el miembro.");
    } finally {
      setSavingMemberId(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedProjectId) return;

    setSavingMemberId(memberId);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(
        `/api/admin/projects/${selectedProjectId}/members`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ memberId }),
        }
      );
      if (!res.ok) {
        setError("No se pudo quitar el acceso.");
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch {
      setError("No se pudo quitar el acceso.");
    } finally {
      setSavingMemberId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          Acceso a proyectos
        </h2>
        <p className="text-xs text-slate-500">
          Define qué usuarios pueden ver y editar cada proyecto.
        </p>
      </div>

      {error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left: projects list */}
        <div className="md:col-span-1">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Proyectos</p>
          {loadingProjects ? (
            <p className="text-sm text-slate-500">Cargando proyectos...</p>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 max-h-80 overflow-y-auto space-y-1">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => handleSelectProject(project.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                    selectedProjectId === project.id
                      ? "bg-indigo-600 text-white"
                      : "text-slate-700 hover:bg-white hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{project.name}</span>
                    {project.status && (
                      <span className="text-[11px] rounded-full border border-slate-200 px-2 py-0.5">
                        {project.status}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: members + add form */}
        <div className="md:col-span-2 space-y-4">
          {!selectedProjectId ? (
            <p className="text-sm text-slate-500">
              Selecciona un proyecto para gestionar sus miembros.
            </p>
          ) : (
            <>
              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">
                  Miembros del proyecto
                </p>
                {loadingMembers ? (
                  <p className="text-sm text-slate-500">
                    Cargando miembros...
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                          <th className="py-3 px-4">Usuario</th>
                          <th className="py-3 px-4">Rol</th>
                          <th className="py-3 px-4 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {members.map((member) => {
                          const displayName =
                            member.user_full_name || "Usuario sin nombre";
                          return (
                            <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-4 text-slate-900">
                                {displayName}
                              </td>
                              <td className="py-3 px-4">
                                <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                  {ROLE_LABELS[member.role]}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember(member.id)}
                                  disabled={savingMemberId === member.id}
                                  className="text-xs font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50 transition-colors"
                                >
                                  {savingMemberId === member.id
                                    ? "Eliminando..."
                                    : "Quitar acceso"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <form
                onSubmit={handleAddMember}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"
              >
                <p className="text-xs font-medium text-slate-700 uppercase tracking-wide">
                  Añadir miembro
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Usuario
                    </label>
                    <select
                      value={addUserId}
                      onChange={(e) => setAddUserId(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      disabled={savingMemberId !== null}
                    >
                      <option value="">Seleccionar usuario</option>
                      {users
                        .filter(
                          (u) =>
                            !members.some((m) => m.user_id === u.id)
                        )
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name || u.email || "Sin nombre"}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">
                      Rol
                    </label>
                    <select
                      value={addRole}
                      onChange={(e) =>
                        setAddRole(
                          e.target.value as "owner" | "editor" | "viewer" | ""
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      disabled={savingMemberId !== null}
                    >
                      <option value="">Seleccionar rol</option>
                      <option value="owner">Propietario</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Lector</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={
                    !addUserId.trim() ||
                    !addRole ||
                    savingMemberId !== null
                  }
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {savingMemberId === "new" ? "Añadiendo..." : "Añadir"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

type GlobalKnowledgeSourceRow = {
  id: string;
  scope_type: string;
  project_id?: string | null;
  project_name?: string | null;
  source_type: string;
  source_name: string;
  external_ref: string | null;
  source_url: string | null;
  status: string;
  sync_enabled: boolean;
  last_synced_at: string | null;
  last_sync_error?: string | null;
  last_sync_status_detail?: string | null;
  integration_id: string | null;
  created_at: string;
  updated_at: string;
};

type IntegrationOption = {
  id: string;
  provider: string;
  display_name: string;
  account_email: string | null;
  status: string;
};

const GLOBAL_SOURCE_TYPE_LABELS: Record<string, string> = {
  google_drive_folder: "Carpeta Google Drive",
  google_drive_file: "Archivo Google Drive",
  sap_help: "SAP Help Portal",
  sap_official: "SAP Official",
  official_web: "Official SAP web",
  sharepoint_library: "Biblioteca SharePoint",
  confluence_space: "Espacio Confluence",
  jira_project: "Proyecto Jira",
  web_url: "URL web",
  manual_upload: "Carga manual",
};

type SyncStatusKey = "never" | "synced" | "syncing" | "error";

const SYNC_STATUS_LABELS: Record<SyncStatusKey, string> = {
  never: "Never synced",
  synced: "Synced",
  syncing: "Syncing",
  error: "Error",
};

/** User-facing labels for curated SAP sync failure detail codes. */
const SYNC_DETAIL_LABELS: Record<string, string> = {
  js_required: "Page requires JavaScript",
  no_content: "No readable content extracted",
  zero_chunks: "0 chunks generated",
  embed_failed: "Failed during embedding",
  insert_failed: "Failed during insert",
  other: "Sync failed",
};

/** Compact sync result line for curated SAP sources when status is error. */
function getSyncDetailLine(s: GlobalKnowledgeSourceRow): string | null {
  if (s.status !== "error") return null;
  const err = s.last_sync_error?.trim();
  if (err) {
    const firstLine = err.split(/\n/)[0].trim();
    if (firstLine.length <= 90 && (firstLine.includes("chars)") || firstLine.includes("chunks generated")))
      return firstLine;
    if (firstLine.length <= 90) return firstLine;
  }
  const detail = s.last_sync_status_detail;
  if (detail && SYNC_DETAIL_LABELS[detail]) return SYNC_DETAIL_LABELS[detail];
  if (err) {
    const short = err.slice(0, 80);
    return short + (err.length > 80 ? "…" : "");
  }
  return null;
}

function getSyncStatus(
  s: GlobalKnowledgeSourceRow,
  syncingSourceId: string | null
): SyncStatusKey {
  if (syncingSourceId === s.id) return "syncing";
  if (s.status === "error") return "error";
  if (s.last_synced_at != null) return "synced";
  return "never";
}

/** Show Sync now for Google Drive folder/file sources; API will return clear error if integration or ref missing. */
function isDriveSource(s: GlobalKnowledgeSourceRow): boolean {
  return s.source_type === "google_drive_folder" || s.source_type === "google_drive_file";
}

/** Official SAP curated URL sources: sync indexes the single page into knowledge_documents. */
function isCuratedSapSource(s: GlobalKnowledgeSourceRow): boolean {
  return s.source_type === "sap_help" || s.source_type === "official_web" || s.source_type === "sap_official";
}

function GlobalKnowledgeSourcesPanel() {
  const [sources, setSources] = useState<GlobalKnowledgeSourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<"global" | "project" | "all">("global");
  const [integrations, setIntegrations] = useState<IntegrationOption[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [googleConnectPending, setGoogleConnectPending] = useState(false);
  const [newSourceType, setNewSourceType] = useState("web_url");
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newExternalRef, setNewExternalRef] = useState("");
  const [newIntegrationId, setNewIntegrationId] = useState("");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const canSyncSource = (s: GlobalKnowledgeSourceRow) =>
    (isDriveSource(s) && !!s.integration_id && !!s.external_ref) ||
    (isCuratedSapSource(s) && !!s.source_url?.trim());

  const handleConnectGoogleDrive = async () => {
    setGoogleConnectPending(true);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch("/api/integrations/google/connect?return_url=/admin", { headers });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Error al iniciar la conexión con Google.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError("Respuesta inesperada del servidor.");
    } catch {
      setError("Error de conexión.");
    } finally {
      setGoogleConnectPending(false);
    }
  };

  const loadIntegrations = useCallback(async () => {
    setIntegrationsLoading(true);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch("/api/integrations", { headers });
      const data = (await res.json().catch(() => ({ integrations: [] }))) as { integrations?: IntegrationOption[] };
      setIntegrations((data.integrations ?? []).filter((i) => i.provider === "google_drive"));
    } catch {
      setIntegrations([]);
    } finally {
      setIntegrationsLoading(false);
    }
  }, []);

  const handleSync = async (id: string) => {
    setSyncingSourceId(id);
    setSyncMessage(null);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(`/api/admin/knowledge-sources/${id}/sync`, {
        method: "POST",
        headers,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        chunksCreated?: number;
        filesProcessed?: number;
        documentsProcessed?: number;
        errors?: string[];
        status?: string;
      };
      if (!res.ok) {
        setSyncMessage(data.error ?? "No se pudo sincronizar la fuente.");
        void loadSources();
        return;
      }
      const docs = data.documentsProcessed ?? data.filesProcessed ?? 0;
      const chunks = data.chunksCreated ?? 0;
      if (data.ok) {
        setSyncMessage(
          data.message ?? `Sincronización completada. ${docs} documentos, ${chunks} fragmentos.`
        );
      } else {
        setSyncMessage(
          data.message ?? data.error ?? `Sincronización con errores. ${docs} documentos, ${chunks} fragmentos.`
        );
      }
      void loadSources();
    } catch {
      setSyncMessage("Error de conexión.");
    } finally {
      setSyncingSourceId(null);
    }
  };

  const loadSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(`/api/admin/knowledge-sources?scope=${scopeFilter}`, { headers });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Error al cargar las fuentes.");
        setSources([]);
        return;
      }
      const data = (await res.json()) as { sources?: GlobalKnowledgeSourceRow[] };
      setSources(data.sources ?? []);
    } catch {
      setError("Error de conexión.");
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, [scopeFilter]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  useEffect(() => {
    void loadIntegrations();
  }, [loadIntegrations]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim() || saving) return;
    setSaving(true);
    setCreateError(null);
    try {
      const headers = await getAdminAuthHeaders();
      headers["Content-Type"] = "application/json";
      const body: Record<string, unknown> = {
        source_type: newSourceType,
        source_name: newSourceName.trim(),
        source_url: newSourceUrl.trim() || null,
        external_ref: newExternalRef.trim() || null,
      };
      if ((newSourceType === "google_drive_folder" || newSourceType === "google_drive_file") && newIntegrationId.trim()) {
        body.integration_id = newIntegrationId.trim();
      }
      const res = await fetch("/api/admin/knowledge-sources", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; source?: GlobalKnowledgeSourceRow };
      if (!res.ok) {
        setCreateError(data.error ?? "Error al crear la fuente.");
        return;
      }
      setNewSourceName("");
      setNewSourceUrl("");
      setNewExternalRef("");
      setNewIntegrationId("");
      if (data.source) setSources((prev) => [data.source!, ...prev]);
    } catch {
      setCreateError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(`/api/admin/knowledge-sources/${id}`, {
        method: "DELETE",
        headers,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Error al eliminar la fuente.");
        return;
      }
      setSources((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError("Error de conexión.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatSyncDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const hasGoogleIntegration = integrations.length > 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-xl overflow-hidden bg-slate-100 shrink-0">
            <Image
              src={getSapitoGeneral().avatarImage}
              alt=""
              fill
              className="object-cover"
              sizes="40px"
            />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Knowledge Sources
            </h2>
            <p className="text-xs text-slate-500 max-w-xl">
              Global and project knowledge used by Sapito to answer with broader context. Managed from Admin.
            </p>
          </div>
        </div>
      </div>

      {/* Platform integrations: Google Drive — primary entry point */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
          Platform integrations
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-slate-800">Google Drive</p>
            {integrationsLoading ? (
              <p className="mt-1 text-xs text-slate-500">Cargando…</p>
            ) : hasGoogleIntegration ? (
              <>
                <p className="mt-1 text-xs text-slate-600">
                  Conectado: {integrations[0]?.account_email ?? integrations[0]?.display_name ?? "—"}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Usado para fuentes globales y de proyecto. Conecta aquí para gestionar desde Admin.
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-slate-500">
                Conecta una cuenta de Google Drive para crear fuentes de conocimiento global o por proyecto.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleConnectGoogleDrive}
            disabled={googleConnectPending}
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors shrink-0"
          >
            {googleConnectPending ? "Redirigiendo…" : hasGoogleIntegration ? "Reconectar Google Drive" : "Connect Google Drive"}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => void loadSources()}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Reintentar
          </button>
        </div>
      )}
      {syncMessage && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            syncMessage.includes("completada") && !syncMessage.includes("errores")
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : syncMessage.includes("Error") || syncMessage.includes("errores")
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {syncMessage}
        </div>
      )}

      <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <p className="text-xs font-medium text-slate-700 uppercase tracking-wide">
          Crear fuente global
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Tipo</label>
            <select
              value={newSourceType}
              onChange={(e) => setNewSourceType(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={saving}
            >
              {Object.entries(GLOBAL_SOURCE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {(newSourceType === "sap_help" || newSourceType === "official_web" || newSourceType === "sap_official") && (
              <div className="mt-1 space-y-1">
                <p className="text-xs text-slate-500">
                  Añade la URL de la página (una por fuente). Al sincronizar se indexará solo esa página.
                </p>
                <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5 border border-amber-200">
                  <strong>Guía:</strong> Las páginas SAP Help solo se indexan cuando el contenido legible está en el HTML inicial. Las que cargan todo por JavaScript no se pueden indexar con este flujo. Si una URL falla, prueba otra página curada o usa un documento/PDF como alternativa.
                </p>
                {newSourceType === "sap_help" && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                    <strong>SAP Help Portal:</strong> solo URLs de help.sap.com. No uses community.sap.com (esas páginas usan JavaScript y no se pueden indexar aquí).
                  </p>
                )}
                {newSourceType === "sap_official" && (
                  <p className="text-xs text-slate-600">
                    <strong>SAP Official:</strong> documentación oficial SAP aprobada (p. ej. help.sap.com u otras fuentes oficiales).
                  </p>
                )}
                {newSourceType === "official_web" && (
                  <p className="text-xs text-slate-600">
                    <strong>Official Web:</strong> páginas públicas curadas (p. ej. community.sap.com u otros dominios). Si la página requiere JavaScript o verificación anti-bot, la sincronización fallará con un mensaje claro.
                  </p>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Nombre *</label>
            <input
              type="text"
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
              placeholder="Nombre de la fuente"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={saving}
            />
          </div>
          {(newSourceType === "google_drive_folder" || newSourceType === "google_drive_file") && (
            <div>
              <label className="block text-xs text-slate-600 mb-1">Cuenta Google Drive</label>
              <select
                value={newIntegrationId}
                onChange={(e) => setNewIntegrationId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={saving}
              >
                <option value="">Seleccionar cuenta</option>
                {integrations.map((int) => (
                  <option key={int.id} value={int.id}>
                    {int.account_email || int.display_name || int.id}
                  </option>
                ))}
              </select>
              {!hasGoogleIntegration && (
                <p className="mt-1 text-xs text-slate-500">Conecta Google Drive arriba.</p>
              )}
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-600 mb-1">URL</label>
            <input
              type="text"
              value={newSourceUrl}
              onChange={(e) => setNewSourceUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Ref externa (ej. ID carpeta)</label>
            <input
              type="text"
              value={newExternalRef}
              onChange={(e) => setNewExternalRef(e.target.value)}
              placeholder="Opcional"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={saving}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={!newSourceName.trim() || saving}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Creando…" : "Crear fuente global"}
        </button>
        {createError && (
          <p className="text-sm text-red-600">{createError}</p>
        )}
      </form>

      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Listado
          </p>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
            {(["global", "project", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScopeFilter(s)}
                className={`px-2 py-1 rounded-md font-medium transition-colors ${
                  scopeFilter === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {s === "global" ? "Global" : s === "project" ? "Project" : "All"}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Cargando fuentes…</p>
        ) : sources.length === 0 ? (
          <p className="text-sm text-slate-500">
            {scopeFilter === "global" && "No hay fuentes globales. Crea una para que Sapito use conocimiento reutilizable (por ejemplo SAP Help o Google Drive)."}
            {scopeFilter === "project" && "No hay fuentes de proyecto listadas aquí."}
            {scopeFilter === "all" && "No hay fuentes de conocimiento. Añade una fuente global o de proyecto para empezar."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="py-3 px-4">Nombre</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Scope</th>
                  <th className="py-3 px-4">Proyecto</th>
                  <th className="py-3 px-4">Sync status</th>
                  <th className="py-3 px-4">Última sync</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sources.map((s) => {
                  const syncStatus = getSyncStatus(s, syncingSourceId);
                  return (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-900 font-medium">{s.source_name}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        {GLOBAL_SOURCE_TYPE_LABELS[s.source_type] ?? s.source_type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                        {s.scope_type === "global" ? "Global" : "Project"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {s.scope_type === "project" && (s.project_name ?? s.project_id ?? "—")}
                      {s.scope_type === "global" && "—"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium w-fit ${
                            syncStatus === "syncing"
                              ? "bg-amber-100 text-amber-800"
                              : syncStatus === "error"
                                ? "bg-red-100 text-red-800"
                                : syncStatus === "synced"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {SYNC_STATUS_LABELS[syncStatus]}
                        </span>
                        {isCuratedSapSource(s) && getSyncDetailLine(s) && (
                          <span className="text-xs text-slate-500 max-w-[220px] truncate" title={s.last_sync_error ?? undefined}>
                            {getSyncDetailLine(s)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      {s.last_synced_at ? formatSyncDate(s.last_synced_at) : "—"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isDriveSource(s) || isCuratedSapSource(s) ? (
                          <button
                            type="button"
                            onClick={() => handleSync(s.id)}
                            disabled={syncingSourceId !== null || !canSyncSource(s)}
                            title={!canSyncSource(s) ? (isCuratedSapSource(s) ? "Añade la URL de la página SAP en la fuente" : "Configura cuenta de Google Drive y Ref externa (ID carpeta) en la fuente") : "Sincronizar ahora"}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
                          >
                            {syncingSourceId === s.id ? "Syncing…" : "Sync now"}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400" title="Sync solo disponible para Google Drive o SAP oficial (sap_help, sap_official, official_web)">
                            —
                          </span>
                        )}
                        {s.scope_type === "global" && (
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id)}
                            disabled={deletingId !== null}
                            className="text-xs font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50"
                          >
                            {deletingId === s.id ? "Eliminando…" : "Eliminar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

type ClientRow = {
  id: string;
  name: string;
  created_at?: string;
  created_by?: string | null;
};

function ClientsPanel() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch("/api/admin/clients", { headers });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Error al cargar los clientes.");
        setClients([]);
        return;
      }
      const data = (await res.json()) as { clients?: ClientRow[] };
      setClients(data.clients ?? []);
    } catch {
      setError("Error de conexión.");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || saving) return;
    setSaving(true);
    setCreateError(null);
    try {
      const headers = await getAdminAuthHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; client?: ClientRow };
      if (!res.ok) {
        setCreateError(data.error ?? "Error al crear el cliente.");
        return;
      }
      setNewName("");
      if (data.client) setClients((prev) => [...prev, data.client!].sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setCreateError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          Clientes
        </h2>
        <p className="text-xs text-slate-500">
          Crear y listar clientes para asignar a proyectos.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <p className="text-xs font-medium text-slate-700 uppercase tracking-wide">
          Crear cliente
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="block text-xs text-slate-600 mb-1">
              Nombre
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre del cliente"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              disabled={saving}
            />
          </div>
          <button
            type="submit"
            disabled={!newName.trim() || saving}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Creando…" : "Crear cliente"}
          </button>
        </div>
        {createError && (
          <p className="text-sm text-red-600">{createError}</p>
        )}
      </form>

      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
          Listado de clientes
        </p>
        {loading ? (
          <p className="text-sm text-slate-500">Cargando clientes…</p>
        ) : clients.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no hay clientes. Crea uno arriba.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="py-3 px-4">Nombre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-900">{c.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
