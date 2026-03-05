"use client";

import { useMemo } from "react";
import { GanttChart } from "lucide-react";

export type PhaseForGantt = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  sort_order?: number;
  phase_key?: string | null;
};

export type ActivityForGantt = {
  id: string;
  phase_id: string | null;
  name: string;
  start_date: string | null;
  due_date: string | null;
  status?: string | null;
  priority?: string | null;
};

export type TaskForGantt = {
  id: string;
  activity_id: string | null;
  title: string;
  due_date: string | null;
  status?: string | null;
  priority?: string | null;
};

function toDate(v: string | Date): Date {
  if (v instanceof Date) return v;
  const s = String(v).trim();
  return s ? new Date(s.includes("T") ? s : s + "T00:00:00") : new Date(0);
}

function toPercent(t: Date, start: Date, end: Date): number {
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 0;
  const x = (t.getTime() - start.getTime()) / total;
  return Math.max(0, Math.min(100, x * 100));
}

function getWeekTicks(projectStart: Date, projectEnd: Date): Date[] {
  const out: Date[] = [];
  const cur = new Date(projectStart);
  cur.setHours(0, 0, 0, 0);
  const end = projectEnd.getTime();
  while (cur.getTime() <= end) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 7);
  }
  return out;
}

type ProjectGanttProProps = {
  phases: PhaseForGantt[];
  activities?: ActivityForGantt[];
  tasks?: TaskForGantt[];
  projectStart: string | Date;
  projectEnd: string | Date;
  title?: string;
  showLegend?: boolean;
  /** Height of the chart area in pixels */
  height?: number;
};

export default function ProjectGanttPro({
  phases,
  activities = [],
  tasks = [],
  projectStart,
  projectEnd,
  title = "Línea de tiempo",
  showLegend = true,
  height = 320,
}: ProjectGanttProProps) {
  const start = toDate(projectStart);
  const end = toDate(projectEnd);
  const totalMs = end.getTime() - start.getTime();
  const hasRange = totalMs > 0;

  const sortedPhases = useMemo(
    () => [...phases].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [phases]
  );

  const weekTicks = useMemo(() => getWeekTicks(start, end), [start, end]);
  const todayPercent = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (now.getTime() < start.getTime() || now.getTime() > end.getTime()) return null;
    return toPercent(now, start, end);
  }, [start, end]);

  const activitiesByPhase = useMemo(() => {
    const map = new Map<string, ActivityForGantt[]>();
    for (const a of activities) {
      const key = a.phase_id ?? "unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [activities]);

  const trackWidth = Math.max(600, weekTicks.length * 32);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 shrink-0">
            <GanttChart className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Plan visual
            </p>
            <p className="text-sm font-medium text-slate-800 mt-0.5">{title}</p>
          </div>
        </div>
        {showLegend && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600">
              <span className="h-2 w-4 rounded bg-indigo-500/80" />
              Fase
            </span>
            {activities.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600">
                <span className="h-1.5 w-3 rounded-sm bg-slate-400" />
                Actividad
              </span>
            )}
          </div>
        )}
      </div>

      <div className="p-5">
        {!hasRange || sortedPhases.length === 0 ? (
          <div
            className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-sm text-slate-500"
            style={{ height: `${height}px` }}
          >
            Sin fechas o fases para mostrar.
          </div>
        ) : (
          <div className="w-full overflow-x-auto overflow-y-hidden">
            <div className="relative min-w-[600px]" style={{ width: trackWidth + 160 }}>
              {/* Time axis: weekly ticks */}
              <div className="flex border-b border-slate-200 bg-slate-50/80" style={{ marginLeft: 160 }}>
                <div
                  className="shrink-0 border-r border-slate-200 bg-slate-50/80 flex items-end"
                  style={{ width: 160 }}
                />
                <div
                  className="relative shrink-0 flex"
                  style={{ width: trackWidth, height: 28 }}
                >
                  {weekTicks.map((d) => {
                    const pct = toPercent(d, start, end);
                    return (
                      <div
                        key={d.getTime()}
                        className="absolute top-0 bottom-0 border-l border-slate-200 text-[10px] text-slate-400 pl-0.5"
                        style={{ left: `${pct}%` }}
                        title={d.toLocaleDateString("es-ES")}
                      >
                        {pct < 95 && (
                          <span className="whitespace-nowrap">
                            {d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Today line overlay (full height of phase rows) */}
              {todayPercent != null && (
                <div
                  className="absolute top-8 bottom-0 left-0 pointer-events-none z-10"
                  style={{ marginLeft: 160, width: trackWidth }}
                >
                  <div
                    className="w-0.5 h-full bg-rose-400"
                    style={{ marginLeft: `${todayPercent}%` }}
                    title="Hoy"
                  />
                </div>
              )}

              {/* Phase rows */}
              {sortedPhases.map((phase) => {
                const pStart = phase.start_date ? toDate(phase.start_date) : null;
                const pEnd = phase.end_date ? toDate(phase.end_date) : null;
                const leftPct = pStart && pEnd ? toPercent(pStart, start, end) : 0;
                const widthPct = pStart && pEnd ? toPercent(pEnd, start, end) - leftPct : 0;
                const phaseActivities = activitiesByPhase.get(phase.id) ?? [];
                const rowHeight = phaseActivities.length > 0 ? 56 : 40;

                return (
                  <div
                    key={phase.id}
                    className="flex items-stretch border-b border-slate-100 last:border-b-0"
                    style={{ minHeight: rowHeight }}
                  >
                    <div
                      className="shrink-0 border-r border-slate-200 py-2 px-3 flex items-center bg-white"
                      style={{ width: 160 }}
                    >
                      <span className="text-xs font-medium text-slate-800 truncate" title={phase.name}>
                        {phase.name}
                      </span>
                    </div>
                    <div
                      className="relative shrink-0 py-1.5 flex flex-col justify-center gap-0.5"
                      style={{ width: trackWidth }}
                    >
                      {/* Phase bar */}
                      {phase.start_date && phase.end_date && (
                        <div
                          className="absolute top-2 h-5 rounded-lg border border-indigo-200 bg-indigo-500/15 shadow-sm pointer-events-none"
                          style={{
                            left: `${leftPct}%`,
                            width: `${Math.max(2, widthPct)}%`,
                          }}
                          title={`${phase.start_date} – ${phase.end_date}`}
                        />
                      )}
                      {/* Activity markers: short bars below phase bar */}
                      {phaseActivities.slice(0, 8).map((act) => {
                        const aStart = act.start_date ? toDate(act.start_date) : null;
                        const aEnd = act.due_date ? toDate(act.due_date) : act.start_date ? toDate(act.start_date) : null;
                        if (!aStart || !aEnd) return null;
                        const aLeft = toPercent(aStart, start, end);
                        const aWidth = Math.max(2, toPercent(aEnd, start, end) - aLeft);
                        return (
                          <div
                            key={act.id}
                            className="absolute h-2 rounded-sm bg-slate-400/60 border border-slate-300/80 pointer-events-none"
                            style={{
                              top: "50%",
                              marginTop: 2,
                              left: `${aLeft}%`,
                              width: `${aWidth}%`,
                              transform: "translateY(-50%)",
                            }}
                            title={act.name}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
