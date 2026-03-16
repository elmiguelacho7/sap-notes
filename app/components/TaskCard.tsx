"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight } from "lucide-react";
import { AssigneeDropdown } from "@/app/components/AssigneeDropdown";
import type { BoardTask } from "@/app/components/TasksBoard";

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
}: TaskCardProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative rounded-lg bg-slate-900 border border-slate-700 p-3 hover:bg-slate-800 transition-all flex flex-col min-w-0 ${
        isDragging ? "ring-2 ring-indigo-500 shadow-lg opacity-90 z-10" : ""
      }`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg ${leftBarClass}`} />
      <div className="pl-4 min-w-0 flex-1 flex flex-col">
        <div className="pr-0 space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <p className="text-sm font-semibold text-slate-100 truncate min-w-0" title={task.title}>{task.title}</p>
            {task.priority && ["high", "medium", "low"].includes((task.priority ?? "").toLowerCase()) && (
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                  (task.priority ?? "").toLowerCase() === "high"
                    ? "bg-red-500/20 text-red-300 border border-red-500/30"
                    : (task.priority ?? "").toLowerCase() === "medium"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-slate-500/20 text-slate-400 border border-slate-500/30"
                }`}
              >
                {(task.priority ?? "").toLowerCase() === "high" ? "Alta" : (task.priority ?? "").toLowerCase() === "medium" ? "Media" : "Baja"}
              </span>
            )}
          </div>
          {activityLabel != null && (
            <p className="text-[11px] text-slate-500 leading-tight min-w-0 flex items-baseline gap-1">
              <span className="shrink-0">Actividad:</span>
              <span className="text-slate-400 truncate" title={activityLabel}>{activityLabel}</span>
            </p>
          )}
          {/* Responsable: [pill] — compact, truncates long names, stays inside card */}
          {assigneeOptions !== undefined && (
            <p className="text-[11px] text-slate-500 leading-tight flex items-center gap-1.5 min-w-0">
              <span className="shrink-0">Responsable:</span>
              {onAssigneeChange ? (
                <span
                  className="inline-flex min-w-0 max-w-full"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <AssigneeDropdown
                    options={assigneeOptions}
                    value={task.assignee_profile_id ?? null}
                    onChange={(profileId) => onAssigneeChange(task.id, profileId)}
                    placeholder="Sin asignar"
                    variant={assigneeLabel ? "assigned" : "unassigned"}
                  />
                </span>
              ) : (
                <span className={`truncate min-w-0 ${assigneeLabel ? "text-slate-300" : "text-slate-500"}`} title={assigneeLabel ?? "Sin asignar"}>
                  👤 {assigneeLabel ?? "Sin asignar"}
                </span>
              )}
            </p>
          )}
          {task.due_date && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              Límite: {new Date(task.due_date).toLocaleDateString()}
            </p>
          )}
          {task.description && (
            <p className="text-xs text-slate-400 line-clamp-2 mt-0.5 break-words">{task.description}</p>
          )}
        </div>
        <div className="pt-2 mt-1 border-t border-slate-700 flex items-center justify-between gap-2 min-w-0">
          <select
            value={currentStatusKey}
            onChange={(e) => onStatusChange(task.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1.5 shrink-0">
            {task.created_at && (
              <span className="text-[11px] text-slate-500">
                {new Date(task.created_at).toLocaleDateString()}
              </span>
            )}
            {onOpenDetail && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDetail(task);
                }}
                className="inline-flex items-center gap-0.5 rounded px-1.5 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
              >
                Open
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const TaskCard = React.memo(TaskCardComponent);
