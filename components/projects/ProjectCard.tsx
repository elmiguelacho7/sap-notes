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

/** Card container border/accent by status: in_progress more prominent, planned calmer, closed quieter, blocked amber */
function getCardBorderClass(status: string | null): string {
  if (!status) return "border-slate-800";
  const s = status.toLowerCase().trim();
  if (s === "in_progress" || s === "en progreso") return "border-indigo-500/40 hover:border-indigo-500/50";
  if (s === "blocked" || s === "bloqueado") return "border-amber-500/30 hover:border-amber-500/40";
  if (s === "planned" || s === "planificado") return "border-slate-800 hover:border-slate-700";
  if (s === "completed" || s === "cerrado" || s === "closed" || s === "finalizado" || s === "archived" || s === "archivado") return "border-slate-800/80 hover:border-slate-700/80";
  return "border-slate-800 hover:border-slate-700";
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
      className={`group flex cursor-pointer flex-col rounded-xl bg-slate-900/60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2 focus:ring-offset-slate-950 ${getCardBorderClass(project.status)} border`}
      aria-label={`Abrir workspace de ${project.name || "Proyecto sin nombre"}`}
    >
      {/* Content: title and metadata (all clickable via card) */}
      <div className="flex flex-1 flex-col gap-4 p-5 min-h-0">
        {/* Top: name + status */}
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-100 truncate min-w-0 group-hover:text-white transition-colors">
            {project.name || "Proyecto sin nombre"}
          </h2>
          {project.status && (
            <span
              className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(project.status)}`}
            >
              {getStatusLabel(project.status)}
            </span>
          )}
        </div>

        {/* Middle: client + date range */}
        <div className="flex flex-col gap-1 text-sm text-slate-500">
          {project.client_name && (
            <span className="truncate">{project.client_name}</span>
          )}
          {dateRange && (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-600" />
              {dateRange}
            </span>
          )}
          {project.current_phase_key && (
            <span className="text-xs text-slate-600">Fase: {phaseDisplay(project.current_phase_key)}</span>
          )}
        </div>

        {/* Metrics row: spacing and alignment */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-slate-800/60">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <FileText className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
            <span>{project.notes_count}</span>
            <span className="text-slate-500">notas</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <Ticket className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
            <span>{project.open_tickets_count}</span>
            <span className="text-slate-500">tickets</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <CheckSquare className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
            <span>{project.open_tasks_count}</span>
            <span className="text-slate-500">tareas</span>
          </span>
        </div>
      </div>

      {/* Actions: supporting CTA + secondary links (links stop card click) */}
      <footer className="flex flex-wrap items-center gap-2 border-t border-slate-800 px-5 py-3">
        <Link
          href={workspaceHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-800/40 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700/50 hover:text-slate-100 hover:border-slate-500/50"
          onClick={(e) => e.stopPropagation()}
        >
          <FolderOpen className="h-3.5 w-3.5" aria-hidden />
          Abrir workspace
        </Link>
        <Link
          href={`/projects/${project.id}/planning`}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-800/60 hover:text-slate-400"
          onClick={(e) => e.stopPropagation()}
        >
          <Calendar className="h-3 w-3" aria-hidden />
          Planning
        </Link>
        <Link
          href={`/projects/${project.id}/tasks`}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-800/60 hover:text-slate-400"
          onClick={(e) => e.stopPropagation()}
        >
          <ListTodo className="h-3 w-3" aria-hidden />
          Tasks
        </Link>
      </footer>
    </article>
  );
}
