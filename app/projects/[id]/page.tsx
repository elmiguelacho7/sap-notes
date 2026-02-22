"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Client = {
  id: string;
  name: string;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  clients?: Client[] | null;
};

type Module = {
  id: string;
  code: string;
  name: string;
};

type ProjectModule = {
  id: string;
  modules: Module[];
};

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params?.id;

  const [project, setProject] = useState<Project | null>(null);
  const [projectModules, setProjectModules] = useState<ProjectModule[]>([]);
  const [loading, setLoading] = useState(true);

  // =========================
  // CHECK SESSION + LOAD DATA
  // =========================
  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      if (!projectId) {
        return;
      }

      // ---- Proyecto ----
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select(
          `
          id,
          name,
          description,
          created_at,
          clients (
            id,
            name
          )
        `
        )
        .eq("id", projectId)
        .maybeSingle();

      if (projectError) {
        console.error("project select error", projectError);
      } else if (projectData) {
        setProject(projectData as Project);
      }

      // ---- Módulos de proyecto ----
      const { data: pmData, error: pmError } = await supabase
        .from("project_modules")
        .select(
          `
          id,
          modules (
            id,
            code,
            name
          )
        `
        )
        .eq("project_id", projectId);

      if (pmError) {
        console.error("project_modules select error", pmError);
      } else if (pmData) {
        // pmData tiene forma: { id, modules: Module[] }[]
        // Forzamos el tipo de forma segura para React:
        setProjectModules(pmData as unknown as ProjectModule[]);
      }

      setLoading(false);
    };

    load();
  }, [projectId, router]);

  const handleBack = () => {
    router.push("/projects");
  };

  // =========================
  // UI
  // =========================
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center">
        <p className="mb-4 text-red-400">Project not found.</p>
        <button
          onClick={handleBack}
          className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700"
        >
          Back to projects
        </button>
      </div>
    );
  }

  const clientName =
    project.clients && project.clients.length > 0
      ? project.clients[0].name
      : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">{project.name}</h1>
            <p className="text-gray-400 text-sm">
              Created:{" "}
              {new Date(project.created_at).toLocaleString()}
            </p>
            {clientName && (
              <p className="text-gray-400 text-sm mt-1">
                Client: {clientName}
              </p>
            )}
          </div>

          <button
            onClick={handleBack}
            className="bg-gray-800 px-4 py-2 rounded hover:bg-gray-700 text-sm"
          >
            ← Back to projects
          </button>
        </div>

        {/* DESCRIPTION */}
        {project.description && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-lg font-semibold mb-2">Description</h2>
            <p className="text-gray-300 whitespace-pre-line">
              {project.description}
            </p>
          </div>
        )}

        {/* MODULES */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">Project modules</h2>

          {projectModules.length === 0 ? (
            <p className="text-gray-400 text-sm">
              No modules assigned to this project yet.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {projectModules.map((pm) =>
                pm.modules.map((m) => (
                  <div
                    key={`${pm.id}-${m.id}`}
                    className="bg-gray-950 border border-gray-800 rounded-lg p-4"
                  >
                    <p className="text-xs text-gray-500 mb-1">
                      Module code
                    </p>
                    <p className="font-semibold">{m.code}</p>
                    <p className="text-gray-300 mt-1">{m.name}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}