"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { BoardTask } from "@/app/components/TasksBoard";
import { TaskWorkspaceHeader } from "@/components/tasks/TaskWorkspaceHeader";
import { TaskFilterBar } from "@/components/tasks/TaskFilterBar";
import { ViewModeToggle } from "@/components/tasks/ViewModeToggle";
import { TaskDetailDrawer, type TaskDetailPayload } from "@/components/tasks/TaskDetailDrawer";
import TasksBoard from "@/app/components/TasksBoard";

type TaskStatusRow = { id: string; code: string; name: string };

const SCOPE_OPTIONS = [
  { value: "global", label: "Global tasks" },
  { value: "my", label: "My tasks" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "All priorities" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export default function GlobalTasksPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<TaskStatusRow[]>([]);
  const [scope, setScope] = useState<"global" | "my">("global");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<BoardTask | null>(null);
  const [detailSaving, setDetailSaving] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled) setCurrentUserId(user?.id ?? null);
    });
    return () => { cancelled = true; };
  }, []);

  const loadStatuses = useCallback(async () => {
    const { data } = await supabase
      .from("task_statuses")
      .select("id, code, name")
      .eq("is_active", true)
      .order("order_index", { ascending: true });
    setStatuses((data ?? []) as TaskStatusRow[]);
  }, []);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  const statusOptions = [
    { value: "", label: "All statuses" },
    ...statuses.map((s) => ({ value: s.id, label: s.name })),
  ];

  const handleSaveDetailGlobal = useCallback(async (taskId: string, payload: TaskDetailPayload) => {
    setDetailSaving(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: payload.title,
          description: payload.description,
          status_id: payload.status,
          priority: payload.priority,
          assignee_id: payload.assignee_profile_id,
          due_date: payload.due_date,
        })
        .eq("id", taskId);
      if (error) throw error;
      setDetailOpen(false);
      setDetailTask(null);
      setRefreshTrigger((t) => t + 1);
    } catch (e) {
      console.error("Error saving task detail", e);
    } finally {
      setDetailSaving(false);
    }
  }, []);

  return (
    <div className="w-full min-w-0 space-y-6 bg-slate-950">
      <TaskWorkspaceHeader
        title="Tasks"
        subtitle="Track work across global, personal, and project contexts."
        actions={<ViewModeToggle value={viewMode} onChange={setViewMode} />}
      />

      <TaskFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search tasks..."
        scopeOptions={SCOPE_OPTIONS}
        scopeValue={scope}
        onScopeChange={(v) => setScope(v as "global" | "my")}
        statusOptions={statusOptions}
        statusValue={statusFilter}
        onStatusChange={setStatusFilter}
        priorityOptions={PRIORITY_OPTIONS}
        priorityValue={priorityFilter}
        onPriorityChange={setPriorityFilter}
      />

      <section>
        <TasksBoard
          projectId={null}
          title="Board"
          subtitle="Global tasks (no project). Create and move cards across statuses."
          filterByUserId={scope === "my" ? currentUserId : null}
          searchQuery={searchQuery}
          statusFilter={statusFilter || undefined}
          priorityFilter={priorityFilter || undefined}
          viewMode={viewMode}
          currentUserId={currentUserId}
          onOpenDetail={(task) => {
            setDetailTask(task);
            setDetailOpen(true);
          }}
          refreshTrigger={refreshTrigger}
        />
      </section>

      <TaskDetailDrawer
        task={detailTask}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailTask(null);
        }}
        onSave={handleSaveDetailGlobal}
        context="global"
        statusOptions={statuses.map((s) => ({ value: s.id, label: s.name }))}
        priorityOptions={[
          { value: "high", label: "Alta" },
          { value: "medium", label: "Media" },
          { value: "low", label: "Baja" },
        ]}
        saving={detailSaving}
      />
    </div>
  );
}
