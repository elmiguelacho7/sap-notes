"use client";

import { useMemo } from "react";
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
 * Planning hero: premium timeline (custom) with same phase data.
 * Timeline-centric, dark/slate native, SAP Activate identity preserved.
 */
export function ProjectPlanningGantt({
  phases,
  projectStart,
  projectEnd,
  height = 420,
}: ProjectPlanningGanttProps) {
  const hasTasksWithDates = useMemo(() => hasAnyPhasesWithDates(phases), [phases]);

  return (
    <div className="w-full min-w-0 overflow-x-auto rounded-2xl border border-slate-700/80 bg-slate-900/80 shadow-lg shadow-black/5 ring-1 ring-slate-700/30 overflow-hidden">
      <div className="border-b border-slate-700/60 px-4 sm:px-5 py-3 bg-slate-800/50 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Timeline del proyecto</p>
        <p className="text-sm font-medium text-slate-200 mt-0.5">Fases SAP Activate</p>
      </div>
      <div className="w-full min-w-0 p-4 sm:p-5 overflow-x-auto" style={{ height: `${height - 72}px` }}>
        {!hasTasksWithDates ? (
          <div
            className="flex h-full min-w-0 items-center justify-center rounded-xl border border-dashed border-slate-700/60 bg-slate-800/30 text-slate-500"
          >
            <p className="text-sm text-center px-4">Indica fechas de inicio y fin en el editor de fases para ver el timeline.</p>
          </div>
        ) : (
          <ProjectPlanningTimeline
            phases={phases}
            projectStart={projectStart}
            projectEnd={projectEnd}
            height={height - 72}
          />
        )}
      </div>
    </div>
  );
}
