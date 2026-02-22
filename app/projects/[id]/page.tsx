"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Project = {
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

type ProjectNote = {
  id: string;
  title: string;
  body: string | null;
  client: string | null;
  module: string | null;
  scope_item: string | null;
  error_code: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  planned: "Planificado",
  in_progress: "En progreso",
  on_hold: "En espera",
  closed: "Cerrado",
};

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const projectId = params?.id;

  const [project, setProject] = useState<Project | null>(null);
  const [notes, setNotes] = useState<ProjectNote[]>([]);

  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(true);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const loadProject = async () => {
      setLoadingProject(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("project_dashboard")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();

      if (error) {
        console.error("project_dashboard get error", error);
        setErrorMsg("No se pudo cargar la información del proyecto.");
      } else if (!data) {
        setErrorMsg("No se ha encontrado el proyecto.");
      } else {
        setProject(data as Project);
      }

      setLoadingProject(false);
    };

    const loadNotes = async () => {
      setLoadingNotes(true);
      setNotesError(null);

      const { data, error } = await supabase
        .from("notes") // ajusta si tu tabla/vista de notas tiene otro nombre
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("notes by project error", error);
        setNotesError("No se pudieron cargar las notas de este proyecto.");
      } else if (data) {
        setNotes(data as ProjectNote[]);
      }

      setLoadingNotes(false);
    };

    void loadProject();
    void loadNotes();
  }, [projectId]);

  const formatDate = (value: string | null) => {
    if (!value) return "Sin fecha";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString();
  };

  const formatStatus = (status: string | null) => {
    if (!status) return "Sin estado";
    return STATUS_LABELS[status] ?? status;
  };

  // ======================
  // UI
  // ======================

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Header navegación */}
        <header className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push("/projects")}
            className="text-[11px] text-slate-400 underline underline-offset-4 hover:text-slate-200"
          >
            ← Volver a proyectos
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/notes")}
              className="text-[11px] text-slate-400 underline underline-offset-4 hover:text-slate-200"
            >
              Ir al panel de notas →
            </button>
          </div>
        </header>

        {/* Estado carga / error proyecto */}
        {loadingProject && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-8 text-center text-sm text-slate-400">
            Cargando proyecto…
          </div>
        )}

        {!loadingProject && errorMsg && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {errorMsg}
          </div>
        )}

        {/* Contenido del proyecto */}
        {!loadingProject && !errorMsg && project && (
          <>
            {/* Cabecera principal del proyecto */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.2em] text-sky-400">
                  SAP Notes Hub
                </p>
                <h1 className="text-2xl font-semibold text-slate-50">
                  {project.name}
                </h1>
                <p className="text-sm text-slate-400 max-w-xl">
                  {project.description || "Sin descripción detallada."}
                </p>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
                  {project.client_name && (
                    <span className="rounded-full bg-slate-800/80 px-2 py-1">
                      Cliente: {project.client_name}
                    </span>
                  )}
                  {project.environment_type && (
                    <span className="rounded-full bg-slate-800/80 px-2 py-1">
                      Entorno: {project.environment_type}
                    </span>
                  )}
                  {project.sap_version && (
                    <span className="rounded-full bg-slate-800/80 px-2 py-1">
                      SAP: {project.sap_version}
                    </span>
                  )}
                  {project.status && (
                    <span className="rounded-full bg-slate-800/80 px-2 py-1">
                      Estado: {formatStatus(project.status)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-start gap-2 text-[11px] text-slate-400 md:items-end">
                <div>
                  <p className="text-slate-500">Fecha de inicio</p>
                  <p className="font-medium text-slate-200">
                    {formatDate(project.start_date)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Creado en SAP Notes Hub</p>
                  <p className="font-medium text-slate-200">
                    {formatDate(project.created_at)}
                  </p>
                </div>
              </div>
            </section>

            {/* Métricas del proyecto */}
            <section className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Notas totales
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-50">
                  {project.notes_count}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Incidencias, decisiones y configuraciones registradas.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Notas por módulo
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-50">
                  {project.module_notes_count}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Agrupadas por SD, MM, FI, etc.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Scope items
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-50">
                  {project.scope_items_count}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Procesos estándar SAP vinculados.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Ficheros
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-50">
                  {project.files_count}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Documentación adjunta del proyecto.
                </p>
              </div>
            </section>

            {/* Notas del proyecto */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-200">
                  Notas del proyecto ({notes.length})
                </h2>
                <button
                  type="button"
                  onClick={() => router.push("/notes")}
                  className="text-[11px] text-sky-400 hover:text-sky-300 underline underline-offset-4"
                >
                  Ver todas las notas →
                </button>
              </div>

              {loadingNotes && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-center text-sm text-slate-400">
                  Cargando notas del proyecto…
                </div>
              )}

              {!loadingNotes && notesError && (
                <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
                  {notesError}
                </div>
              )}

              {!loadingNotes && !notesError && (
                <>
                  {notes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/60 px-6 py-8 text-center">
                      <p className="text-sm text-slate-200">
                        Este proyecto todavía no tiene notas registradas.
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Añade notas desde el panel general para ir construyendo
                        el historial de decisiones e incidencias.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {notes.map((note) => (
                        <article
                          key={note.id}
                          className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left shadow-sm"
                        >
                          <header className="mb-1">
                            <h3 className="text-sm font-semibold text-slate-50">
                              {note.title}
                            </h3>
                          </header>

                          <p className="mb-3 line-clamp-3 text-xs text-slate-400">
                            {note.body || "Sin descripción detallada."}
                          </p>

                          <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
                            {note.module && (
                              <span className="rounded-full bg-slate-800/80 px-2 py-1">
                                Módulo: {note.module}
                              </span>
                            )}
                            {note.scope_item && (
                              <span className="rounded-full bg-slate-800/80 px-2 py-1">
                                Scope: {note.scope_item}
                              </span>
                            )}
                            {note.error_code && (
                              <span className="rounded-full bg-slate-800/80 px-2 py-1">
                                Error: {note.error_code}
                              </span>
                            )}
                          </div>

                          <footer className="mt-auto flex items-center justify-between text-[10px] text-slate-500">
                            <span>Creada: {formatDate(note.created_at)}</span>
                            {note.client && <span>{note.client}</span>}
                          </footer>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}