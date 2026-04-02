"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import type { BoardTask } from "@/app/components/TasksBoard";
import type { TaskPriorityKey } from "@/lib/taskWorkflow";

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
  assigneeOptions = [],
  activityOptions = [],
  projectName = null,
  saving = false,
}: TaskDetailDrawerProps) {
  const t = useTranslations("tasks.drawer");
  const tPriority = useTranslations("tasks.priority");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [activityId, setActivityId] = useState("");

  /* eslint-disable react-hooks/set-state-in-effect -- sync form fields when drawer opens for a task */
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
  /* eslint-enable react-hooks/set-state-in-effect */

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
    "w-full h-10 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/25";
  const textareaClass =
    "w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2.5 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/25";
  const labelClass = "block text-xs font-medium text-[rgb(var(--rb-text-muted))] mb-1.5";

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/45 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed top-0 right-0 bottom-0 z-50 w-full md:max-w-xl bg-[rgb(var(--rb-surface))] border-l border-[rgb(var(--rb-surface-border))]/80 shadow-xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
      >
        <div className="flex items-center justify-between shrink-0 border-b border-[rgb(var(--rb-surface-border))]/70 px-4 py-3 bg-[rgb(var(--rb-surface))]">
          <h2 id="task-detail-title" className="text-lg font-semibold text-[rgb(var(--rb-text-primary))]">
            {t("title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[rgb(var(--rb-text-muted))] hover:text-[rgb(var(--rb-text-primary))] hover:bg-[rgb(var(--rb-surface-2))]/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30"
            aria-label={t("closeAria")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div>
            <label className={labelClass}>{t("titleRequired")}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder={t("titlePlaceholder")}
              required
            />
          </div>

          <div>
            <label className={labelClass}>{t("description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={textareaClass}
              placeholder={t("descriptionPlaceholder")}
            />
          </div>

          <div>
            <label className={labelClass}>{t("status")}</label>
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
            <label className={labelClass}>{t("priority")}</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className={inputClass}
            >
              {PRIORITY_KEYS.map((p) => (
                <option key={p} value={p}>
                  {tPriority(p)}
                </option>
              ))}
            </select>
          </div>

          {assigneeOptions.length > 0 && (
            <div>
              <label className={labelClass}>{t("assignee")}</label>
              <select
                value={assigneeId ?? ""}
                onChange={(e) => setAssigneeId(e.target.value || null)}
                className={inputClass}
              >
                <option value="">{t("unassigned")}</option>
                {assigneeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelClass}>{t("dueDate")}</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {context === "project" && activityOptions.length > 0 && (
            <div>
              <label className={labelClass}>{t("activity")}</label>
              <select
                value={activityId}
                onChange={(e) => setActivityId(e.target.value)}
                className={inputClass}
              >
                <option value="">{t("emptySelect")}</option>
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
              <label className={labelClass}>{t("project")}</label>
              <p className="text-sm text-[rgb(var(--rb-text-secondary))]">{projectName}</p>
            </div>
          )}

          <div className="pt-4 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-4 text-sm font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-2))]/60 hover:text-[rgb(var(--rb-text-primary))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30 disabled:opacity-50"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="h-10 rounded-xl rb-btn-primary px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
