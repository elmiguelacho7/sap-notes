"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, Pencil } from "lucide-react";
import { AssigneeDropdown } from "@/app/components/AssigneeDropdown";
import type { BoardTask } from "@/app/components/TasksBoard";
import type { TaskPriorityKey } from "@/lib/taskWorkflow";
import { FORM_SECTION_TITLE_CLASS } from "@/components/layout/formPageClasses";

export type TaskListContext = "global" | "project";

export type TaskListProps = {
  tasks: BoardTask[];
  context: TaskListContext;
  /** Status options for dropdown: value = status_id (global) or status key (project) */
  statusOptions: { value: string; label: string }[];
  getStatusKey: (task: BoardTask) => string;
  onStatusChange: (taskId: string, newStatusKey: string) => void | Promise<void>;
  priorityOptions: { value: string; label: string }[];
  onPriorityChange?: (taskId: string, priority: string) => void | Promise<void>;
  assigneeOptions?: { value: string; label: string }[];
  onAssigneeChange?: (taskId: string, assigneeId: string | null) => void | Promise<void>;
  onDueDateChange?: (taskId: string, dueDate: string | null) => void | Promise<void>;
  onOpenDetail?: (task: BoardTask) => void;
  /** For global: resolve project_id -> project name */
  getProjectName?: (projectId: string | null) => string | null;
  /** For project: resolve activity_id -> activity name */
  getActivityLabel?: (activityId: string | null) => string | null;
  /** For global: "Scope" column - e.g. "Global" / "My" based on filter; optional */
  scopeLabel?: string;
  loading?: boolean;
  /** Visual variant only. */
  variant?: "standalone" | "embedded";
};

const PRIORITY_ORDER: TaskPriorityKey[] = ["high", "medium", "low"];

export function TaskList({
  tasks,
  context,
  statusOptions,
  getStatusKey,
  onStatusChange,
  priorityOptions,
  onPriorityChange,
  assigneeOptions,
  onAssigneeChange,
  onDueDateChange,
  onOpenDetail,
  getProjectName,
  getActivityLabel,
  scopeLabel,
  loading = false,
  variant = "standalone",
}: TaskListProps) {
  const t = useTranslations("tasks.list");
  const tPriority = useTranslations("tasks.priority");
  const tTaskCard = useTranslations("tasks.taskCard");
  const [editingDueId, setEditingDueId] = useState<string | null>(null);

  const priorityLabelMap = useMemo(
    () =>
      ({
        high: tPriority("high"),
        medium: tPriority("medium"),
        low: tPriority("low"),
      }) as Record<TaskPriorityKey, string>,
    [tPriority]
  );

  const handleDueDateBlur = useCallback(
    (taskId: string, value: string) => {
      const next = value.trim() ? value.trim() : null;
      onDueDateChange?.(taskId, next);
      setEditingDueId(null);
    },
    [onDueDateChange]
  );

  function priorityLabel(p: string): string {
    const k = (p ?? "").toLowerCase() as TaskPriorityKey;
    return priorityLabelMap[k] ?? p ?? t("emDash");
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] overflow-hidden shadow-sm">
        <div className="animate-pulse p-6 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-[rgb(var(--rb-surface-3))]/50" />
          ))}
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] px-6 py-12 text-center space-y-2 shadow-sm">
        <p className="text-sm font-medium text-[rgb(var(--rb-text-primary))]">{t("emptyTitle")}</p>
        <p className="text-xs text-[rgb(var(--rb-text-muted))] max-w-md mx-auto leading-relaxed">{t("emptySubtitle")}</p>
      </div>
    );
  }

  const baseTh = `text-left ${FORM_SECTION_TITLE_CLASS} py-3 pr-4 whitespace-nowrap`;
  const baseTd = "py-3 pr-4 text-sm text-[rgb(var(--rb-text-primary))] align-middle";
  const controlClass =
    "h-8 rounded-lg border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-2.5 text-xs text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/30 focus:border-[rgb(var(--rb-brand-primary))]/25";

  return (
    <div
      className={
        variant === "embedded"
          ? "bg-transparent shadow-none border-0 rounded-none overflow-hidden"
          : "rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] overflow-hidden shadow-sm"
      }
    >
      <div
        className={
          variant === "embedded"
            ? "overflow-x-auto px-5 sm:px-6 [scrollbar-width:thin] [scrollbar-color:rgb(var(--rb-surface-border))_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgb(var(--rb-surface-border))]"
            : "overflow-x-auto px-4 sm:px-5 [scrollbar-width:thin] [scrollbar-color:rgb(var(--rb-surface-border))_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgb(var(--rb-surface-border))]"
        }
      >
        <table className="w-full min-w-[920px] border-collapse">
          <thead>
            <tr className="border-b border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/80">
              <th className={`${baseTh} pl-0.5`}>{t("colTask")}</th>
              {context === "global" && scopeLabel != null && <th className={baseTh}>{t("colScope")}</th>}
              {context === "global" && getProjectName && <th className={baseTh}>{t("colProject")}</th>}
              {context === "project" && getActivityLabel && <th className={baseTh}>{t("colActivity")}</th>}
              <th className={baseTh}>{t("colStatus")}</th>
              <th className={baseTh}>{t("colPriority")}</th>
              {(assigneeOptions != null || onAssigneeChange) && <th className={baseTh}>{t("colAssignee")}</th>}
              <th className={baseTh}>{t("colDue")}</th>
              <th className={baseTh}>{t("colUpdated")}</th>
              {onOpenDetail && <th className={`${baseTh} w-0`}>{t("colActions")}</th>}
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const statusKey = getStatusKey(task);
              const assigneeLabel =
                assigneeOptions && task.assignee_profile_id
                  ? assigneeOptions.find((o) => o.value === task.assignee_profile_id)?.label ?? null
                  : null;
              return (
                <tr
                  key={task.id}
                  className="border-b border-[rgb(var(--rb-surface-border))]/65 hover:bg-[rgb(var(--rb-surface-2))]/60 transition-colors"
                >
                  <td className={`${baseTd} pl-0.5`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-[rgb(var(--rb-text-primary))] truncate" title={task.title}>
                        {task.title}
                      </span>
                    </div>
                    {task.description && (
                      <p
                        className="text-xs text-[rgb(var(--rb-text-muted))] truncate max-w-[420px] mt-0.5"
                        title={task.description}
                      >
                        {task.description}
                      </p>
                    )}
                  </td>
                  {context === "global" && scopeLabel != null && (
                    <td className={baseTd}>
                      <span className="text-[rgb(var(--rb-text-secondary))]">{scopeLabel}</span>
                    </td>
                  )}
                  {context === "global" && getProjectName && (
                    <td className={baseTd}>
                      <span className="text-[rgb(var(--rb-text-secondary))]">
                        {getProjectName((task as BoardTask & { project_id?: string | null }).project_id ?? null) ??
                          t("emDash")}
                      </span>
                    </td>
                  )}
                  {context === "project" && getActivityLabel && (
                    <td className={baseTd}>
                      <span
                        className="text-[rgb(var(--rb-text-secondary))] truncate max-w-[180px] block"
                        title={getActivityLabel(task.activity_id ?? null) ?? undefined}
                      >
                        {getActivityLabel(task.activity_id ?? null) ?? t("emDash")}
                      </span>
                    </td>
                  )}
                  <td className={baseTd}>
                    <select
                      value={statusKey}
                      onChange={(e) => onStatusChange(task.id, e.target.value)}
                      className={`min-w-[132px] ${controlClass}`}
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={baseTd}>
                    {onPriorityChange && priorityOptions.length > 0 ? (
                      <select
                        value={(task.priority ?? "medium").toLowerCase()}
                        onChange={(e) => onPriorityChange(task.id, e.target.value)}
                        className={`min-w-[108px] ${controlClass}`}
                      >
                        {PRIORITY_ORDER.map((p) => (
                          <option key={p} value={p}>
                            {priorityLabelMap[p]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[rgb(var(--rb-text-secondary))]">{priorityLabel(task.priority ?? "")}</span>
                    )}
                  </td>
                  {(assigneeOptions != null || onAssigneeChange) && (
                    <td className={baseTd}>
                      {onAssigneeChange && assigneeOptions ? (
                        <AssigneeDropdown
                          options={assigneeOptions}
                          value={task.assignee_profile_id ?? null}
                          onChange={(id) => onAssigneeChange(task.id, id)}
                          placeholder={tTaskCard("unassigned")}
                          variant={assigneeLabel ? "assigned" : "unassigned"}
                          appearance="light"
                        />
                      ) : (
                        <span className="text-[rgb(var(--rb-text-secondary))]">{assigneeLabel ?? tTaskCard("unassigned")}</span>
                      )}
                    </td>
                  )}
                  <td className={baseTd}>
                    {onDueDateChange ? (
                      editingDueId === task.id ? (
                        <input
                          type="date"
                          defaultValue={task.due_date ?? ""}
                          onBlur={(e) => handleDueDateBlur(task.id, e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && setEditingDueId(null)}
                          className={`w-36 ${controlClass}`}
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingDueId(task.id)}
                          className="text-[rgb(var(--rb-text-secondary))] hover:text-[rgb(var(--rb-text-primary))] text-xs flex items-center gap-1"
                        >
                          {task.due_date ? new Date(task.due_date).toLocaleDateString() : t("emDash")}
                          <Pencil className="h-3 w-3 opacity-60" />
                        </button>
                      )
                    ) : (
                      <span className="text-[rgb(var(--rb-text-secondary))]">
                        {task.due_date ? new Date(task.due_date).toLocaleDateString() : t("emDash")}
                      </span>
                    )}
                  </td>
                  <td className={baseTd}>
                    <span className="text-[rgb(var(--rb-text-muted))] text-xs">
                      {task.updated_at
                        ? new Date(String(task.updated_at)).toLocaleDateString()
                        : task.created_at
                          ? new Date(String(task.created_at)).toLocaleDateString()
                          : t("emDash")}
                    </span>
                  </td>
                  {onOpenDetail && (
                    <td className={baseTd}>
                      <button
                        type="button"
                        onClick={() => onOpenDetail(task)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/90 px-2.5 text-xs font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-2))]/60 hover:text-[rgb(var(--rb-text-primary))] transition-colors"
                      >
                        {t("open")}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
