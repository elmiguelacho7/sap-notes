"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type DashboardProject = {
  id: string;
  name: string;
  description: string | null;
  environment_type: string | null;
  sap_version: string | null;
  status: string | null;
  start_date: string | null;
  client_id: string | null;
  client_name: string | null;
  created_at: string | null;
  notes_count: number;
  module_notes_count: number;
  files_count: number;
  scope_items_count: number;
};

export default function ProjectsDashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMsg(null);

      const {
        data,
        error,
      } = await supabase.from("project_dashboard").select("*").order("created_at", {
        ascending: false,
      });

      if (error) {
        console.error("project_dashboard select error", error);
        setErrorMsg("No se pudieron cargar los proyectos.");
      } else if (data) {
        setProjects(data as DashboardProject[]);
      }

      setLoading(false);
    };

    load();
  }, []);

  const formatDate = (value: string | null) => {
    if (!value) return "Sin fecha";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString();
  };

  const formatStatus = (status: string | null) => {
    if (!status) return "Sin estado";
    switch (status) {
      case "planned":
        return "Planificado";
      case "in_progress":
        return "En progreso";
      case "on_hold":
        return "En espera";
      case "closed":
        return "Cerrado";
      default:
        return status;
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-400">
              SAP Notes Hub
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-50">
              Proyectos y documentación
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Vista general de tus proyectos SAP y sus notas asociadas.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => router.push("/projects/new")}
              className="inline-flex items-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 hover:bg-sky-600"
            >
              + Nuevo proyecto
            </button>
            <button
              type="button"
              onClick={() => router.push("/notes")}
              className="text-[11px] text-slate-400 underline underline-offset-4 hover:text-slate-200"
            >
              Ir al panel de notas →
            </button>
          </div>
        </header>

        {/* Estado de carga / error */}
        {loading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-8 text-center text-sm text-slate-400">
            Cargando proyectos…
          </div>
        )}

        {!loading && errorMsg && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {errorMsg}
          </div>
        )}

        {/* Lista de proyectos */}
        {!loading && !errorMsg && (
          <>
            {projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/60 px-6 py-10 text-center">
                <p className="text-sm text-slate-300">
                  Aún no tienes proyectos creados.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Crea tu primer proyecto para empezar a registrar notas,
                  decisiones y configuraciones.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/projects/new")}
                  className="mt-5 inline-flex items-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 hover:bg-sky-600"
                >
                  + Crear proyecto
                </button>
              </div>
            ) : (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-200">
                    Tus proyectos ({projects.length})
                  </h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => router.push(`/projects/${p.id}`)}
                      className="group flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left shadow-sm transition hover:border-sky-500/60 hover:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-50 group-hover:text-sky-100">
                            {p.name}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                            {p.description || "Sin descripción"}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] text-slate-300">
                          {formatStatus(p.status)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        {p.client_name && (
                          <span className="rounded-full bg-slate-800/80 px-2 py-1">
                            Cliente: {p.client_name}
                          </span>
                        )}
                        {p.environment_type && (
                          <span className="rounded-full bg-slate-800/80 px-2 py-1">
                            Entorno: {p.environment_type}
                          </span>
                        )}
                        {p.sap_version && (
                          <span className="rounded-full bg-slate-800/80 px-2 py-1">
                            Versión SAP: {p.sap_version}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                        <div className="rounded-xl bg-slate-900/80 px-2 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">
                            Notas
                          </p>
                          <p className="text-sm font-semibold">
                            {p.notes_count}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-900/80 px-2 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">
                            Scope items
                          </p>
                          <p className="text-sm font-semibold">
                            {p.scope_items_count}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-900/80 px-2 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">
                            Notas módulo
                          </p>
                          <p className="text-sm font-semibold">
                            {p.module_notes_count}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-900/80 px-2 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">
                            Ficheros
                          </p>
                          <p className="text-sm font-semibold">
                            {p.files_count}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
                        <span>Creado: {formatDate(p.created_at)}</span>
                        <span className="opacity-0 transition group-hover:opacity-100">
                          Ver detalle →
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}