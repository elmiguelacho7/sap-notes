"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

type RoleWithPermissions = {
  id: string;
  scope: string;
  key: string;
  name: string;
  is_active: boolean;
  permissions: { id: string; key: string; name: string }[];
};

type Permission = {
  id: string;
  scope: string;
  key: string;
  name: string;
};

const TAB_IDS = ["general", "administration", "roles"] as const;
const TAB_LABELS: Record<(typeof TAB_IDS)[number], string> = {
  general: "General",
  administration: "Administración",
  roles: "Roles",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  superadmin: "Acceso total a la aplicación y configuración.",
  admin: "Gestión de clientes y visualización de proyectos.",
  consultant: "Usuario estándar sin permisos de administración.",
  viewer: "Solo lectura a nivel de aplicación.",
  owner: "Control total del proyecto y sus miembros.",
  editor: "Editar tareas y notas; sin gestión de miembros.",
};

function getRoleDescription(scope: string, key: string): string {
  if (scope === "project" && key === "viewer") return "Solo lectura dentro del proyecto.";
  return ROLE_DESCRIPTIONS[key] ?? "";
}

export default function AdminRolesPage() {
  const [loading, setLoading] = useState(true);
  const [appRole, setAppRole] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof TAB_IDS)[number]>("roles");
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch("/api/admin/roles", { headers });
      const data = await res.json().catch(() => ({})) as {
        error?: string;
        roles?: RoleWithPermissions[];
        permissions?: Permission[];
      };
      if (!res.ok) {
        setError(data.error ?? "Error al cargar los roles.");
        setRoles([]);
        setAllPermissions([]);
        return;
      }
      setRoles(data.roles ?? []);
      setAllPermissions(data.permissions ?? []);
    } catch {
      setError("Error de conexión.");
      setRoles([]);
      setAllPermissions([]);
    }
  }, []);

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
        if ((profile as { app_role?: string } | null)?.app_role === "superadmin") {
          await loadRoles();
        }
      } catch {
        if (!cancelled) setAppRole(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void init();
    return () => { cancelled = true; };
  }, [loadRoles]);

  const handleToggleActive = async (roleId: string, isActive: boolean) => {
    setUpdatingRoleId(roleId);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/admin/roles/${roleId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ is_active: isActive }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; role?: RoleWithPermissions };
      if (!res.ok) {
        setError(data.error ?? "Error al actualizar el rol.");
        return;
      }
      if (data.role) {
        setRoles((prev) => prev.map((r) => (r.id === roleId ? { ...r, is_active: data.role!.is_active } : r)));
      }
    } catch {
      setError("Error de conexión.");
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleTogglePermission = async (roleId: string, permissionId: string, checked: boolean) => {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;

    const currentIds = role.permissions.map((p) => p.id);
    const newIds = checked
      ? [...currentIds, permissionId]
      : currentIds.filter((id) => id !== permissionId);

    setUpdatingRoleId(roleId);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/admin/roles/${roleId}/permissions`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ permissionIds: newIds }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Error al actualizar los permisos.");
        return;
      }
      await loadRoles();
    } catch {
      setError("Error de conexión.");
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleControlTotal = async (role: RoleWithPermissions) => {
    const scopePerms = allPermissions.filter((p) => p.scope === role.scope);
    const allIds = scopePerms.map((p) => p.id);
    const currentIds = new Set(role.permissions.map((p) => p.id));
    const allSelected = scopePerms.length > 0 && allIds.every((id) => currentIds.has(id));
    const newIds = allSelected ? [] : allIds;

    setUpdatingRoleId(role.id);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/admin/roles/${role.id}/permissions`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ permissionIds: newIds }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Error al actualizar los permisos.");
        return;
      }
      await loadRoles();
    } catch {
      setError("Error de conexión.");
    } finally {
      setUpdatingRoleId(null);
    }
  };

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
          Acceso restringido. Solo los superadministradores pueden ver esta página.
        </p>
      </div>
    );
  }

  const scopePermissions = (scope: string) => allPermissions.filter((p) => p.scope === scope);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-indigo-600"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver al panel de administración
        </Link>

        <header>
          <h1 className="text-2xl font-semibold text-slate-900">
            Configuración
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Roles y permisos (Phase 1: solo gestión; la autorización en la app no usa aún estas tablas).
          </p>
        </header>

        <nav className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-sm">
          {TAB_IDS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </nav>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {activeTab === "roles" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles.map((role) => {
              const permsForScope = scopePermissions(role.scope);
              const permissionIdsSet = new Set(role.permissions.map((p) => p.id));
              const allSelected = permsForScope.length > 0 && permsForScope.every((p) => permissionIdsSet.has(p.id));
              const busy = updatingRoleId === role.id;

              return (
                <div
                  key={role.id}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                >
                  <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/50">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-900">{role.name}</h2>
                        <p className="text-xs text-slate-500 mt-0.5 capitalize">{role.scope}</p>
                        <p className="text-xs text-slate-600 mt-1">
                          {getRoleDescription(role.scope, role.key)}
                        </p>
                      </div>
                      <label className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-medium text-slate-600">Activo</span>
                        <input
                          type="checkbox"
                          checked={role.is_active}
                          onChange={(e) => handleToggleActive(role.id, e.target.checked)}
                          disabled={busy}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Permisos
                      </span>
                      <button
                        type="button"
                        onClick={() => handleControlTotal(role)}
                        disabled={busy || permsForScope.length === 0}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
                      >
                        {allSelected ? "Quitar todos" : "Control total"}
                      </button>
                    </div>
                    <ul className="space-y-2">
                      {permsForScope.map((perm) => {
                        const checked = permissionIdsSet.has(perm.id);
                        return (
                          <li key={perm.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`${role.id}-${perm.id}`}
                              checked={checked}
                              onChange={(e) => handleTogglePermission(role.id, perm.id, e.target.checked)}
                              disabled={busy}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label
                              htmlFor={`${role.id}-${perm.id}`}
                              className="text-sm text-slate-700 cursor-pointer"
                            >
                              {perm.name}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                    {permsForScope.length === 0 && (
                      <p className="text-xs text-slate-400">No hay permisos definidos para este ámbito.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab !== "roles" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Próximamente
          </div>
        )}
      </div>
    </main>
  );
}
