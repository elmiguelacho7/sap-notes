"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
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

type AdminUser = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  app_role: string;
};

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Superadministrador",
  consultant: "Consultor",
};

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [appRole, setAppRole] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [appRoleNew, setAppRoleNew] = useState<"superadmin" | "consultant">("consultant");
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
        setError((data as { error?: string }).error ?? "Error al cargar los usuarios.");
        setUsers([]);
        return;
      }
      setUsers((data as { users?: AdminUser[] }).users ?? []);
    } catch {
      setError("Error de conexión.");
      setUsers([]);
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
        setCreateError(data.error ?? "Error al crear el usuario.");
        return;
      }
      setCreateSuccess("Usuario creado correctamente.");
      setEmail("");
      setFullName("");
      setAppRoleNew("consultant");
      await loadUsers();
    } catch {
      setCreateError("Error de conexión.");
    } finally {
      setCreating(false);
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
          Acceso restringido. Solo los administradores pueden ver esta página.
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-indigo-600"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver al panel de administración
        </Link>

        <header>
          <h1 className="text-2xl font-semibold text-slate-900">
            Usuarios
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Crear y gestionar usuarios (consultores y superadministradores).
          </p>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Crear usuario
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
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
                  placeholder="usuario@ejemplo.com"
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
                  placeholder="Nombre completo"
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
                  onChange={(e) => setAppRoleNew(e.target.value as "superadmin" | "consultant")}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={creating}
                >
                  <option value="consultant">Consultor</option>
                  <option value="superadmin">Superadministrador</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={creating || !email.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 mt-6"
              >
                {creating ? "Creando…" : "Crear usuario"}
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
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Usuarios existentes
            </h2>
          </div>
          <div className="p-5">
            {users.length === 0 ? (
              <p className="text-sm text-slate-500">Aún no hay usuarios. Crea uno arriba.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Nombre</th>
                      <th className="py-3 px-4">Rol</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-900">{u.email ?? "—"}</td>
                        <td className="py-3 px-4 text-slate-700">{u.full_name ?? "—"}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                            {ROLE_LABELS[u.app_role] ?? u.app_role}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
