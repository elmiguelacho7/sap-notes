"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, CheckCircle, ShieldCheck, Shield, User, Eye, Crown, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { AppPageShell } from "@/components/ui/layout/AppPageShell";
import { FORM_PAGE_BLOCK_CLASS, FORM_PAGE_SHELL_CLASS } from "@/components/layout/formPageClasses";

type RoleWithPermissions = {
  id: string;
  scope: string;
  key: string;
  name: string;
  is_active: boolean;
  permissions: { id: string; key: string; name: string }[];
};

/** Short descriptions for role cards (informational only). */
const ROLE_DESCRIPTIONS: Record<string, string> = {
  superadmin: "Full access to platform configuration and administration.",
  admin: "Manages users, projects, and clients but cannot change core system configuration.",
  consultant: "Standard user working on assigned projects.",
  viewer: "Read-only access.",
  owner: "Full control of the project, including members and content.",
  editor: "Can edit project content but cannot manage everything.",
};

/** Overrides for project-scoped roles when description differs from platform. */
const PROJECT_ROLE_DESCRIPTIONS: Record<string, string> = {
  viewer: "Read-only access inside the project.",
};

const MAX_PERMISSIONS_IN_CARD = 6;

/** Icon component per role key (visual only). */
const ROLE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  superadmin: ShieldCheck,
  admin: Shield,
  consultant: User,
  viewer: Eye,
  owner: Crown,
  editor: Pencil,
};

async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function RoleCard({
  role,
  variant,
  userCount,
}: {
  role: RoleWithPermissions;
  variant: "platform" | "project";
  userCount?: number | null;
}) {
  const t = useTranslations("admin.roles");
  const description =
    variant === "project" && PROJECT_ROLE_DESCRIPTIONS[role.key]
      ? PROJECT_ROLE_DESCRIPTIONS[role.key]
      : ROLE_DESCRIPTIONS[role.key] ?? role.name;
  const displayPerms = role.permissions.slice(0, MAX_PERMISSIONS_IN_CARD);
  const Icon = ROLE_ICONS[role.key] ?? User;
  const scopeName = variant === "platform" ? t("scopePlatform") : t("scopeProject");
  const badgeLabel = variant === "platform" ? t("typePlatform") : t("typeProject");

  return (
    <div className="group rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] p-5 shadow-sm ring-1 ring-[rgb(var(--rb-surface-border))]/20 transition-[box-shadow,border-color] duration-200 hover:border-[rgb(var(--rb-surface-border))]/80 hover:shadow-md min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--rb-brand-primary))]/20 bg-[rgb(var(--rb-brand-primary))]/8 text-[rgb(var(--rb-brand-primary))]">
            <Icon className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-[rgb(var(--rb-text-primary))] truncate">
              {role.name}
            </h3>
            <span className="mt-1 inline-flex rounded-full border border-[rgb(var(--rb-brand-primary))]/22 bg-[rgb(var(--rb-brand-primary))]/8 px-2.5 py-0.5 text-[11px] font-medium text-[rgb(var(--rb-brand-primary))]">
              {badgeLabel}
            </span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[rgb(var(--rb-text-muted))]">{description}</p>
      {displayPerms.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-[rgb(var(--rb-surface-border))]/45 pt-4" aria-label={`Permissions for ${role.name}`}>
          {displayPerms.map((p) => (
            <li key={p.id} className="flex items-start gap-2.5 text-sm text-[rgb(var(--rb-text-secondary))] min-w-0">
              <CheckCircle className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              <span className="min-w-0 break-words leading-snug">{p.name}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 space-y-1 border-t border-[rgb(var(--rb-surface-border))]/45 pt-4">
        {userCount != null && (
          <p className="text-xs text-[rgb(var(--rb-text-muted))]">{t("userCount", { count: userCount })}</p>
        )}
        <p className="text-xs text-[rgb(var(--rb-text-muted))]">{t("scopeLabel", { scope: scopeName })}</p>
        <button
          type="button"
          className="text-xs font-medium text-[rgb(var(--rb-brand-primary))] transition-colors duration-150 hover:text-[rgb(var(--rb-brand-primary-hover))]"
        >
          {t("editRole")}
        </button>
      </div>
    </div>
  );
}

export default function AdminRolesPage() {
  const t = useTranslations("admin.roles");
  const [loading, setLoading] = useState(true);
  const [appRole, setAppRole] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [matrixError, setMatrixError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled || !user) {
          setAppRole(null);
          setLoading(false);
          return;
        }
        const { data: profile } = await supabase.from("profiles").select("app_role").eq("id", user.id).single();
        if (cancelled) return;
        setAppRole((profile as { app_role?: string } | null)?.app_role ?? null);
      } catch {
        if (!cancelled) setAppRole(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading || appRole === null) return;
    let cancelled = false;
    setMatrixError(null);

    async function loadMatrix() {
      try {
        const headers = await getAdminAuthHeaders();
        const res = await fetch("/api/admin/roles", { headers });
        if (cancelled) return;
        if (!res.ok) {
          setMatrixError(res.status === 403 ? t("errors.noPermission") : t("errors.loadMatrix"));
          return;
        }
        const data = (await res.json()) as { roles?: RoleWithPermissions[] };
        if (cancelled) return;
        setRoles(Array.isArray(data.roles) ? data.roles : []);
      } catch {
        if (!cancelled) setMatrixError(t("errors.loadMatrix"));
      }
    }

    void loadMatrix();
    return () => {
      cancelled = true;
    };
  }, [loading, appRole, t]);

  if (loading) {
    return (
      <AppPageShell>
        <div className={FORM_PAGE_SHELL_CLASS}>
          <div className={`${FORM_PAGE_BLOCK_CLASS} py-12 text-center`}>
            <p className="text-sm font-medium text-[rgb(var(--rb-text-primary))]">{t("loading")}</p>
          </div>
        </div>
      </AppPageShell>
    );
  }

  if (appRole === null) {
    return (
      <AppPageShell>
        <div className={FORM_PAGE_SHELL_CLASS}>
          <div
            className={`${FORM_PAGE_BLOCK_CLASS} rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] px-5 py-12 text-center shadow-sm`}
          >
            <p className="text-sm font-medium text-[rgb(var(--rb-text-primary))]">{t("restricted")}</p>
            <p className="mt-1 text-sm text-[rgb(var(--rb-text-muted))]">{t("signInRequired")}</p>
          </div>
        </div>
      </AppPageShell>
    );
  }

  const platformRoles = roles.filter((r) => r.scope === "app");
  const projectRoles = roles.filter((r) => r.scope === "project");

  return (
    <AppPageShell>
      <div className={FORM_PAGE_SHELL_CLASS}>
        <div className={`${FORM_PAGE_BLOCK_CLASS} space-y-8`}>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[rgb(var(--rb-text-muted))] transition-colors hover:text-[rgb(var(--rb-brand-primary))]"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
            {t("backToAdmin")}
          </Link>

          <header className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--rb-text-primary))]">{t("title")}</h1>
            <p className="max-w-3xl text-sm leading-relaxed text-[rgb(var(--rb-text-muted))]">{t("subtitle")}</p>
          </header>

          {matrixError && (
            <div className="rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-900">{matrixError}</div>
          )}

          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold tracking-tight text-[rgb(var(--rb-text-primary))]">
                {t("platformSectionTitle")}
              </h2>
              <p className="text-sm text-[rgb(var(--rb-text-muted))]">{t("platformSectionHint")}</p>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {platformRoles.length === 0 && !matrixError && (
                <p className="col-span-full text-sm text-[rgb(var(--rb-text-muted))]">{t("loadingRoles")}</p>
              )}
              {platformRoles.map((role) => (
                <RoleCard key={role.id} role={role} variant="platform" />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold tracking-tight text-[rgb(var(--rb-text-primary))]">
                {t("projectSectionTitle")}
              </h2>
              <p className="text-sm text-[rgb(var(--rb-text-muted))]">{t("projectSectionHint")}</p>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {projectRoles.length === 0 && !matrixError && (
                <p className="col-span-full text-sm text-[rgb(var(--rb-text-muted))]">{t("loadingRoles")}</p>
              )}
              {projectRoles.map((role) => (
                <RoleCard key={role.id} role={role} variant="project" />
              ))}
            </div>
          </section>

          <p className="text-xs leading-relaxed text-[rgb(var(--rb-text-muted))]">{t("footer")}</p>
        </div>
      </div>
    </AppPageShell>
  );
}
