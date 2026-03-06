"use client";

import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";

export type ProjectCardProject = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  start_date: string | null;
  planned_end_date: string | null;
  current_phase_key: string | null;
  notes_count: number;
  open_tickets_count: number;
  open_tasks_count: number;
};

type ProjectCardProps = {
  project: ProjectCardProject;
};

const PHASE_LABELS: Record<string, string> = {
  discover: "Discover",
  prepare: "Prepare",
  explore: "Explore",
  realize: "Realize",
  deploy: "Deploy",
  run: "Run",
};

function phaseDisplay(phaseKey: string | null): string {
  if (!phaseKey) return "—";
  return PHASE_LABELS[phaseKey] ?? phaseKey;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();
  const isActive = project.status
    ? !String(project.status).toLowerCase().includes("cerrado") && !String(project.status).toLowerCase().includes("closed")
    : true;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col shadow-sm hover:shadow transition-shadow">
      <div className="p-6 flex-1 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 truncate min-w-0">
            {project.name || "Proyecto sin nombre"}
          </h2>
          {project.status && (
            <span
              className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
                isActive ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"
              }`}
            >
              {project.status}
            </span>
          )}
        </div>
        {project.description && (
          <p className="text-sm text-slate-600 line-clamp-2">
            {project.description}
          </p>
        )}

        <div className="flex items-center gap-2 text-slate-500">
          <span className="text-[11px]">Fase: {phaseDisplay(project.current_phase_key)}</span>
          {project.start_date && project.planned_end_date && (
            <>
              <span className="text-slate-300">·</span>
              <span className="flex items-center gap-1 text-[11px]">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                {formatDate(project.start_date)} — {formatDate(project.planned_end_date)}
              </span>
            </>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3 text-center">
            <p className="text-xl font-semibold text-slate-900">{project.notes_count}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Notas</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3 text-center">
            <p className="text-xl font-semibold text-slate-900">{project.open_tickets_count}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Tickets</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3 text-center">
            <p className="text-xl font-semibold text-slate-900">{project.open_tasks_count}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Tareas</p>
          </div>
        </div>
      </div>

      <footer className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.push(`/projects/${project.id}`)}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Ver proyecto
        </button>
        <button
          type="button"
          onClick={() => router.push(`/projects/${project.id}/planning`)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Planificación
        </button>
        <button
          type="button"
          onClick={() => router.push(`/projects/${project.id}/tasks`)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Tareas
        </button>
      </footer>
    </div>
  );
}
