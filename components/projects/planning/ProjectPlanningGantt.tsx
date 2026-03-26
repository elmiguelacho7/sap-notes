"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ProjectPhase } from "@/lib/services/projectPhaseService";
import { ProjectPlanningTimeline } from "./ProjectPlanningTimeline";

export type ProjectPlanningGanttProps = {
  phases: ProjectPhase[];
  projectStart: string;
  projectEnd: string;
  /** Height of the gantt container in pixels */
  height?: number;
};

function parseDate(s: string | null): Date | null {
  if (!s || !s.trim()) return null;
  const d = new Date(s.includes("T") ? s : s + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Returns phases that have both start_date and end_date for timeline display.
 */
function hasAnyPhasesWithDates(phases: ProjectPhase[]): boolean {
  return phases.some((p) => {
    const s = parseDate(p.start_date);
    const e = parseDate(p.end_date);
    return s != null && e != null && s.getTime() <= e.getTime();
  });
}

/**
 * Phase timeline card — flat premium surface aligned with workspace overview.
 */
export function ProjectPlanningGantt({
  phases,
  projectStart,
  projectEnd,
  height = 420,
}: ProjectPlanningGanttProps) {
  const t = useTranslations("planning");
  const hasTasksWithDates = useMemo(() => hasAnyPhasesWithDates(phases), [phases]);

  return (
    <div
      className="flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/85 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100"
      style={{ height: `${height}px` }}
    >
      <div className="shrink-0 border-b border-slate-200/90 bg-gradient-to-br from-slate-50/90 to-white px-4 py-3.5 sm:px-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {t("gantt.eyebrow")}
        </p>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-slate-900">
          {t("gantt.title")}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-600 font-medium">
          {t("gantt.subtitle")}
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col w-full min-w-0 overflow-x-auto p-4 sm:p-5 bg-slate-50/40">
        {!hasTasksWithDates ? (
          <div className="flex min-h-[200px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200/90 bg-white px-4 py-8 text-center shadow-sm">
            <p className="max-w-sm text-sm text-slate-600 font-medium">
              {t("gantt.empty")}
            </p>
          </div>
        ) : (
          <div className="flex min-h-[280px] min-w-0 flex-1 flex-col">
            <ProjectPlanningTimeline
              phases={phases}
              projectStart={projectStart}
              projectEnd={projectEnd}
            />
          </div>
        )}
      </div>
    </div>
  );
}
