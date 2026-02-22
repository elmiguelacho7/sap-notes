"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  created_at: string;
};

export default function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const projectId = params.id;

  // Hooks SIEMPRE en el mismo orden
  const [checkingSession, setCheckingSession] = useState(true);
  const [loadingProject, setLoadingProject] = useState(true);
  const [saving, setSaving] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      // 1) Auth guard
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.replace("/");
        return;
      }

      setCheckingSession(false);

      // 2) Cargar proyecto
      setLoadingProject(true);
      setErrorMsg(null);

      const { data: projData, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (error) {
        console.error(error);
        setErrorMsg("No se ha podido cargar el proyecto.");
        setProject(null);
      } else if (projData) {
        const p = projData as Project;
        setProject(p);
        setName(p.name || "");
        setDescription(p.description || "");
        setStatus(p.status || "");
      }

      setLoadingProject(false);
    };

    if (projectId) {
      init();
    }
  }, [router, projectId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (checkingSession) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!project) return;

    if (!name.trim()) {
      setErrorMsg("El nombre del proyecto es obligatorio.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("projects")
        .update({
          name: name.trim(),
          description: description.trim() || null,
          status: status.trim() || null,
        })
        .eq("id", project.id);

      if (error) {
        console.error(error);
        setErrorMsg("No se pudo actualizar el proyecto. Inténtalo de nuevo.");
        setSaving(false);
        return;
      }

      setSuccessMsg("Proyecto actualizado correctamente.");
    } catch (err) {
      console.error(err);
      setErrorMsg("Se ha producido un error inesperado.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
              PH
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Project Hub
              </p>
              <p className="text-[11px] text-slate-500">
                Detalle del proyecto
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/projects")}
              className="text-xs border border-slate-300 px-3 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100"
            >
              Volver a proyectos
            </button>
            <button
              onClick={handleLogout}
              className="text-xs border border-slate-300 px-3 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <section className="max-w-4xl mx-auto px-6 py-7">
        {loadingProject ? (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <p className="text-sm text-slate-500">Cargando proyecto...</p>
          </div>
        ) : !project ? (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <p className="text-sm text-red-500">
              {errorMsg || "No se ha encontrado el proyecto indicado."}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-5">
            <div>
              <h1 className="text-xl font-semibold text-slate-900 mb-1">
                {project.name || "Proyecto sin nombre"}
              </h1>
              <p className="text-xs text-slate-500">
                Creado el{" "}
                {new Date(project.created_at).toLocaleDateString()}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-800">
                  Nombre del proyecto *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-800">
                  Descripción
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Añade un resumen del contexto, objetivos y decisiones clave relacionadas con este proyecto."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-800">
                  Estado
                </label>
                <input
                  type="text"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  placeholder="Ejemplo: En análisis, En curso, Cerrado..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-red-500">{errorMsg}</p>
              )}
              {successMsg && (
                <p className="text-xs text-emerald-600">{successMsg}</p>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Guardando cambios..." : "Guardar cambios"}
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/projects")}
                  className="text-sm text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-100"
                >
                  Volver sin guardar
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}