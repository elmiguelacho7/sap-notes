"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { ProjectCard, type ProjectCardProject } from "@/components/projects/ProjectCard";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  start_date: string | null;
  planned_end_date: string | null;
  current_phase_key: string | null;
  created_at: string;
};

export default function ProjectsPage() {
  const router = useRouter();

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projects, setProjects] = useState<ProjectCardProject[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoadingProjects(true);
      setErrorMsg(null);

      const { data: projData, error } = await supabase
        .from("projects")
        .select("id, name, description, status, start_date, planned_end_date, current_phase_key, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        handleSupabaseError("projects", error);
        setErrorMsg("No se pudieron cargar los proyectos.");
        setProjects([]);
        setLoadingProjects(false);
        return;
      }

      const rows = (projData ?? []) as ProjectRow[];

      const { data: doneStatusRows } = await supabase
        .from("task_statuses")
        .select("id")
        .eq("code", "DONE")
        .eq("is_active", true)
        .limit(1);
      const doneStatusId = (doneStatusRows?.[0] as { id: string } | undefined)?.id ?? null;

      const projectsWithCounts = await Promise.all(
        rows.map(async (p) => {
          const [notesRes, ticketsRes, tasksRes] = await Promise.all([
            supabase
              .from("notes")
              .select("id", { count: "exact", head: true })
              .eq("project_id", p.id)
              .is("deleted_at", null),
            supabase
              .from("tickets")
              .select("id", { count: "exact", head: true })
              .eq("project_id", p.id)
              .neq("status", "closed"),
            doneStatusId
              ? supabase
                  .from("tasks")
                  .select("id", { count: "exact", head: true })
                  .eq("project_id", p.id)
                  .neq("status_id", doneStatusId)
              : supabase
                  .from("tasks")
                  .select("id", { count: "exact", head: true })
                  .eq("project_id", p.id),
          ]);

          const notes_count = notesRes.count ?? 0;
          const open_tickets_count = ticketsRes.count ?? 0;
          const open_tasks_count = tasksRes.count ?? 0;

          return {
            id: p.id,
            name: p.name,
            description: p.description,
            status: p.status,
            start_date: p.start_date,
            planned_end_date: p.planned_end_date,
            current_phase_key: p.current_phase_key,
            notes_count,
            open_tickets_count,
            open_tasks_count,
          } satisfies ProjectCardProject;
        })
      );

      setProjects(projectsWithCounts);
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
      project.current_phase_key ?? "",
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

      {/* GRID OF CARDS */}
      <div>
        {loadingProjects ? (
          <p className="p-6 text-sm text-slate-500">Cargando proyectos...</p>
        ) : errorMsg ? (
          <p className="p-6 text-sm text-red-500">{errorMsg}</p>
        ) : filteredProjects.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No se han encontrado proyectos con los filtros actuales.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
