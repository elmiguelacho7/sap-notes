"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
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

type ClientRow = {
  id: string;
  name: string;
  created_at?: string;
  created_by?: string | null;
};

export default function ClientsPage() {
  const [loading, setLoading] = useState(true);
  const [appRole, setAppRole] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
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
    }
    checkAccess();
    return () => { cancelled = true; };
  }, []);

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
    if (appRole === "superadmin") void loadClients();
  }, [appRole, loadClients]);

  const handleCreate = async (e: FormEvent) => {
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

  if (loading && !appRole) {
    return (
      <PageShell wide={false}>
        <div className="py-12 text-center">
          <p className="text-sm text-slate-500">Cargando…</p>
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
            Solo los administradores pueden gestionar clientes.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell wide={false}>
      <div className="space-y-6">
        <PageHeader
          title="Clientes"
          description="Gestiona clientes para asignar a proyectos. Módulo operativo, independiente de la administración de la plataforma."
        />

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/50">
            <h2 className="text-sm font-semibold text-slate-900">Crear cliente</h2>
            <p className="text-xs text-slate-500 mt-1">Añade un nuevo cliente al catálogo.</p>
          </div>
          <div className="p-5">
            <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre</label>
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
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Creando…" : "Crear cliente"}
              </button>
            </form>
            {createError && <p className="mt-2 text-sm text-red-600">{createError}</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/50">
            <h2 className="text-sm font-semibold text-slate-900">Listado de clientes</h2>
          </div>
          <div className="p-5">
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
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
      </div>
    </PageShell>
  );
}
