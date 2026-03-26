"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  Building2,
  PauseCircle,
  Ticket,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/Skeleton";
import { AppPageShell } from "@/components/ui/layout/AppPageShell";

type StatusCount = { status: string; count: number };
type ActivityDayCount = { date: string; count: number };
type InsightProject = { projectId: string; projectName: string; count: number };
type AssigneeCount = { id: string; label: string; count: number };

const FETCH_LIMIT = 8000;

function humanizeStatus(status: string | null | undefined) {
  const s = String(status ?? "").trim();
  if (!s) return "Unknown";
  const withSpaces = s.replace(/_/g, " ");
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function statusToColor(status: string): string {
  const s = status.toLowerCase().trim();
  if (s === "open" || s === "abierto") return "#d97706";
  if (s === "in_progress" || s === "in progress" || s === "en progreso") return "#6366f1";
  if (s === "resolved" || s === "resuelto" || s === "closed" || s === "cerrado" || s === "done")
    return "#059669";
  if (s === "blocked" || s === "bloqueado") return "#dc2626";
  if (s === "pending" || s === "todo") return "#64748b";
  return "#94a3b8";
}

const TOOLTIP_BASE = {
  backgroundColor: "#ffffff",
  borderColor: "#e2e8f0",
  textStyle: { color: "#0f172a", fontSize: 12 },
  padding: [10, 12],
  extraCssText: "line-height: 1.5;",
};

const AXIS_LABEL = {
  color: "#64748b",
  fontSize: 11,
};

const SPLIT_LINE = {
  lineStyle: { color: "#e2e8f0", type: "dashed" as const },
};

const GRID = {
  left: "10%",
  right: "6%",
  top: "12%",
  bottom: "18%",
  containLabel: true,
};

function ChartEmptyState({
  message = "Not enough data yet to display insights.",
}: {
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-center px-2 py-12">
      <BarChart3 className="h-9 w-9 text-slate-400" aria-hidden />
      <p className="text-sm font-medium text-slate-600">{message}</p>
    </div>
  );
}

/** Single card system for all report blocks (matches module / My Work density). */
function ReportCard({
  title,
  subtitle,
  children,
  emphasis = "default",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Primary distribution cards use slightly stronger title weight. */
  emphasis?: "default" | "primary";
}) {
  const titleClass =
    emphasis === "primary"
      ? "text-sm font-semibold text-slate-900"
      : "text-sm font-semibold text-slate-900";
  return (
    <section className="rounded-2xl border border-slate-200/85 bg-white p-5 space-y-4 w-full min-w-0 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
      <div className="space-y-1 min-w-0">
        <h2 className={titleClass}>{title}</h2>
        {subtitle ? <p className="text-xs text-slate-600 leading-snug">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function KpiTile({
  label,
  value,
  loading,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  loading: boolean;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "rose" | "amber";
}) {
  const border =
    tone === "rose"
      ? "border-rose-200/90 bg-rose-50/60 ring-1 ring-rose-100/70"
      : tone === "amber"
        ? "border-amber-200/90 bg-amber-50/55 ring-1 ring-amber-100/70"
        : "border-slate-200/90 bg-white ring-1 ring-slate-100";
  const labelClass =
    tone === "rose"
      ? "text-rose-800"
      : tone === "amber"
        ? "text-amber-900"
        : "text-slate-500";
  const valueClass =
    tone === "rose" ? "text-rose-900" : tone === "amber" ? "text-amber-900" : "text-slate-900";
  const iconClass =
    tone === "rose" ? "text-rose-700" : tone === "amber" ? "text-amber-800" : "text-slate-400";

  return (
    <div className={`rounded-2xl border p-3 space-y-0 shadow-sm ${border}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} aria-hidden />
        <p className={`text-[11px] font-medium uppercase tracking-wide ${labelClass}`}>{label}</p>
      </div>
      <div className={`mt-2 text-base font-semibold tabular-nums ${valueClass}`}>
        {loading ? <Skeleton className="h-7 w-14" /> : value}
      </div>
    </div>
  );
}

function DonutChart({
  data,
  centerTop,
  centerBottom,
}: {
  data: StatusCount[];
  centerTop: string;
  centerBottom: string;
}) {
  const total = useMemo(() => data.reduce((acc, d) => acc + d.count, 0), [data]);
  const hasData = data.length > 0 && total > 0;
  const option: EChartsOption | null = hasData
    ? ({
        backgroundColor: "transparent",
        tooltip: {
          ...TOOLTIP_BASE,
          trigger: "item",
          formatter: (params: unknown) => {
            const p = params as { name: string; value: number; percent: number };
            const pct = typeof p.percent === "number" ? p.percent.toFixed(1) : "0";
            return `<span style="color:#64748b">Status</span><br/><span style="color:#0f172a;font-weight:600">${p.name}</span><br/><span style="color:#64748b">Count</span><br/><span style="color:#0f172a;font-weight:600">${p.value}</span><br/><span style="color:#64748b">Share</span><br/><span style="color:#0f172a;font-weight:600">${pct}%</span>`;
          },
        },
        legend: { show: false },
        graphic: [
          {
            type: "text",
            left: "50%",
            top: "48%",
            style: {
              text: `${centerTop}\n${centerBottom}`,
              textAlign: "center",
              fill: "#0f172a",
              fontSize: 14,
              fontWeight: 650,
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
              color: "#0f172a",
              fontSize: 11,
              formatter: "{b}: {c}",
            },
            emphasis: {
              label: { show: true },
              itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,0.2)" },
            },
            data: data.map((d) => ({
              name: d.status,
              value: d.count,
              itemStyle: { color: statusToColor(d.status) },
            })),
          },
        ],
      }) satisfies EChartsOption
    : null;

  return (
    <div className="h-[280px] w-full min-h-[280px] flex items-center justify-center">
      {!hasData || !option ? (
        <ChartEmptyState />
      ) : (
        <ReactECharts
          option={option}
          style={{ height: "100%", width: "100%" }}
          opts={{ renderer: "canvas" }}
          notMerge
        />
      )}
    </div>
  );
}

function VerticalBarChart({ data, yAxisName }: { data: StatusCount[]; yAxisName: string }) {
  const total = useMemo(() => data.reduce((acc, d) => acc + d.count, 0), [data]);
  const hasData = data.length > 0 && total > 0;
  const sorted = useMemo(() => [...data].sort((a, b) => b.count - a.count), [data]);

  const option: EChartsOption | null = hasData
    ? ({
        backgroundColor: "transparent",
        color: ["#64748b"],
        tooltip: {
          ...TOOLTIP_BASE,
          trigger: "axis",
          axisPointer: { type: "shadow" },
          formatter: (params: unknown) => {
            const p = Array.isArray(params) ? params[0] : params;
            const payload = p as { name?: string; value?: number };
            return `<span style="color:#64748b">${yAxisName}</span><br/><span style="color:#0f172a;font-weight:600">${payload.name ?? ""}</span><br/><span style="color:#64748b">Count</span><br/><span style="color:#0f172a;font-weight:600">${payload.value ?? 0}</span>`;
          },
        },
        grid: GRID,
        xAxis: {
          type: "category",
          data: sorted.map((d) => d.status),
          axisLabel: { ...AXIS_LABEL, rotate: sorted.length > 6 ? 35 : 0, interval: 0 },
          axisLine: { lineStyle: { color: "#e2e8f0" } },
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
            type: "bar",
            barMaxWidth: 36,
            data: sorted.map((d) => ({
              value: d.count,
              itemStyle: { color: statusToColor(d.status), borderRadius: [6, 6, 0, 0] },
            })),
          },
        ],
      }) satisfies EChartsOption
    : null;

  return (
    <div className="h-[280px] w-full min-h-[280px] flex items-center justify-center">
      {!hasData || !option ? (
        <ChartEmptyState />
      ) : (
        <ReactECharts
          option={option}
          style={{ height: "100%", width: "100%" }}
          opts={{ renderer: "canvas" }}
          notMerge
        />
      )}
    </div>
  );
}

function ActivityLineChart({ data }: { data: ActivityDayCount[] }) {
  const hasData = data.some((d) => d.count > 0);
  const option: EChartsOption | null = hasData
    ? ({
        backgroundColor: "transparent",
        color: ["#4ade80"],
        tooltip: {
          ...TOOLTIP_BASE,
          trigger: "axis",
          formatter: (params: unknown) => {
            const p = Array.isArray(params) ? params[0] : params;
            const payload = p as { name?: string; value?: number };
            const fullDate = payload.name
              ? new Date(payload.name).toLocaleDateString("en-US", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })
              : "";
            return `<span style="color:#64748b">Activity</span><br/><span style="color:#0f172a;font-weight:600">${fullDate}</span><br/><span style="color:#64748b">Events</span><br/><span style="color:#0f172a;font-weight:600">${payload.value ?? 0}</span>`;
          },
        },
        grid: GRID,
        xAxis: {
          type: "category",
          boundaryGap: false,
          data: data.map((d) => d.date),
          axisLabel: { ...AXIS_LABEL, formatter: (value: string) => value.slice(5) },
          axisLine: { lineStyle: { color: "#e2e8f0" } },
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
            lineStyle: { width: 2, color: "#4ade80" },
            areaStyle: { color: "rgba(74, 222, 128, 0.12)" },
            data: data.map((d) => d.count),
          },
        ],
      }) satisfies EChartsOption
    : null;

  return (
    <div className="h-[240px] w-full min-h-[240px] flex items-center justify-center">
      {!hasData || !option ? (
        <ChartEmptyState />
      ) : (
        <ReactECharts
          option={option}
          style={{ height: "100%", width: "100%" }}
          opts={{ renderer: "canvas" }}
          notMerge
        />
      )}
    </div>
  );
}

function WorkloadBarChart({ data, title }: { data: AssigneeCount[]; title: string }) {
  const top = useMemo(() => data.slice(0, 10), [data]);
  const total = useMemo(() => top.reduce((acc, d) => acc + d.count, 0), [top]);
  const hasData = top.length > 0 && total > 0;

  const option: EChartsOption | null = hasData
    ? ({
        backgroundColor: "transparent",
        color: ["#64748b"],
        tooltip: {
          ...TOOLTIP_BASE,
          trigger: "axis",
          axisPointer: { type: "shadow" },
          formatter: (params: unknown) => {
            const p = Array.isArray(params) ? params[0] : params;
            const payload = p as { name?: string; value?: number };
            return `<span style="color:#64748b">${title}</span><br/><span style="color:#0f172a;font-weight:600">${payload.name ?? ""}</span><br/><span style="color:#64748b">Count</span><br/><span style="color:#0f172a;font-weight:600">${payload.value ?? 0}</span>`;
          },
        },
        grid: { ...GRID, left: "22%" },
        xAxis: {
          type: "value",
          axisLabel: AXIS_LABEL,
          splitLine: SPLIT_LINE,
          axisLine: { show: true, lineStyle: { color: "#e2e8f0" } },
        },
        yAxis: {
          type: "category",
          data: top.map((d) => d.label),
          axisLabel: { ...AXIS_LABEL, width: 100, overflow: "truncate" },
          axisLine: { show: false },
          axisTick: { show: false },
        },
        series: [
          {
            type: "bar",
            barWidth: "65%",
            barMaxWidth: 22,
            data: top.map((d) => d.count),
            itemStyle: { color: "#64748b", borderRadius: [0, 6, 6, 0] },
          },
        ],
      }) satisfies EChartsOption
    : null;

  return (
    <div className="h-[260px] w-full min-h-[260px] flex items-center justify-center">
      {!hasData || !option ? (
        <ChartEmptyState message="No assignee workload in view." />
      ) : (
        <ReactECharts
          option={option}
          style={{ height: "100%", width: "100%" }}
          opts={{ renderer: "canvas" }}
          notMerge
        />
      )}
    </div>
  );
}

function buildActivitySeries(
  projectRows: Array<{ created_at?: string }>,
  taskRows: Array<{ created_at?: string }>,
  ticketRows: Array<{ updated_at?: string }>
): ActivityDayCount[] {
  const dayCounts: Record<string, number> = {};
  for (let d = 0; d < 31; d++) {
    const day = new Date();
    day.setDate(day.getDate() - (30 - d));
    day.setHours(0, 0, 0, 0);
    dayCounts[day.toISOString().slice(0, 10)] = 0;
  }
  const addDay = (iso: string | null | undefined) => {
    if (!iso) return;
    const date = iso.slice(0, 10);
    if (dayCounts[date] !== undefined) dayCounts[date]++;
  };
  projectRows.forEach((r) => addDay(r.created_at));
  taskRows.forEach((r) => addDay(r.created_at));
  ticketRows.forEach((r) => addDay(r.updated_at));
  return Object.entries(dayCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

function isProjectActive(status: string | null | undefined) {
  const s = String(status ?? "").toLowerCase().trim();
  if (!s) return true;
  return !["archived", "cancelled", "closed", "completed"].includes(s);
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);

  const [activeProjects, setActiveProjects] = useState(0);
  const [openTickets, setOpenTickets] = useState(0);
  const [overdueTasks, setOverdueTasks] = useState(0);
  const [blockedTasks, setBlockedTasks] = useState(0);
  const [activeClients, setActiveClients] = useState(0);

  const [ticketsByStatus, setTicketsByStatus] = useState<StatusCount[]>([]);
  const [tasksByStatus, setTasksByStatus] = useState<StatusCount[]>([]);
  const [activityLast30Days, setActivityLast30Days] = useState<ActivityDayCount[]>([]);

  const [topOpenTicketProjects, setTopOpenTicketProjects] = useState<InsightProject[]>([]);
  const [topOverdueProjects, setTopOverdueProjects] = useState<InsightProject[]>([]);

  const [tasksByAssignee, setTasksByAssignee] = useState<AssigneeCount[]>([]);
  const [ticketsByAssignee, setTicketsByAssignee] = useState<AssigneeCount[]>([]);
  const [hasSnapshotData, setHasSnapshotData] = useState(true);

  const todayIso = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t.toISOString().slice(0, 10);
  }, []);

  const thirtyDaysAgoIso = useMemo(() => {
    const t = new Date();
    t.setDate(t.getDate() - 30);
    return t.toISOString();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setWarning(null);

    const failures: string[] = [];

    const settled = await Promise.allSettled([
      supabase.from("projects").select("id,name,status,created_at").limit(FETCH_LIMIT),
      supabase.from("tickets").select("id,project_id,status,assigned_to,created_at,updated_at").limit(FETCH_LIMIT),
      supabase
        .from("tasks")
        .select("id,project_id,status_id,assignee_id,due_date,created_at")
        .limit(FETCH_LIMIT),
      supabase
        .from("project_tasks")
        .select("id,project_id,status,assignee_profile_id,due_date,created_at")
        .limit(FETCH_LIMIT),
      supabase.from("task_statuses").select("id,code").eq("is_active", true),
      supabase.from("projects").select("created_at").gte("created_at", thirtyDaysAgoIso).limit(FETCH_LIMIT),
      supabase.from("project_tasks").select("created_at").gte("created_at", thirtyDaysAgoIso).limit(FETCH_LIMIT),
      supabase.from("tickets").select("updated_at").gte("updated_at", thirtyDaysAgoIso).limit(FETCH_LIMIT),
      supabase.from("clients").select("id", { count: "exact", head: true }),
    ]);

    const pick = <T,>(i: number, label: string): T[] => {
      const r = settled[i];
      if (r.status !== "fulfilled" || r.value.error) {
        failures.push(label);
        return [];
      }
      return (r.value.data ?? []) as T[];
    };

    const projects = pick<{ id: string; name: string; status: string | null; created_at: string }>(
      0,
      "projects"
    );
    const tickets = pick<{
      id: string;
      project_id: string | null;
      status: string | null;
      assigned_to: string | null;
      created_at: string;
      updated_at: string | null;
    }>(1, "tickets");
    const globalTasks = pick<{
      id: string;
      project_id: string | null;
      status_id: string;
      assignee_id: string | null;
      due_date: string | null;
      created_at: string;
    }>(2, "tasks");
    const projectTasks = pick<{
      id: string;
      project_id: string | null;
      status: string | null;
      assignee_profile_id: string | null;
      due_date: string | null;
      created_at: string;
    }>(3, "project_tasks");

    const statusRows = settled[4];
    const taskCodeById = new Map<string, string>();
    if (statusRows.status === "fulfilled" && !statusRows.value.error) {
      for (const s of (statusRows.value.data ?? []) as Array<{ id: string; code: string }>) {
        taskCodeById.set(s.id, s.code);
      }
    } else {
      failures.push("task_statuses");
    }

    const activityProjects = pick<{ created_at: string }>(5, "activity_projects");
    const activityTasks = pick<{ created_at: string }>(6, "activity_tasks");
    const activityTickets = pick<{ updated_at: string }>(7, "activity_tickets");

    let clientsCount = 0;
    const clientsRes = settled[8];
    if (clientsRes.status === "fulfilled" && !clientsRes.value.error && typeof clientsRes.value.count === "number") {
      clientsCount = clientsRes.value.count;
    }

    const projectNameById = new Map(projects.map((p) => [p.id, p.name]));

    setActiveProjects(projects.filter((p) => isProjectActive(p.status)).length);

    const openTix = tickets.filter((t) => {
      const st = String(t.status ?? "").toLowerCase().trim();
      return st !== "closed" && st !== "resolved";
    });
    setOpenTickets(openTix.length);

    const isDoneGlobal = (code: string | undefined) => String(code ?? "").toUpperCase() === "DONE";
    const isBlockedGlobal = (code: string | undefined) => String(code ?? "").toUpperCase() === "BLOCKED";
    const overdueGlobal = globalTasks.filter((t) => {
      if (!t.due_date) return false;
      if (isDoneGlobal(taskCodeById.get(t.status_id))) return false;
      return t.due_date < todayIso;
    });
    const overdueProject = projectTasks.filter((t) => {
      if (!t.due_date) return false;
      if (String(t.status ?? "").toLowerCase().trim() === "done") return false;
      return t.due_date < todayIso;
    });
    setOverdueTasks(overdueGlobal.length + overdueProject.length);

    const blockedG = globalTasks.filter((t) => isBlockedGlobal(taskCodeById.get(t.status_id)));
    const blockedP = projectTasks.filter((t) => String(t.status ?? "").toLowerCase().trim() === "blocked");
    setBlockedTasks(blockedG.length + blockedP.length);

    setActiveClients(clientsCount);

    const tixStatusMap = new Map<string, number>();
    tickets.forEach((t) => {
      const key = humanizeStatus(t.status ?? "open");
      tixStatusMap.set(key, (tixStatusMap.get(key) ?? 0) + 1);
    });
    setTicketsByStatus(
      Array.from(tixStatusMap.entries()).map(([status, count]) => ({ status, count }))
    );

    const taskStatusMap = new Map<string, number>();
    globalTasks.forEach((t) => {
      const code = taskCodeById.get(t.status_id);
      const label = humanizeStatus(code ? code.toLowerCase() : "unknown");
      taskStatusMap.set(label, (taskStatusMap.get(label) ?? 0) + 1);
    });
    projectTasks.forEach((t) => {
      const label = humanizeStatus(t.status);
      taskStatusMap.set(label, (taskStatusMap.get(label) ?? 0) + 1);
    });
    setTasksByStatus(Array.from(taskStatusMap.entries()).map(([status, count]) => ({ status, count })));

    setActivityLast30Days(buildActivitySeries(activityProjects, activityTasks, activityTickets));

    const openByProject = new Map<string, number>();
    for (const t of openTix) {
      if (!t.project_id) continue;
      openByProject.set(t.project_id, (openByProject.get(t.project_id) ?? 0) + 1);
    }
    setTopOpenTicketProjects(
      Array.from(openByProject.entries())
        .map(([projectId, count]) => ({
          projectId,
          count,
          projectName: projectNameById.get(projectId) ?? "Project",
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    );

    const overdueByProject = new Map<string, number>();
    for (const t of overdueGlobal) {
      if (!t.project_id) continue;
      overdueByProject.set(t.project_id, (overdueByProject.get(t.project_id) ?? 0) + 1);
    }
    for (const t of overdueProject) {
      if (!t.project_id) continue;
      overdueByProject.set(t.project_id, (overdueByProject.get(t.project_id) ?? 0) + 1);
    }
    setTopOverdueProjects(
      Array.from(overdueByProject.entries())
        .map(([projectId, count]) => ({
          projectId,
          count,
          projectName: projectNameById.get(projectId) ?? "Project",
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    );

    const taskAssigneeIds = new Set<string>();
    globalTasks.forEach((t) => {
      if (t.assignee_id) taskAssigneeIds.add(t.assignee_id);
    });
    projectTasks.forEach((t) => {
      if (t.assignee_profile_id) taskAssigneeIds.add(t.assignee_profile_id);
    });
    const ticketAssigneeIds = new Set<string>();
    openTix.forEach((t) => {
      if (t.assigned_to) ticketAssigneeIds.add(t.assigned_to);
    });

    const allProfileIds = Array.from(
      new Set([...Array.from(taskAssigneeIds), ...Array.from(ticketAssigneeIds)])
    );
    let profileLabel = new Map<string, string>();
    if (allProfileIds.length > 0) {
      const { data: profs, error: pe } = await supabase
        .from("profiles")
        .select("id,full_name,email")
        .in("id", allProfileIds);
      if (pe) failures.push("profiles");
      for (const p of profs ?? []) {
        const row = p as { id: string; full_name?: string | null; email?: string | null };
        const label =
          (row.full_name && row.full_name.trim()) || (row.email && row.email.trim()) || "Member";
        profileLabel.set(row.id, label);
      }
    }

    const taskWorkload = new Map<string, number>();
    globalTasks.forEach((t) => {
      if (!t.assignee_id) return;
      taskWorkload.set(t.assignee_id, (taskWorkload.get(t.assignee_id) ?? 0) + 1);
    });
    projectTasks.forEach((t) => {
      if (!t.assignee_profile_id) return;
      taskWorkload.set(t.assignee_profile_id, (taskWorkload.get(t.assignee_profile_id) ?? 0) + 1);
    });
    setTasksByAssignee(
      Array.from(taskWorkload.entries())
        .map(([id, count]) => ({ id, count, label: profileLabel.get(id) ?? id.slice(0, 8) + "…" }))
        .sort((a, b) => b.count - a.count)
    );

    const ticketWorkload = new Map<string, number>();
    openTix.forEach((t) => {
      if (!t.assigned_to) return;
      ticketWorkload.set(t.assigned_to, (ticketWorkload.get(t.assigned_to) ?? 0) + 1);
    });
    setTicketsByAssignee(
      Array.from(ticketWorkload.entries())
        .map(([id, count]) => ({ id, count, label: profileLabel.get(id) ?? id.slice(0, 8) + "…" }))
        .sort((a, b) => b.count - a.count)
    );

    if (failures.length > 0) {
      setWarning("Some reports data could not be loaded. Counts may be incomplete.");
    }

    setHasSnapshotData(
      projects.length + tickets.length + globalTasks.length + projectTasks.length > 0
    );
    setLoading(false);
  }, [thirtyDaysAgoIso, todayIso]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const showGlobalEmpty = !loading && !hasSnapshotData;

  const ticketsTotal = ticketsByStatus.reduce((a, d) => a + d.count, 0);

  return (
    <AppPageShell>
      <div className="w-full min-w-0 space-y-6">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Operations</p>
        <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
        <p className="text-slate-600 text-sm leading-relaxed">
          Operational insights across projects, tickets, and tasks.
        </p>
        <p className="text-xs text-slate-500 pt-0.5">Based on data visible to your account.</p>
      </div>

      <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiTile label="Active projects" value={activeProjects} loading={loading} icon={Users} />
        <KpiTile label="Open tickets" value={openTickets} loading={loading} icon={Ticket} />
        <KpiTile
          label="Overdue tasks"
          value={overdueTasks}
          loading={loading}
          icon={AlertTriangle}
          tone="rose"
        />
        <KpiTile
          label="Blocked tasks"
          value={blockedTasks}
          loading={loading}
          icon={PauseCircle}
          tone="amber"
        />
        <KpiTile label="Active clients" value={activeClients} loading={loading} icon={Building2} />
      </div>

      {warning ? (
        <div className="rounded-xl border border-amber-200/90 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 w-full min-w-0 shadow-sm ring-1 ring-amber-100/60">
          {warning}
        </div>
      ) : null}

      {showGlobalEmpty ? (
        <ReportCard title="Insights" subtitle="Charts and lists will appear when operational data exists.">
          <ChartEmptyState message="Not enough data yet to display insights." />
        </ReportCard>
      ) : (
        <>
          {/* A — Distribution (primary) */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 w-full min-w-0">
            <ReportCard
              title="Tickets by status"
              subtitle="Distribution across tickets you can access"
              emphasis="primary"
            >
              <DonutChart
                data={ticketsByStatus}
                centerTop={String(ticketsTotal)}
                centerBottom="tickets"
              />
            </ReportCard>

            <ReportCard
              title="Tasks by status"
              subtitle="Global tasks and project tasks combined"
              emphasis="primary"
            >
              <VerticalBarChart data={tasksByStatus} yAxisName="Task status" />
            </ReportCard>
          </div>

          {/* B — Trend */}
          <div className="grid grid-cols-1 gap-6 w-full min-w-0">
            <ReportCard
              title="Activity last 30 days"
              subtitle="New projects, new tasks, and ticket updates by day"
            >
              <ActivityLineChart data={activityLast30Days} />
            </ReportCard>
          </div>

          {/* C — Hotspots */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 w-full min-w-0">
            <ReportCard
              title="Projects with most open tickets"
              subtitle="Highest open backlog — open a project to act"
            >
              {topOpenTicketProjects.length === 0 ? (
                <ChartEmptyState message="No open tickets linked to projects." />
              ) : (
                <ul className="space-y-1.5">
                  {topOpenTicketProjects.map((p) => {
                    const max = Math.max(...topOpenTicketProjects.map((x) => x.count), 1);
                    const pct = (p.count / max) * 100;
                    return (
                      <li
                        key={p.projectId}
                        className="rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-100"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <Link
                            href={`/projects/${p.projectId}`}
                            className="min-w-0 text-sm font-medium text-slate-900 truncate hover:text-[rgb(var(--rb-brand-primary-active))] transition-colors"
                          >
                            {p.projectName}
                          </Link>
                          <div className="shrink-0 text-right">
                            <span className="text-sm font-semibold text-slate-900 tabular-nums">
                              {p.count}
                            </span>
                            <span className="ml-1.5 text-[11px] text-slate-500">open</span>
                          </div>
                        </div>
                        <div className="mt-2 h-1 w-full rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[rgb(var(--rb-brand-primary))]/55"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ReportCard>

            <ReportCard
              title="Projects with overdue tasks"
              subtitle="Due dates passed and work not completed"
            >
              {topOverdueProjects.length === 0 ? (
                <ChartEmptyState message="No overdue tasks on projects." />
              ) : (
                <ul className="space-y-1.5">
                  {topOverdueProjects.map((p) => {
                    const max = Math.max(...topOverdueProjects.map((x) => x.count), 1);
                    const pct = (p.count / max) * 100;
                    return (
                      <li
                        key={p.projectId}
                        className="rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-100"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <Link
                            href={`/projects/${p.projectId}`}
                            className="min-w-0 text-sm font-medium text-slate-900 truncate hover:text-rose-700 transition-colors"
                          >
                            {p.projectName}
                          </Link>
                          <div className="shrink-0 text-right">
                            <span className="text-sm font-semibold text-rose-800 tabular-nums">
                              {p.count}
                            </span>
                            <span className="ml-1.5 text-[11px] text-slate-500">overdue</span>
                          </div>
                        </div>
                        <div className="mt-2 h-1 w-full rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-rose-500/55"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ReportCard>
          </div>

          {/* D — Workload (secondary emphasis) */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 w-full min-w-0">
            <ReportCard
              title="Top workload (tasks)"
              subtitle="Assigned global and project tasks in your scope"
            >
              <WorkloadBarChart data={tasksByAssignee} title="Tasks" />
            </ReportCard>
            <ReportCard
              title="Top workload (tickets)"
              subtitle="Open tickets by assignee"
            >
              <WorkloadBarChart data={ticketsByAssignee} title="Tickets" />
            </ReportCard>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 w-full min-w-0">
            <Link href="/projects" className="hover:text-slate-900 transition-colors">
              Browse projects
            </Link>
            <span className="text-slate-300" aria-hidden>
              ·
            </span>
            <Link
              href="/my-work"
              className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors"
            >
              <Briefcase className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              My Work
            </Link>
          </div>
        </>
      )}
      </div>
    </AppPageShell>
  );
}
