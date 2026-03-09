"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";

const PLATFORM_ROLES: { key: string; name: string; description: string }[] = [
  {
    key: "superadmin",
    name: "Superadministrador",
    description: "Acceso total a la plataforma: usuarios, activaciones, roles globales, Knowledge Sources y configuración. Solo este rol puede activar usuarios y acceder al panel de administración.",
  },
  {
    key: "admin",
    name: "Administrador",
    description: "Gestión operativa (por ejemplo clientes) y visualización de proyectos. No puede gestionar usuarios ni activaciones ni roles globales.",
  },
  {
    key: "consultant",
    name: "Consultor",
    description: "Usuario estándar de la plataforma. Acceso a proyectos en los que esté asignado, sin permisos de administración global.",
  },
];

const PROJECT_ROLES: { key: string; name: string; description: string }[] = [
  {
    key: "owner",
    name: "Propietario",
    description: "Control total del proyecto: editar configuración, contenido y gestionar miembros del equipo.",
  },
  {
    key: "editor",
    name: "Editor",
    description: "Puede editar tareas, notas y contenido del proyecto. No puede gestionar miembros ni configuración del proyecto.",
  },
  {
    key: "viewer",
    name: "Lector",
    description: "Solo lectura dentro del proyecto. Puede ver tareas, notas y documentación sin poder editarlos.",
  },
];

export default function AdminRolesPage() {
  const [loading, setLoading] = useState(true);
  const [appRole, setAppRole] = useState<string | null>(null);

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
      } catch {
        if (!cancelled) setAppRole(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void init();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <PageShell wide={false}>
        <div className="py-12 text-center">
          <p className="text-sm text-slate-500">Cargando...</p>
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
            Solo los superadministradores pueden ver esta página.
          </p>
        </div>
      </PageShell>
    );
  }

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
          description="Separación clara entre roles de plataforma (globales) y roles de proyecto. La aplicación usa estos conceptos para el control de acceso."
        />

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/50">
            <h2 className="text-sm font-semibold text-slate-900">Roles de plataforma</h2>
            <p className="text-xs text-slate-500 mt-1">
              Se asignan a cada usuario a nivel global (perfil). Definen qué puede hacer en la aplicación fuera de un proyecto concreto.
            </p>
          </div>
          <div className="p-5">
            <ul className="space-y-4">
              {PLATFORM_ROLES.map((role) => (
                <li key={role.key} className="flex flex-col gap-1">
                  <span className="font-medium text-slate-900">{role.name}</span>
                  <p className="text-sm text-slate-600">{role.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/50">
            <h2 className="text-sm font-semibold text-slate-900">Roles de proyecto</h2>
            <p className="text-xs text-slate-500 mt-1">
              Se asignan por proyecto a cada miembro del equipo. La gestión de miembros se hace en el contexto del proyecto (no desde Admin).
            </p>
          </div>
          <div className="p-5">
            <ul className="space-y-4">
              {PROJECT_ROLES.map((role) => (
                <li key={role.key} className="flex flex-col gap-1">
                  <span className="font-medium text-slate-900">{role.name}</span>
                  <p className="text-sm text-slate-600">{role.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <p className="text-xs text-slate-500">
          La aplicación utiliza actualmente el rol global (app_role) y el rol en proyecto para el control de acceso. No se muestra una matriz editable de permisos hasta que el backend la aplique de forma consistente.
        </p>
      </div>
    </PageShell>
  );
}
