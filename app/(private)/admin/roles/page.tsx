"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";

type RoleWithPermissions = {
  id: string;
  scope: string;
  key: string;
  name: string;
  is_active: boolean;
  permissions: { id: string; key: string; name: string }[];
};

/** Fallback descriptions when API data is used for permissions; role names come from API. */
const ROLE_DESCRIPTIONS: Record<string, string> = {
  superadmin:
    "Acceso total a la plataforma: usuarios, activaciones, roles globales, Knowledge Sources y configuración.",
  admin:
    "Gestión operativa (clientes, proyectos, fuentes de conocimiento, notas y métricas). Sin gestión de usuarios ni activaciones.",
  consultant:
    "Usuario estándar. Acceso a proyectos en los que esté asignado. Puede crear proyectos si está habilitado en la matriz.",
  viewer: "Solo panel principal. Sin acceso al panel de administración ni a proyectos salvo asignación.",
  owner: "Control total del proyecto: configuración, contenido y miembros.",
  editor: "Editar tareas, notas, actividades, tickets y conocimiento. No gestionar miembros.",
};

async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
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
      <PageShell wide={false}>
        <div className="py-12 text-center">
          <p className="text-sm text-slate-500">Cargando...</p>
        </div>
      </PageShell>
    );
  }

  if (appRole === null) {
    return (
      <PageShell wide={false}>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-700">Acceso restringido</p>
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
    <PageShell wide={false}>
      <div className="space-y-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-indigo-600"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver al panel de administración
        </Link>

        <PageHeader
          title="Roles y permisos"
          description="Matriz de permisos por rol. Los roles de plataforma se asignan en el perfil; los de proyecto, en cada proyecto."
        />

        {matrixError && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            {matrixError}
          </p>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Roles de plataforma
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Se asignan a cada usuario a nivel global (perfil). Definen qué puede
              hacer en la aplicación fuera de un proyecto concreto.
            </p>
          </div>
          <div className="p-5">
            <ul className="space-y-5">
              {platformRoles.length === 0 && !matrixError && (
                <li className="text-sm text-slate-500">
                  Cargando roles…
                </li>
              )}
              {platformRoles.map((role) => (
                <li key={role.id} className="flex flex-col gap-1">
                  <span className="font-medium text-slate-900">{role.name}</span>
                  <p className="text-sm text-slate-600">
                    {ROLE_DESCRIPTIONS[role.key] ?? role.name}
                  </p>
                  {role.permissions.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Permisos de ${role.name}`}>
                      {role.permissions.map((p) => (
                        <li
                          key={p.id}
                          className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                        >
                          {p.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Roles de proyecto
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Se asignan por proyecto a cada miembro. La gestión de miembros se
              hace en el contexto del proyecto.
            </p>
          </div>
          <div className="p-5">
            <ul className="space-y-5">
              {projectRoles.length === 0 && !matrixError && (
                <li className="text-sm text-slate-500">
                  Cargando roles…
                </li>
              )}
              {projectRoles.map((role) => (
                <li key={role.id} className="flex flex-col gap-1">
                  <span className="font-medium text-slate-900">{role.name}</span>
                  <p className="text-sm text-slate-600">
                    {ROLE_DESCRIPTIONS[role.key] ?? role.name}
                  </p>
                  {role.permissions.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Permisos de ${role.name}`}>
                      {role.permissions.map((p) => (
                        <li
                          key={p.id}
                          className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                        >
                          {p.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
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
