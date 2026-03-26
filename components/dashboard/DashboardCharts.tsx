"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useLocale, useTranslations } from "next-intl";
import { BarChart3 } from "lucide-react";

type ChartData = {
  ticketsByStatus: { status: string; count: number }[];
  ticketsByClient: { clientName: string; count: number }[];
  activityLast30Days: { date: string; count: number }[];
};

/** Semantic status colors: muted, enterprise-friendly. */
function statusToColor(status: string): string {
  const s = status.toLowerCase().trim();
  if (s === "open" || s === "abierto") return "#d97706"; // amber-600
  if (s === "in_progress" || s === "en progreso" || s === "in progress") return "#0d9488"; // teal-600 (distinct from Ribbit green)
  if (s === "resolved" || s === "resuelto" || s === "cerrado" || s === "closed") return "#059669"; // emerald-600
  if (s === "blocked" || s === "bloqueado") return "#dc2626"; // red-600
  return "#64748b"; // slate-500
}

const GRID = {
  left: "12%",
  right: "8%",
  top: "10%",
  bottom: "15%",
  containLabel: true,
};

const AXIS_LABEL = {
  color: "#94a3b8",
  fontSize: 11,
};

const SPLIT_LINE = {
  lineStyle: { color: "#d6e0dc", type: "dashed" as const },
};

const TOOLTIP_BASE = {
  backgroundColor: "#ffffff",
  borderColor: "#d8e2de",
  textStyle: { color: "#0f172a", fontSize: 12 },
  padding: [10, 12],
  extraCssText: "line-height: 1.5;",
};

export function DashboardCharts({ data }: { data: ChartData }) {
  const t = useTranslations("dashboard.charts");
  const tt = useTranslations("dashboard.charts.tooltip");
  const locale = useLocale();
  const localeTag = locale === "es" ? "es-ES" : "en-US";

  const hasStatus = data.ticketsByStatus.length > 0;
  const hasClient = data.ticketsByClient.length > 0;
  const hasActivity = data.activityLast30Days.some((d) => d.count > 0);

  const statusTotal = data.ticketsByStatus.reduce((acc, d) => acc + d.count, 0);
  const clientTotal = data.ticketsByClient.reduce((acc, d) => acc + d.count, 0);

  const donutOption: EChartsOption | null = useMemo(() => {
    if (!hasStatus) return null;
    return {
      tooltip: {
        ...TOOLTIP_BASE,
        trigger: "item",
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number; percent: number };
          const pc = typeof p.percent === "number" ? p.percent.toFixed(1) : "0";
          return `<span style="color:#64748b">${tt("status")}</span><br/><span style="color:#0f172a;font-weight:600">${p.name}</span><br/><span style="color:#64748b">${tt("count")}</span><br/><span style="color:#0f172a;font-weight:600">${p.value}</span><br/><span style="color:#64748b">${tt("pctOfTotal")}</span><br/><span style="color:#0f172a;font-weight:600">${pc}%</span>`;
        },
      },
      legend: { show: false },
      graphic: [
        {
          type: "text",
          left: "50%",
          top: "48%",
          style: {
            text: t("donutCenter", { count: statusTotal }),
            textAlign: "center",
            fill: "#0f172a",
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 22,
          } as Record<string, unknown>,
          z: 10,
        },
      ] as EChartsOption["graphic"],
      series: [
        {
          type: "pie",
          radius: ["50%", "75%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: "#ffffff", borderWidth: 2 },
          label: {
            show: true,
            color: "#334155",
            fontSize: 11,
            formatter: "{b}: {c}",
          },
          emphasis: { label: { show: true }, itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,0.2)" } },
          data: data.ticketsByStatus.map((d) => ({
            name: d.status,
            value: d.count,
            itemStyle: { color: statusToColor(d.status) },
          })),
        },
      ],
    };
  }, [hasStatus, data.ticketsByStatus, statusTotal, t, tt]);

  const barOption: EChartsOption | null = useMemo(() => {
    if (!hasClient) return null;
    return {
      color: ["#2a9d67"],
      tooltip: {
        ...TOOLTIP_BASE,
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const p = Array.isArray(params) ? params[0] : params;
          const payload = p as { name?: string; value?: number };
          const name = payload.name ?? "";
          const count = payload.value ?? 0;
          const pct = clientTotal > 0 ? ((count / clientTotal) * 100).toFixed(1) : "0";
          return `<span style="color:#64748b">${tt("client")}</span><br/><span style="color:#0f172a;font-weight:600">${name}</span><br/><span style="color:#64748b">${tt("ticketCount")}</span><br/><span style="color:#0f172a;font-weight:600">${count}</span><br/><span style="color:#64748b">${tt("pctOfTotal")}</span><br/><span style="color:#0f172a;font-weight:600">${pct}%</span>`;
        },
      },
      grid: { ...GRID, left: "18%" },
      xAxis: {
        type: "value",
        axisLabel: AXIS_LABEL,
        splitLine: SPLIT_LINE,
        axisLine: { show: true, lineStyle: { color: "#d0ddd8" } },
      },
      yAxis: {
        type: "category",
        data: data.ticketsByClient.slice(0, 8).map((d) => d.clientName),
        axisLabel: { ...AXIS_LABEL, width: 80, overflow: "truncate" },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: "bar",
          barWidth: "60%",
          barMaxWidth: 24,
          data: data.ticketsByClient.slice(0, 8).map((d) => d.count),
          itemStyle: { borderRadius: [0, 4, 4, 0] },
        },
      ],
    };
  }, [hasClient, data.ticketsByClient, clientTotal, tt]);

  const areaOption: EChartsOption | null = useMemo(() => {
    if (!hasActivity) return null;
    return {
      color: ["#2a9d67"],
      tooltip: {
        ...TOOLTIP_BASE,
        trigger: "axis",
        formatter: (params: unknown) => {
          const p = Array.isArray(params) ? params[0] : params;
          const payload = p as { name?: string; value?: number };
          const fullDate = payload.name
            ? new Date(payload.name).toLocaleDateString(localeTag, {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "";
          const count = payload.value ?? 0;
          return `<span style="color:#64748b">${tt("fullDate")}</span><br/><span style="color:#0f172a;font-weight:600">${fullDate}</span><br/><span style="color:#64748b">${tt("eventCount")}</span><br/><span style="color:#0f172a;font-weight:600">${count}</span>`;
        },
      },
      grid: GRID,
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: data.activityLast30Days.map((d) => d.date),
        axisLabel: { ...AXIS_LABEL, formatter: (value: string) => value.slice(5) },
        axisLine: { lineStyle: { color: "#d0ddd8" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: AXIS_LABEL,
        splitLine: SPLIT_LINE,
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 4,
          lineStyle: { width: 2, color: "#63c78e" },
          areaStyle: { color: "rgba(42, 157, 103, 0.16)" },
          data: data.activityLast30Days.map((d) => d.count),
        },
      ],
    };
  }, [hasActivity, data.activityLast30Days, localeTag, tt]);

  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:gap-8">
      <div className="overflow-hidden rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] shadow-sm ring-1 ring-[rgb(var(--rb-surface-border))]/25">
        <div className="border-b border-[rgb(var(--rb-surface-border))]/45 px-5 py-4">
          <h3 className="text-sm font-semibold tracking-tight text-[rgb(var(--rb-text-primary))]">{t("ticketsByStatus")}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-[rgb(var(--rb-text-muted))]">{t("ticketsByStatusSub")}</p>
        </div>
        <div className="flex h-[min(320px,42vw)] min-h-[260px] items-center justify-center p-5 sm:p-6">
          {!hasStatus ? (
            <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-6">
              <BarChart3 className="h-10 w-10 text-[rgb(var(--rb-text-muted))]" aria-hidden />
              <p className="text-sm font-medium text-[rgb(var(--rb-text-secondary))]">{t("emptyTitle")}</p>
              <p className="text-xs text-[rgb(var(--rb-text-muted))] max-w-[200px]">{t("emptySub")}</p>
            </div>
          ) : (
            <ReactECharts option={donutOption!} style={{ height: "100%", width: "100%" }} opts={{ renderer: "canvas" }} notMerge />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/85 bg-[rgb(var(--rb-surface))]/98 rb-depth-card overflow-hidden">
        <div className="px-5 pt-5 pb-1 rb-surface-header">
          <h3 className="text-sm font-semibold tracking-[-0.01em] text-[rgb(var(--rb-text-primary))]">{t("ticketsByClient")}</h3>
          <p className="text-xs text-[rgb(var(--rb-text-muted))] mt-0.5">{t("ticketsByClientSub")}</p>
        </div>
        <div className="p-4 h-[240px] flex items-center justify-center">
          {!hasClient ? (
            <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-6">
              <BarChart3 className="h-10 w-10 text-[rgb(var(--rb-text-muted))]" aria-hidden />
              <p className="text-sm font-medium text-[rgb(var(--rb-text-secondary))]">{t("emptyTitle")}</p>
              <p className="text-xs text-[rgb(var(--rb-text-muted))] max-w-[200px]">{t("emptySub")}</p>
            </div>
          ) : (
            <ReactECharts option={barOption!} style={{ height: "100%", width: "100%" }} opts={{ renderer: "canvas" }} notMerge />
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] shadow-sm ring-1 ring-[rgb(var(--rb-surface-border))]/25">
        <div className="border-b border-[rgb(var(--rb-surface-border))]/45 px-5 py-4">
          <h3 className="text-sm font-semibold tracking-tight text-[rgb(var(--rb-text-primary))]">{t("activity30d")}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-[rgb(var(--rb-text-muted))]">{t("activity30dSub")}</p>
        </div>
        <div className="flex h-[min(320px,42vw)] min-h-[260px] items-center justify-center p-5 sm:p-6">
          {!hasActivity ? (
            <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-6">
              <BarChart3 className="h-10 w-10 text-[rgb(var(--rb-text-muted))]" aria-hidden />
              <p className="text-sm font-medium text-[rgb(var(--rb-text-secondary))]">{t("emptyTitle")}</p>
              <p className="text-xs text-[rgb(var(--rb-text-muted))] max-w-[200px]">{t("emptySub")}</p>
            </div>
          ) : (
            <ReactECharts option={areaOption!} style={{ height: "100%", width: "100%" }} opts={{ renderer: "canvas" }} notMerge />
          )}
        </div>
      </div>
    </section>
  );
}
