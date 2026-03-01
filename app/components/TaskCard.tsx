"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BoardTask } from "@/app/components/TasksBoard";

type TaskCardProps = {
  task: BoardTask;
  activityLabel: string | null;
  leftBarClass: string;
  columns: { id: string; label: string }[];
  currentStatusKey: string;
  onStatusChange: (taskId: string, newStatusKey: string) => void | Promise<void>;
};

export function TaskCard({
  task,
  activityLabel,
  leftBarClass,
  columns,
  currentStatusKey,
  onStatusChange,
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
      className={`relative rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col overflow-hidden ${
        isDragging ? "ring-2 ring-indigo-500 shadow-lg opacity-90 z-10" : ""
      }`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${leftBarClass}`} />
      <div className="pl-4">
        <div className="px-3 py-2">
          <p className="text-sm font-semibold text-slate-900">{task.title}</p>
          {activityLabel && (
            <p className="text-xs text-slate-500 mt-0.5">Actividad: {activityLabel}</p>
          )}
          {task.due_date && (
            <p className="text-xs text-slate-500">
              Límite: {new Date(task.due_date).toLocaleDateString()}
            </p>
          )}
          {task.description && (
            <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{task.description}</p>
          )}
        </div>
        <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50/50">
          <select
            value={currentStatusKey}
            onChange={(e) => onStatusChange(task.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {task.created_at && (
            <span className="text-[11px] text-slate-400 shrink-0">
              {new Date(task.created_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
