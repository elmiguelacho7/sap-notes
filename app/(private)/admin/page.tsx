"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Users, Zap, Brain, Shield, BarChart2, Sliders, UserCog } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { AppPageShell } from "@/components/ui/layout/AppPageShell";
import { getSapitoGeneral } from "@/lib/agents/agentRegistry";
import {
  INDUSTRY_OPTIONS,
  COMPANY_SIZE_OPTIONS,
  ACCOUNT_TIER_OPTIONS,
  OWNERSHIP_TYPE_OPTIONS,
  BUSINESS_MODEL_OPTIONS,
} from "@/lib/constants/clientOptions";
import {
  getAllCountryOptions,
  getStateOptions,
  resolveCountryOptionValue,
  resolveStateOptionValue,
  getCountryDisplayName,
} from "@/lib/countryStateCity";

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

type TabId = "users" | "activations" | "knowledge" | "limits" | "userLimits" | "capacity";

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
      <div className="bg-slate-950 min-h-full">
        <AppPageShell>
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-slate-300">Cargando…</p>
            <p className="mt-1 text-sm text-slate-500">Un momento.</p>
          </div>
        </AppPageShell>
      </div>
    );
  }

  if (appRole !== "superadmin") {
    return (
      <div className="bg-slate-950 min-h-full">
        <AppPageShell>
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-5 py-12 text-center">
            <p className="text-sm font-medium text-slate-200">Acceso restringido</p>
            <p className="mt-1 text-sm text-slate-500">
              Solo los administradores pueden ver este panel.
            </p>
          </div>
        </AppPageShell>
      </div>
    );
  }

  return <AdminPanel />;
}

type OverviewStats = {
  usersActive: number | null;
  projectsTotal: number | null;
  knowledgeIntegrations: number | null;
  capacityPct: number | null;
};

function AdminPanel() {
  const [activeTab, setActiveTab] = useState<TabId>("users");
  const [overview, setOverview] = useState<OverviewStats>({
    usersActive: null,
    projectsTotal: null,
    knowledgeIntegrations: null,
    capacityPct: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const headers = await getAdminAuthHeaders();
      try {
        const [usersRes, projectsRes, integrationsRes, capacityRes] = await Promise.all([
          fetch("/api/admin/users", { headers }),
          supabase.from("projects").select("id", { count: "exact", head: true }),
          fetch("/api/integrations", { headers }),
          fetch("/api/admin/quotas/capacity", { headers }),
        ]);

        if (cancelled) return;

        const usersData = usersRes.ok ? ((await usersRes.json()) as { users?: { is_active?: boolean }[] }) : null;
        const usersActive = usersData?.users?.filter((u) => u.is_active === true).length ?? null;

        const projectsTotal = projectsRes.error ? null : (projectsRes.count ?? null);

        let knowledgeIntegrations: number | null = null;
        if (integrationsRes.ok) {
          const data = (await integrationsRes.json()) as { integrations?: { provider?: string }[] };
          knowledgeIntegrations = (data.integrations ?? []).filter((i) => i.provider === "google_drive").length;
        }

        let capacityPct: number | null = null;
        if (capacityRes.ok) {
          const cap = (await capacityRes.json()) as {
            summary?: { usersAtLimit?: number; usersNearLimit?: number; userUsage?: unknown[] };
          };
          const total = cap.summary?.userUsage?.length ?? 0;
          const atLimit = cap.summary?.usersAtLimit ?? 0;
          const nearLimit = cap.summary?.usersNearLimit ?? 0;
          if (total > 0) capacityPct = Math.round(((atLimit + nearLimit * 0.5) / total) * 100);
        }
        setOverview({
          usersActive,
          projectsTotal,
          knowledgeIntegrations,
          capacityPct,
        });
      } catch {
        if (!cancelled) setOverview((o) => ({ ...o }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const iconClass = "size-4 shrink-0 text-slate-400";

  return (
    <div className="bg-slate-950 min-h-full">
      <AppPageShell>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-100">Admin</h1>
          <p className="text-sm text-slate-500">Platform administration and system configuration.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Users</p>
            <p className="text-lg font-semibold text-slate-100 mt-0.5">
              {overview.usersActive !== null ? overview.usersActive : "—"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Active users in the system</p>
          </div>
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Projects</p>
            <p className="text-lg font-semibold text-slate-100 mt-0.5">
              {overview.projectsTotal !== null ? overview.projectsTotal : "—"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Total projects</p>
          </div>
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Knowledge Sources</p>
            <p className="text-lg font-semibold text-slate-100 mt-0.5">
              {overview.knowledgeIntegrations !== null ? overview.knowledgeIntegrations : "—"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Connected integrations</p>
          </div>
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Capacity</p>
            <p className="text-lg font-semibold text-slate-100 mt-0.5">
              {overview.capacityPct !== null ? `${overview.capacityPct}%` : "—"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Usage / near limit</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 rounded-lg border border-slate-700/60 bg-slate-900 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
              activeTab === "users"
                ? "bg-slate-800 text-slate-100"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Users className={iconClass} aria-hidden />
            Usuarios
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("activations")}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
              activeTab === "activations"
                ? "bg-slate-800 text-slate-100"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Zap className={iconClass} aria-hidden />
            Activaciones
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("knowledge")}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
              activeTab === "knowledge"
                ? "bg-slate-800 text-slate-100"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Brain className={iconClass} aria-hidden />
            Knowledge Sources
          </button>
          <a
            href="/admin/roles"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
          >
            <Shield className={iconClass} aria-hidden />
            Roles globales
          </a>
          <button
            type="button"
            onClick={() => setActiveTab("limits")}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
              activeTab === "limits"
                ? "bg-slate-800 text-slate-100"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Sliders className={iconClass} aria-hidden />
            Límites por rol
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("userLimits")}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
              activeTab === "userLimits"
                ? "bg-slate-800 text-slate-100"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <UserCog className={iconClass} aria-hidden />
            Límites por usuario
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("capacity")}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
              activeTab === "capacity"
                ? "bg-slate-800 text-slate-100"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <BarChart2 className={iconClass} aria-hidden />
            Capacidad
          </button>
        </div>

        {activeTab === "users" && <UsersRolesPanel />}
        {activeTab === "activations" && <ActivationsPanel />}
        {activeTab === "knowledge" && <GlobalKnowledgeSourcesPanel />}
        {activeTab === "limits" && <RoleLimitsPanel />}
        {activeTab === "userLimits" && <UserLimitsPanel />}
        {activeTab === "capacity" && <CapacityDashboard />}
      </div>
      </AppPageShell>
    </div>
  );
}

type RoleLimitsEntry = {
  roleId: string;
  roleKey: string;
  roleName: string;
  limits: Record<string, number>;
};

function RoleLimitsPanel() {
  const [roleLimits, setRoleLimits] = useState<RoleLimitsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRoleKey, setSavingRoleKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch("/api/admin/quotas", { headers });
      if (!res.ok) return;
      const data = (await res.json()) as { roleLimits?: RoleLimitsEntry[] };
      setRoleLimits(data.roleLimits ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (roleKey: string, limits: Record<string, number>) => {
    setSavingRoleKey(roleKey);
    setMessage(null);
    try {
      const headers = await getAdminAuthHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch("/api/admin/quotas", {
        method: "PUT",
        headers,
        body: JSON.stringify({ roleKey, limits }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Error al guardar.");
        return;
      }
      setMessage("Límites guardados.");
      void load();
    } finally {
      setSavingRoleKey(null);
    }
  };

  const appRoles = roleLimits.filter((r) => r.roleKey !== "superadmin");

  return (
    <section className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden shadow-sm ring-1 ring-slate-700/50">
      <div className="border-b border-slate-700/60 px-5 py-4 bg-slate-800/50">
        <h2 className="text-sm font-medium text-slate-200">Límites por rol</h2>
        <p className="text-xs text-slate-500 mt-1">
          Cuotas por defecto para cada rol (superadmin no tiene límite). Vacío = sin límite.
        </p>
      </div>
      <div className="p-5 space-y-6">
        {message && (
          <p className="text-sm text-emerald-400">{message}</p>
        )}
        {loading ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : (
          appRoles.map((entry) => (
            <RoleLimitForm
              key={entry.roleKey}
              entry={entry}
              saving={savingRoleKey === entry.roleKey}
              onSave={handleSave}
            />
          ))
        )}
      </div>
    </section>
  );
}

function RoleLimitForm({
  entry,
  saving,
  onSave,
}: {
  entry: RoleLimitsEntry;
  saving: boolean;
  onSave: (roleKey: string, limits: Record<string, number>) => Promise<void>;
}) {
  const [maxProjects, setMaxProjects] = useState<string>(String(entry.limits.max_projects_created ?? ""));
  const [maxInvitations, setMaxInvitations] = useState<string>(String(entry.limits.max_pending_invitations_per_project ?? ""));
  const [maxMembers, setMaxMembers] = useState<string>(String(entry.limits.max_members_per_project ?? ""));
  const [maxClients, setMaxClients] = useState<string>(String(entry.limits.max_clients_created ?? ""));

  useEffect(() => {
    setMaxProjects(String(entry.limits.max_projects_created ?? ""));
    setMaxInvitations(String(entry.limits.max_pending_invitations_per_project ?? ""));
    setMaxMembers(String(entry.limits.max_members_per_project ?? ""));
    setMaxClients(String(entry.limits.max_clients_created ?? ""));
  }, [entry.roleKey, entry.limits.max_projects_created, entry.limits.max_pending_invitations_per_project, entry.limits.max_members_per_project, entry.limits.max_clients_created]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const limits: Record<string, number> = {};
    const p = parseInt(maxProjects.trim(), 10);
    const i = parseInt(maxInvitations.trim(), 10);
    const m = parseInt(maxMembers.trim(), 10);
    const c = parseInt(maxClients.trim(), 10);
    if (!Number.isNaN(p) && p > 0) limits.max_projects_created = p;
    if (!Number.isNaN(i) && i > 0) limits.max_pending_invitations_per_project = i;
    if (!Number.isNaN(m) && m > 0) limits.max_members_per_project = m;
    if (!Number.isNaN(c) && c > 0) limits.max_clients_created = c;
    void onSave(entry.roleKey, limits);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4 space-y-4">
      <h3 className="text-sm font-medium text-slate-200">{entry.roleName}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Máx. proyectos creados</label>
          <input
            type="number"
            min={1}
            value={maxProjects}
            onChange={(e) => setMaxProjects(e.target.value)}
            placeholder="Sin límite"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            disabled={saving}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Máx. invitaciones pendientes por proyecto</label>
          <input
            type="number"
            min={1}
            value={maxInvitations}
            onChange={(e) => setMaxInvitations(e.target.value)}
            placeholder="Sin límite"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            disabled={saving}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Máx. miembros por proyecto</label>
          <input
            type="number"
            min={1}
            value={maxMembers}
            onChange={(e) => setMaxMembers(e.target.value)}
            placeholder="Sin límite"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            disabled={saving}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Máx. clientes creados</label>
          <input
            type="number"
            min={1}
            value={maxClients}
            onChange={(e) => setMaxClients(e.target.value)}
            placeholder="Sin límite"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            disabled={saving}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors duration-150"
      >
        {saving ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}

type UserQuotaConfig = {
  userId: string;
  appRole: string | null;
  roleLimits: Record<string, number>;
  userOverrides: Record<string, number>;
  effectiveLimits: Record<string, number | null>;
};

const USER_QUOTA_LABELS: Record<string, string> = {
  max_projects_created: "Máx. proyectos creados",
  max_pending_invitations_per_project: "Máx. invitaciones pendientes por proyecto",
  max_members_per_project: "Máx. miembros por proyecto",
  max_clients_created: "Máx. clientes creados",
};

function UserLimitsPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalUserId, setModalUserId] = useState<string | null>(null);
  const [quotaData, setQuotaData] = useState<UserQuotaConfig | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  const openModal = useCallback(async (userId: string) => {
    setModalUserId(userId);
    setQuotaData(null);
    setQuotaLoading(true);
    setMessage(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(`/api/admin/quotas/user/${userId}`, { headers });
      const data = (await res.json()) as UserQuotaConfig | { error?: string };
      if (res.ok && "userId" in data) setQuotaData(data as UserQuotaConfig);
      else setMessage((data as { error?: string }).error ?? "Error al cargar.");
    } finally {
      setQuotaLoading(false);
    }
  }, []);

  const closeModal = useCallback(() => {
    setModalUserId(null);
    setQuotaData(null);
    setMessage(null);
  }, []);

  return (
    <section className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden shadow-sm ring-1 ring-slate-700/50">
      <div className="border-b border-slate-700/60 px-5 py-4 bg-slate-800/50">
        <h2 className="text-sm font-medium text-slate-200">Límites por usuario</h2>
        <p className="text-xs text-slate-500 mt-1">
          Overrides por usuario (vacío = usar límite del rol). Solo superadmin.
        </p>
      </div>
      <div className="p-5">
        {loading ? (
          <p className="text-sm text-slate-500">Cargando usuarios…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-700/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60 bg-slate-800/50 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-4">Nombre</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Rol</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/50 transition-colors duration-150">
                    <td className="py-2 pr-4 text-slate-200">{u.full_name ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-200">{u.email ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-200">{u.app_role}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => openModal(u.id)}
                        className="text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors duration-150"
                      >
                        Configurar límites
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalUserId && (
        <UserQuotaModal
          userId={modalUserId}
          user={users.find((u) => u.id === modalUserId) ?? null}
          quotaData={quotaData}
          loading={quotaLoading}
          saving={saving}
          message={message}
          onClose={closeModal}
          onSave={async (overrides) => {
            setSaving(true);
            setMessage(null);
            try {
              const headers = await getAdminAuthHeaders();
              (headers as Record<string, string>)["Content-Type"] = "application/json";
              const res = await fetch(`/api/admin/quotas/user/${modalUserId}`, {
                method: "PUT",
                headers,
                body: JSON.stringify({ overrides }),
              });
              const data = (await res.json()) as { error?: string };
              if (res.ok) {
                setMessage("Límites guardados.");
                const getRes = await fetch(`/api/admin/quotas/user/${modalUserId}`, { headers });
                if (getRes.ok) {
                  const updated = (await getRes.json()) as UserQuotaConfig;
                  setQuotaData(updated);
                }
              } else setMessage(data.error ?? "Error al guardar.");
            } finally {
              setSaving(false);
            }
          }}
        />
      )}
    </section>
  );
}

function UserQuotaModal({
  userId,
  user,
  quotaData,
  loading,
  saving,
  message,
  onClose,
  onSave,
}: {
  userId: string;
  user: AdminUser | null;
  quotaData: UserQuotaConfig | null;
  loading: boolean;
  saving: boolean;
  message: string | null;
  onClose: () => void;
  onSave: (overrides: Record<string, number>) => Promise<void>;
}) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!quotaData) return;
    const o: Record<string, string> = {};
    for (const key of Object.keys(USER_QUOTA_LABELS)) {
      o[key] = String(quotaData.userOverrides[key] ?? "");
    }
    setOverrides(o);
  }, [quotaData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const out: Record<string, number> = {};
    for (const [key, val] of Object.entries(overrides)) {
      const n = parseInt(String(val).trim(), 10);
      if (!Number.isNaN(n) && n > 0) out[key] = n;
    }
    void onSave(out);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/95 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-700/60 px-5 py-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-200">
            Límites: {user?.full_name || user?.email || userId}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 text-xl leading-none transition-colors">&times;</button>
        </div>
        <div className="p-5">
          {loading ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : quotaData ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-slate-400">Rol: <strong className="text-slate-200">{quotaData.appRole ?? "—"}</strong></p>
              <div className="rounded-lg border border-slate-700/60 p-3 bg-slate-900/50">
                <p className="text-xs font-medium text-slate-400 mb-2">Límites por defecto del rol</p>
                <ul className="text-xs text-slate-300 space-y-1">
                  {Object.entries(USER_QUOTA_LABELS).map(([key, label]) => (
                    <li key={key}>{label}: {quotaData.roleLimits[key] ?? "sin límite"}</li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-slate-400">Override por usuario (vacío = usar valor del rol):</p>
              <div className="grid grid-cols-1 gap-3">
                {Object.entries(USER_QUOTA_LABELS).map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-xs text-slate-400 mb-0.5">{label}</label>
                    <input
                      type="number"
                      min={1}
                      value={overrides[key] ?? ""}
                      onChange={(e) => setOverrides((o) => ({ ...o, [key]: e.target.value }))}
                      placeholder={quotaData.roleLimits[key] != null ? String(quotaData.roleLimits[key]) : "Sin límite"}
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      disabled={saving}
                    />
                    {quotaData.effectiveLimits[key] != null && (
                      <p className="text-xs text-slate-500 mt-0.5">Efectivo: {quotaData.effectiveLimits[key]}</p>
                    )}
                  </div>
                ))}
              </div>
              {message && <p className="text-sm text-emerald-400">{message}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors duration-150"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
                <button type="button" onClick={onClose} className="rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors duration-150">
                  Cerrar
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-slate-500">No se pudo cargar la configuración.</p>
          )}
        </div>
      </div>
    </div>
  );
}

type CapacitySummary = {
  usersAtLimit: number;
  usersNearLimit: number;
  usersWithOverrides: number;
  projectsAtMemberLimit: number;
  projectsNearMemberLimit: number;
  projectsAtInvitationLimit: number;
  projectsNearInvitationLimit: number;
};

type UserCapacityRow = {
  userId: string;
  email: string | null;
  fullName: string | null;
  appRole: string;
  projectsUsed: number;
  projectsLimit: number | null;
  clientsUsed: number;
  clientsLimit: number | null;
  hasOverrides: boolean;
  status: string;
};

type ProjectCapacityRow = {
  projectId: string;
  projectName: string;
  clientName: string | null;
  clientId: string | null;
  membersCurrent: number;
  membersLimit: number | null;
  invitationsCurrent: number;
  invitationsLimit: number | null;
  status: string;
};

const STATUS_LABELS: Record<string, string> = {
  unlimited: "Sin límite",
  normal: "Normal",
  near_limit: "Cerca del límite",
  at_limit: "Al límite",
};

function CapacityDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    summary: CapacitySummary;
    userUsage: UserCapacityRow[];
    projectUsage: ProjectCapacityRow[];
  } | null>(null);
  const [filterRole, setFilterRole] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [overridesOnly, setOverridesOnly] = useState(false);
  const [projectsWithLimitsOnly, setProjectsWithLimitsOnly] = useState(false);
  const [quotaModalUserId, setQuotaModalUserId] = useState<string | null>(null);
  const [quotaModalData, setQuotaModalData] = useState<UserQuotaConfig | null>(null);
  const [quotaModalLoading, setQuotaModalLoading] = useState(false);
  const [quotaModalSaving, setQuotaModalSaving] = useState(false);
  const [quotaModalMessage, setQuotaModalMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAdminAuthHeaders();
      const params = new URLSearchParams();
      if (filterRole) params.set("role", filterRole);
      if (filterStatus) params.set("status", filterStatus);
      if (overridesOnly) params.set("overridesOnly", "true");
      if (projectsWithLimitsOnly) params.set("projectsWithLimitsOnly", "true");
      const url = `/api/admin/quotas/capacity${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { headers });
      if (!res.ok) return;
      const json = (await res.json()) as { summary: CapacitySummary; userUsage: UserCapacityRow[]; projectUsage: ProjectCapacityRow[] };
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [filterRole, filterStatus, overridesOnly, projectsWithLimitsOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!quotaModalUserId) {
      setQuotaModalData(null);
      setQuotaModalMessage(null);
      return;
    }
    let cancelled = false;
    setQuotaModalLoading(true);
    (async () => {
      try {
        const headers = await getAdminAuthHeaders();
        const res = await fetch(`/api/admin/quotas/user/${quotaModalUserId}`, { headers });
        if (cancelled) return;
        const data = (await res.json()) as UserQuotaConfig | { error?: string };
        if (res.ok && "userId" in data) setQuotaModalData(data as UserQuotaConfig);
        else setQuotaModalMessage((data as { error?: string }).error ?? "Error al cargar.");
      } finally {
        if (!cancelled) setQuotaModalLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [quotaModalUserId]);

  const handleSaveQuotaFromCapacity = useCallback(async (overrides: Record<string, number>) => {
    if (!quotaModalUserId) return;
    setQuotaModalSaving(true);
    setQuotaModalMessage(null);
    try {
      const headers = await getAdminAuthHeaders();
      (headers as Record<string, string>)["Content-Type"] = "application/json";
      const res = await fetch(`/api/admin/quotas/user/${quotaModalUserId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ overrides }),
      });
      const data = (await res.json()) as { error?: string };
      if (res.ok) {
        setQuotaModalMessage("Límites guardados.");
        const getRes = await fetch(`/api/admin/quotas/user/${quotaModalUserId}`, { headers });
        if (getRes.ok) setQuotaModalData((await getRes.json()) as UserQuotaConfig);
      } else setQuotaModalMessage(data.error ?? "Error al guardar.");
    } finally {
      setQuotaModalSaving(false);
    }
  }, [quotaModalUserId]);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden shadow-sm ring-1 ring-slate-700/50">
        <div className="border-b border-slate-700/60 px-5 py-4 bg-slate-800/50">
          <h2 className="text-sm font-medium text-slate-200">Uso y límites</h2>
          <p className="text-xs text-slate-500 mt-1">
            Resumen de uso de cuotas por usuario y por proyecto. Umbral: ≥80% cerca del límite, ≥100% al límite.
          </p>
        </div>
        <div className="p-5">
          {loading ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : data ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-6">
                <div className="rounded-xl border border-red-500/30 bg-red-500/15 p-3">
                  <p className="text-lg font-semibold text-red-400">{data.summary.usersAtLimit}</p>
                  <p className="text-xs text-red-400/80">Usuarios al límite</p>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/15 p-3">
                  <p className="text-lg font-semibold text-amber-400">{data.summary.usersNearLimit}</p>
                  <p className="text-xs text-amber-400/80">Usuarios cerca del límite</p>
                </div>
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-3">
                  <p className="text-lg font-semibold text-slate-200">{data.summary.usersWithOverrides}</p>
                  <p className="text-xs text-slate-400">Con overrides</p>
                </div>
                <div className="rounded-xl border border-red-500/30 bg-red-500/15 p-3">
                  <p className="text-lg font-semibold text-red-400">{data.summary.projectsAtMemberLimit}</p>
                  <p className="text-xs text-red-400/80">Proyectos al límite (miembros)</p>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/15 p-3">
                  <p className="text-lg font-semibold text-amber-400">{data.summary.projectsNearMemberLimit}</p>
                  <p className="text-xs text-amber-400/80">Cerca (miembros)</p>
                </div>
                <div className="rounded-xl border border-red-500/30 bg-red-500/15 p-3">
                  <p className="text-lg font-semibold text-red-400">{data.summary.projectsAtInvitationLimit}</p>
                  <p className="text-xs text-red-400/80">Al límite (invit.)</p>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/15 p-3">
                  <p className="text-lg font-semibold text-amber-400">{data.summary.projectsNearInvitationLimit}</p>
                  <p className="text-xs text-amber-400/80">Cerca (invit.)</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4 items-center">
                <span className="text-xs font-medium text-slate-400 mr-1">Vistas:</span>
                <button
                  type="button"
                  onClick={() => setFilterStatus("at_limit")}
                  className="rounded-lg border border-red-500/30 bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/25 transition-colors"
                >
                  Solo al límite
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus("near_limit")}
                  className="rounded-lg border border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/25 transition-colors"
                >
                  Solo cerca del límite
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus("")}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800/50 transition-colors"
                >
                  Todos
                </button>
                <span className="w-px h-5 bg-slate-600 mx-1" />
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100"
                >
                  <option value="">Todos los roles</option>
                  <option value="admin">admin</option>
                  <option value="consultant">consultant</option>
                  <option value="viewer">viewer</option>
                  <option value="superadmin">superadmin</option>
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100"
                >
                  <option value="">Todos los estados</option>
                  <option value="at_limit">Al límite</option>
                  <option value="near_limit">Cerca del límite</option>
                  <option value="normal">Normal</option>
                  <option value="unlimited">Sin límite</option>
                </select>
                <label className="flex items-center gap-2 text-sm text-slate-400">
                  <input type="checkbox" checked={overridesOnly} onChange={(e) => setOverridesOnly(e.target.checked)} className="rounded border-slate-600 bg-slate-900 text-indigo-600" />
                  Solo con overrides
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-400">
                  <input type="checkbox" checked={projectsWithLimitsOnly} onChange={(e) => setProjectsWithLimitsOnly(e.target.checked)} className="rounded border-slate-600 bg-slate-900 text-indigo-600" />
                  Solo proyectos con límite
                </label>
              </div>

              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mt-6 mb-2">Por usuario</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-700/60 mb-6">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/60 bg-slate-800/50 text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      <th className="py-2 px-3">Usuario</th>
                      <th className="py-2 px-3">Email</th>
                      <th className="py-2 px-3">Rol</th>
                      <th className="py-2 px-3">Proyectos</th>
                      <th className="py-2 px-3">Clientes</th>
                      <th className="py-2 px-3">Overrides</th>
                      <th className="py-2 px-3">Estado</th>
                      <th className="py-2 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {data.userUsage.map((u) => (
                      <tr key={u.userId} className="hover:bg-slate-800/50 transition-colors duration-150">
                        <td className="py-2 px-3 text-slate-200">{u.fullName ?? "—"}</td>
                        <td className="py-2 px-3 text-slate-400">{u.email ?? "—"}</td>
                        <td className="py-2 px-3 text-slate-300">{u.appRole}</td>
                        <td className="py-2 px-3 text-slate-300">{u.projectsLimit != null ? `${u.projectsUsed} / ${u.projectsLimit}` : `${u.projectsUsed} (sin límite)`}</td>
                        <td className="py-2 px-3 text-slate-300">{u.clientsLimit != null ? `${u.clientsUsed} / ${u.clientsLimit}` : `${u.clientsUsed} (sin límite)`}</td>
                        <td className="py-2 px-3 text-slate-400">{u.hasOverrides ? "Sí" : "—"}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                            u.status === "at_limit" ? "bg-red-500/15 text-red-400 border border-red-500/30" :
                            u.status === "near_limit" ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" :
                            u.status === "unlimited" ? "bg-slate-700/60 text-slate-400 border border-slate-600/60" : "bg-slate-700/60 text-slate-300 border border-slate-600/60"
                          }`}>
                            {STATUS_LABELS[u.status] ?? u.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setQuotaModalUserId(u.userId)}
                            className="text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors duration-150"
                          >
                            Configurar límites
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mt-6 mb-2">Por proyecto</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-700/60">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/60 bg-slate-800/50 text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      <th className="py-2 px-3">Proyecto</th>
                      <th className="py-2 px-3">Cliente</th>
                      <th className="py-2 px-3">Miembros</th>
                      <th className="py-2 px-3">Invit. pend.</th>
                      <th className="py-2 px-3">Estado</th>
                      <th className="py-2 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {data.projectUsage.map((p) => (
                      <tr key={p.projectId} className="hover:bg-slate-800/50 transition-colors duration-150">
                        <td className="py-2 px-3 text-slate-200">{p.projectName}</td>
                        <td className="py-2 px-3 text-slate-400">{p.clientName ?? "—"}</td>
                        <td className="py-2 px-3 text-slate-300">{p.membersLimit != null ? `${p.membersCurrent} / ${p.membersLimit}` : `${p.membersCurrent} (sin límite)`}</td>
                        <td className="py-2 px-3 text-slate-300">{p.invitationsLimit != null ? `${p.invitationsCurrent} / ${p.invitationsLimit}` : `${p.invitationsCurrent} (sin límite)`}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                            p.status === "at_limit" ? "bg-red-500/15 text-red-400 border border-red-500/30" :
                            p.status === "near_limit" ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" :
                            p.status === "unlimited" ? "bg-slate-700/60 text-slate-400 border border-slate-600/60" : "bg-slate-700/60 text-slate-300 border border-slate-600/60"
                          }`}>
                            {STATUS_LABELS[p.status] ?? p.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <Link href={`/projects/${p.projectId}`} className="text-indigo-400 hover:text-indigo-300 text-xs font-medium mr-2 transition-colors duration-150">
                            Ver proyecto
                          </Link>
                          <Link href={`/projects/${p.projectId}/members`} className="text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors duration-150">
                            Ver equipo
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">No se pudieron cargar los datos.</p>
          )}
        </div>
      </div>

      {quotaModalUserId && (
        <CapacityQuotaModal
          userId={quotaModalUserId}
          userLabel={data?.userUsage.find((u) => u.userId === quotaModalUserId)?.fullName ?? data?.userUsage.find((u) => u.userId === quotaModalUserId)?.email ?? quotaModalUserId}
          quotaData={quotaModalData}
          loading={quotaModalLoading}
          saving={quotaModalSaving}
          message={quotaModalMessage}
          onClose={() => setQuotaModalUserId(null)}
          onSave={handleSaveQuotaFromCapacity}
        />
      )}
    </section>
  );
}

function CapacityQuotaModal({
  userId,
  userLabel,
  quotaData,
  loading,
  saving,
  message,
  onClose,
  onSave,
}: {
  userId: string;
  userLabel: string;
  quotaData: UserQuotaConfig | null;
  loading: boolean;
  saving: boolean;
  message: string | null;
  onClose: () => void;
  onSave: (overrides: Record<string, number>) => Promise<void>;
}) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!quotaData) return;
    const o: Record<string, string> = {};
    for (const key of Object.keys(USER_QUOTA_LABELS)) {
      o[key] = String(quotaData.userOverrides[key] ?? "");
    }
    setOverrides(o);
  }, [quotaData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const out: Record<string, number> = {};
    for (const [key, val] of Object.entries(overrides)) {
      const n = parseInt(String(val).trim(), 10);
      if (!Number.isNaN(n) && n > 0) out[key] = n;
    }
    void onSave(out);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/95 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-700/60 px-5 py-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-200">Límites: {userLabel}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 text-xl leading-none transition-colors">&times;</button>
        </div>
        <div className="p-5">
          {loading ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : quotaData ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-slate-400">Rol: <strong className="text-slate-200">{quotaData.appRole ?? "—"}</strong></p>
              <div className="rounded-lg border border-slate-700/60 p-3 bg-slate-900/50">
                <p className="text-xs font-medium text-slate-400 mb-2">Límites por defecto del rol</p>
                <ul className="text-xs text-slate-300 space-y-1">
                  {Object.entries(USER_QUOTA_LABELS).map(([key, label]) => (
                    <li key={key}>{label}: {quotaData.roleLimits[key] ?? "sin límite"}</li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-slate-400">Override por usuario (vacío = usar valor del rol):</p>
              <div className="grid grid-cols-1 gap-3">
                {Object.entries(USER_QUOTA_LABELS).map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-xs text-slate-400 mb-0.5">{label}</label>
                    <input
                      type="number"
                      min={1}
                      value={overrides[key] ?? ""}
                      onChange={(e) => setOverrides((o) => ({ ...o, [key]: e.target.value }))}
                      placeholder={quotaData.roleLimits[key] != null ? String(quotaData.roleLimits[key]) : "Sin límite"}
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      disabled={saving}
                    />
                    {quotaData.effectiveLimits[key] != null && (
                      <p className="text-xs text-slate-500 mt-0.5">Efectivo: {quotaData.effectiveLimits[key]}</p>
                    )}
                  </div>
                ))}
              </div>
              {message && <p className="text-sm text-emerald-400">{message}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors duration-150">
                  {saving ? "Guardando…" : "Guardar"}
                </button>
                <button type="button" onClick={onClose} className="rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors duration-150">Cerrar</button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-slate-500">No se pudo cargar la configuración.</p>
          )}
        </div>
      </div>
    </div>
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
    <section className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden shadow-sm ring-1 ring-slate-700/50">
      <div className="border-b border-slate-700/60 px-5 py-4 bg-slate-800/50">
        <h2 className="text-sm font-medium text-slate-200">Activación de usuarios</h2>
        <p className="text-xs text-slate-500 mt-1">
          Los usuarios que se registran por la página pública quedan pendientes hasta que un administrador los active.
        </p>
      </div>
      <div className="p-5">
        {loading ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/15 p-4">
              <p className="text-2xl font-semibold text-amber-400">{pending.length}</p>
              <p className="text-sm font-medium text-amber-400">Pendientes</p>
              <p className="text-xs text-amber-400/80 mt-0.5">Sin acceso a la plataforma</p>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-4">
              <p className="text-2xl font-semibold text-emerald-400">{active.length}</p>
              <p className="text-sm font-medium text-emerald-400">Activos</p>
              <p className="text-xs text-emerald-400/80 mt-0.5">Pueden iniciar sesión</p>
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
    <section className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5 space-y-6 shadow-sm ring-1 ring-slate-700/50">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-slate-200">
            Users & Roles
          </h2>
          <p className="text-xs text-slate-500">
            Manage global platform access for each user.
          </p>
        </div>
        <a
          href="/admin/users"
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0"
        >
          Manage users
        </a>
      </div>

      {rolesError && (
        <div className="rounded-xl border border-amber-800/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-200">
          {rolesError}
        </div>
      )}

      {saveMessage && (
        <div
          className={`rounded-xl border px-4 py-2 text-sm ${
            saveMessage.type === "success"
              ? "border-emerald-800/50 bg-emerald-950/30 text-emerald-200"
              : "border-red-800/50 bg-red-950/30 text-red-200"
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando usuarios...</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700/60">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/60 bg-slate-800/50 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-3 px-4">Usuario</th>
                <th className="py-3 px-4">Rol</th>
                <th className="py-3 px-4">Activación</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
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
                  <tr key={user.id} className="hover:bg-slate-800/50 transition-colors duration-150">
                    <td className="py-3 px-4 text-slate-200">
                      {displayName}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={currentRole}
                        onChange={(e) =>
                          handleRoleChange(user.id, e.target.value)
                        }
                        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-60"
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
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${user.is_active ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/15 text-amber-400 border border-amber-500/30"}`}>
                        {user.is_active ? "Activo" : "Pendiente"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveRole(user.id)}
                          disabled={savingUserId === user.id}
                          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors duration-150"
                        >
                          {savingUserId === user.id ? "Guardando..." : "Guardar"}
                        </button>
                        <a
                          href="/admin/users"
                          className="inline-flex items-center justify-center rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors duration-150"
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
    <section className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5 space-y-6 shadow-sm ring-1 ring-slate-700/50">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-slate-200">
            Acceso a proyectos
          </h2>
          <p className="text-xs text-slate-500">
            Define qué usuarios pueden ver y editar cada proyecto.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-rose-400">{error}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left: projects list */}
        <div className="md:col-span-1">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Proyectos</p>
          {loadingProjects ? (
            <p className="text-sm text-slate-500">Cargando proyectos...</p>
          ) : (
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-2 max-h-80 overflow-y-auto space-y-1">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => handleSelectProject(project.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors duration-150 ${
                    selectedProjectId === project.id
                      ? "bg-indigo-600 text-white"
                      : "text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{project.name}</span>
                    {project.status && (
                      <span className="text-[11px] rounded-md border border-slate-600 px-2 py-0.5 text-slate-400">
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
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                  Miembros del proyecto
                </p>
                {loadingMembers ? (
                  <p className="text-sm text-slate-500">
                    Cargando miembros...
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-700/60">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700/60 bg-slate-800/50 text-left text-xs uppercase tracking-wide text-slate-400">
                          <th className="py-3 px-4">Usuario</th>
                          <th className="py-3 px-4">Rol</th>
                          <th className="py-3 px-4 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/40">
                        {members.map((member) => {
                          const displayName =
                            member.user_full_name || "Usuario sin nombre";
                          return (
                            <tr key={member.id} className="hover:bg-slate-800/50 transition-colors duration-150">
                              <td className="py-3 px-4 text-slate-200">
                                {displayName}
                              </td>
                              <td className="py-3 px-4">
                                <span className="inline-flex rounded-md bg-indigo-500/15 px-2 py-0.5 text-xs font-medium text-indigo-400 border border-indigo-500/30">
                                  {ROLE_LABELS[member.role]}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember(member.id)}
                                  disabled={savingMemberId === member.id}
                                  className="text-xs font-medium text-rose-400 hover:text-rose-300 disabled:opacity-50 transition-colors duration-150"
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
                className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4 space-y-3"
              >
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Añadir miembro
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Usuario
                    </label>
                    <select
                      value={addUserId}
                      onChange={(e) => setAddUserId(e.target.value)}
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
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
                    <label className="block text-xs text-slate-400 mb-1">
                      Rol
                    </label>
                    <select
                      value={addRole}
                      onChange={(e) =>
                        setAddRole(
                          e.target.value as "owner" | "editor" | "viewer" | ""
                        )
                      }
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
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
                  className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors duration-150"
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
  const [canManageKnowledgeSources, setCanManageKnowledgeSources] = useState(false);

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

  // Permission for managing knowledge sources (manage_knowledge_sources)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;
        const res = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        const data = await res.json().catch(() => ({ permissions: { manageKnowledgeSources: false } }));
        const perms = (data as { permissions?: { manageKnowledgeSources?: boolean } }).permissions;
        setCanManageKnowledgeSources(perms?.manageKnowledgeSources ?? false);
      } catch {
        if (!cancelled) setCanManageKnowledgeSources(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    <section className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-xl overflow-hidden bg-slate-700 shrink-0">
            <Image
              src={getSapitoGeneral().avatarImage}
              alt=""
              fill
              className="object-cover"
              sizes="40px"
            />
          </div>
          <div>
            <h2 className="text-sm font-medium text-slate-200">
              Knowledge Sources
            </h2>
            <p className="text-xs text-slate-500 max-w-xl">
              Global and project knowledge used by Sapito to answer with broader context. Managed from Admin.
            </p>
          </div>
        </div>
      </div>

      {/* Platform integrations: Google Drive — primary entry point */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4 space-y-3">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          Platform integrations
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-slate-200">Google Drive</p>
            {integrationsLoading ? (
              <p className="mt-1 text-xs text-slate-500">Cargando…</p>
            ) : hasGoogleIntegration ? (
              <>
                <p className="mt-1 text-xs text-slate-400">
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
            disabled={googleConnectPending || !canManageKnowledgeSources}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60 transition-colors duration-150 shrink-0"
          >
            {googleConnectPending ? "Redirigiendo…" : hasGoogleIntegration ? "Reconectar Google Drive" : "Connect Google Drive"}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => void loadSources()}
            className="rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors duration-150"
          >
            Reintentar
          </button>
        </div>
      )}
      {syncMessage && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            syncMessage.includes("completada") && !syncMessage.includes("errores")
              ? "border-emerald-800/50 bg-emerald-950/30 text-emerald-200"
              : syncMessage.includes("Error") || syncMessage.includes("errores")
                ? "border-red-800/50 bg-red-950/30 text-red-200"
                : "border-amber-800/50 bg-amber-950/30 text-amber-200"
          }`}
        >
          {syncMessage}
        </div>
      )}

      <form onSubmit={handleCreate} className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4 space-y-3">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          Crear fuente global
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tipo</label>
            <select
              value={newSourceType}
              onChange={(e) => setNewSourceType(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
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
                <p className="text-xs text-amber-200 bg-amber-500/15 rounded px-2 py-1.5 border border-amber-500/30">
                  <strong>Guía:</strong> Las páginas SAP Help solo se indexan cuando el contenido legible está en el HTML inicial. Las que cargan todo por JavaScript no se pueden indexar con este flujo. Si una URL falla, prueba otra página curada o usa un documento/PDF como alternativa.
                </p>
                {newSourceType === "sap_help" && (
                  <p className="text-xs text-amber-200 bg-amber-500/15 rounded px-2 py-1 border border-amber-500/30">
                    <strong>SAP Help Portal:</strong> solo URLs de help.sap.com. No uses community.sap.com (esas páginas usan JavaScript y no se pueden indexar aquí).
                  </p>
                )}
                {newSourceType === "sap_official" && (
                  <p className="text-xs text-slate-400">
                    <strong>SAP Official:</strong> documentación oficial SAP aprobada (p. ej. help.sap.com u otras fuentes oficiales).
                  </p>
                )}
                {newSourceType === "official_web" && (
                  <p className="text-xs text-slate-400">
                    <strong>Official Web:</strong> páginas públicas curadas (p. ej. community.sap.com u otros dominios). Si la página requiere JavaScript o verificación anti-bot, la sincronización fallará con un mensaje claro.
                  </p>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nombre *</label>
            <input
              type="text"
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
              placeholder="Nombre de la fuente"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              disabled={saving}
            />
          </div>
          {(newSourceType === "google_drive_folder" || newSourceType === "google_drive_file") && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Cuenta Google Drive</label>
              <select
                value={newIntegrationId}
                onChange={(e) => setNewIntegrationId(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
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
            <label className="block text-xs text-slate-400 mb-1">URL</label>
            <input
              type="text"
              value={newSourceUrl}
              onChange={(e) => setNewSourceUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Ref externa (ej. ID carpeta)</label>
            <input
              type="text"
              value={newExternalRef}
              onChange={(e) => setNewExternalRef(e.target.value)}
              placeholder="Opcional"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              disabled={saving}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={!newSourceName.trim() || saving}
          className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors duration-150"
        >
          {saving ? "Creando…" : "Crear fuente global"}
        </button>
        {createError && (
          <p className="text-sm text-red-400">{createError}</p>
        )}
      </form>

      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            Listado
          </p>
          <div className="inline-flex rounded-lg border border-slate-700/60 bg-slate-900 p-0.5 text-xs">
            {(["global", "project", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScopeFilter(s)}
                className={`px-2 py-1 rounded-md font-medium transition-colors duration-150 ${
                  scopeFilter === s ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
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
          <div className="overflow-x-auto rounded-xl border border-slate-700/60">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60 bg-slate-800/50 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-3 px-4">Nombre</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Scope</th>
                  <th className="py-3 px-4">Proyecto</th>
                  <th className="py-3 px-4">Sync status</th>
                  <th className="py-3 px-4">Última sync</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {sources.map((s) => {
                  const syncStatus = getSyncStatus(s, syncingSourceId);
                  return (
                  <tr key={s.id} className="hover:bg-slate-800/50 transition-colors duration-150">
                    <td className="py-3 px-4 text-slate-200 font-medium">{s.source_name}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex rounded-md bg-slate-700/60 px-2 py-0.5 text-xs text-slate-300 border border-slate-600/60">
                        {GLOBAL_SOURCE_TYPE_LABELS[s.source_type] ?? s.source_type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex rounded-md bg-indigo-500/15 px-2 py-0.5 text-xs text-indigo-400 border border-indigo-500/30">
                        {s.scope_type === "global" ? "Global" : "Project"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {s.scope_type === "project" && (s.project_name ?? s.project_id ?? "—")}
                      {s.scope_type === "global" && "—"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium w-fit ${
                            syncStatus === "syncing"
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : syncStatus === "error"
                                ? "bg-red-500/15 text-red-400 border border-red-500/30"
                                : syncStatus === "synced"
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : "bg-slate-700/60 text-slate-400 border border-slate-600/60"
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
                    <td className="py-3 px-4 text-slate-400 text-xs">
                      {s.last_synced_at ? formatSyncDate(s.last_synced_at) : "—"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isDriveSource(s) || isCuratedSapSource(s) ? (
                          <button
                            type="button"
                            onClick={() => handleSync(s.id)}
                            disabled={syncingSourceId !== null || !canSyncSource(s) || !canManageKnowledgeSources}
                            title={!canSyncSource(s) ? (isCuratedSapSource(s) ? "Añade la URL de la página SAP en la fuente" : "Configura cuenta de Google Drive y Ref externa (ID carpeta) en la fuente") : "Sincronizar ahora"}
                            className="text-xs font-medium text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors duration-150"
                          >
                            {syncingSourceId === s.id ? "Syncing…" : "Sync now"}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500" title="Sync solo disponible para Google Drive o SAP oficial (sap_help, sap_official, official_web)">
                            —
                          </span>
                        )}
                        {s.scope_type === "global" && canManageKnowledgeSources && (
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id)}
                            disabled={deletingId !== null}
                            className="text-xs font-medium text-rose-400 hover:text-rose-300 disabled:opacity-50 transition-colors duration-150"
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

/** Client row shape returned by /api/admin/clients (extended). */
type ClientRow = {
  id: string;
  name: string;
  legal_name?: string | null;
  display_name?: string | null;
  tax_id?: string | null;
  website?: string | null;
  linkedin_url?: string | null;
  industry?: string | null;
  subindustry?: string | null;
  company_size_bucket?: string | null;
  employee_range?: string | null;
  annual_revenue_range?: string | null;
  country?: string | null;
  region?: string | null;
  preferred_language?: string | null;
  timezone?: string | null;
  parent_client_id?: string | null;
  account_group?: string | null;
  account_tier?: string | null;
  ownership_type?: string | null;
  business_model?: string | null;
  main_products_services?: string | null;
  sap_relevance_summary?: string | null;
  known_pain_points?: string | null;
  strategic_notes?: string | null;
  is_active?: boolean | null;
  created_at?: string;
  created_by?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
};

const EMPTY_CLIENT_FORM = {
  name: "",
  display_name: "",
  legal_name: "",
  tax_id: "",
  website: "",
  linkedin_url: "",
  industry: "",
  subindustry: "",
  company_size_bucket: "",
  employee_range: "",
  annual_revenue_range: "",
  country: "",
  region: "",
  preferred_language: "",
  timezone: "",
  parent_client_id: "",
  account_group: "",
  account_tier: "",
  ownership_type: "",
  business_model: "",
  main_products_services: "",
  sap_relevance_summary: "",
  known_pain_points: "",
  strategic_notes: "",
  is_active: true,
};

function ClientsPanel() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>(EMPTY_CLIENT_FORM as Record<string, string | boolean>);

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

  useEffect(() => {
    if (!editingId) {
      setForm(EMPTY_CLIENT_FORM as Record<string, string | boolean>);
      return;
    }
    const c = clients.find((x) => x.id === editingId);
    if (c) {
      setForm({
        name: c.name ?? "",
        display_name: c.display_name ?? "",
        legal_name: c.legal_name ?? "",
        tax_id: c.tax_id ?? "",
        website: c.website ?? "",
        linkedin_url: c.linkedin_url ?? "",
        industry: c.industry ?? "",
        subindustry: c.subindustry ?? "",
        company_size_bucket: c.company_size_bucket ?? "",
        employee_range: c.employee_range ?? "",
        annual_revenue_range: c.annual_revenue_range ?? "",
        country: c.country ?? "",
        region: c.region ?? "",
        preferred_language: c.preferred_language ?? "",
        timezone: c.timezone ?? "",
        parent_client_id: c.parent_client_id ?? "",
        account_group: c.account_group ?? "",
        account_tier: c.account_tier ?? "",
        ownership_type: c.ownership_type ?? "",
        business_model: c.business_model ?? "",
        main_products_services: c.main_products_services ?? "",
        sap_relevance_summary: c.sap_relevance_summary ?? "",
        known_pain_points: c.known_pain_points ?? "",
        strategic_notes: c.strategic_notes ?? "",
        is_active: c.is_active !== false,
      });
    } else {
      (async () => {
        const headers = await getAdminAuthHeaders();
        const res = await fetch(`/api/admin/clients/${editingId}`, { headers });
        if (!res.ok) return;
        const data = (await res.json()) as { client?: ClientRow };
        const x = data.client;
        if (x) {
          setForm({
            name: x.name ?? "",
            display_name: x.display_name ?? "",
            legal_name: x.legal_name ?? "",
            tax_id: x.tax_id ?? "",
            website: x.website ?? "",
            linkedin_url: x.linkedin_url ?? "",
            industry: x.industry ?? "",
            subindustry: x.subindustry ?? "",
            company_size_bucket: x.company_size_bucket ?? "",
            employee_range: x.employee_range ?? "",
            annual_revenue_range: x.annual_revenue_range ?? "",
            country: x.country ?? "",
            region: x.region ?? "",
            preferred_language: x.preferred_language ?? "",
            timezone: x.timezone ?? "",
            parent_client_id: x.parent_client_id ?? "",
            account_group: x.account_group ?? "",
            account_tier: x.account_tier ?? "",
            ownership_type: x.ownership_type ?? "",
            business_model: x.business_model ?? "",
            main_products_services: x.main_products_services ?? "",
            sap_relevance_summary: x.sap_relevance_summary ?? "",
            known_pain_points: x.known_pain_points ?? "",
            strategic_notes: x.strategic_notes ?? "",
            is_active: x.is_active !== false,
          });
        }
      })();
    }
  }, [editingId, clients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = (form.name as string)?.trim() || (form.display_name as string)?.trim() || (form.legal_name as string)?.trim();
    if (!name || saving) return;
    setSaving(true);
    setFormError(null);
    const headers = await getAdminAuthHeaders();
    headers["Content-Type"] = "application/json";
    const body: Record<string, unknown> = {
      name: (form.name as string) || name,
      display_name: (form.display_name as string) || null,
      legal_name: (form.legal_name as string) || null,
      tax_id: (form.tax_id as string) || null,
      website: (form.website as string) || null,
      linkedin_url: (form.linkedin_url as string) || null,
      industry: (form.industry as string) || null,
      subindustry: (form.subindustry as string) || null,
      company_size_bucket: (form.company_size_bucket as string) || null,
      employee_range: (form.employee_range as string) || null,
      annual_revenue_range: (form.annual_revenue_range as string) || null,
      country: (form.country as string) || null,
      region: (form.region as string) || null,
      preferred_language: (form.preferred_language as string) || null,
      timezone: (form.timezone as string) || null,
      parent_client_id: (form.parent_client_id as string) || null,
      account_group: (form.account_group as string) || null,
      account_tier: (form.account_tier as string) || null,
      ownership_type: (form.ownership_type as string) || null,
      business_model: (form.business_model as string) || null,
      main_products_services: (form.main_products_services as string) || null,
      sap_relevance_summary: (form.sap_relevance_summary as string) || null,
      known_pain_points: (form.known_pain_points as string) || null,
      strategic_notes: (form.strategic_notes as string) || null,
      is_active: form.is_active,
    };
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/clients/${editingId}`, { method: "PATCH", headers, body: JSON.stringify(body) });
        const data = (await res.json().catch(() => ({}))) as { error?: string; client?: ClientRow };
        if (!res.ok) {
          setFormError(data.error ?? "Error al actualizar el cliente.");
          return;
        }
        setClients((prev) => prev.map((c) => (c.id === editingId ? (data.client ?? c) : c)).sort((a, b) => (a.display_name || a.name).localeCompare(b.display_name || b.name)));
        setEditingId(null);
      } else {
        const res = await fetch("/api/admin/clients", { method: "POST", headers, body: JSON.stringify(body) });
        const data = (await res.json().catch(() => ({}))) as { error?: string; client?: ClientRow };
        if (!res.ok) {
          setFormError(data.error ?? "Error al crear el cliente.");
          return;
        }
        if (data.client) setClients((prev) => [...prev, data.client!].sort((a, b) => (a.display_name || a.name).localeCompare(b.display_name || b.name)));
        setForm(EMPTY_CLIENT_FORM as Record<string, string | boolean>);
      }
    } catch {
      setFormError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  const field = (key: string, label: string, placeholder = "") => (
    <div key={key} className="space-y-1">
      <label className="block text-xs text-slate-400">{label}</label>
      <input
        type="text"
        value={(form[key] as string) ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        disabled={saving}
      />
    </div>
  );

  return (
    <section className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5 space-y-6 shadow-sm ring-1 ring-slate-700/50">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-slate-200">Clientes</h2>
          <p className="text-xs text-slate-500">Crear y editar clientes para proyectos, reporting y contexto SAP.</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            {editingId ? "Editar cliente" : "Nuevo cliente"}
          </span>
          {editingId && (
            <button
              type="button"
              onClick={() => { setEditingId(null); setForm(EMPTY_CLIENT_FORM as Record<string, string | boolean>); }}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-400">Identidad</p>
            {field("name", "Nombre (obligatorio)", "Nombre o razón social")}
            {field("display_name", "Nombre para mostrar", "Ej. Acme")}
            {field("legal_name", "Razón social / legal")}
            {field("tax_id", "CIF / NIF")}
            {field("website", "Web")}
            {field("linkedin_url", "LinkedIn")}
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-400">Segmentación</p>
            <div className="space-y-1">
              <label className="block text-xs text-slate-400">Industria</label>
              <select value={(form.industry as string) ?? ""} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" disabled={saving}>
                {INDUSTRY_OPTIONS.map((o) => <option key={o.value || "_"} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {field("subindustry", "Subindustria")}
            <div className="space-y-1">
              <label className="block text-xs text-slate-400">Tamaño empresa</label>
              <select value={(form.company_size_bucket as string) ?? ""} onChange={(e) => setForm((f) => ({ ...f, company_size_bucket: e.target.value }))} className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" disabled={saving}>
                {COMPANY_SIZE_OPTIONS.map((o) => <option key={o.value || "_"} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {field("employee_range", "Rango empleados")}
            {field("annual_revenue_range", "Facturación (rango)")}
            <p className="text-xs font-medium text-slate-400 mt-3">Estructura</p>
            <div className="space-y-1">
              <label className="block text-xs text-slate-400">Cliente padre</label>
              <select
                value={(form.parent_client_id as string) ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, parent_client_id: e.target.value }))}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                disabled={saving}
              >
                <option value="">Ninguno</option>
                {clients.filter((c) => c.id !== editingId).map((c) => (
                  <option key={c.id} value={c.id}>{c.display_name || c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-slate-400">País</label>
              <select
                value={resolveCountryOptionValue(form.country as string)}
                onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, country: v, region: "" })); }}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                disabled={saving}
              >
                <option value="">—</option>
                {getAllCountryOptions().map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
                {(form.country as string)?.trim() && !getAllCountryOptions().some((o) => o.value === resolveCountryOptionValue(form.country as string)) && (
                  <option value={form.country as string}>{form.country} (actual)</option>
                )}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-slate-400">Región / Estado</label>
              <select
                value={resolveStateOptionValue(form.country as string, form.region as string)}
                onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                disabled={saving}
              >
                <option value="">—</option>
                {getStateOptions((form.country as string) ?? "").map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
                {(form.region as string) && (form.country as string)?.length === 2 && !getStateOptions(form.country as string).some((o) => o.value === (form.region as string)) && (
                  <option value={form.region as string}>{form.region} (actual)</option>
                )}
              </select>
            </div>
            {field("account_group", "Grupo de cuenta")}
            <div className="space-y-1">
              <label className="block text-xs text-slate-400">Tier</label>
              <select value={(form.account_tier as string) ?? ""} onChange={(e) => setForm((f) => ({ ...f, account_tier: e.target.value }))} className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" disabled={saving}>
                {ACCOUNT_TIER_OPTIONS.map((o) => <option key={o.value || "_"} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-slate-400">Tipo propiedad</label>
              <select value={(form.ownership_type as string) ?? ""} onChange={(e) => setForm((f) => ({ ...f, ownership_type: e.target.value }))} className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" disabled={saving}>
                {OWNERSHIP_TYPE_OPTIONS.map((o) => <option key={o.value || "_"} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-slate-400">Modelo negocio</label>
              <select value={(form.business_model as string) ?? ""} onChange={(e) => setForm((f) => ({ ...f, business_model: e.target.value }))} className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" disabled={saving}>
                {BUSINESS_MODEL_OPTIONS.map((o) => <option key={o.value || "_"} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {field("main_products_services", "Productos / servicios principales")}
            {field("main_products_services", "Productos / servicios principales")}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-400">Contexto SAP</p>
          <textarea
            value={(form.sap_relevance_summary as string) ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, sap_relevance_summary: e.target.value }))}
            placeholder="Resumen de relevancia SAP, sistemas, roadmap…"
            rows={2}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            disabled={saving}
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-400">Notas estratégicas</p>
          <textarea
            value={(form.known_pain_points as string) ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, known_pain_points: e.target.value }))}
            placeholder="Pain points conocidos"
            rows={1}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            disabled={saving}
          />
          <textarea
            value={(form.strategic_notes as string) ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, strategic_notes: e.target.value }))}
            placeholder="Notas internas estratégicas"
            rows={2}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            disabled={saving}
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.is_active === true}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              disabled={saving}
              className="rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-indigo-500/40"
            />
            Activo
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors duration-150"
          >
            {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear cliente"}
          </button>
        </div>
        {formError && <p className="text-sm text-red-400">{formError}</p>}
      </form>

      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Listado de clientes</p>
        {loading ? (
          <p className="text-sm text-slate-500">Cargando clientes…</p>
        ) : clients.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no hay clientes. Crea uno arriba.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-700/60">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60 bg-slate-800/50 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-3 px-4">Nombre</th>
                  <th className="py-3 px-4">País</th>
                  <th className="py-3 px-4">Industria</th>
                  <th className="py-3 px-4">Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setEditingId(c.id)}
                    className="hover:bg-slate-800/50 transition-colors duration-150 cursor-pointer"
                  >
                    <td className="py-3 px-4 text-slate-200 font-medium">{c.display_name || c.name}</td>
                    <td className="py-3 px-4 text-slate-400">{getCountryDisplayName(c.country) || "—"}</td>
                    <td className="py-3 px-4 text-slate-400">{c.industry ?? "—"}</td>
                    <td className="py-3 px-4 text-slate-400">{c.account_tier ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && clients.length > 0 && (
          <button
            type="button"
            onClick={() => { setEditingId(null); setForm(EMPTY_CLIENT_FORM as Record<string, string | boolean>); }}
            className="mt-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors duration-150"
          >
            + Nuevo cliente
          </button>
        )}
      </div>
    </section>
  );
}
