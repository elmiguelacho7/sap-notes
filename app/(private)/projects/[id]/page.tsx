"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  created_at: string;
};

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params?.id;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const load = async () => {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();

      if (error) {
        console.error(error);
        setErrorMsg("No se pudo cargar la información del proyecto.");
        setProject(null);
      } else {
        setProject(data as Project | null);
      }

      setLoading(false);
    };

    void load();
  }, [projectId]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-7">
        <p className="text-sm text-slate-500">Cargando proyecto…</p>
      </div>
    );
  }

  if (errorMsg || !project) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-7 space-y-4">
        <button
          onClick={() => router.push("/projects")}
          className="text-xs text-blue-600 hover:underline"
        >
          ← Volver a proyectos
        </button>

        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          {errorMsg || "No se encontró el proyecto."}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-7 space-y-5">
      <button
        onClick={() => router.push("/projects")}
        className="text-xs text-blue-600 hover:underline"
      >
        ← Volver a proyectos
      </button>

      {/* Cabecera del proyecto */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Proyecto</p>
            <h1 className="text-xl font-semibold text-slate-900">
              {project.name}
            </h1>
            {project.status && (
              <p className="mt-1 text-xs text-slate-500">
                Estado:{" "}
                <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                  {project.status}
                </span>
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[11px] text-slate-400">
              Creado el{" "}
              {new Date(project.created_at).toLocaleDateString("es-ES")}
            </p>
          </div>
        </div>

        {project.description && (
          <div className="mt-4">
            <p className="text-xs text-slate-500 mb-1">Descripción</p>
            <p className="text-sm text-slate-700 whitespace-pre-line border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
              {project.description}
            </p>
          </div>
        )}
      </div>

      {/* Bloque siguiente pasos / IA (placeholder) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-800 mb-1">
          Próximo paso
        </p>
        <p className="text-sm text-slate-600">
          Aquí añadiremos KPIs del proyecto, notas asociadas y la integración
          con el agente de IA para este proyecto.
        </p>
      </div>
    </div>
  );
}