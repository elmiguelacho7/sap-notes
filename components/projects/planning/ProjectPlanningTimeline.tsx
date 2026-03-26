"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ProjectPhase } from "@/lib/services/projectPhaseService";

/** Pixel thresholds for in-bar duration (measured on chart track width). */
const DURATION_WIDE_PX = 72;
const DURATION_MEDIUM_PX = 38;
/** Estimated badge width for overflow checks */
const DURATION_BADGE_EST_PX = 44;

/** Left phase column width (px); must match layout + resize math */
const LABEL_WIDTH_PX = 184;

type DurationTier = "wide" | "medium" | "external";

function getDurationTier(barWidthPx: number, trackWidthPx: number, widthPct: number): DurationTier {
  if (trackWidthPx > 0) {
    if (barWidthPx >= DURATION_WIDE_PX) return "wide";
    if (barWidthPx >= DURATION_MEDIUM_PX) return "medium";
    return "external";
  }
  if (widthPct >= 20) return "wide";
  if (widthPct >= 10) return "medium";
  return "external";
}

function shouldPlaceBadgeLeftOfBar(
  leftPct: number,
  widthPct: number,
  trackWidthPx: number
): boolean {
  const barRightPx = ((leftPct + widthPct) / 100) * trackWidthPx;
  const spaceRight = trackWidthPx - barRightPx;
  if (spaceRight < DURATION_BADGE_EST_PX) return true;
  if (leftPct + widthPct > 86) return true;
  return false;
}

function shouldPlaceBadgeAboveBar(leftPct: number, widthPct: number): boolean {
  return leftPct < 6 && widthPct < 14;
}

export type ProjectPlanningTimelineProps = {
  phases: ProjectPhase[];
  projectStart: string;
  projectEnd: string;
  /** Height of the timeline content area; omit to fill parent flex */
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

function formatDate(d: Date, localeTag: string): string {
  return d.toLocaleDateString(localeTag, { month: "short", day: "numeric", year: "numeric" });
}

function formatDurationShort(days: number, unit: string): string {
  return `${days} ${unit}`;
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

type MonthSegment = {
  label: string;
  leftPct: number;
  widthPct: number;
};

function getMonthLabels(projectStart: Date, projectEnd: Date, localeTag: string): MonthSegment[] {
  const out: MonthSegment[] = [];
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
        label: cur.toLocaleDateString(localeTag, { month: "short", year: "numeric" }),
        leftPct,
        widthPct,
      });
    }
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

/** Vertical grid positions (0–100) for month starts + quarter lines inside wide months */
function getVerticalGridPcts(segments: MonthSegment[]): number[] {
  const set = new Set<number>();
  for (const m of segments) {
    set.add(Number(m.leftPct.toFixed(4)));
    if (m.widthPct >= 4) {
      for (let q = 1; q <= 3; q++) {
        set.add(Number((m.leftPct + (m.widthPct * q) / 4).toFixed(4)));
      }
    }
  }
  return Array.from(set).sort((a, b) => a - b);
}

/**
 * Phase bars — executive timeline: dual-row scale, grid, today reference, refined bars & tooltip.
 */
export function ProjectPlanningTimeline({
  phases,
  projectStart,
  projectEnd,
  height = 380,
}: ProjectPlanningTimelineProps) {
  const t = useTranslations("planning");
  const locale = useLocale();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<{ x: number; y: number } | null>(null);
  const timelineRowsRef = useRef<HTMLDivElement | null>(null);
  const [chartTrackWidthPx, setChartTrackWidthPx] = useState(0);

  const projectStartDate = useMemo(() => parseDate(projectStart) ?? new Date(), [projectStart]);
  const projectEndDate = useMemo(() => {
    const parsed = parseDate(projectEnd);
    if (parsed) return parsed;
    const start = parseDate(projectStart) ?? new Date();
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    return end;
  }, [projectEnd, projectStart]);

  const tasks = useMemo(() => getTimelineTasks(phases), [phases]);
  const currentPhaseId = useMemo(() => getCurrentPhaseId(tasks), [tasks]);

  useEffect(() => {
    const el = timelineRowsRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.clientWidth - LABEL_WIDTH_PX;
      setChartTrackWidthPx(Math.max(0, w));
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [tasks.length]);

  const totalDays = useMemo(
    () => Math.max(1, daysBetween(projectStartDate, projectEndDate)),
    [projectStartDate, projectEndDate]
  );

  const todayPct = useMemo(() => {
    const today = startOfDay(new Date());
    if (today.getTime() < projectStartDate.getTime() || today.getTime() > projectEndDate.getTime()) return null;
    return (daysBetween(projectStartDate, today) / totalDays) * 100;
  }, [projectStartDate, projectEndDate, totalDays]);

  const monthSegments = useMemo(
    () => getMonthLabels(projectStartDate, projectEndDate, localeTag),
    [projectStartDate, projectEndDate, localeTag]
  );

  const gridPcts = useMemo(() => getVerticalGridPcts(monthSegments), [monthSegments]);

  const rowHeight = 60;
  const barHeight = 36;
  const labelWidth = LABEL_WIDTH_PX;
  const scaleHeaderHeight = 58;

  const hoveredTask = hoveredTaskId ? tasks.find((t) => t.id === hoveredTaskId) : null;
  const hoveredDurationDays = hoveredTask
    ? Math.max(1, daysBetween(hoveredTask.startDate, hoveredTask.endDate) + 1)
    : 0;

  const rootStyle = height != null ? { height: `${height}px` } : undefined;
  const rootClass =
    "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/25 " +
    (height == null ? "h-full" : "");

  const gridLineClass = "absolute top-0 bottom-0 w-px bg-slate-200/95";

  return (
    <div className={rootClass} style={rootStyle}>
      {/* Time scale: months + intra-month subdivisions */}
      <div
        className="flex shrink-0 flex-col border-b border-slate-200/90 bg-slate-50/90"
        style={{ minHeight: scaleHeaderHeight, paddingLeft: labelWidth }}
      >
        <div className="relative min-h-[28px] flex-1 border-b border-slate-200/80">
          {monthSegments.map((m, i) => (
            <div
              key={`m-${i}`}
              className="absolute inset-y-0 flex items-center border-r border-slate-200/90 pl-2.5 pr-1"
              style={{
                left: `${m.leftPct}%`,
                width: `${m.widthPct}%`,
              }}
            >
              <span className="truncate text-[11px] font-semibold text-slate-600">{m.label}</span>
            </div>
          ))}
        </div>
        <div className="relative min-h-[26px] flex-1">
          {monthSegments.map((m, mi) => {
            const showQuarterLabels = m.widthPct >= 7;
            return (
              <div
                key={`sub-${mi}`}
                className="absolute inset-y-0 flex"
                style={{ left: `${m.leftPct}%`, width: `${m.widthPct}%` }}
              >
                {[0, 1, 2, 3].map((q) => (
                  <div
                    key={q}
                    className="relative flex flex-1 items-end justify-center border-l border-slate-800/80 pb-1 first:border-l-0"
                  >
                    {showQuarterLabels ? (
                      <span className="text-[10px] tabular-nums text-slate-500">{q + 1}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline body */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {tasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-4 py-10">
            <p className="text-center text-sm text-slate-600 font-medium">
              {t("timeline.empty")}
            </p>
          </div>
        ) : (
          <>
            {/* Vertical grid (chart area only) */}
            <div
              className="pointer-events-none absolute z-0 overflow-hidden"
              style={{
                left: labelWidth,
                right: 0,
                top: 0,
                bottom: 0,
              }}
            >
              {gridPcts.map((pct, gi) => (
                <div key={`${pct}-${gi}`} className={gridLineClass} style={{ left: `${pct}%` }} />
              ))}
            </div>

            {/* Today: top-aligned marker + full-height line */}
            {todayPct != null && (
              <div
                className="pointer-events-none absolute inset-0 z-[11] min-h-0"
                style={{ paddingLeft: labelWidth }}
              >
                <div className="relative h-full min-h-0 w-full">
                  <div
                    className="absolute top-0 bottom-0 flex w-0 flex-col items-center"
                    style={{
                      left: `${todayPct}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <div className="flex shrink-0 flex-col items-center bg-slate-900/30">
                      <span className="whitespace-nowrap border-b border-amber-400/40 bg-slate-900/95 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100/95">
                        {t("timeline.today")}
                      </span>
                      <div className="h-1 w-px shrink-0 bg-amber-400/55" aria-hidden />
                    </div>
                    <div className="w-px flex-1 bg-amber-400/45" aria-hidden />
                  </div>
                </div>
              </div>
            )}

            <div
              ref={timelineRowsRef}
              className="timeline-rows relative z-[1] flex min-h-0 flex-1 flex-col overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/90 [&::-webkit-scrollbar-thumb]:hover:bg-slate-400/90"
            >
              {tasks.map((task) => {
                const startDay = daysBetween(projectStartDate, startOfDay(task.startDate));
                const endDay = daysBetween(projectStartDate, startOfDay(task.endDate));
                const leftPct = Math.max(0, (startDay / totalDays) * 100);
                const spanDays = Math.max(1, endDay - startDay + 1);
                const widthPct = Math.min(100 - leftPct, (spanDays / totalDays) * 100);
                const isCurrent = currentPhaseId === task.id;
                const isHovered = hoveredTaskId === task.id;

                const barWidthPx =
                  chartTrackWidthPx > 0 ? (widthPct / 100) * chartTrackWidthPx : 0;
                const tier = getDurationTier(barWidthPx, chartTrackWidthPx, widthPct);
                const badgeLeft =
                  tier === "external" &&
                  chartTrackWidthPx > 0 &&
                  shouldPlaceBadgeLeftOfBar(leftPct, widthPct, chartTrackWidthPx);
                const badgeAbove =
                  tier === "external" &&
                  shouldPlaceBadgeAboveBar(leftPct, widthPct) &&
                  !badgeLeft;

                const durationBadgeClass =
                  "z-[2] whitespace-nowrap rounded-md border border-slate-200/90 bg-white px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-700 shadow-sm";

                const onBarHoverEnter = (e: MouseEvent<HTMLElement>) => {
                  setHoveredTaskId(task.id);
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltipAnchor({ x: rect.left + rect.width / 2, y: rect.top });
                };
                const onBarHoverLeave = () => {
                  setHoveredTaskId(null);
                  setTooltipAnchor(null);
                };

                return (
                  <div
                    key={task.id}
                    className={
                      "group flex shrink-0 items-stretch border-b border-slate-100 transition-colors last:border-b-0 " +
                      (isCurrent
                        ? "bg-indigo-50/95"
                        : "hover:bg-slate-50/95")
                    }
                    style={{ minHeight: rowHeight }}
                  >
                    <div
                      className={
                        "flex shrink-0 flex-col justify-center border-r border-slate-200/90 py-2.5 pl-3 pr-4 " +
                        "bg-slate-50/80 " +
                        (isCurrent
                          ? "shadow-[inset_3px_0_0_rgba(99,102,241,0.65)] bg-indigo-50/60"
                          : "")
                      }
                      style={{ width: labelWidth }}
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{task.name}</span>
                          {isCurrent ? (
                            <span className="shrink-0 rounded-md border border-indigo-200/90 bg-indigo-100/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-900">
                              {t("timeline.current")}
                            </span>
                          ) : null}
                        </div>
                        {task.phaseKey ? (
                          <span className="truncate text-xs text-slate-500 font-medium">{task.phaseKey}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="relative flex min-w-0 flex-1 items-center bg-white py-2.5 pr-3">
                      <div className="relative h-full min-h-[36px] w-full">
                        <div
                          className="absolute flex items-center"
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            height: barHeight,
                            top: "50%",
                            transform: "translateY(-50%)",
                          }}
                        >
                          <div
                            className="relative h-full min-h-0 w-full min-w-0"
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
                                "flex h-full w-full min-w-0 items-center rounded-lg border transition-colors duration-150 " +
                                "ring-1 ring-inset ring-slate-200/60 shadow-sm " +
                                (isCurrent
                                  ? "border-indigo-300/90 bg-indigo-200/70"
                                  : isHovered
                                    ? "border-slate-300/90 bg-slate-200/70"
                                    : "border-slate-200/90 bg-slate-100/90 group-hover:border-slate-300 group-hover:bg-slate-100") +
                                (tier === "external" ? " px-1" : " px-2")
                              }
                            >
                              {tier === "wide" ? (
                                <span
                                  className={
                                    "w-full truncate text-center text-[11px] font-semibold tabular-nums " +
                                    (isCurrent ? "text-indigo-950" : "text-slate-700")
                                  }
                                >
                                  {formatDurationShort(spanDays, t("timeline.durationUnitShort"))}
                                </span>
                              ) : null}
                              {tier === "medium" ? (
                                <span
                                  className={
                                    "w-full truncate text-center text-[10px] font-semibold tabular-nums tracking-tight " +
                                    (isCurrent ? "text-indigo-950" : "text-slate-700")
                                  }
                                >
                                  {formatDurationShort(spanDays, t("timeline.durationUnitShortCompact"))}
                                </span>
                              ) : null}
                            </div>
                            {tier === "external" ? (
                              <span
                                className={`absolute ${durationBadgeClass} ${
                                  badgeAbove
                                    ? "bottom-full left-1/2 mb-0.5 -translate-x-1/2"
                                    : badgeLeft
                                      ? "top-1/2 right-full mr-1 -translate-y-1/2"
                                      : "top-1/2 left-full ml-1 -translate-y-1/2"
                                }`}
                                onMouseEnter={onBarHoverEnter}
                                onMouseLeave={onBarHoverLeave}
                              >
                                {formatDurationShort(spanDays, t("timeline.durationUnitShort"))}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {hoveredTask && tooltipAnchor && (
              <div
                className="pointer-events-none fixed z-20 -translate-x-1/2 -translate-y-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-lg shadow-slate-900/10"
                style={{
                  left: tooltipAnchor.x,
                  top: tooltipAnchor.y - 8,
                  minWidth: 220,
                }}
              >
                <p className="text-sm font-semibold tracking-tight text-slate-900">{hoveredTask.name}</p>
                <div className="mt-2.5 space-y-1.5 border-t border-slate-100 pt-2.5">
                  <p className="text-[11px] leading-snug text-slate-600">
                    {t("timeline.tooltip.start")}{" "}
                    <span className="font-medium text-slate-900">{formatDate(hoveredTask.startDate, localeTag)}</span>
                  </p>
                  <p className="text-[11px] leading-snug text-slate-600">
                    {t("timeline.tooltip.end")}{" "}
                    <span className="font-medium text-slate-900">{formatDate(hoveredTask.endDate, localeTag)}</span>
                  </p>
                  <p className="text-[11px] font-semibold tabular-nums text-slate-700">
                    {t("timeline.tooltip.duration")} {t("emDash")} {formatDurationShort(hoveredDurationDays, t("timeline.durationUnitShort"))}
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
