"use client";

import { useMemo, useState } from "react";
import type { ProjectPhase } from "@/lib/services/projectPhaseService";

export type ProjectPlanningTimelineProps = {
  phases: ProjectPhase[];
  projectStart: string;
  projectEnd: string;
  /** Height of the timeline content area (excluding header) */
  height?: number;
};

function parseDate(s: string | null): Date | null {
  if (!s || !s.trim()) return null;
  const d = new Date(s.includes("T") ? s : s + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / (24 * 60 * 60 * 1000));
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type TimelineTask = {
  id: string;
  name: string;
  phaseKey: string | null;
  startDate: Date;
  endDate: Date;
  order: number;
};

function getTimelineTasks(phases: ProjectPhase[]): TimelineTask[] {
  const sorted = [...phases].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const out: TimelineTask[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const start = parseDate(p.start_date);
    const end = parseDate(p.end_date);
    if (start && end && start.getTime() <= end.getTime()) {
      out.push({
        id: p.id,
        name: p.name || `Phase ${p.sort_order ?? i + 1}`,
        phaseKey: p.phase_key ?? null,
        startDate: start,
        endDate: end,
        order: p.sort_order ?? i + 1,
      });
    }
  }
  return out;
}

function getCurrentPhaseId(tasks: TimelineTask[]): string | null {
  const today = startOfDay(new Date());
  for (const t of tasks) {
    const s = startOfDay(t.startDate);
    const e = startOfDay(t.endDate);
    if (today.getTime() >= s.getTime() && today.getTime() <= e.getTime()) return t.id;
  }
  return null;
}

function getMonthLabels(projectStart: Date, projectEnd: Date): { label: string; leftPct: number; widthPct: number }[] {
  const out: { label: string; leftPct: number; widthPct: number }[] = [];
  const totalMs = projectEnd.getTime() - projectStart.getTime();
  if (totalMs <= 0) return out;
  const cur = new Date(projectStart);
  cur.setDate(1);
  cur.setHours(0, 0, 0, 0);
  while (cur.getTime() < projectEnd.getTime()) {
    const monthStart = cur.getTime();
    const next = new Date(cur);
    next.setMonth(next.getMonth() + 1);
    const monthEnd = next.getTime();
    const rangeStart = Math.max(monthStart, projectStart.getTime());
    const rangeEnd = Math.min(monthEnd, projectEnd.getTime());
    if (rangeStart < rangeEnd) {
      const leftPct = ((rangeStart - projectStart.getTime()) / totalMs) * 100;
      const widthPct = ((rangeEnd - rangeStart) / totalMs) * 100;
      out.push({
        label: cur.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        leftPct,
        widthPct,
      });
    }
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

/**
 * Premium timeline hero for the Planning page. Native to SAP Notes Hub design:
 * timeline-centric, SAP Activate phases, dark/slate, current phase and today marker.
 */
export function ProjectPlanningTimeline({
  phases,
  projectStart,
  projectEnd,
  height = 380,
}: ProjectPlanningTimelineProps) {
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<{ x: number; y: number } | null>(null);

  const projectStartDate = useMemo(() => parseDate(projectStart) ?? new Date(), [projectStart]);
  const projectEndDate = useMemo(
    () => parseDate(projectEnd) ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    [projectEnd]
  );

  const tasks = useMemo(() => getTimelineTasks(phases), [phases]);
  const currentPhaseId = useMemo(() => getCurrentPhaseId(tasks), [tasks]);

  const totalDays = useMemo(
    () => Math.max(1, daysBetween(projectStartDate, projectEndDate)),
    [projectStartDate, projectEndDate]
  );

  const todayPct = useMemo(() => {
    const today = startOfDay(new Date());
    if (today.getTime() < projectStartDate.getTime() || today.getTime() > projectEndDate.getTime()) return null;
    return (daysBetween(projectStartDate, today) / totalDays) * 100;
  }, [projectStartDate, projectEndDate, totalDays]);

  const monthLabels = useMemo(
    () => getMonthLabels(projectStartDate, projectEndDate),
    [projectStartDate, projectEndDate]
  );

  const rowHeight = 56;
  const barHeight = 42;
  const labelWidth = 168;
  const scaleHeight = 52;

  const hoveredTask = hoveredTaskId ? tasks.find((t) => t.id === hoveredTaskId) : null;

  return (
    <div className="flex h-full min-w-0 flex-col rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden">
      {/* Scale header */}
      <div
        className="flex shrink-0 border-b border-slate-700/50 bg-slate-800/50"
        style={{ height: scaleHeight, paddingLeft: labelWidth }}
      >
        <div className="relative flex h-full items-center">
          {monthLabels.length > 0 &&
            monthLabels.map((m, i) => (
              <div
                key={i}
                className="absolute flex h-full items-center px-3 text-xs font-medium text-slate-400"
                style={{
                  left: `${m.leftPct}%`,
                  width: `${m.widthPct}%`,
                  borderRight: i < monthLabels.length - 1 ? "1px solid rgba(51, 65, 85, 0.35)" : "none",
                }}
              >
                {m.label}
              </div>
            ))}
        </div>
      </div>

      {/* Timeline body */}
      <div className="relative flex flex-1 flex-col overflow-hidden" style={{ minHeight: 0 }}>
        {tasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-12 text-slate-500">
            <p className="text-sm">Set start and end dates in the phase editor below to see the timeline.</p>
          </div>
        ) : (
          <>
            {/* Today marker — restrained */}
            {todayPct != null && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-amber-400/40"
                style={{
                  left: `calc(${labelWidth}px + (100% - ${labelWidth}px) * ${todayPct / 100})`,
                }}
              >
                <span className="absolute left-1/2 top-1.5 -translate-x-1/2 rounded-md bg-slate-700/90 px-2 py-0.5 text-[10px] font-medium tracking-wide text-slate-300 ring-1 ring-slate-600/50">
                  Today
                </span>
              </div>
            )}

            <div className="timeline-rows flex flex-1 flex-col overflow-auto py-0.5 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-slate-800/30 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-600/50 [&::-webkit-scrollbar-thumb]:hover:bg-slate-500/50">
              {tasks.map((task) => {
                const startDay = daysBetween(projectStartDate, startOfDay(task.startDate));
                const endDay = daysBetween(projectStartDate, startOfDay(task.endDate));
                const leftPct = Math.max(0, (startDay / totalDays) * 100);
                const spanDays = Math.max(1, endDay - startDay + 1);
                const widthPct = Math.min(100 - leftPct, (spanDays / totalDays) * 100);
                const isCurrent = currentPhaseId === task.id;
                const showDurationInBar = widthPct > 18;
                const isHovered = hoveredTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    className="group flex shrink-0 items-center border-b border-slate-700/30 last:border-b-0"
                    style={{ height: rowHeight }}
                  >
                    {/* Phase label */}
                    <div
                      className="flex shrink-0 items-center pr-5 text-left"
                      style={{ width: labelWidth }}
                    >
                      <span
                        className={
                          isCurrent
                            ? "text-sm font-semibold text-indigo-200"
                            : "text-sm font-medium text-slate-300 group-hover:text-slate-200"
                        }
                      >
                        {task.name}
                      </span>
                      {isCurrent && (
                        <span className="ml-2 rounded-md bg-indigo-500/25 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-indigo-300">
                          Current phase
                        </span>
                      )}
                    </div>

                    {/* Bar track */}
                    <div className="relative flex flex-1 items-center" style={{ minWidth: 0 }}>
                      <div className="relative h-full w-full py-2">
                        <div
                          className="absolute flex items-center"
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            height: barHeight,
                            top: "50%",
                            transform: "translateY(-50%)",
                          }}
                          onMouseEnter={(e) => {
                            setHoveredTaskId(task.id);
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltipAnchor({ x: rect.left + rect.width / 2, y: rect.top });
                          }}
                          onMouseLeave={() => {
                            setHoveredTaskId(null);
                            setTooltipAnchor(null);
                          }}
                        >
                          <div
                            className={
                              "flex h-full w-full items-center justify-center rounded-xl border-2 transition-all duration-150 " +
                              (isCurrent
                                ? "border-indigo-400/70 bg-indigo-500/35 shadow-md shadow-indigo-500/15"
                                : isHovered
                                  ? "border-slate-500/60 bg-slate-600/35"
                                  : "border-slate-600/50 bg-slate-600/20 group-hover:border-slate-500/50 group-hover:bg-slate-600/25")
                            }
                          >
                            {showDurationInBar && (
                              <span
                                className={
                                  "truncate px-2 text-[11px] font-medium " +
                                  (isCurrent ? "text-indigo-100" : "text-slate-300")
                                }
                              >
                                {spanDays} {spanDays === 1 ? "day" : "days"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tooltip */}
            {hoveredTask && tooltipAnchor && (
              <div
                className="pointer-events-none fixed z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-600/80 bg-slate-800 shadow-xl"
                style={{
                  left: tooltipAnchor.x,
                  top: tooltipAnchor.y - 10,
                  minWidth: 200,
                }}
              >
                <div className="p-3">
                  <p className="text-sm font-semibold text-slate-100">{hoveredTask.name}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDate(hoveredTask.startDate)} – {formatDate(hoveredTask.endDate)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {Math.max(1, daysBetween(hoveredTask.startDate, hoveredTask.endDate) + 1)} days
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
