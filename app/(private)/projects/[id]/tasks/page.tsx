"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import TasksBoard from "../../../../components/TasksBoard"; // ✅ ruta correcta

type Project = {
  id: string;
  name: string;
  description: string | null;
};

export default function ProjectTasksPage() {
  const params = useParams();
  const projectId =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
      ? params.id[0]
      : "";

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;

    const loadProject = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("projects")
        .select("id, name, description")
        .eq("id", projectId)
        .single();

      if (error) {
        console.error("[projects] load error:", error);
        setProject(null);
      } else {
        setProject(data as Project);
      }

      setLoading(false);
    };

    loadProject();
  }, [projectId]);

  if (!projectId) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm text-slate-600">
            No se ha encontrado el identificador del proyecto.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Proyecto
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            {loading ? "Cargando proyecto…" : project?.name ?? "Proyecto"}
          </h1>
          {project?.description && (
            <p className="text-sm text-slate-500 line-clamp-2">
              {project.description}
            </p>
          )}
        </header>

        <section>
          <TasksBoard
            projectId={projectId}
            title="Tablero de actividades del proyecto"
            subtitle="Organiza las tareas de este proyecto por estado. Crea nuevas actividades y arrástralas entre columnas."
          />
        </section>
      </div>
    </main>
  );
}