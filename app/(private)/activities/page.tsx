"use client";

import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";

export default function GlobalActivitiesPage() {
  return (
    <PageShell>
      <div className="space-y-8">
      <PageHeader
        title="Actividades"
        description="Las actividades se gestionan en el contexto de cada proyecto. Abre un proyecto y usa la pestaña Planificación → Actividades para ver y crear actividades."
      />
      <section>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">Actividades por proyecto</p>
          <p className="mt-1 text-sm text-slate-500">
            Selecciona un proyecto desde la lista de proyectos y entra en su workspace para gestionar actividades y fases.
          </p>
          <Link
            href="/projects"
            className="mt-4 inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Ir a Proyectos
          </Link>
        </div>
      </section>
      </div>
    </PageShell>
  );
}
