"use client";

import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
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
  if (s === "in_progress" || s === "en progreso" || s === "in progress") return "#6366f1"; // indigo-500
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
  lineStyle: { color: "#334155", type: "dashed" as const },
};

const TOOLTIP_BASE = {
  backgroundColor: "#1e293b",
  borderColor: "#334155",
  textStyle: { color: "#e2e8f0", fontSize: 12 },
  padding: [10, 12],
  extraCssText: "line-height: 1.5;",
};

function ChartEmptyState({ message = "No data available yet", sub = "Data will appear here as activity is recorded." }: { message?: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-6">
      <BarChart3 className="h-10 w-10 text-slate-600" aria-hidden />
      <p className="text-sm font-medium text-slate-400">{message}</p>
      <p className="text-xs text-slate-500 max-w-[200px]">{sub}</p>
    </div>
  );
}

export function DashboardCharts({ data }: { data: ChartData }) {
  const hasStatus = data.ticketsByStatus.length > 0;
  const hasClient = data.ticketsByClient.length > 0;
  const hasActivity = data.activityLast30Days.some((d) => d.count > 0);

  const statusTotal = data.ticketsByStatus.reduce((acc, d) => acc + d.count, 0);
  const clientTotal = data.ticketsByClient.reduce((acc, d) => acc + d.count, 0);

  const donutOption: EChartsOption | null = hasStatus
    ? {
        tooltip: {
          ...TOOLTIP_BASE,
          trigger: "item",
          formatter: (params: unknown) => {
            const p = params as { name: string; value: number; percent: number };
            const pc = typeof p.percent === "number" ? p.percent.toFixed(1) : "0";
            return `<span style="color:#94a3b8">Status</span><br/><span style="color:#f1f5f9;font-weight:600">${p.name}</span><br/><span style="color:#94a3b8">Count</span><br/><span style="color:#e2e8f0;font-weight:600">${p.value}</span><br/><span style="color:#94a3b8">% of total</span><br/><span style="color:#e2e8f0;font-weight:600">${pc}%</span>`;
          },
        },
        legend: { show: false },
        graphic: [
          {
            type: "text",
            left: "50%",
            top: "48%",
            style: {
              text: `Tickets\n${statusTotal}`,
              textAlign: "center",
              fill: "#e2e8f0",
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
            itemStyle: { borderColor: "#1e293b", borderWidth: 2 },
            label: {
              show: true,
              color: "#e2e8f0",
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
      }
    : null;

  const barOption: EChartsOption | null = hasClient
    ? {
        color: ["#6366f1"],
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
            return `<span style="color:#94a3b8">Client</span><br/><span style="color:#f1f5f9;font-weight:600">${name}</span><br/><span style="color:#94a3b8">Ticket count</span><br/><span style="color:#e2e8f0;font-weight:600">${count}</span><br/><span style="color:#94a3b8">% of total</span><br/><span style="color:#e2e8f0;font-weight:600">${pct}%</span>`;
          },
        },
        grid: { ...GRID, left: "18%" },
        xAxis: {
          type: "value",
          axisLabel: AXIS_LABEL,
          splitLine: SPLIT_LINE,
          axisLine: { show: true, lineStyle: { color: "#334155" } },
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
      }
    : null;

  const areaOption: EChartsOption | null = hasActivity
    ? {
        color: ["#6366f1"],
        tooltip: {
          ...TOOLTIP_BASE,
          trigger: "axis",
          formatter: (params: unknown) => {
            const p = Array.isArray(params) ? params[0] : params;
            const payload = p as { name?: string; value?: number };
            const fullDate = payload.name
              ? new Date(payload.name).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
              : "";
            const count = payload.value ?? 0;
            return `<span style="color:#94a3b8">Full date</span><br/><span style="color:#f1f5f9;font-weight:600">${fullDate}</span><br/><span style="color:#94a3b8">Event count</span><br/><span style="color:#e2e8f0;font-weight:600">${count}</span>`;
          },
        },
        grid: GRID,
        xAxis: {
          type: "category",
          boundaryGap: false,
          data: data.activityLast30Days.map((d) => d.date),
          axisLabel: { ...AXIS_LABEL, formatter: (value: string) => value.slice(5) },
          axisLine: { lineStyle: { color: "#334155" } },
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
            lineStyle: { width: 2, color: "#6366f1" },
            areaStyle: { color: "rgba(99, 102, 241, 0.18)" },
            data: data.activityLast30Days.map((d) => d.count),
          },
        ],
      }
    : null;

  return (
    <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="rounded-2xl border border-slate-700/80 bg-slate-800/30 shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-1 border-b border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-100">Tickets por estado</h3>
          <p className="text-xs text-slate-500 mt-0.5">Distribución actual</p>
        </div>
        <div className="p-4 h-[240px] flex items-center justify-center">
          {!hasStatus ? (
            <ChartEmptyState />
          ) : (
            <ReactECharts option={donutOption!} style={{ height: "100%", width: "100%" }} opts={{ renderer: "canvas" }} notMerge />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700/80 bg-slate-800/30 shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-1 border-b border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-100">Tickets por cliente</h3>
          <p className="text-xs text-slate-500 mt-0.5">Top clientes</p>
        </div>
        <div className="p-4 h-[240px] flex items-center justify-center">
          {!hasClient ? (
            <ChartEmptyState />
          ) : (
            <ReactECharts option={barOption!} style={{ height: "100%", width: "100%" }} opts={{ renderer: "canvas" }} notMerge />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700/80 bg-slate-800/30 shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-1 border-b border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-100">Actividad últimos 30 días</h3>
          <p className="text-xs text-slate-500 mt-0.5">Eventos por día</p>
        </div>
        <div className="p-4 h-[240px] flex items-center justify-center">
          {!hasActivity ? (
            <ChartEmptyState />
          ) : (
            <ReactECharts option={areaOption!} style={{ height: "100%", width: "100%" }} opts={{ renderer: "canvas" }} notMerge />
          )}
        </div>
      </div>
    </section>
  );
}
