"use client";

import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";

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
  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      backgroundColor: "#1e293b",
      borderColor: "#334155",
      textStyle: { color: "#e2e8f0", fontSize: 12 },
      formatter: (params: unknown) => {
        const p = Array.isArray(params) ? params[0] : params;
        const payload = p as { name?: string; value?: number };
        return `<span style="color:#94a3b8">User</span><br/><span style="color:#f1f5f9;font-weight:600">${payload.name ?? ""}</span><br/><span style="color:#94a3b8">Active tasks</span><br/><span style="color:#e2e8f0;font-weight:600">${payload.value ?? 0}</span>`;
      },
    },
    grid: { ...GRID, left: "20%" },
    xAxis: {
      type: "value",
      axisLabel: AXIS_LABEL,
      splitLine: { lineStyle: { color: "#334155", type: "dashed" as const } },
      axisLine: { show: true, lineStyle: { color: "#334155" } },
    },
    yAxis: {
      type: "category",
      data: users.map((u) => u.name || "Sin nombre"),
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
        itemStyle: { color: "#6366f1", borderRadius: [0, 4, 4, 0] },
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: "100%", minHeight: "200px", width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
    />
  );
}
