"use client";

import React, { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import type { BoardTask } from "@/app/components/TasksBoard";
import { STATUS_LABELS_ES, PRIORITY_LABELS } from "@/lib/taskWorkflow";
import type { ProjectStatusKey, TaskPriorityKey } from "@/lib/taskWorkflow";

export type TaskDetailDrawerContext = "global" | "project";

export type TaskDetailPayload = {
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_profile_id: string | null;
  due_date: string | null;
  activity_id?: string | null;
};

export type TaskDetailDrawerProps = {
  task: BoardTask | null;
  open: boolean;
  onClose: () => void;
  onSave: (taskId: string, payload: TaskDetailPayload) => void | Promise<void>;
  context: TaskDetailDrawerContext;
  statusOptions: { value: string; label: string }[];
  priorityOptions: { value: string; label: string }[];
  assigneeOptions?: { value: string; label: string }[];
  activityOptions?: { value: string; label: string }[];
  /** Project name (read-only in project context). */
  projectName?: string | null;
  saving?: boolean;
};

const PRIORITY_KEYS: TaskPriorityKey[] = ["high", "medium", "low"];

export function TaskDetailDrawer({
  task,
  open,
  onClose,
  onSave,
  context,
  statusOptions,
  priorityOptions,
  assigneeOptions = [],
  activityOptions = [],
  projectName = null,
  saving = false,
}: TaskDetailDrawerProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [activityId, setActivityId] = useState("");

  useEffect(() => {
    if (task && open) {
      setTitle(task.title ?? "");
      setDescription(task.description ?? "");
      setStatus(
        task.status
          ? (task.status as string).toLowerCase()
          : (task.status_id ?? "")
      );
      setPriority(((task.priority ?? "medium") as string).toLowerCase());
      setAssigneeId(task.assignee_profile_id ?? null);
      setDueDate(task.due_date ? task.due_date.toString().slice(0, 10) : "");
      setActivityId(task.activity_id ?? "");
    }
  }, [task, open]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!task) return;
      onSave(task.id, {
        title: title.trim(),
        description: description.trim() || null,
        status: status.trim() || (context === "project" ? "pending" : ""),
        priority: priority.trim() || "medium",
        assignee_profile_id: assigneeId,
        due_date: dueDate.trim() || null,
        ...(context === "project" && { activity_id: activityId.trim() || null }),
      });
    },
    [task, title, description, status, priority, assigneeId, dueDate, activityId, context, onSave]
  );

  if (!open) return null;

  const inputClass =
    "w-full rounded-xl border border-slate-600/80 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50";
  const labelClass = "block text-xs font-medium text-slate-500 mb-1";

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-slate-900 border-l border-slate-700/80 shadow-xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
      >
        <div className="flex items-center justify-between shrink-0 border-b border-slate-700/60 px-5 py-4">
          <h2 id="task-detail-title" className="text-lg font-semibold text-slate-100">
            Task details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className={labelClass}>Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="Task title"
              required
            />
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Optional description"
            />
          </div>

          <div>
            <label className={labelClass}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputClass}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className={inputClass}
            >
              {PRIORITY_KEYS.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          {assigneeOptions.length > 0 && (
            <div>
              <label className={labelClass}>Responsable</label>
              <select
                value={assigneeId ?? ""}
                onChange={(e) => setAssigneeId(e.target.value || null)}
                className={inputClass}
              >
                <option value="">Sin asignar</option>
                {assigneeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelClass}>Due date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {context === "project" && activityOptions.length > 0 && (
            <div>
              <label className={labelClass}>Activity</label>
              <select
                value={activityId}
                onChange={(e) => setActivityId(e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {activityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {context === "project" && projectName != null && (
            <div>
              <label className={labelClass}>Project</label>
              <p className="text-sm text-slate-400">{projectName}</p>
            </div>
          )}

          <div className="pt-4 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
