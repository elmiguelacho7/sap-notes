"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { ProjectCard, type ProjectCardProject } from "@/components/projects/ProjectCard";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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
    <PageShell wide>
      <div className="space-y-8">
        <PageHeader
          title="Proyectos"
          description="Registra y organiza aquí tus proyectos. Abre un proyecto para ver su workspace."
          actions={<Button onClick={() => router.push("/projects/new")}>Nuevo proyecto</Button>}
        />

      <section>
        <h2 className="text-sm font-semibold text-slate-800 mb-1">Filtrar</h2>
        <p className="text-xs text-slate-500 mb-5">Busca por nombre, descripción o estado.</p>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Escribe para filtrar..."
            className="max-w-sm"
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-800 mb-1">Proyectos</h2>
        <p className="text-xs text-slate-500 mb-5">Listado de proyectos. Haz clic en un proyecto para abrir su workspace.</p>
        {loadingProjects ? (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-12 text-center">
            <p className="text-sm font-medium text-slate-700">Cargando proyectos…</p>
            <p className="mt-1 text-sm text-slate-500">Un momento.</p>
          </div>
        ) : errorMsg ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {errorMsg}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-12 text-center">
            <p className="text-sm font-medium text-slate-700">No se han encontrado proyectos</p>
            <p className="mt-1 text-sm text-slate-500">Ajusta el filtro o crea un nuevo proyecto.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>
      </div>
    </PageShell>
  );
}
