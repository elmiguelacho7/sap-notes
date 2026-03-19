"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback } from "react";
import { CalendarDays, FileText, Ticket, CheckSquare, FolderOpen, Calendar, ListTodo } from "lucide-react";

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
  client_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
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

/** Status badge styles: visible but not bright; balanced with metrics and CTA */
function getStatusBadgeClass(status: string | null): string {
  if (!status) return "bg-slate-500/10 text-slate-500 border-slate-500/20";
  const s = status.toLowerCase().trim();
  if (s === "planned" || s === "planificado") return "bg-sky-500/10 text-sky-400 border-sky-500/20";
  if (s === "in_progress" || s === "en progreso") return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
  if (s === "completed" || s === "cerrado" || s === "closed" || s === "finalizado") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (s === "archived" || s === "archivado") return "bg-slate-500/10 text-slate-500 border-slate-500/20";
  if (s === "blocked" || s === "bloqueado") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  return "bg-slate-500/10 text-slate-500 border-slate-500/20";
}

function getStatusLabel(status: string | null): string {
  if (!status) return "—";
  const s = status.toLowerCase().trim();
  if (s === "planned") return "Planificado";
  if (s === "in_progress") return "En progreso";
  if (s === "completed") return "Completado";
  if (s === "archived") return "Archivado";
  if (s === "blocked") return "Bloqueado";
  return status;
}

/** Card container: premium surface; hover and focus only, no status-based border color to keep restraint */
function getCardHoverClass(status: string | null): string {
  if (!status) return "hover:bg-slate-900/90 hover:border-slate-700";
  const s = status.toLowerCase().trim();
  if (s === "in_progress" || s === "en progreso") return "hover:bg-slate-900/90 hover:border-slate-700";
  if (s === "blocked" || s === "bloqueado") return "hover:bg-slate-900/90 hover:border-slate-700";
  return "hover:bg-slate-900/90 hover:border-slate-700";
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();
  const workspaceHref = `/projects/${project.id}`;

  const dateRange =
    project.start_date && project.planned_end_date
      ? `${formatDate(project.start_date)} — ${formatDate(project.planned_end_date)}`
      : project.start_date
        ? formatDate(project.start_date)
        : null;

  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("a")) return;
      router.push(workspaceHref);
    },
    [router, workspaceHref]
  );

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if ((e.target as HTMLElement).closest("a")) return;
      e.preventDefault();
      router.push(workspaceHref);
    },
    [router, workspaceHref]
  );

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className={`group flex cursor-pointer flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2 focus:ring-offset-slate-950 ${getCardHoverClass(project.status)}`}
      aria-label={`Abrir workspace de ${project.name || "Proyecto sin nombre"}`}
    >
      {/* Top: title + status badge */}
      <div className="flex items-start justify-between gap-3 p-4 pb-2">
        <h2 className="text-base font-semibold text-slate-100 truncate min-w-0 group-hover:text-white transition-colors">
          {project.name || "Proyecto sin nombre"}
        </h2>
        {project.status && (
          <span
            className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${getStatusBadgeClass(project.status)}`}
          >
            {getStatusLabel(project.status)}
          </span>
        )}
      </div>

      {/* Middle: client, date range, mini-stats */}
      <div className="flex flex-1 flex-col gap-2 px-4 min-h-0">
        {(project.client_name || dateRange) && (
          <div className="flex flex-col gap-0.5 text-xs text-slate-500">
            {project.client_name && <span className="truncate">{project.client_name}</span>}
            {dateRange && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3 shrink-0 text-slate-600" aria-hidden />
                {dateRange}
              </span>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <FileText className="h-3 w-3 shrink-0 text-slate-600" aria-hidden />
            <span className="font-medium text-slate-400">{project.notes_count}</span>
            <span>notas</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Ticket className="h-3 w-3 shrink-0 text-slate-600" aria-hidden />
            <span className="font-medium text-slate-400">{project.open_tickets_count}</span>
            <span>tickets</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <CheckSquare className="h-3 w-3 shrink-0 text-slate-600" aria-hidden />
            <span className="font-medium text-slate-400">{project.open_tasks_count}</span>
            <span>tareas</span>
          </span>
        </div>
      </div>

      {/* Bottom: primary CTA + secondary links; one clear primary action */}
      <footer className="flex flex-wrap items-center gap-2 border-t border-slate-800/80 px-4 py-3 mt-auto">
        <Link
          href={workspaceHref}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
          onClick={(e) => e.stopPropagation()}
        >
          <FolderOpen className="h-3.5 w-3.5" aria-hidden />
          Abrir workspace
        </Link>
        <Link
          href={`/projects/${project.id}/planning`}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-500 transition-colors hover:text-slate-400 hover:bg-slate-800/50"
          onClick={(e) => e.stopPropagation()}
        >
          <Calendar className="h-3 w-3" aria-hidden />
          Planning
        </Link>
        <Link
          href={`/projects/${project.id}/tasks`}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-500 transition-colors hover:text-slate-400 hover:bg-slate-800/50"
          onClick={(e) => e.stopPropagation()}
        >
          <ListTodo className="h-3 w-3" aria-hidden />
          Tasks
        </Link>
      </footer>
    </article>
  );
}
