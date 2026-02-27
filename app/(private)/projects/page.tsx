"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  created_at: string;
};

export default function ProjectsPage() {
  const router = useRouter();

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoadingProjects(true);
      setErrorMsg(null);

      const { data: projData, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        handleSupabaseError("projects", error);
        setErrorMsg("No se pudieron cargar los proyectos.");
        setProjects([]);
      } else {
        setProjects((projData ?? []) as Project[]);
      }

      setLoadingProjects(false);
    };

    void load();
  }, []);

  const filteredProjects = projects.filter((project) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;

    const fields = [
      project.name,
      project.description ?? "",
      project.status ?? "",
    ].join(" ");

    return fields.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-7 space-y-5">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Proyectos</h1>
          <p className="text-sm text-slate-600 max-w-xl">
            Registra y organiza aquí tus proyectos internos.
          </p>
        </div>

        <button
          onClick={() => router.push("/projects/new")}
          className="self-start bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Nuevo proyecto
        </button>
      </div>

      {/* BUSCADOR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Buscador de proyectos
          </p>
          <p className="text-xs text-slate-500">
            Filtra por nombre, descripción o estado.
          </p>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Escribe para filtrar..."
          className="w-full md:w-64 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* LISTA */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        {loadingProjects ? (
          <p className="p-6 text-sm text-slate-500">Cargando proyectos...</p>
        ) : errorMsg ? (
          <p className="p-6 text-sm text-red-500">{errorMsg}</p>
        ) : filteredProjects.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No se han encontrado proyectos con los filtros actuales.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredProjects.map((project) => (
              <li
                key={project.id}
                className="p-4 hover:bg-slate-50 cursor-pointer"
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {project.name || "Proyecto sin nombre"}
                    </p>

                    {project.description && (
                      <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                        {project.description}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                      {project.status && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                          Estado: {project.status}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[11px] text-slate-400">
                      {new Date(project.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}