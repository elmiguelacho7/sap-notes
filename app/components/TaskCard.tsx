"use client";

import React, { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight } from "lucide-react";
import { AssigneeDropdown } from "@/app/components/AssigneeDropdown";
import type { BoardTask } from "@/app/components/TasksBoard";
import { getTaskDuePresentation, type TaskDuePresentationLabels } from "@/app/components/taskDuePresentation";

type TaskCardProps = {
  task: BoardTask;
  activityLabel: string | null;
  assigneeLabel: string | null;
  leftBarClass: string;
  columns: { id: string; label: string }[];
  currentStatusKey: string;
  onStatusChange: (taskId: string, newStatusKey: string) => void | Promise<void>;
  assigneeOptions?: { value: string; label: string }[];
  onAssigneeChange?: (taskId: string, assigneeProfileId: string | null) => void | Promise<void>;
  onOpenDetail?: (task: BoardTask) => void;
  /** En tablero Kanban el estado ya se infiere por columna: el select se muestra más discreto. */
  demoteStatusSelect?: boolean;
};

function TaskCardComponent({
  task,
  activityLabel,
  assigneeLabel,
  leftBarClass,
  columns,
  currentStatusKey,
  onStatusChange,
  assigneeOptions,
  onAssigneeChange,
  onOpenDetail,
  demoteStatusSelect = false,
}: TaskCardProps) {
  const tPriority = useTranslations("tasks.priority");
  const tCard = useTranslations("tasks.taskCard");
  const tDue = useTranslations("tasks.due");

  const dueLabels: TaskDuePresentationLabels = useMemo(
    () => ({
      overdue: tDue("overdue"),
      dueToday: tDue("dueToday"),
      dueTomorrow: tDue("dueTomorrow"),
      inDays: (n: number) => tDue("inDays", { n }),
      limit: tDue("limit"),
    }),
    [tDue]
  );

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const duePresent = useMemo(
    () => getTaskDuePresentation(task.due_date, dueLabels),
    [task.due_date, dueLabels]
  );

  const priorityKey = (task.priority ?? "").toLowerCase();
  const priorityShort =
    priorityKey === "high"
      ? tPriority("high")
      : priorityKey === "medium"
        ? tPriority("medium")
        : priorityKey === "low"
          ? tPriority("low")
          : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative rounded-xl bg-[rgb(var(--rb-surface))] border border-[rgb(var(--rb-surface-border))]/65 p-3 shadow-sm hover:border-[rgb(var(--rb-surface-border))]/85 hover:shadow-md hover:-translate-y-[1px] transition-[border-color,box-shadow,opacity,transform] duration-150 flex flex-col min-w-0 ${
        isDragging
          ? "opacity-[0.92] shadow-lg ring-1 ring-[rgb(var(--rb-brand-primary))]/15 z-10"
          : ""
      }`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[10px] ${leftBarClass}`} />
      <div className="pl-3 min-w-0 flex-1 flex flex-col">
        <div className="pr-0 space-y-2.5 min-w-0">
          <div className="flex items-start gap-2 min-w-0">
            <p
              className="text-[15px] font-semibold leading-snug tracking-tight text-[rgb(var(--rb-text-primary))] truncate min-w-0 flex-1"
              title={task.title}
            >
              {task.title}
            </p>
            {task.priority && ["high", "medium", "low"].includes(priorityKey) && priorityShort && (
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                  priorityKey === "high"
                    ? "bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-200/80"
                    : priorityKey === "medium"
                      ? "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200/80"
                      : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/90"
                }`}
              >
                {priorityShort}
              </span>
            )}
          </div>

          {/* Meta row: due + activity (lightweight) */}
          {(duePresent || activityLabel != null) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {duePresent ? (
                <span
                  className={`inline-flex items-center rounded-full border border-[rgb(var(--rb-surface-border))]/45 bg-[rgb(var(--rb-surface-3))]/12 px-2 py-0.5 text-[11px] tabular-nums ${duePresent.className}`}
                >
                  <span className="font-medium">{duePresent.line}</span>
                  {duePresent.sub ? <span className="font-normal opacity-90"> {duePresent.sub}</span> : null}
                </span>
              ) : null}
              {activityLabel != null ? (
                <span
                  className="inline-flex min-w-0 max-w-full items-center rounded-full border border-[rgb(var(--rb-surface-border))]/40 bg-[rgb(var(--rb-surface-3))]/10 px-2 py-0.5 text-[11px] text-[rgb(var(--rb-text-muted))] truncate"
                  title={activityLabel}
                >
                  <span className="text-[rgb(var(--rb-text-muted))]">{tCard("activity")}</span>
                  <span className="mx-1 text-[rgb(var(--rb-text-muted))]">·</span>
                  <span className="truncate text-[rgb(var(--rb-text-secondary))]">{activityLabel}</span>
                </span>
              ) : null}
            </div>
          )}

          {/* Assignee: compact + secondary */}
          {assigneeOptions !== undefined && (
            <div className="flex items-center gap-2 min-w-0">
              {onAssigneeChange ? (
                <span
                  className="inline-flex min-w-0 max-w-[12.5rem] opacity-95"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <AssigneeDropdown
                    options={assigneeOptions}
                    value={task.assignee_profile_id ?? null}
                    onChange={(profileId) => onAssigneeChange(task.id, profileId)}
                    placeholder={tCard("unassigned")}
                    variant={assigneeLabel ? "assigned" : "unassigned"}
                    appearance="light"
                    className="h-8 rounded-full px-2.5 py-1 text-xs border-[rgb(var(--rb-surface-border))]/45 bg-[rgb(var(--rb-surface-3))]/10 hover:bg-[rgb(var(--rb-surface-3))]/20"
                  />
                </span>
              ) : (
                <span
                  className={`inline-flex max-w-full items-center truncate rounded-full border border-[rgb(var(--rb-surface-border))]/40 bg-[rgb(var(--rb-surface-3))]/10 px-2 py-0.5 text-[11px] ${
                    assigneeLabel ? "text-[rgb(var(--rb-text-secondary))]" : "text-[rgb(var(--rb-text-muted))]"
                  }`}
                  title={assigneeLabel ?? tCard("unassigned")}
                >
                  {assigneeLabel ?? tCard("unassigned")}
                </span>
              )}
            </div>
          )}

          {task.description && (
            <p className="text-[10px] text-[rgb(var(--rb-text-secondary))] line-clamp-2 mt-1 break-words leading-relaxed">
              {task.description}
            </p>
          )}
        </div>

        {/* Footer row: status + quick action (very compact) */}
        <div className="mt-3 pt-2.5 border-t border-[rgb(var(--rb-surface-border))]/45 flex items-center justify-between gap-2 min-w-0">
          <div
            className={
              demoteStatusSelect ? "flex justify-end min-w-0" : "flex items-center gap-2 min-w-0 flex-1"
            }
          >
            <select
              value={currentStatusKey}
              onChange={(e) => onStatusChange(task.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              title={tCard("changeStatusTitle")}
              aria-label={tCard("changeStatusAria")}
              className={
                demoteStatusSelect
                  ? "max-w-[7rem] cursor-pointer rounded-full border border-[rgb(var(--rb-surface-border))]/45 bg-[rgb(var(--rb-surface-3))]/10 py-0.5 px-2 text-[9px] leading-tight text-[rgb(var(--rb-text-muted))] shadow-none hover:border-[rgb(var(--rb-surface-border))]/75 hover:bg-[rgb(var(--rb-surface-3))]/20 hover:text-[rgb(var(--rb-text-secondary))] focus:outline-none focus-visible:ring-1 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35"
                  : "h-8 flex-1 min-w-0 cursor-pointer rounded-full border border-[rgb(var(--rb-surface-border))]/45 bg-[rgb(var(--rb-surface-3))]/10 px-2.5 text-[11px] text-[rgb(var(--rb-text-primary))] hover:border-[rgb(var(--rb-surface-border))]/75 hover:bg-[rgb(var(--rb-surface-3))]/20 focus:outline-none focus:ring-1 focus:ring-[rgb(var(--rb-brand-ring))]/35"
              }
            >
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {onOpenDetail && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail(task);
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[rgb(var(--rb-surface-border))]/40 bg-[rgb(var(--rb-surface-3))]/10 px-2.5 text-[11px] font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-3))]/20 hover:border-[rgb(var(--rb-surface-border))]/70 transition-colors shrink-0"
              title={tCard("openDetailTitle")}
            >
              {tCard("open")}
              <ChevronRight className="h-3 w-3 opacity-60" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const TaskCard = React.memo(TaskCardComponent);
