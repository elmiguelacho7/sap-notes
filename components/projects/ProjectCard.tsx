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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      <div className="p-5 flex-1 flex flex-col gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 truncate">
            {project.name || "Proyecto sin nombre"}
          </h2>
          {project.description && (
            <p className="mt-1 text-xs text-slate-600 line-clamp-2">
              {project.description}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {project.status && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
              {project.status}
            </span>
          )}
          <span className="text-[11px] text-slate-500">
            Fase: {phaseDisplay(project.current_phase_key)}
          </span>
        </div>

        {project.start_date && project.planned_end_date && (
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
            <span className="text-[11px] text-slate-500">Duración del proyecto</span>
            <span className="flex items-center gap-1 text-[11px] font-medium text-slate-700">
              <CalendarDays className="h-3 w-3 shrink-0" />
              {formatDate(project.start_date)} — {formatDate(project.planned_end_date)}
            </span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-center">
            <p className="text-lg font-semibold text-slate-900">
              {project.notes_count}
            </p>
            <p className="text-[11px] text-slate-500">Notas</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-center">
            <p className="text-lg font-semibold text-slate-900">
              {project.open_tickets_count}
            </p>
            <p className="text-[11px] text-slate-500">Tickets abiertos</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-center">
            <p className="text-lg font-semibold text-slate-900">
              {project.open_tasks_count}
            </p>
            <p className="text-[11px] text-slate-500">Tareas abiertas</p>
          </div>
        </div>
      </div>

      <footer className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => router.push(`/projects/${project.id}`)}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
        >
          Ver
        </button>
        <button
          type="button"
          onClick={() => router.push(`/projects/${project.id}/planning`)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1"
        >
          Planificación
        </button>
        <button
          type="button"
          onClick={() => router.push(`/projects/${project.id}/tasks`)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1"
        >
          Tareas
        </button>
      </footer>
    </div>
  );
}
