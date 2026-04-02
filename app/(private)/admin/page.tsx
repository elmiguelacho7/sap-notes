"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Users, Zap, Brain, Shield, BarChart2, Sliders, UserCog } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { AppPageShell } from "@/components/ui/layout/AppPageShell";
import { FORM_PAGE_BLOCK_CLASS, FORM_PAGE_SHELL_CLASS } from "@/components/layout/formPageClasses";
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
  const t = useTranslations("admin.page");
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
  }, [t]);

  if (loading) {
    return (
      <AppPageShell>
        <div className={FORM_PAGE_SHELL_CLASS}>
          <div className={`${FORM_PAGE_BLOCK_CLASS} py-12 text-center`}>
            <p className="text-sm font-medium text-[rgb(var(--rb-text-primary))]">{t("loading")}</p>
            <p className="mt-1 text-sm text-[rgb(var(--rb-text-muted))]">{t("loadingSubtext")}</p>
          </div>
        </div>
      </AppPageShell>
    );
  }

  if (appRole !== "superadmin") {
    return (
      <AppPageShell>
        <div className={FORM_PAGE_SHELL_CLASS}>
          <div
            className={`${FORM_PAGE_BLOCK_CLASS} rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] px-5 py-12 text-center shadow-sm`}
          >
            <p className="text-sm font-medium text-[rgb(var(--rb-text-primary))]">{t("restricted")}</p>
            <p className="mt-1 text-sm text-[rgb(var(--rb-text-muted))]">{t("restrictedBody")}</p>
          </div>
        </div>
      </AppPageShell>
    );
  }

  return <AdminPanel />;
}

type OverviewStats = {
  usersTotal: number | null;
  usersActive: number | null;
  usersPending: number | null;
  adminsTotal: number | null;
  consultantsTotal: number | null;
  projectsTotal: number | null;
  knowledgeIntegrations: number | null;
  capacityPct: number | null;
  usersAtLimit: number | null;
  usersNearLimit: number | null;
  projectsAtLimit: number | null;
  projectsNearLimit: number | null;
};

function AdminPanel() {
  const t = useTranslations("admin.page");
  const [activeTab, setActiveTab] = useState<TabId>("users");
  const [overview, setOverview] = useState<OverviewStats>({
    usersTotal: null,
    usersActive: null,
    usersPending: null,
    adminsTotal: null,
    consultantsTotal: null,
    projectsTotal: null,
    knowledgeIntegrations: null,
    capacityPct: null,
    usersAtLimit: null,
    usersNearLimit: null,
    projectsAtLimit: null,
    projectsNearLimit: null,
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

        const usersData = usersRes.ok
          ? ((await usersRes.json()) as { users?: { is_active?: boolean; app_role?: string }[] })
          : null;
        const usersTotal = usersData?.users?.length ?? null;
        const usersActive = usersData?.users?.filter((u) => u.is_active === true).length ?? null;
        const usersPending = usersData?.users?.filter((u) => u.is_active !== true).length ?? null;
        const adminsTotal =
          usersData?.users?.filter((u) => (u.app_role ?? "").toLowerCase() === "admin" || (u.app_role ?? "").toLowerCase() === "superadmin").length ??
          null;
        const consultantsTotal =
          usersData?.users?.filter((u) => (u.app_role ?? "").toLowerCase() === "consultant").length ??
          null;

        const projectsTotal = projectsRes.error ? null : (projectsRes.count ?? null);

        let knowledgeIntegrations: number | null = null;
        if (integrationsRes.ok) {
          const data = (await integrationsRes.json()) as { integrations?: { provider?: string }[] };
          knowledgeIntegrations = (data.integrations ?? []).filter((i) => i.provider === "google_drive").length;
        }

        let capacityPct: number | null = null;
        let usersAtLimit: number | null = null;
        let usersNearLimit: number | null = null;
        let projectsAtLimit: number | null = null;
        let projectsNearLimit: number | null = null;
        if (capacityRes.ok) {
          const cap = (await capacityRes.json()) as {
            summary?: {
              usersAtLimit?: number;
              usersNearLimit?: number;
              usersWithOverrides?: number;
              projectsAtMemberLimit?: number;
              projectsNearMemberLimit?: number;
              projectsAtInvitationLimit?: number;
              projectsNearInvitationLimit?: number;
              userUsage?: unknown[];
            };
          };
          const total = cap.summary?.userUsage?.length ?? 0;
          const atLimit = cap.summary?.usersAtLimit ?? 0;
          const nearLimit = cap.summary?.usersNearLimit ?? 0;
          if (total > 0) capacityPct = Math.round(((atLimit + nearLimit * 0.5) / total) * 100);
          usersAtLimit = atLimit;
          usersNearLimit = nearLimit;
          const projAt =
            (cap.summary?.projectsAtMemberLimit ?? 0) + (cap.summary?.projectsAtInvitationLimit ?? 0);
          const projNear =
            (cap.summary?.projectsNearMemberLimit ?? 0) + (cap.summary?.projectsNearInvitationLimit ?? 0);
          projectsAtLimit = projAt;
          projectsNearLimit = projNear;
        }
        setOverview({
          usersTotal,
          usersActive,
          usersPending,
          adminsTotal,
          consultantsTotal,
          projectsTotal,
          knowledgeIntegrations,
          capacityPct,
          usersAtLimit,
          usersNearLimit,
          projectsAtLimit,
          projectsNearLimit,
        });
      } catch {
        if (!cancelled) setOverview((o) => ({ ...o }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const iconClass = "size-4 shrink-0 text-[rgb(var(--rb-text-muted))]";
  const iconClassActive = "size-4 shrink-0 text-[rgb(var(--rb-brand-primary))]";
  const tabBase =
    "inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-[color,background-color,box-shadow,transform] duration-150";
  const tabActive =
    "bg-[rgb(var(--rb-surface))] text-[rgb(var(--rb-text-primary))] shadow-md ring-2 ring-[rgb(var(--rb-brand-primary))]/30";
  const tabInactive =
    "text-[rgb(var(--rb-text-muted))] hover:bg-[rgb(var(--rb-surface))]/90 hover:text-[rgb(var(--rb-text-primary))] hover:shadow-sm active:scale-[0.99]";
  const kpiLabel = "text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--rb-text-muted))]";
  const kpiValue = "mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-[rgb(var(--rb-text-primary))]";
  const kpiHint = "mt-1 text-xs leading-snug text-[rgb(var(--rb-text-muted))]";
  const kpiCell =
    "relative min-w-0 overflow-hidden rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 py-3.5 pl-4 pr-3 shadow-sm before:absolute before:left-0 before:top-3 before:bottom-3 before:w-[3px] before:rounded-full before:bg-[rgb(var(--rb-brand-primary))]/35 before:content-['']";

  const insightCell =
    "rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-4 py-3 shadow-sm ring-1 ring-slate-100";
  const insightLabel =
    "text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--rb-text-muted))]";
  const insightValue =
    "mt-1 text-sm font-semibold text-[rgb(var(--rb-text-primary))]";
  const insightSub =
    "mt-0.5 text-xs text-[rgb(var(--rb-text-muted))]";

  const accessHealth =
    overview.usersPending === null
      ? { title: "Access health", value: "—", sub: "Pending activations" }
      : overview.usersPending === 0
        ? { title: "Access health", value: "No activation backlog", sub: "All users are active" }
        : { title: "Access health", value: `${overview.usersPending} pending`, sub: "Users awaiting activation" };

  const governanceHealth =
    overview.adminsTotal === null
      ? { title: "Governance", value: "—", sub: "Admin coverage" }
      : overview.adminsTotal <= 1
        ? { title: "Governance", value: "Single admin", sub: "Consider adding a backup admin" }
        : { title: "Governance", value: `${overview.adminsTotal} admin users`, sub: "Admin-level coverage" };

  const knowledgeHealth =
    overview.knowledgeIntegrations === null
      ? { title: "Knowledge", value: "—", sub: "Connected sources" }
      : overview.knowledgeIntegrations === 0
        ? { title: "Knowledge", value: "No sources connected", sub: "Connect a source to start ingesting" }
        : { title: "Knowledge", value: `${overview.knowledgeIntegrations} connected`, sub: "Active integrations" };

  const capacityHealth = (() => {
    const at = overview.usersAtLimit ?? null;
    const near = overview.usersNearLimit ?? null;
    const projAt = overview.projectsAtLimit ?? null;
    const projNear = overview.projectsNearLimit ?? null;
    if (at == null && near == null && projAt == null && projNear == null) {
      return { title: "Capacity", value: "—", sub: "Limits and near-limit users" };
    }
    const flags =
      (at ?? 0) + (near ?? 0) + (projAt ?? 0) + (projNear ?? 0);
    if (flags === 0) {
      return { title: "Capacity", value: "No alerts", sub: "No users/projects near limits" };
    }
    const parts: string[] = [];
    if ((at ?? 0) > 0) parts.push(`${at} at limit`);
    if ((near ?? 0) > 0) parts.push(`${near} near limit`);
    if ((projAt ?? 0) > 0) parts.push(`${projAt} projects at limit`);
    if ((projNear ?? 0) > 0) parts.push(`${projNear} projects near limit`);
    return { title: "Capacity", value: parts[0] ?? "Alerts", sub: parts.slice(1).join(" · ") || "Review capacity dashboard" };
  })();

  const sectionMeta: Record<TabId, { title: string; subtitle: string }> = {
    users: {
      title: "Users",
      subtitle: "Manage identities, roles, and access state across the platform.",
    },
    activations: {
      title: "Activations",
      subtitle: "Review pending users and activate access when appropriate.",
    },
    knowledge: {
      title: "Knowledge sources",
      subtitle: "Connect and monitor ingestion sources that feed the knowledge system.",
    },
    limits: {
      title: "Role limits",
      subtitle: "Set default quotas per role to enforce governance at scale.",
    },
    userLimits: {
      title: "User limits",
      subtitle: "Override quotas for specific users when needed.",
    },
    capacity: {
      title: "Capacity",
      subtitle: "Monitor quota pressure across users and projects to prevent throttling.",
    },
  };

  return (
    <AppPageShell>
      <div className={FORM_PAGE_SHELL_CLASS}>
        <div className={`${FORM_PAGE_BLOCK_CLASS} space-y-6`}>
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--rb-text-primary))]">
              {t("title")}
            </h1>
            <p className="text-sm text-[rgb(var(--rb-text-muted))] max-w-3xl">{t("subtitle")}</p>
          </header>

          <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] p-3 shadow-sm sm:p-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3.5">
              <div className={kpiCell}>
                <p className={kpiLabel}>Total users</p>
                <p className={kpiValue}>{overview.usersTotal !== null ? overview.usersTotal : "—"}</p>
                <p className={kpiHint}>
                  {overview.usersActive !== null && overview.usersPending !== null
                    ? `${overview.usersActive} active · ${overview.usersPending} pending`
                    : "Active and pending users"}
                </p>
              </div>
              <div className={kpiCell}>
                <p className={kpiLabel}>Projects</p>
                <p className={kpiValue}>{overview.projectsTotal !== null ? overview.projectsTotal : "—"}</p>
                <p className={kpiHint}>Portfolio footprint</p>
              </div>
              <div className={kpiCell}>
                <p className={kpiLabel}>Knowledge sources</p>
                <p className={kpiValue}>
                  {overview.knowledgeIntegrations !== null ? overview.knowledgeIntegrations : "—"}
                </p>
                <p className={kpiHint}>Connected ingestion sources</p>
              </div>
              <div className={kpiCell}>
                <p className={kpiLabel}>Capacity alerts</p>
                <p className={kpiValue}>
                  {overview.capacityPct !== null ? `${overview.capacityPct}%` : "—"}
                </p>
                <p className={kpiHint}>
                  {overview.usersAtLimit !== null && overview.usersNearLimit !== null
                    ? `${overview.usersAtLimit} at limit · ${overview.usersNearLimit} near limit`
                    : "Users near quota limits"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4 sm:gap-3.5">
            {[accessHealth, governanceHealth, knowledgeHealth, capacityHealth].map((x) => (
              <div key={x.title} className={insightCell}>
                <p className={insightLabel}>{x.title}</p>
                <p className={insightValue}>{x.value}</p>
                <p className={insightSub}>{x.sub}</p>
              </div>
            ))}
          </div>

          <nav
            className="flex flex-wrap gap-1 rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/22 p-1 shadow-inner"
            aria-label="Admin sections"
          >
            <button
              type="button"
              onClick={() => setActiveTab("users")}
              className={`${tabBase} ${activeTab === "users" ? tabActive : tabInactive}`}
            >
              <Users className={activeTab === "users" ? iconClassActive : iconClass} aria-hidden />
              {t("tabs.users")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("activations")}
              className={`${tabBase} ${activeTab === "activations" ? tabActive : tabInactive}`}
            >
              <Zap className={activeTab === "activations" ? iconClassActive : iconClass} aria-hidden />
              {t("tabs.activations")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("knowledge")}
              className={`${tabBase} ${activeTab === "knowledge" ? tabActive : tabInactive}`}
            >
              <Brain className={activeTab === "knowledge" ? iconClassActive : iconClass} aria-hidden />
              Knowledge Sources
            </button>
            <a href="/admin/roles" className={`${tabBase} ${tabInactive}`}>
              <Shield className={iconClass} aria-hidden />
              {t("tabs.globalRoles")}
            </a>
            <button
              type="button"
              onClick={() => setActiveTab("limits")}
              className={`${tabBase} ${activeTab === "limits" ? tabActive : tabInactive}`}
            >
              <Sliders className={activeTab === "limits" ? iconClassActive : iconClass} aria-hidden />
              {t("tabs.roleLimits")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("userLimits")}
              className={`${tabBase} ${activeTab === "userLimits" ? tabActive : tabInactive}`}
            >
              <UserCog className={activeTab === "userLimits" ? iconClassActive : iconClass} aria-hidden />
              {t("tabs.userLimits")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("capacity")}
              className={`${tabBase} ${activeTab === "capacity" ? tabActive : tabInactive}`}
            >
              <BarChart2 className={activeTab === "capacity" ? iconClassActive : iconClass} aria-hidden />
              {t("tabs.capacity")}
            </button>
          </nav>

          <section className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] shadow-sm ring-1 ring-slate-100 overflow-hidden">
            <div className="border-b border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-2))]/55 px-5 py-4">
              <h2 className="text-sm font-semibold text-[rgb(var(--rb-text-primary))]">
                {sectionMeta[activeTab].title}
              </h2>
              <p className="mt-1 text-xs text-[rgb(var(--rb-text-muted))]">
                {sectionMeta[activeTab].subtitle}
              </p>
            </div>
            <div className="p-5">
              {activeTab === "users" && <UsersRolesPanel />}
              {activeTab === "activations" && <ActivationsPanel />}
              {activeTab === "knowledge" && <GlobalKnowledgeSourcesPanel />}
              {activeTab === "limits" && <RoleLimitsPanel />}
              {activeTab === "userLimits" && <UserLimitsPanel />}
              {activeTab === "capacity" && <CapacityDashboard />}
            </div>
          </section>
        </div>
      </div>
    </AppPageShell>
  );
}

type RoleLimitsEntry = {
  roleId: string;
  roleKey: string;
  roleName: string;
  limits: Record<string, number>;
};

function RoleLimitsPanel() {
  const t = useTranslations("admin.page");
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
        setMessage(data.error ?? t("errors.saveFailed"));
        return;
      }
      setMessage("Limits saved.");
      void load();
    } finally {
      setSavingRoleKey(null);
    }
  };

  const appRoles = roleLimits.filter((r) => r.roleKey !== "superadmin");

  return (
    <section className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] overflow-hidden shadow-sm ring-1 ring-[rgb(var(--rb-surface-border))]/35">
      <div className="border-b border-[rgb(var(--rb-surface-border))]/60 px-5 py-4 bg-[rgb(var(--rb-surface-3))]/20">
        <h2 className="text-sm font-semibold text-[rgb(var(--rb-text-primary))]">{t("roleLimits.title")}</h2>
        <p className="text-xs text-[rgb(var(--rb-text-muted))] mt-1">
          {t("roleLimits.subtitle")}
        </p>
      </div>
      <div className="p-5 space-y-6">
        {message && (
          <p className="text-sm text-emerald-800">{message}</p>
        )}
        {loading ? (
          <p className="text-sm text-[rgb(var(--rb-text-muted))]">{t("loading")}</p>
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
  const t = useTranslations("admin.page");
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
    <form onSubmit={handleSubmit} className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/15 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-[rgb(var(--rb-text-primary))]">{entry.roleName}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-[rgb(var(--rb-text-muted))] mb-1">{t("quotaLabels.maxProjects")}</label>
          <input
            type="number"
            min={1}
            value={maxProjects}
            onChange={(e) => setMaxProjects(e.target.value)}
            placeholder="Unlimited"
            className="w-full rounded-md border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30"
            disabled={saving}
          />
        </div>
        <div>
          <label className="block text-xs text-[rgb(var(--rb-text-muted))] mb-1">{t("quotaLabels.maxInvitations")}</label>
          <input
            type="number"
            min={1}
            value={maxInvitations}
            onChange={(e) => setMaxInvitations(e.target.value)}
            placeholder="Unlimited"
            className="w-full rounded-md border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30"
            disabled={saving}
          />
        </div>
        <div>
          <label className="block text-xs text-[rgb(var(--rb-text-muted))] mb-1">{t("quotaLabels.maxMembers")}</label>
          <input
            type="number"
            min={1}
            value={maxMembers}
            onChange={(e) => setMaxMembers(e.target.value)}
            placeholder="Unlimited"
            className="w-full rounded-md border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30"
            disabled={saving}
          />
        </div>
        <div>
          <label className="block text-xs text-[rgb(var(--rb-text-muted))] mb-1">{t("quotaLabels.maxClients")}</label>
          <input
            type="number"
            min={1}
            value={maxClients}
            onChange={(e) => setMaxClients(e.target.value)}
            placeholder="Unlimited"
            className="w-full rounded-md border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30"
            disabled={saving}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-[rgb(var(--rb-brand-primary))] px-4 py-2 text-sm font-medium text-white hover:bg-[rgb(var(--rb-brand-primary-hover))] disabled:opacity-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35"
      >
        {saving ? t("saving") : t("save")}
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
  max_projects_created: "Max created projects",
  max_pending_invitations_per_project: "Max pending invitations per project",
  max_members_per_project: "Max members per project",
  max_clients_created: "Max created clients",
};

function UserLimitsPanel() {
  const t = useTranslations("admin.page");
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
  }, [t]);

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
      else setMessage((data as { error?: string }).error ?? t("errors.loadFailed"));
    } finally {
      setQuotaLoading(false);
    }
  }, [t]);

  const closeModal = useCallback(() => {
    setModalUserId(null);
    setQuotaData(null);
    setMessage(null);
  }, []);

  return (
    <section className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] overflow-hidden shadow-sm ring-1 ring-[rgb(var(--rb-surface-border))]/35">
      <div className="border-b border-[rgb(var(--rb-surface-border))]/60 px-5 py-4 bg-[rgb(var(--rb-surface-3))]/20">
        <h2 className="text-sm font-semibold text-[rgb(var(--rb-text-primary))]">{t("userLimits.title")}</h2>
        <p className="text-xs text-[rgb(var(--rb-text-muted))] mt-1">
          {t("userLimits.subtitle")}
        </p>
      </div>
      <div className="p-5">
        {loading ? (
          <p className="text-sm text-[rgb(var(--rb-text-muted))]">{t("userLimits.loadingUsers")}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/18 text-left text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">
                  <th className="py-2 pr-4">Nombre</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">{t("capacity.table.role")}</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--rb-surface-border))]/45">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[rgb(var(--rb-surface-3))]/25 transition-colors duration-150">
                    <td className="py-2 pr-4 text-[rgb(var(--rb-text-primary))]">{u.full_name ?? "—"}</td>
                    <td className="py-2 pr-4 text-[rgb(var(--rb-text-primary))]">{u.email ?? "—"}</td>
                    <td className="py-2 pr-4 text-[rgb(var(--rb-text-primary))]">{u.app_role}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => openModal(u.id)}
                        className="text-[rgb(var(--rb-brand-primary))] hover:text-[rgb(var(--rb-brand-primary-hover))] text-xs font-medium transition-colors duration-150"
                      >
                        {t("userLimits.configure")}
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
                setMessage("Limits saved.");
                const getRes = await fetch(`/api/admin/quotas/user/${modalUserId}`, { headers });
                if (getRes.ok) {
                  const updated = (await getRes.json()) as UserQuotaConfig;
                  setQuotaData(updated);
                }
              } else setMessage(data.error ?? t("errors.saveFailed"));
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
  const t = useTranslations("admin.page");
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!quotaData) return;
    const o: Record<string, string> = {};
    for (const key of Object.keys(USER_QUOTA_LABELS)) {
      o[key] = String(quotaData.userOverrides[key] ?? "");
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-[rgb(var(--rb-surface-border))]/60 px-5 py-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[rgb(var(--rb-text-primary))]">
            {t("userLimits.modalTitle")}: {user?.full_name || user?.email || userId}
          </h3>
          <button type="button" onClick={onClose} className="text-[rgb(var(--rb-text-muted))] hover:text-[rgb(var(--rb-text-primary))] text-xl leading-none transition-colors">&times;</button>
        </div>
        <div className="p-5">
          {loading ? (
            <p className="text-sm text-[rgb(var(--rb-text-muted))]">{t("loading")}</p>
          ) : quotaData ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-[rgb(var(--rb-text-muted))]">{t("usersRoles.table.role")}: <strong className="text-[rgb(var(--rb-text-primary))]">{quotaData.appRole ?? "—"}</strong></p>
              <div className="rounded-lg border border-[rgb(var(--rb-surface-border))]/55 p-3 bg-[rgb(var(--rb-surface-3))]/12">
                <p className="text-xs font-medium text-[rgb(var(--rb-text-muted))] mb-2">{t("userLimits.defaultRoleLimits")}</p>
                <ul className="text-xs text-[rgb(var(--rb-text-secondary))] space-y-1">
                  {Object.entries(USER_QUOTA_LABELS).map(([key, label]) => (
                    <li key={key}>{label}: {quotaData.roleLimits[key] ?? "unlimited"}</li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-[rgb(var(--rb-text-muted))]">{t("userLimits.overrideHelp")}</p>
              <div className="grid grid-cols-1 gap-3">
                {Object.entries(USER_QUOTA_LABELS).map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-xs text-[rgb(var(--rb-text-muted))] mb-0.5">{label}</label>
                    <input
                      type="number"
                      min={1}
                      value={overrides[key] ?? ""}
                      onChange={(e) => setOverrides((o) => ({ ...o, [key]: e.target.value }))}
                      placeholder={quotaData.roleLimits[key] != null ? String(quotaData.roleLimits[key]) : "Unlimited"}
                      className="w-full rounded-md border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30"
                      disabled={saving}
                    />
                    {quotaData.effectiveLimits[key] != null && (
                      <p className="text-xs text-[rgb(var(--rb-text-muted))] mt-0.5">{t("userLimits.effective")}: {quotaData.effectiveLimits[key]}</p>
                    )}
                  </div>
                ))}
              </div>
              {message && <p className="text-sm text-emerald-800">{message}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[rgb(var(--rb-brand-primary))] px-4 py-2 text-sm font-medium text-white hover:bg-[rgb(var(--rb-brand-primary-hover))] disabled:opacity-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35"
                >
                  {saving ? t("saving") : t("save")}
                </button>
                <button type="button" onClick={onClose} className="rounded-xl border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-4 py-2 text-sm font-medium text-[rgb(var(--rb-text-primary))] hover:bg-[rgb(var(--rb-surface-3))]/35 transition-colors duration-150">
                  {t("close")}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-[rgb(var(--rb-text-muted))]">{t("errors.loadConfig")}</p>
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
  unlimited: "Unlimited",
  normal: "Normal",
  near_limit: "Near limit",
  at_limit: "At limit",
};

function CapacityDashboard() {
  const t = useTranslations("admin.page");
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
  }, [quotaModalUserId, t]);

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
        setQuotaModalMessage("Limits saved.");
        const getRes = await fetch(`/api/admin/quotas/user/${quotaModalUserId}`, { headers });
        if (getRes.ok) setQuotaModalData((await getRes.json()) as UserQuotaConfig);
      } else setQuotaModalMessage(data.error ?? t("errors.saveFailed"));
    } finally {
      setQuotaModalSaving(false);
    }
  }, [quotaModalUserId]);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] overflow-hidden shadow-sm ring-1 ring-[rgb(var(--rb-surface-border))]/35">
        <div className="border-b border-[rgb(var(--rb-surface-border))]/60 px-5 py-4 bg-[rgb(var(--rb-surface-3))]/20">
          <h2 className="text-sm font-semibold text-[rgb(var(--rb-text-primary))]">{t("capacity.title")}</h2>
          <p className="text-xs text-[rgb(var(--rb-text-muted))] mt-1">
            {t("capacity.subtitle")}
          </p>
        </div>
        <div className="p-5">
          {loading ? (
            <p className="text-sm text-[rgb(var(--rb-text-muted))]">{t("loading")}</p>
          ) : data ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-6">
                <div className="rounded-xl border border-red-500/30 bg-red-500/15 p-3">
                  <p className="text-lg font-semibold text-red-600">{data.summary.usersAtLimit}</p>
                  <p className="text-xs text-red-600/90">{t("capacity.usersAtLimit")}</p>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/15 p-3">
                  <p className="text-lg font-semibold text-amber-800">{data.summary.usersNearLimit}</p>
                  <p className="text-xs text-amber-800/90">{t("capacity.usersNearLimit")}</p>
                </div>
                <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/15 p-3">
                  <p className="text-lg font-semibold text-[rgb(var(--rb-text-primary))]">{data.summary.usersWithOverrides}</p>
                  <p className="text-xs text-[rgb(var(--rb-text-muted))]">{t("capacity.withOverrides")}</p>
                </div>
                <div className="rounded-xl border border-red-500/30 bg-red-500/15 p-3">
                  <p className="text-lg font-semibold text-red-600">{data.summary.projectsAtMemberLimit}</p>
                  <p className="text-xs text-red-600/90">{t("capacity.projectsAtMemberLimit")}</p>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/15 p-3">
                  <p className="text-lg font-semibold text-amber-800">{data.summary.projectsNearMemberLimit}</p>
                  <p className="text-xs text-amber-800/90">Cerca (miembros)</p>
                </div>
                <div className="rounded-xl border border-red-500/30 bg-red-500/15 p-3">
                  <p className="text-lg font-semibold text-red-600">{data.summary.projectsAtInvitationLimit}</p>
                  <p className="text-xs text-red-600/90">{t("capacity.invitationsAtLimit")}</p>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/15 p-3">
                  <p className="text-lg font-semibold text-amber-800">{data.summary.projectsNearInvitationLimit}</p>
                  <p className="text-xs text-amber-800/90">Cerca (invit.)</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4 items-center">
                <span className="text-xs font-medium text-[rgb(var(--rb-text-muted))] mr-1">{t("capacity.views")}:</span>
                <button
                  type="button"
                  onClick={() => setFilterStatus("at_limit")}
                  className="rounded-lg border border-red-200/90 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100/80 transition-colors"
                >
                  {t("capacity.atLimitOnly")}
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus("near_limit")}
                  className="rounded-lg border border-amber-200/90 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100/80 transition-colors"
                >
                  {t("capacity.nearLimitOnly")}
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus("")}
                  className="rounded-lg border border-[rgb(var(--rb-surface-border))]/60 px-3 py-1.5 text-xs text-[rgb(var(--rb-text-muted))] hover:bg-[rgb(var(--rb-surface-3))]/25 transition-colors"
                >
                  {t("capacity.all")}
                </button>
                <span className="w-px h-5 bg-[rgb(var(--rb-surface-border))]/70 mx-1" />
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="rounded-md border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-1.5 text-sm text-[rgb(var(--rb-text-primary))]"
                >
                  <option value="">{t("capacity.allRoles")}</option>
                  <option value="admin">admin</option>
                  <option value="consultant">consultant</option>
                  <option value="viewer">viewer</option>
                  <option value="superadmin">superadmin</option>
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="rounded-md border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-1.5 text-sm text-[rgb(var(--rb-text-primary))]"
                >
                  <option value="">{t("capacity.allStatuses")}</option>
                  <option value="at_limit">{t("capacity.atLimit")}</option>
                  <option value="near_limit">{t("capacity.nearLimit")}</option>
                  <option value="normal">Normal</option>
                  <option value="unlimited">{t("capacity.unlimited")}</option>
                </select>
                <label className="flex items-center gap-2 text-sm text-[rgb(var(--rb-text-muted))]">
                  <input type="checkbox" checked={overridesOnly} onChange={(e) => setOverridesOnly(e.target.checked)} className="rounded border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 text-[rgb(var(--rb-brand-primary))]" />
                  {t("capacity.overridesOnly")}
                </label>
                <label className="flex items-center gap-2 text-sm text-[rgb(var(--rb-text-muted))]">
                  <input type="checkbox" checked={projectsWithLimitsOnly} onChange={(e) => setProjectsWithLimitsOnly(e.target.checked)} className="rounded border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 text-[rgb(var(--rb-brand-primary))]" />
                  {t("capacity.limitedProjectsOnly")}
                </label>
              </div>

              <h3 className="text-xs font-medium text-[rgb(var(--rb-text-muted))] uppercase tracking-wide mt-6 mb-2">{t("capacity.byUser")}</h3>
              <div className="overflow-x-auto rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] shadow-sm mb-6">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/18 text-left text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">
                      <th className="py-2 px-3">{t("capacity.table.user")}</th>
                      <th className="py-2 px-3">Email</th>
                      <th className="py-2 px-3">{t("capacity.table.role")}</th>
                      <th className="py-2 px-3">{t("capacity.table.projects")}</th>
                      <th className="py-2 px-3">{t("capacity.table.clients")}</th>
                      <th className="py-2 px-3">{t("capacity.table.overrides")}</th>
                      <th className="py-2 px-3">{t("capacity.table.status")}</th>
                      <th className="py-2 px-3 text-right">{t("capacity.table.actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgb(var(--rb-surface-border))]/45">
                    {data.userUsage.map((u) => (
                      <tr key={u.userId} className="hover:bg-[rgb(var(--rb-surface-3))]/25 transition-colors duration-150">
                        <td className="py-2 px-3 text-[rgb(var(--rb-text-primary))]">{u.fullName ?? "—"}</td>
                        <td className="py-2 px-3 text-[rgb(var(--rb-text-muted))]">{u.email ?? "—"}</td>
                        <td className="py-2 px-3 text-[rgb(var(--rb-text-secondary))]">{u.appRole}</td>
                        <td className="py-2 px-3 text-[rgb(var(--rb-text-secondary))]">{u.projectsLimit != null ? `${u.projectsUsed} / ${u.projectsLimit}` : `${u.projectsUsed} (${t("capacity.unlimited")})`}</td>
                        <td className="py-2 px-3 text-[rgb(var(--rb-text-secondary))]">{u.clientsLimit != null ? `${u.clientsUsed} / ${u.clientsLimit}` : `${u.clientsUsed} (${t("capacity.unlimited")})`}</td>
                        <td className="py-2 px-3 text-[rgb(var(--rb-text-muted))]">{u.hasOverrides ? "Yes" : "—"}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                            u.status === "at_limit" ? "bg-red-500/10 text-red-700 border border-red-200/80" :
                            u.status === "near_limit" ? "border-amber-200/80 bg-amber-500/10 text-amber-900 border" :
                            u.status === "unlimited" ? "bg-[rgb(var(--rb-surface-3))]/30 text-[rgb(var(--rb-text-muted))] border border-[rgb(var(--rb-surface-border))]/55" : "bg-[rgb(var(--rb-surface-3))]/30 text-[rgb(var(--rb-text-secondary))] border border-[rgb(var(--rb-surface-border))]/55"
                          }`}>
                            {STATUS_LABELS[u.status] ?? u.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setQuotaModalUserId(u.userId)}
                            className="text-[rgb(var(--rb-brand-primary))] hover:text-[rgb(var(--rb-brand-primary-hover))] text-xs font-medium transition-colors duration-150"
                          >
                            {t("userLimits.configure")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="text-xs font-medium text-[rgb(var(--rb-text-muted))] uppercase tracking-wide mt-6 mb-2">{t("capacity.byProject")}</h3>
              <div className="overflow-x-auto rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] shadow-sm">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/18 text-left text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">
                      <th className="py-2 px-3">{t("capacity.projectTable.project")}</th>
                      <th className="py-2 px-3">{t("capacity.projectTable.client")}</th>
                      <th className="py-2 px-3">{t("capacity.projectTable.members")}</th>
                      <th className="py-2 px-3">{t("capacity.projectTable.pendingInvitations")}</th>
                      <th className="py-2 px-3">{t("capacity.projectTable.status")}</th>
                      <th className="py-2 px-3 text-right">{t("capacity.projectTable.actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgb(var(--rb-surface-border))]/45">
                    {data.projectUsage.map((p) => (
                      <tr key={p.projectId} className="hover:bg-[rgb(var(--rb-surface-3))]/25 transition-colors duration-150">
                        <td className="py-2 px-3 text-[rgb(var(--rb-text-primary))]">{p.projectName}</td>
                        <td className="py-2 px-3 text-[rgb(var(--rb-text-muted))]">{p.clientName ?? "—"}</td>
                        <td className="py-2 px-3 text-[rgb(var(--rb-text-secondary))]">{p.membersLimit != null ? `${p.membersCurrent} / ${p.membersLimit}` : `${p.membersCurrent} (${t("capacity.unlimited")})`}</td>
                        <td className="py-2 px-3 text-[rgb(var(--rb-text-secondary))]">{p.invitationsLimit != null ? `${p.invitationsCurrent} / ${p.invitationsLimit}` : `${p.invitationsCurrent} (${t("capacity.unlimited")})`}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                            p.status === "at_limit" ? "bg-red-500/10 text-red-700 border border-red-200/80" :
                            p.status === "near_limit" ? "border-amber-200/80 bg-amber-500/10 text-amber-900 border" :
                            p.status === "unlimited" ? "bg-[rgb(var(--rb-surface-3))]/30 text-[rgb(var(--rb-text-muted))] border border-[rgb(var(--rb-surface-border))]/55" : "bg-[rgb(var(--rb-surface-3))]/30 text-[rgb(var(--rb-text-secondary))] border border-[rgb(var(--rb-surface-border))]/55"
                          }`}>
                            {STATUS_LABELS[p.status] ?? p.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <Link href={`/projects/${p.projectId}`} className="text-[rgb(var(--rb-brand-primary))] hover:text-[rgb(var(--rb-brand-primary-hover))] text-xs font-medium mr-2 transition-colors duration-150">
                            {t("capacity.projectTable.viewProject")}
                          </Link>
                          <Link href={`/projects/${p.projectId}/members`} className="text-[rgb(var(--rb-brand-primary))] hover:text-[rgb(var(--rb-brand-primary-hover))] text-xs font-medium transition-colors duration-150">
                            {t("capacity.projectTable.viewTeam")}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-[rgb(var(--rb-text-muted))]">{t("errors.loadData")}</p>
          )}
        </div>
      </div>

      {quotaModalUserId && (
        <CapacityQuotaModal
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
  userLabel,
  quotaData,
  loading,
  saving,
  message,
  onClose,
  onSave,
}: {
  userLabel: string;
  quotaData: UserQuotaConfig | null;
  loading: boolean;
  saving: boolean;
  message: string | null;
  onClose: () => void;
  onSave: (overrides: Record<string, number>) => Promise<void>;
}) {
  const t = useTranslations("admin.page");
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!quotaData) return;
    const o: Record<string, string> = {};
    for (const key of Object.keys(USER_QUOTA_LABELS)) {
      o[key] = String(quotaData.userOverrides[key] ?? "");
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-[rgb(var(--rb-surface-border))]/60 px-5 py-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[rgb(var(--rb-text-primary))]">{t("userLimits.modalTitle")}: {userLabel}</h3>
          <button type="button" onClick={onClose} className="text-[rgb(var(--rb-text-muted))] hover:text-[rgb(var(--rb-text-primary))] text-xl leading-none transition-colors">&times;</button>
        </div>
        <div className="p-5">
          {loading ? (
            <p className="text-sm text-[rgb(var(--rb-text-muted))]">{t("loading")}</p>
          ) : quotaData ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-[rgb(var(--rb-text-muted))]">{t("usersRoles.table.role")}: <strong className="text-[rgb(var(--rb-text-primary))]">{quotaData.appRole ?? "—"}</strong></p>
              <div className="rounded-lg border border-[rgb(var(--rb-surface-border))]/55 p-3 bg-[rgb(var(--rb-surface-3))]/12">
                <p className="text-xs font-medium text-[rgb(var(--rb-text-muted))] mb-2">{t("userLimits.defaultRoleLimits")}</p>
                <ul className="text-xs text-[rgb(var(--rb-text-secondary))] space-y-1">
                  {Object.entries(USER_QUOTA_LABELS).map(([key, label]) => (
                    <li key={key}>{label}: {quotaData.roleLimits[key] ?? "unlimited"}</li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-[rgb(var(--rb-text-muted))]">{t("userLimits.overrideHelp")}</p>
              <div className="grid grid-cols-1 gap-3">
                {Object.entries(USER_QUOTA_LABELS).map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-xs text-[rgb(var(--rb-text-muted))] mb-0.5">{label}</label>
                    <input
                      type="number"
                      min={1}
                      value={overrides[key] ?? ""}
                      onChange={(e) => setOverrides((o) => ({ ...o, [key]: e.target.value }))}
                      placeholder={quotaData.roleLimits[key] != null ? String(quotaData.roleLimits[key]) : "Unlimited"}
                      className="w-full rounded-md border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30"
                      disabled={saving}
                    />
                    {quotaData.effectiveLimits[key] != null && (
                      <p className="text-xs text-[rgb(var(--rb-text-muted))] mt-0.5">{t("userLimits.effective")}: {quotaData.effectiveLimits[key]}</p>
                    )}
                  </div>
                ))}
              </div>
              {message && <p className="text-sm text-emerald-800">{message}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="rounded-xl bg-[rgb(var(--rb-brand-primary))] px-4 py-2 text-sm font-medium text-white hover:bg-[rgb(var(--rb-brand-primary-hover))] disabled:opacity-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35">
                  {saving ? "Saving…" : "Save"}
                </button>
                <button type="button" onClick={onClose} className="rounded-xl border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-4 py-2 text-sm font-medium text-[rgb(var(--rb-text-primary))] hover:bg-[rgb(var(--rb-surface-3))]/35 transition-colors duration-150">{t("close")}</button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-[rgb(var(--rb-text-muted))]">{t("errors.loadConfig")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivationsPanel() {
  const t = useTranslations("admin.page");
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
  }, [t]);

  const pending = users.filter((u) => !u.is_active);
  const active = users.filter((u) => u.is_active);

  return (
    <section className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] overflow-hidden shadow-sm ring-1 ring-[rgb(var(--rb-surface-border))]/35">
      <div className="border-b border-[rgb(var(--rb-surface-border))]/60 px-5 py-4 bg-[rgb(var(--rb-surface-3))]/20">
        <h2 className="text-sm font-semibold text-[rgb(var(--rb-text-primary))]">{t("activations.title")}</h2>
        <p className="text-xs text-[rgb(var(--rb-text-muted))] mt-1">
          {t("activations.subtitle")}
        </p>
      </div>
      <div className="p-5">
        {loading ? (
          <p className="text-sm text-[rgb(var(--rb-text-muted))]">{t("loading")}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-4 shadow-sm">
              <p className="text-2xl font-semibold tabular-nums text-amber-900">{pending.length}</p>
              <p className="text-sm font-medium text-amber-900">{t("activations.pending")}</p>
              <p className="text-xs text-amber-800/90 mt-0.5">No platform access yet</p>
            </div>
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-4 shadow-sm">
              <p className="text-2xl font-semibold tabular-nums text-emerald-900">{active.length}</p>
              <p className="text-sm font-medium text-emerald-900">{t("activations.active")}</p>
              <p className="text-xs text-emerald-800/90 mt-0.5">{t("activations.canSignIn")}</p>
            </div>
          </div>
        )}
        <a
          href="/admin/users"
          className="mt-4 inline-flex items-center rounded-lg bg-[rgb(var(--rb-brand-primary))] px-4 py-2 text-sm font-medium text-white hover:bg-[rgb(var(--rb-brand-primary-hover))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35"
        >
          {t("activations.manage")}
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
  const t = useTranslations("admin.page");
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
          setError(t("errors.loadUsers"));
          setUsers([]);
          setLoading(false);
          return;
        }
        const data = (await res.json()) as { users?: AdminUser[] };
        if (cancelled) return;
        setUsers(data.users ?? []);
      } catch {
        if (!cancelled) {
          setError(t("errors.loadUsers"));
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
          setRolesError(data.error ?? "Could not load app roles.");
          setAppRoles([]);
          return;
        }
        const data = (await res.json()) as { roles?: AppRoleOption[] };
        if (cancelled) return;
        setAppRoles(data.roles ?? []);
      } catch {
        if (!cancelled) {
          setRolesError("Could not load app roles.");
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
        setSaveMessage({ type: "error", text: data.error ?? "Could not update role." });
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
      setSaveMessage({ type: "success", text: t("usersRoles.roleUpdated") });
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] shadow-sm">
      <div className="flex flex-col gap-4 border-b border-[rgb(var(--rb-surface-border))]/55 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-[rgb(var(--rb-text-primary))]">
            Users &amp; Roles
          </h2>
          <p className="text-sm leading-relaxed text-[rgb(var(--rb-text-muted))] max-w-xl">
            Manage global platform access for each user.
          </p>
        </div>
        <a
          href="/admin/users"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-transparent bg-[rgb(var(--rb-brand-primary))] px-4 text-sm font-medium text-white shadow-sm hover:bg-[rgb(var(--rb-brand-primary-hover))] disabled:opacity-60 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-0"
        >
          Manage users
        </a>
      </div>
      <div className="space-y-5 p-5 sm:p-6 sm:pt-5">

      {rolesError && (
        <div className="rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {rolesError}
        </div>
      )}

      {saveMessage && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            saveMessage.type === "success"
              ? "border-emerald-200/90 bg-emerald-50 text-emerald-900"
              : "border-red-200/90 bg-red-50 text-red-800"
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[rgb(var(--rb-text-muted))]">{t("usersRoles.loadingUsers")}</p>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[rgb(var(--rb-surface-border))]/55 bg-[rgb(var(--rb-surface))] shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[rgb(var(--rb-surface-border))]/50 bg-[rgb(var(--rb-surface-3))]/14 text-left text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">
                <th className="py-4 px-4 first:pl-5">{t("usersRoles.table.user")}</th>
                <th className="py-4 px-4">{t("usersRoles.table.role")}</th>
                <th className="py-4 px-4">{t("usersRoles.table.activation")}</th>
                <th className="py-4 px-4 pr-5 text-right">{t("usersRoles.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const displayName =
                  user.full_name || user.email || t("usersRoles.untitled");
                const secondaryLine =
                  user.full_name && user.email ? user.email : null;
                const currentRole =
                  pendingRoles[user.id] ?? user.app_role;
                const roleOptions = appRoles.length > 0
                  ? appRoles
                  : [
                      { id: "consultant", key: "consultant", name: t("usersRoles.consultant") },
                      { id: "superadmin", key: "superadmin", name: "Superadmin" },
                    ];
                return (
                  <tr
                    key={user.id}
                    className="border-b border-[rgb(var(--rb-surface-border))]/30 transition-colors duration-150 last:border-b-0 hover:bg-[rgb(var(--rb-brand-primary))]/[0.045]"
                  >
                    <td className="py-4 px-4 pl-5 align-middle">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[15px] font-semibold leading-snug tracking-tight text-[rgb(var(--rb-text-primary))]">
                          {displayName}
                        </span>
                        {secondaryLine && (
                          <span className="text-xs text-[rgb(var(--rb-text-muted))] tabular-nums">{secondaryLine}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 align-middle">
                      <select
                        value={currentRole}
                        onChange={(e) =>
                          handleRoleChange(user.id, e.target.value)
                        }
                        className="h-10 min-w-[10rem] rounded-lg border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/12 px-2.5 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30 disabled:opacity-60"
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
                    <td className="py-4 px-4 align-middle">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${user.is_active ? "border-emerald-200/80 bg-emerald-500/10 text-emerald-800" : "border-amber-200/80 bg-amber-500/10 text-amber-900"}`}>
                        {user.is_active ? t("activations.active") : t("activations.pending")}
                      </span>
                    </td>
                    <td className="py-4 px-4 pr-5 text-right align-middle">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveRole(user.id)}
                          disabled={savingUserId === user.id}
                          className="inline-flex h-8 items-center justify-center rounded-lg bg-[rgb(var(--rb-brand-primary))] px-3 text-xs font-medium text-white shadow-sm hover:bg-[rgb(var(--rb-brand-primary-hover))] disabled:opacity-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35"
                        >
                          {savingUserId === user.id ? "Saving..." : "Save"}
                        </button>
                        <a
                          href="/admin/users"
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/15 px-3 text-xs font-medium text-[rgb(var(--rb-text-primary))] hover:bg-[rgb(var(--rb-surface-3))]/30 transition-colors duration-150"
                        >
                          {t("usersRoles.manage")}
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
      </div>
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
  owner: "owner",
  editor: "editor",
  viewer: "viewer",
};

function ProjectAccessPanel() {
  const t = useTranslations("admin.page");
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
          setError(t("projectAccess.errors.loadData"));
          setUsers([]);
        } else {
          const usersData = (await usersRes.json()) as { users?: AdminUser[] };
          setUsers(usersData.users ?? []);
        }

        if (projResult.error) {
          setError(t("projectAccess.errors.loadData"));
          setProjects([]);
        } else {
          setProjects((projResult.data ?? []) as { id: string; name: string; status?: string | null }[]);
        }
      } catch {
        if (!cancelled) setError(t("projectAccess.errors.loadData"));
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
        setError(t("projectAccess.errors.loadMembers"));
        setMembers([]);
        return;
      }
      const data = (await res.json()) as { members?: ProjectMember[] };
      setMembers(data.members ?? []);
    } catch {
      setError(t("projectAccess.errors.loadMembers"));
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
        setError("Could not add member.");
        return;
      }
      const data = (await res.json()) as { member?: ProjectMember };
      if (data.member) setMembers((prev) => [...prev, data.member!]);
      setAddUserId("");
      setAddRole("");
    } catch {
      setError("Could not add member.");
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
        setError("Could not remove access.");
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch {
      setError("Could not remove access.");
    } finally {
      setSavingMemberId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] p-5 sm:p-6 space-y-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[rgb(var(--rb-text-primary))]">
            {t("projectAccess.title")}
          </h2>
          <p className="text-xs text-[rgb(var(--rb-text-muted))]">
            {t("projectAccess.subtitle")}
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-rose-400">{error}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left: projects list */}
        <div className="md:col-span-1">
          <p className="text-xs font-medium text-[rgb(var(--rb-text-muted))] uppercase tracking-wide mb-2">{t("projectAccess.projects")}</p>
          {loadingProjects ? (
            <p className="text-sm text-[rgb(var(--rb-text-muted))]">{t("projectAccess.loadingProjects")}</p>
          ) : (
            <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/15 p-2 max-h-80 overflow-y-auto space-y-1">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => handleSelectProject(project.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors duration-150 ${
                    selectedProjectId === project.id
                      ? "bg-[rgb(var(--rb-brand-primary))] text-white shadow-sm"
                      : "text-[rgb(var(--rb-text-primary))] hover:bg-[rgb(var(--rb-surface-3))]/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{project.name}</span>
                    {project.status && (
                      <span className="text-[11px] rounded-md border border-[rgb(var(--rb-surface-border))]/55 bg-[rgb(var(--rb-surface-3))]/15 px-2 py-0.5 text-[rgb(var(--rb-text-muted))]">
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
            <p className="text-sm text-[rgb(var(--rb-text-muted))]">
              {t("projectAccess.selectProject")}
            </p>
          ) : (
            <>
              <div>
                <p className="text-xs font-medium text-[rgb(var(--rb-text-muted))] uppercase tracking-wide mb-2">
                  {t("projectAccess.membersTitle")}
                </p>
                {loadingMembers ? (
                  <p className="text-sm text-[rgb(var(--rb-text-muted))]">
                    {t("projectAccess.loadingMembers")}
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] shadow-sm">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/18 text-left text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">
                          <th className="py-3 px-4">{t("projectAccess.table.user")}</th>
                          <th className="py-3 px-4">{t("projectAccess.table.role")}</th>
                          <th className="py-3 px-4 text-right">{t("projectAccess.table.action")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgb(var(--rb-surface-border))]/45">
                        {members.map((member) => {
                          const displayName =
                            member.user_full_name || t("projectAccess.unnamedUser");
                          return (
                            <tr key={member.id} className="hover:bg-[rgb(var(--rb-surface-3))]/25 transition-colors duration-150">
                              <td className="py-3 px-4 text-[rgb(var(--rb-text-primary))]">
                                {displayName}
                              </td>
                              <td className="py-3 px-4">
                                <span className="inline-flex rounded-md bg-[rgb(var(--rb-brand-primary))]/10 px-2 py-0.5 text-xs font-medium text-[rgb(var(--rb-brand-primary))] border border-[rgb(var(--rb-brand-primary))]/25">
                                  {t(`projectAccess.roles.${ROLE_LABELS[member.role]}`)}
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
                                    ? t("projectAccess.removing")
                                    : t("projectAccess.removeAccess")}
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
                className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/15 p-4 space-y-3"
              >
                <p className="text-xs font-medium text-[rgb(var(--rb-text-muted))] uppercase tracking-wide">
                  {t("projectAccess.addMember")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[rgb(var(--rb-text-muted))] mb-1">
                      {t("projectAccess.table.user")}
                    </label>
                    <select
                      value={addUserId}
                      onChange={(e) => setAddUserId(e.target.value)}
                      className="w-full rounded-md border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30"
                      disabled={savingMemberId !== null}
                    >
                      <option value="">{t("projectAccess.selectUser")}</option>
                      {users
                        .filter(
                          (u) =>
                            !members.some((m) => m.user_id === u.id)
                        )
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name || u.email || t("usersRoles.untitled")}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[rgb(var(--rb-text-muted))] mb-1">
                      {t("projectAccess.table.role")}
                    </label>
                    <select
                      value={addRole}
                      onChange={(e) =>
                        setAddRole(
                          e.target.value as "owner" | "editor" | "viewer" | ""
                        )
                      }
                      className="w-full rounded-md border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30"
                      disabled={savingMemberId !== null}
                    >
                      <option value="">{t("projectAccess.selectRole")}</option>
                      <option value="owner">{t("projectAccess.roles.owner")}</option>
                      <option value="editor">{t("projectAccess.roles.editor")}</option>
                      <option value="viewer">{t("projectAccess.roles.viewer")}</option>
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
                  className="rounded-xl bg-[rgb(var(--rb-brand-primary))] px-3 py-2 text-sm font-medium text-white hover:bg-[rgb(var(--rb-brand-primary-hover))] disabled:opacity-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35"
                >
                  {savingMemberId === "new" ? t("projectAccess.adding") : t("projectAccess.add")}
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
  google_drive_folder: "Google Drive folder",
  google_drive_file: "Google Drive file",
  sap_help: "SAP Help Portal",
  sap_official: "SAP Official",
  official_web: "Official SAP web",
  sharepoint_library: "SharePoint library",
  confluence_space: "Confluence space",
  jira_project: "Jira project",
  web_url: "Web URL",
  manual_upload: "Manual upload",
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
  const t = useTranslations("admin.page");
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
        setError(data.error ?? t("knowledge.errors.startGoogle"));
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(t("knowledge.errors.unexpectedResponse"));
    } catch {
      setError("Connection error.");
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
        setSyncMessage(data.error ?? "Could not sync source.");
        void loadSources();
        return;
      }
      const docs = data.documentsProcessed ?? data.filesProcessed ?? 0;
      const chunks = data.chunksCreated ?? 0;
      if (data.ok) {
        setSyncMessage(
          data.message ?? t("knowledge.syncCompleted", { docs, chunks })
        );
      } else {
        setSyncMessage(
          data.message ?? data.error ?? t("knowledge.syncWithErrors", { docs, chunks })
        );
      }
      void loadSources();
    } catch {
      setSyncMessage("Connection error.");
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
        setError(data.error ?? t("knowledge.errors.loadSources"));
        setSources([]);
        return;
      }
      const data = (await res.json()) as { sources?: GlobalKnowledgeSourceRow[] };
      setSources(data.sources ?? []);
    } catch {
      setError("Connection error.");
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
        setCreateError(data.error ?? t("knowledge.errors.createSource"));
        return;
      }
      setNewSourceName("");
      setNewSourceUrl("");
      setNewExternalRef("");
      setNewIntegrationId("");
      if (data.source) setSources((prev) => [data.source!, ...prev]);
    } catch {
      setCreateError("Connection error.");
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
        setError(data.error ?? t("knowledge.errors.deleteSource"));
        return;
      }
      setSources((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError("Connection error.");
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
    <section className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] p-5 shadow-sm sm:p-6 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-xl overflow-hidden bg-[rgb(var(--rb-surface-3))]/40 shrink-0">
            <Image
              src={getSapitoGeneral().avatarImage}
              alt=""
              fill
              className="object-cover"
              sizes="40px"
            />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[rgb(var(--rb-text-primary))]">
              Knowledge Sources
            </h2>
            <p className="text-xs text-[rgb(var(--rb-text-muted))] max-w-xl">
              Global and project knowledge used by Sapito to answer with broader context. Managed from Admin.
            </p>
          </div>
        </div>
      </div>

      {/* Platform integrations: Google Drive — primary entry point */}
      <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/15 p-4 space-y-3">
        <p className="text-xs font-medium text-[rgb(var(--rb-text-muted))] uppercase tracking-wide">
          Platform integrations
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-[rgb(var(--rb-text-primary))]">Google Drive</p>
            {integrationsLoading ? (
              <p className="mt-1 text-xs text-[rgb(var(--rb-text-muted))]">{t("loading")}</p>
            ) : hasGoogleIntegration ? (
              <>
                <p className="mt-1 text-xs text-[rgb(var(--rb-text-muted))]">
                  {t("knowledge.connected")}: {integrations[0]?.account_email ?? integrations[0]?.display_name ?? "—"}
                </p>
                <p className="mt-0.5 text-xs text-[rgb(var(--rb-text-muted))]">
                  {t("knowledge.integrationHelp")}
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-[rgb(var(--rb-text-muted))]">
                {t("knowledge.connectHelp")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleConnectGoogleDrive}
            disabled={googleConnectPending || !canManageKnowledgeSources}
            className="rounded-xl bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[rgb(var(--rb-brand-primary-hover))] disabled:opacity-60 transition-colors duration-150 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35"
          >
            {googleConnectPending ? t("knowledge.redirecting") : hasGoogleIntegration ? t("knowledge.reconnectDrive") : t("knowledge.connectDrive")}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => void loadSources()}
            className="rounded-xl border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-1.5 text-xs font-medium text-[rgb(var(--rb-text-primary))] hover:bg-[rgb(var(--rb-surface-3))]/35 transition-colors duration-150"
          >
            {t("knowledge.retry")}
          </button>
        </div>
      )}
      {syncMessage && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            syncMessage.includes("completed") && !syncMessage.includes("errors")
              ? "border-emerald-200/90 bg-emerald-50 text-emerald-900"
              : syncMessage.includes("Error") || syncMessage.includes("errors")
                ? "border-red-200/90 bg-red-50 text-red-800"
                : "border-amber-200/90 bg-amber-50 text-amber-900"
          }`}
        >
          {syncMessage}
        </div>
      )}

      <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/50 bg-[rgb(var(--rb-surface-3))]/10 p-5 shadow-sm sm:p-6">
        <div className="mb-6 space-y-1 border-b border-[rgb(var(--rb-surface-border))]/45 pb-5">
          <h3 className="text-sm font-semibold tracking-tight text-[rgb(var(--rb-text-primary))]">
            {t("knowledge.createGlobalSource")}
          </h3>
          <p className="text-sm leading-relaxed text-[rgb(var(--rb-text-muted))]">{t("knowledge.createSectionHint")}</p>
        </div>
        <form onSubmit={handleCreate} className="space-y-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--rb-text-secondary))]">{t("knowledge.type")}</label>
            <select
              value={newSourceType}
              onChange={(e) => setNewSourceType(e.target.value)}
              className="h-10 w-full rounded-lg border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] px-3 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30"
              disabled={saving}
            >
              {Object.entries(GLOBAL_SOURCE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {(newSourceType === "sap_help" || newSourceType === "official_web" || newSourceType === "sap_official") && (
              <div className="mt-1 space-y-1">
                <p className="text-xs text-[rgb(var(--rb-text-muted))]">
                  {t("knowledge.curatedUrlHelp")}
                </p>
                <p className="text-xs rounded-lg border border-amber-200/80 bg-amber-50/90 px-2.5 py-1.5 text-amber-900">
                  <strong>{t("knowledge.guide")}:</strong> {t("knowledge.guideBody")}
                </p>
                {newSourceType === "sap_help" && (
                  <p className="text-xs rounded-lg border border-amber-200/80 bg-amber-50/90 px-2.5 py-1 text-amber-900">
                    <strong>{t("knowledge.sapHelpTitle")}:</strong> {t("knowledge.sapHelpBody")}
                  </p>
                )}
                {newSourceType === "sap_official" && (
                  <p className="text-xs text-[rgb(var(--rb-text-muted))]">
                    <strong>{t("knowledge.sapOfficialTitle")}:</strong> {t("knowledge.sapOfficialBody")}
                  </p>
                )}
                {newSourceType === "official_web" && (
                  <p className="text-xs text-[rgb(var(--rb-text-muted))]">
                    <strong>{t("knowledge.officialWebTitle")}:</strong> {t("knowledge.officialWebBody")}
                  </p>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--rb-text-secondary))]">{t("knowledge.nameRequired")}</label>
            <input
              type="text"
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
              placeholder={t("knowledge.sourceNamePlaceholder")}
              className="h-10 w-full rounded-lg border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] px-3 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30"
              disabled={saving}
            />
          </div>
          {(newSourceType === "google_drive_folder" || newSourceType === "google_drive_file") && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--rb-text-secondary))]">{t("knowledge.driveAccount")}</label>
              <select
                value={newIntegrationId}
                onChange={(e) => setNewIntegrationId(e.target.value)}
                className="h-10 w-full rounded-lg border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] px-3 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30"
                disabled={saving}
              >
                <option value="">{t("knowledge.selectAccount")}</option>
                {integrations.map((int) => (
                  <option key={int.id} value={int.id}>
                    {int.account_email || int.display_name || int.id}
                  </option>
                ))}
              </select>
              {!hasGoogleIntegration && (
                <p className="mt-1 text-xs text-[rgb(var(--rb-text-muted))]">{t("knowledge.connectDriveAbove")}</p>
              )}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--rb-text-secondary))]">{t("knowledge.url")}</label>
            <input
              type="text"
              value={newSourceUrl}
              onChange={(e) => setNewSourceUrl(e.target.value)}
              placeholder="https://..."
              className="h-10 w-full rounded-lg border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] px-3 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30"
              disabled={saving}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--rb-text-secondary))]">{t("knowledge.externalRef")}</label>
            <input
              type="text"
              value={newExternalRef}
              onChange={(e) => setNewExternalRef(e.target.value)}
              placeholder={t("knowledge.optional")}
              className="h-10 w-full rounded-lg border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] px-3 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30"
              disabled={saving}
            />
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-[rgb(var(--rb-surface-border))]/40 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={!newSourceName.trim() || saving}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[rgb(var(--rb-brand-primary))] px-4 text-sm font-medium text-white shadow-sm hover:bg-[rgb(var(--rb-brand-primary-hover))] disabled:opacity-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35"
          >
            {saving ? t("knowledge.creating") : t("knowledge.createGlobalSource")}
          </button>
          {createError && <p className="text-sm text-red-700">{createError}</p>}
        </div>
      </form>
      </div>

      <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/55 bg-[rgb(var(--rb-surface))] p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-col gap-4 border-b border-[rgb(var(--rb-surface-border))]/45 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h3 className="text-sm font-semibold tracking-tight text-[rgb(var(--rb-text-primary))]">
              {t("knowledge.sourcesRegistryTitle")}
            </h3>
            <p className="text-sm text-[rgb(var(--rb-text-muted))]">{t("knowledge.sourcesRegistryHint")}</p>
          </div>
          <div className="inline-flex shrink-0 gap-0.5 rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/18 p-1 text-xs shadow-inner">
            {(["global", "project", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScopeFilter(s)}
                className={`rounded-lg px-3 py-1.5 font-semibold transition-all duration-150 ${
                  scopeFilter === s
                    ? "bg-[rgb(var(--rb-surface))] text-[rgb(var(--rb-text-primary))] shadow-sm ring-2 ring-[rgb(var(--rb-brand-primary))]/25"
                    : "text-[rgb(var(--rb-text-muted))] hover:bg-[rgb(var(--rb-surface))]/90 hover:text-[rgb(var(--rb-text-primary))]"
                }`}
              >
                {s === "global" ? t("knowledge.scope.global") : s === "project" ? t("knowledge.scope.project") : t("knowledge.scope.all")}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-[rgb(var(--rb-text-muted))]">{t("knowledge.loadingSources")}</p>
        ) : sources.length === 0 ? (
          <p className="text-sm text-[rgb(var(--rb-text-muted))]">
            {scopeFilter === "global" && t("knowledge.emptyGlobal")}
            {scopeFilter === "project" && "No project sources listed here."}
            {scopeFilter === "all" && "No knowledge sources. Add a global or project source to get started."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[rgb(var(--rb-surface-border))]/55 bg-[rgb(var(--rb-surface-3))]/8 shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--rb-surface-border))]/50 bg-[rgb(var(--rb-surface-3))]/14 text-left text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">
                  <th className="py-3.5 px-4">{t("knowledge.table.name")}</th>
                  <th className="py-3.5 px-4">{t("knowledge.table.type")}</th>
                  <th className="py-3.5 px-4">Scope</th>
                  <th className="py-3.5 px-4">{t("knowledge.table.project")}</th>
                  <th className="py-3.5 px-4">Sync status</th>
                  <th className="py-3.5 px-4">{t("knowledge.table.lastSync")}</th>
                  <th className="py-3.5 px-4 text-right">{t("knowledge.table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => {
                  const syncStatus = getSyncStatus(s, syncingSourceId);
                  return (
                  <tr
                    key={s.id}
                    className="border-b border-[rgb(var(--rb-surface-border))]/30 transition-colors duration-150 last:border-b-0 hover:bg-[rgb(var(--rb-brand-primary))]/[0.045]"
                  >
                    <td className="py-3.5 px-4 text-[rgb(var(--rb-text-primary))] font-medium">{s.source_name}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex rounded-md bg-[rgb(var(--rb-surface-3))]/30 px-2 py-0.5 text-xs text-[rgb(var(--rb-text-secondary))] border border-[rgb(var(--rb-surface-border))]/55">
                        {GLOBAL_SOURCE_TYPE_LABELS[s.source_type] ?? s.source_type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex rounded-md bg-[rgb(var(--rb-brand-primary))]/10 px-2 py-0.5 text-xs text-[rgb(var(--rb-brand-primary))] border border-[rgb(var(--rb-brand-primary))]/25">
                        {s.scope_type === "global" ? t("knowledge.scope.global") : t("knowledge.scope.project")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[rgb(var(--rb-text-muted))]">
                      {s.scope_type === "project" && (s.project_name ?? s.project_id ?? "—")}
                      {s.scope_type === "global" && "—"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium w-fit ${
                            syncStatus === "syncing"
                              ? "border border-amber-200/80 bg-amber-500/10 text-amber-900"
                              : syncStatus === "error"
                                ? "border border-red-200/80 bg-red-500/10 text-red-800"
                                : syncStatus === "synced"
                                  ? "bg-emerald-500/10 text-emerald-800 border border-emerald-200/80"
                                  : "bg-[rgb(var(--rb-surface-3))]/30 text-[rgb(var(--rb-text-muted))] border border-[rgb(var(--rb-surface-border))]/55"
                          }`}
                        >
                          {SYNC_STATUS_LABELS[syncStatus]}
                        </span>
                        {isCuratedSapSource(s) && getSyncDetailLine(s) && (
                          <span className="text-xs text-[rgb(var(--rb-text-muted))] max-w-[220px] truncate" title={s.last_sync_error ?? undefined}>
                            {getSyncDetailLine(s)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[rgb(var(--rb-text-muted))] text-xs">
                      {s.last_synced_at ? formatSyncDate(s.last_synced_at) : "—"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isDriveSource(s) || isCuratedSapSource(s) ? (
                          <button
                            type="button"
                            onClick={() => handleSync(s.id)}
                            disabled={syncingSourceId !== null || !canSyncSource(s) || !canManageKnowledgeSources}
                            title={!canSyncSource(s) ? (isCuratedSapSource(s) ? t("knowledge.syncHintSap") : t("knowledge.syncHintDrive")) : t("knowledge.syncNow")}
                            className="text-xs font-medium text-[rgb(var(--rb-brand-primary))] hover:text-[rgb(var(--rb-brand-primary-hover))] disabled:opacity-50 transition-colors duration-150"
                          >
                            {syncingSourceId === s.id ? t("knowledge.syncing") : t("knowledge.syncNow")}
                          </button>
                        ) : (
                          <span className="text-xs text-[rgb(var(--rb-text-muted))]" title={t("knowledge.syncOnlyHint")}>
                            —
                          </span>
                        )}
                        {s.scope_type === "global" && canManageKnowledgeSources && (
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id)}
                            disabled={deletingId !== null}
                            className="text-xs font-medium text-rose-700 hover:text-rose-800 disabled:opacity-50 transition-colors duration-150"
                          >
                            {deletingId === s.id ? t("knowledge.deleting") : t("knowledge.delete")}
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
      setError("Connection error.");
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
      setFormError("Connection error.");
    } finally {
      setSaving(false);
    }
  };

  const field = (key: string, label: string, placeholder = "") => (
    <div key={key} className="space-y-1">
      <label className="block text-xs text-[rgb(var(--rb-text-muted))]">{label}</label>
      <input
        type="text"
        value={(form[key] as string) ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full rounded-md border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30"
        disabled={saving}
      />
    </div>
  );

  return (
    <section className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] p-5 sm:p-6 space-y-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[rgb(var(--rb-text-primary))]">Clientes</h2>
          <p className="text-xs text-[rgb(var(--rb-text-muted))]">Crear y editar clientes para proyectos, reporting y contexto SAP.</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <form onSubmit={handleSubmit} className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/15 p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[rgb(var(--rb-text-muted))] uppercase tracking-wide">
            {editingId ? "Editar cliente" : "Nuevo cliente"}
          </span>
          {editingId && (
            <button
              type="button"
              onClick={() => { setEditingId(null); setForm(EMPTY_CLIENT_FORM as Record<string, string | boolean>); }}
              className="text-xs text-[rgb(var(--rb-brand-primary))] hover:text-[rgb(var(--rb-brand-primary-hover))] transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[rgb(var(--rb-text-muted))]">Identidad</p>
            {field("name", "Name (required)", "Name or company name")}
            {field("display_name", "Nombre para mostrar", "Ej. Acme")}
            {field("legal_name", "Legal name")}
            {field("tax_id", "CIF / NIF")}
            {field("website", "Web")}
            {field("linkedin_url", "LinkedIn")}
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium text-[rgb(var(--rb-text-muted))]">Segmentación</p>
            <div className="space-y-1">
              <label className="block text-xs text-[rgb(var(--rb-text-muted))]">Industria</label>
              <select value={(form.industry as string) ?? ""} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} className="w-full rounded-md border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30" disabled={saving}>
                {INDUSTRY_OPTIONS.map((o) => <option key={o.value || "_"} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {field("subindustry", "Subindustria")}
            <div className="space-y-1">
              <label className="block text-xs text-[rgb(var(--rb-text-muted))]">Tamaño empresa</label>
              <select value={(form.company_size_bucket as string) ?? ""} onChange={(e) => setForm((f) => ({ ...f, company_size_bucket: e.target.value }))} className="w-full rounded-md border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30" disabled={saving}>
                {COMPANY_SIZE_OPTIONS.map((o) => <option key={o.value || "_"} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {field("employee_range", "Rango empleados")}
            {field("annual_revenue_range", "Revenue range")}
            <p className="text-xs font-medium text-[rgb(var(--rb-text-muted))] mt-3">Estructura</p>
            <div className="space-y-1">
              <label className="block text-xs text-[rgb(var(--rb-text-muted))]">Cliente padre</label>
              <select
                value={(form.parent_client_id as string) ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, parent_client_id: e.target.value }))}
                className="w-full rounded-md border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30"
                disabled={saving}
              >
                <option value="">Ninguno</option>
                {clients.filter((c) => c.id !== editingId).map((c) => (
                  <option key={c.id} value={c.id}>{c.display_name || c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-[rgb(var(--rb-text-muted))]">País</label>
              <select
                value={resolveCountryOptionValue(form.country as string)}
                onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, country: v, region: "" })); }}
                className="w-full rounded-md border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30"
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
              <label className="block text-xs text-[rgb(var(--rb-text-muted))]">Región / Estado</label>
              <select
                value={resolveStateOptionValue(form.country as string, form.region as string)}
                onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                className="w-full rounded-md border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30"
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
              <label className="block text-xs text-[rgb(var(--rb-text-muted))]">Tier</label>
              <select value={(form.account_tier as string) ?? ""} onChange={(e) => setForm((f) => ({ ...f, account_tier: e.target.value }))} className="w-full rounded-md border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30" disabled={saving}>
                {ACCOUNT_TIER_OPTIONS.map((o) => <option key={o.value || "_"} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-[rgb(var(--rb-text-muted))]">Tipo propiedad</label>
              <select value={(form.ownership_type as string) ?? ""} onChange={(e) => setForm((f) => ({ ...f, ownership_type: e.target.value }))} className="w-full rounded-md border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30" disabled={saving}>
                {OWNERSHIP_TYPE_OPTIONS.map((o) => <option key={o.value || "_"} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-[rgb(var(--rb-text-muted))]">Modelo negocio</label>
              <select value={(form.business_model as string) ?? ""} onChange={(e) => setForm((f) => ({ ...f, business_model: e.target.value }))} className="w-full rounded-md border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30" disabled={saving}>
                {BUSINESS_MODEL_OPTIONS.map((o) => <option key={o.value || "_"} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {field("main_products_services", "Productos / servicios principales")}
            {field("main_products_services", "Productos / servicios principales")}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium text-[rgb(var(--rb-text-muted))]">Contexto SAP</p>
          <textarea
            value={(form.sap_relevance_summary as string) ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, sap_relevance_summary: e.target.value }))}
            placeholder="Resumen de relevancia SAP, sistemas, roadmap…"
            rows={2}
            className="w-full rounded-md border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30"
            disabled={saving}
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium text-[rgb(var(--rb-text-muted))]">Notas estratégicas</p>
          <textarea
            value={(form.known_pain_points as string) ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, known_pain_points: e.target.value }))}
            placeholder="Pain points conocidos"
            rows={1}
            className="w-full rounded-md border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30"
            disabled={saving}
          />
          <textarea
            value={(form.strategic_notes as string) ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, strategic_notes: e.target.value }))}
            placeholder="Internal strategic notes"
            rows={2}
            className="w-full rounded-md border border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30"
            disabled={saving}
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-[rgb(var(--rb-text-secondary))]">
            <input
              type="checkbox"
              checked={form.is_active === true}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              disabled={saving}
              className="rounded border-[rgb(var(--rb-surface-border))]/65 bg-[rgb(var(--rb-surface-3))]/20 text-[rgb(var(--rb-brand-primary))] focus:ring-[rgb(var(--rb-brand-primary))]/30"
            />
            Activo
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[rgb(var(--rb-brand-primary))] px-3 py-2 text-sm font-medium text-white hover:bg-[rgb(var(--rb-brand-primary-hover))] disabled:opacity-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35"
          >
            {saving ? "Saving…" : editingId ? "Save changes" : "Create client"}
          </button>
        </div>
        {formError && <p className="text-sm text-red-700">{formError}</p>}
      </form>

      <div>
        <p className="text-xs font-medium text-[rgb(var(--rb-text-muted))] uppercase tracking-wide mb-2">Listado de clientes</p>
        {loading ? (
          <p className="text-sm text-[rgb(var(--rb-text-muted))]">Cargando clientes…</p>
        ) : clients.length === 0 ? (
          <p className="text-sm text-[rgb(var(--rb-text-muted))]">Aún no hay clientes. Crea uno arriba.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/18 text-left text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">
                  <th className="py-3 px-4">Nombre</th>
                  <th className="py-3 px-4">País</th>
                  <th className="py-3 px-4">Industria</th>
                  <th className="py-3 px-4">Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--rb-surface-border))]/45">
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setEditingId(c.id)}
                    className="hover:bg-[rgb(var(--rb-surface-3))]/25 transition-colors duration-150 cursor-pointer"
                  >
                    <td className="py-3 px-4 text-[rgb(var(--rb-text-primary))] font-medium">{c.display_name || c.name}</td>
                    <td className="py-3 px-4 text-[rgb(var(--rb-text-muted))]">{getCountryDisplayName(c.country) || "—"}</td>
                    <td className="py-3 px-4 text-[rgb(var(--rb-text-muted))]">{c.industry ?? "—"}</td>
                    <td className="py-3 px-4 text-[rgb(var(--rb-text-muted))]">{c.account_tier ?? "—"}</td>
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
            className="mt-2 text-sm text-[rgb(var(--rb-brand-primary))] hover:text-[rgb(var(--rb-brand-primary-hover))] transition-colors duration-150"
          >
            + Nuevo cliente
          </button>
        )}
      </div>
    </section>
  );
}
