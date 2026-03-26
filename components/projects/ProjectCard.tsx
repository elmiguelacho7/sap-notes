"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, FileText, Ticket, CheckSquare, FolderOpen, Calendar, ListTodo } from "lucide-react";
import { computeProjectHealth, type ProjectHealthLevel } from "@/lib/projectHealth";

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

function formatDate(dateString: string | null, localeTag: string): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  return d.toLocaleDateString(localeTag, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Status chips tuned for light premium cards */
function getStatusBadgeClass(status: string | null): string {
  if (!status) return "bg-slate-100 text-slate-600 border-slate-200/90";
  const s = status.toLowerCase().trim();
  if (s === "planned" || s === "planificado") return "bg-sky-50 text-sky-800 border-sky-200/80";
  if (s === "in_progress" || s === "en progreso") return "bg-indigo-50 text-indigo-800 border-indigo-200/80";
  if (s === "completed" || s === "cerrado" || s === "closed" || s === "finalizado") return "bg-emerald-50 text-emerald-800 border-emerald-200/80";
  if (s === "archived" || s === "archivado") return "bg-slate-100 text-slate-600 border-slate-200/80";
  if (s === "blocked" || s === "bloqueado") return "bg-amber-50 text-amber-900 border-amber-200/80";
  return "bg-slate-100 text-slate-600 border-slate-200/90";
}

function getStatusLabel(status: string | null, t: (key: string) => string): string {
  if (!status) return t("emDash");
  const s = status.toLowerCase().trim();
  if (s === "planned") return t("status.planned");
  if (s === "in_progress") return t("status.in_progress");
  if (s === "completed") return t("status.completed");
  if (s === "archived") return t("status.archived");
  if (s === "blocked") return t("status.blocked");
  return status;
}

function healthLabelClass(level: ProjectHealthLevel): string {
  if (level === "healthy") return "text-emerald-700";
  if (level === "watch") return "text-amber-800";
  return "text-rose-700";
}

function healthSegmentActiveClass(level: ProjectHealthLevel): string {
  if (level === "healthy") return "bg-emerald-500";
  if (level === "watch") return "bg-amber-500";
  return "bg-rose-500";
}

export function ProjectCard({ project }: ProjectCardProps) {
  const t = useTranslations("projects");
  const locale = useLocale();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const router = useRouter();
  const workspaceHref = `/projects/${project.id}`;

  const dateRange =
    project.start_date && project.planned_end_date
      ? `${formatDate(project.start_date, localeTag)} ${t("emDash")} ${formatDate(project.planned_end_date, localeTag)}`
      : project.start_date
        ? formatDate(project.start_date, localeTag)
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

  const health = useMemo(() => computeProjectHealth(project), [project]);

  const healthAria = t("card.health.aria", {
    state: t(`card.health.${health.level}`),
    segments: health.segmentsFilled,
  });

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200/75 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_20px_-6px_rgba(15,23,42,0.07),0_16px_40px_-12px_rgba(15,23,42,0.06)] ring-1 ring-inset ring-white transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-slate-300/85 hover:shadow-[0_2px_4px_rgba(15,23,42,0.04),0_12px_32px_-8px_rgba(15,23,42,0.1),0_24px_48px_-16px_rgba(15,23,42,0.08)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:ring-offset-2 focus:ring-offset-white"
      aria-label={t("card.openWorkspaceAria", { name: project.name || t("card.untitledProject") })}
    >
      {/* Executive header: single plane; health reads as part of the row, not a nested card */}
      <div className="border-b border-slate-200/60 bg-gradient-to-br from-slate-50/95 via-white to-slate-50/50 px-4 pb-3 pt-3.5 shadow-[inset_0_-1px_0_rgba(15,23,42,0.03)]">
        <h2 className="min-w-0 truncate text-[0.9375rem] font-semibold leading-snug tracking-tight text-slate-900 transition-colors group-hover:text-slate-950">
          {project.name || t("card.untitledProject")}
        </h2>

        <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {project.status && (
              <span
                className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${getStatusBadgeClass(project.status)}`}
              >
                {getStatusLabel(project.status, t)}
              </span>
            )}
          </div>

          <div
            className="min-w-0 sm:shrink-0 sm:border-l sm:border-slate-200/55 sm:pl-4"
            title={t(`card.health.tooltip.${health.level}`)}
          >
            <div className="flex flex-col gap-0.5 sm:items-end">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                {t("card.health.label")}
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold tabular-nums ${healthLabelClass(health.level)}`}>
                  {t(`card.health.${health.level}`)}
                </span>
                <div className="flex gap-0.5" role="img" aria-label={healthAria}>
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`h-1 w-[1.125rem] rounded-sm ${
                        i < health.segmentsFilled
                          ? healthSegmentActiveClass(health.level)
                          : "bg-slate-200/80"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body: soft lift from header; metadata + signal strip read as one calm band */}
      <div className="min-h-0 flex-1 bg-gradient-to-b from-white to-slate-50/35 px-4 py-3">
        {(project.client_name || dateRange) && (
          <div className="space-y-1 rounded-xl border border-slate-100/90 bg-white/70 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            {project.client_name && (
              <p className="truncate text-sm font-medium leading-snug text-slate-800">{project.client_name}</p>
            )}
            {dateRange && (
              <p className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                <CalendarDays className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                <span>{dateRange}</span>
              </p>
            )}
          </div>
        )}

        <div
          className={`flex items-stretch rounded-xl bg-slate-50/65 px-1.5 py-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)] ${project.client_name || dateRange ? "mt-2" : ""}`}
        >
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-0.5 text-center">
            <FileText className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
            <span className="text-sm font-semibold tabular-nums text-slate-900">{project.notes_count}</span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{t("card.notes")}</span>
          </div>
          <div
            className="w-px shrink-0 bg-gradient-to-b from-transparent via-slate-200/50 to-transparent"
            aria-hidden
          />
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-0.5 text-center">
            <Ticket className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
            <span className="text-sm font-semibold tabular-nums text-slate-900">{project.open_tickets_count}</span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{t("card.tickets")}</span>
          </div>
          <div
            className="w-px shrink-0 bg-gradient-to-b from-transparent via-slate-200/50 to-transparent"
            aria-hidden
          />
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-0.5 text-center">
            <CheckSquare className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
            <span className="text-sm font-semibold tabular-nums text-slate-900">{project.open_tasks_count}</span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{t("card.tasks")}</span>
          </div>
        </div>
      </div>

      <footer className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-slate-200/50 bg-gradient-to-b from-slate-50/40 to-white px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
        <Link
          href={workspaceHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[rgb(var(--rb-brand-primary))]/30 bg-[rgb(var(--rb-brand-primary))] px-3 py-2 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-[border-color,background-color,box-shadow] hover:border-[rgb(var(--rb-brand-primary))]/45 hover:bg-[rgb(var(--rb-brand-primary-hover))] hover:shadow-[0_2px_8px_-2px_rgba(15,23,42,0.12)]"
          onClick={(e) => e.stopPropagation()}
        >
          <FolderOpen className="h-3.5 w-3.5 opacity-95" aria-hidden />
          {t("card.openWorkspace")}
        </Link>
        <Link
          href={`/projects/${project.id}/planning`}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium tracking-tight text-slate-500 transition-colors hover:bg-slate-100/90 hover:text-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          <Calendar className="h-3 w-3 text-slate-400" aria-hidden />
          {t("card.planning")}
        </Link>
        <Link
          href={`/projects/${project.id}/tasks`}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium tracking-tight text-slate-500 transition-colors hover:bg-slate-100/90 hover:text-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          <ListTodo className="h-3 w-3 text-slate-400" aria-hidden />
          {t("card.tasksSection")}
        </Link>
      </footer>
    </article>
  );
}
