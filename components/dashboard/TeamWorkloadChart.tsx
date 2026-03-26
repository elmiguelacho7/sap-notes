"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useTranslations } from "next-intl";

type TeamWorkloadUser = { id: string; name: string; taskCount: number };

const GRID = {
  left: "12%",
  right: "10%",
  top: "8%",
  bottom: "12%",
  containLabel: true,
};

const AXIS_LABEL = {
  color: "#94a3b8",
  fontSize: 11,
};

export function TeamWorkloadChart({ users }: { users: TeamWorkloadUser[] }) {
  const t = useTranslations("dashboard.workload.chart");

  const option: EChartsOption = useMemo(() => {
    const tUser = t("tooltipUser");
    const tTasks = t("tooltipTasks");
    const unnamed = t("unnamedUser");
    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: "#ffffff",
        borderColor: "#d8e2de",
        textStyle: { color: "#0f172a", fontSize: 12 },
        formatter: (params: unknown) => {
          const p = Array.isArray(params) ? params[0] : params;
          const payload = p as { name?: string; value?: number };
          return `<span style="color:#64748b">${tUser}</span><br/><span style="color:#0f172a;font-weight:600">${payload.name ?? ""}</span><br/><span style="color:#64748b">${tTasks}</span><br/><span style="color:#0f172a;font-weight:600">${payload.value ?? 0}</span>`;
        },
      },
      grid: { ...GRID, left: "20%" },
      xAxis: {
        type: "value",
        axisLabel: AXIS_LABEL,
        splitLine: { lineStyle: { color: "#d6e0dc", type: "dashed" as const } },
        axisLine: { show: true, lineStyle: { color: "#d0ddd8" } },
      },
      yAxis: {
        type: "category",
        data: users.map((u) => u.name?.trim() || unnamed),
        axisLabel: { ...AXIS_LABEL, width: 80, overflow: "truncate" },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: "bar",
          barWidth: "60%",
          barMaxWidth: 24,
          data: users.map((u) => u.taskCount),
          itemStyle: { color: "#2a9d67", borderRadius: [0, 4, 4, 0] },
        },
      ],
    };
  }, [users, t]);

  return (
    <ReactECharts
      option={option}
      style={{ height: "100%", minHeight: "200px", width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
    />
  );
}
