"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, CheckCircle, ShieldCheck, Shield, User, Eye, Crown, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { PageShell } from "@/components/layout/PageShell";

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
  superadmin:
    "Full access to platform configuration and administration.",
  admin:
    "Manages users, projects, and clients but cannot change core system configuration.",
  consultant:
    "Standard user working on assigned projects.",
  viewer:
    "Read-only access.",
  owner:
    "Full control of the project, including members and content.",
  editor:
    "Can edit project content but cannot manage everything.",
};

/** Overrides for project-scoped roles when description differs from platform. */
const PROJECT_ROLE_DESCRIPTIONS: Record<string, string> = {
  viewer: "Read-only access inside the project.",
};

const MAX_PERMISSIONS_IN_CARD = 6;

/** Icon component per role key (visual only). */
const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
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
  typeLabel,
  userCount,
}: {
  role: RoleWithPermissions;
  typeLabel: "Platform role" | "Project role";
  userCount?: number | null;
}) {
  const description =
    typeLabel === "Project role" && PROJECT_ROLE_DESCRIPTIONS[role.key]
      ? PROJECT_ROLE_DESCRIPTIONS[role.key]
      : ROLE_DESCRIPTIONS[role.key] ?? role.name;
  const displayPerms = role.permissions.slice(0, MAX_PERMISSIONS_IN_CARD);
  const Icon = ROLE_ICONS[role.key] ?? User;
  const scopeLabel = typeLabel === "Platform role" ? "Platform" : "Project";

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5 space-y-3 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center min-w-0 flex-1">
          <Icon className="size-4 shrink-0 text-slate-400 mr-2" aria-hidden />
          <h3 className="text-sm font-semibold text-slate-100 truncate">{role.name}</h3>
        </div>
        <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2 py-0.5 rounded-md shrink-0">
          {typeLabel}
        </span>
      </div>
      <p className="text-xs text-slate-500">{description}</p>
      {displayPerms.length > 0 && (
        <ul className="space-y-1.5" aria-label={`Permisos de ${role.name}`}>
          {displayPerms.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-sm text-slate-300 min-w-0">
              <CheckCircle className="size-4 shrink-0 text-emerald-400" aria-hidden />
              <span className="min-w-0 break-words">{p.name}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="pt-1 space-y-0.5">
        {userCount != null && (
          <p className="text-xs text-slate-500">Users with this role: {userCount}</p>
        )}
        <p className="text-xs text-slate-500">Scope: {scopeLabel}</p>
        <button
          type="button"
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors duration-150"
        >
          Edit role
        </button>
      </div>
    </div>
  );
}

export default function AdminRolesPage() {
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
          setMatrixError(res.status === 403 ? "No tiene permiso para ver esta página." : "No se pudo cargar la matriz de permisos.");
          return;
        }
        const data = (await res.json()) as { roles?: RoleWithPermissions[] };
        if (cancelled) return;
        setRoles(Array.isArray(data.roles) ? data.roles : []);
      } catch {
        if (!cancelled) setMatrixError("Error al cargar la matriz de permisos.");
      }
    }

    void loadMatrix();
    return () => {
      cancelled = true;
    };
  }, [loading, appRole]);

  if (loading) {
    return (
      <PageShell wide={false} className="bg-slate-950">
        <div className="py-12 text-center">
          <p className="text-sm text-slate-500">Cargando...</p>
        </div>
      </PageShell>
    );
  }

  if (appRole === null) {
    return (
      <PageShell wide={false} className="bg-slate-950">
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-5 py-12 text-center">
          <p className="text-sm font-medium text-slate-200">Acceso restringido</p>
          <p className="mt-1 text-sm text-slate-500">
            Debes iniciar sesión para ver esta página.
          </p>
        </div>
      </PageShell>
    );
  }

  const platformRoles = roles.filter((r) => r.scope === "app");
  const projectRoles = roles.filter((r) => r.scope === "project");

  return (
    <PageShell wide={false} className="bg-slate-950">
      <div className="space-y-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver al panel de administración
        </Link>

        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-100">
            Roles y permisos
          </h1>
          <p className="text-sm text-slate-500">
            Matriz de permisos por rol. Los roles de plataforma se asignan en el perfil; los de proyecto, en cada proyecto.
          </p>
        </div>

        {matrixError && (
          <div className="rounded-xl border border-amber-800/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-200">
            {matrixError}
          </div>
        )}

        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-slate-200">
              Platform Roles
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Roles that define what a user can do across the whole platform.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {platformRoles.length === 0 && !matrixError && (
              <p className="text-sm text-slate-500 col-span-full">Cargando roles…</p>
            )}
            {platformRoles.map((role) => (
              <RoleCard key={role.id} role={role} typeLabel="Platform role" />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-slate-200">
              Project Roles
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Roles assigned inside each project to control project-specific access.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projectRoles.length === 0 && !matrixError && (
              <p className="text-sm text-slate-500 col-span-full">Cargando roles…</p>
            )}
            {projectRoles.map((role) => (
              <RoleCard key={role.id} role={role} typeLabel="Project role" />
            ))}
          </div>
        </section>

        <p className="text-xs text-slate-500">
          La aplicación utiliza esta matriz para el control de acceso. Los
          permisos se leen desde la base de datos (roles, permissions,
          role_permissions).
        </p>
      </div>
    </PageShell>
  );
}
