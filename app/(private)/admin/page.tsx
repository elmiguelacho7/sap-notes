"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/** Returns headers with Bearer token for admin API calls (session is in localStorage). */
async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type TabId = "users" | "projects";

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
          .select("app_role")
          .eq("id", user.id)
          .single();

        if (cancelled) return;
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
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-slate-500">Cargando...</p>
      </div>
    );
  }

  if (appRole !== "superadmin") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-center text-sm text-slate-600">
          Acceso restringido. Solo los administradores pueden ver este panel.
        </p>
      </div>
    );
  }

  return <AdminPanel />;
}

function AdminPanel() {
  const [activeTab, setActiveTab] = useState<TabId>("users");

  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Panel de administración
            </h1>
            <p className="text-sm text-slate-500">
              Gestiona usuarios, roles y acceso a proyectos.
            </p>
          </div>
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === "users"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Usuarios y roles
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("projects")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === "projects"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Acceso a proyectos
          </button>
        </div>

        {activeTab === "users" && <UsersRolesPanel />}
        {activeTab === "projects" && <ProjectAccessPanel />}
      </div>
    </div>
  );
}

type AdminUser = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  app_role: "superadmin" | "consultant";
};

function UsersRolesPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [pendingRoles, setPendingRoles] = useState<
    Record<string, "superadmin" | "consultant">
  >({});

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

  const handleRoleChange = (
    userId: string,
    newRole: "superadmin" | "consultant"
  ) => {
    setPendingRoles((prev) => ({ ...prev, [userId]: newRole }));
  };

  const handleSaveRole = async (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    const newRole = pendingRoles[userId] ?? user.app_role;
    if (newRole === user.app_role) {
      setPendingRoles((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      return;
    }

    setSavingUserId(userId);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ userId, appRole: newRole }),
      });
      if (!res.ok) {
        setError("No se pudo actualizar el rol.");
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, app_role: newRole } : u))
      );
      setPendingRoles((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          Usuarios y roles
        </h2>
        <p className="text-xs text-slate-500">
          Define el rol global de cada usuario en la plataforma.
        </p>
      </div>

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
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => {
                const displayName =
                  user.full_name || user.email || "Sin nombre";
                const currentRole =
                  pendingRoles[user.id] ?? user.app_role;
                return (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-900">
                      {displayName}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={currentRole}
                        onChange={(e) =>
                          handleRoleChange(user.id, e.target.value as "superadmin" | "consultant")
                        }
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        disabled={savingUserId === user.id}
                      >
                        <option value="consultant">Consultor</option>
                        <option value="superadmin">Superadmin</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleSaveRole(user.id)}
                        disabled={savingUserId === user.id}
                        className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        {savingUserId === user.id ? "Guardando..." : "Guardar"}
                      </button>
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
