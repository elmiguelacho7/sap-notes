"use client";

import Link from "next/link";
import { BarChart3, Ticket } from "lucide-react";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";

export type ProjectAnalyticsSectionProps = {
  projectId: string;
  /** ECharts option for task progress / tasks by status (donut or bar) */
  taskChartOption: EChartsOption | null;
  /** Ticket counts for a simple status block */
  ticketsOpen: number;
  ticketsOverdue: number;
  ticketsUrgent: number;
  loading?: boolean;
};

export function ProjectAnalyticsSection({
  projectId,
  taskChartOption,
  ticketsOpen,
  ticketsOverdue,
  ticketsUrgent,
  loading = false,
}: ProjectAnalyticsSectionProps) {
  return (
    <section aria-labelledby="analytics-heading" className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <h2 id="analytics-heading" className="sr-only">
        Analíticas
      </h2>

      <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5" />
          Progreso de tareas
        </h3>
        <div className="min-h-[200px] flex items-center justify-center">
          {loading ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : taskChartOption == null ? (
            <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-6">
              <BarChart3 className="h-9 w-9 text-slate-600" aria-hidden />
              <p className="text-sm font-medium text-slate-400">Sin datos de tareas aún.</p>
              <p className="text-xs text-slate-500 max-w-[180px]">Crea tareas para ver el desglose por estado.</p>
              <Link
                href={`/projects/${projectId}/tasks`}
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 mt-1"
              >
                Ir a Tareas
              </Link>
            </div>
          ) : (
            <div className="h-[200px] w-full">
              <ReactECharts
                option={taskChartOption}
                style={{ height: "100%", width: "100%" }}
                opts={{ renderer: "canvas" }}
                notMerge
              />
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
          <Ticket className="h-3.5 w-3.5" />
          Tickets
        </h3>
        {loading ? (
          <p className="text-sm text-slate-500 py-8">Cargando…</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Abiertos</span>
              <span className="font-semibold tabular-nums text-slate-100">{ticketsOpen}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Vencidos</span>
              <span className="font-semibold tabular-nums text-slate-100">{ticketsOverdue}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Urgentes</span>
              <span className="font-semibold tabular-nums text-slate-100">{ticketsUrgent}</span>
            </div>
            <Link
              href={`/projects/${projectId}/tickets`}
              className="inline-block mt-4 text-xs font-medium text-indigo-400 hover:text-indigo-300"
            >
              Ver todos los tickets →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
