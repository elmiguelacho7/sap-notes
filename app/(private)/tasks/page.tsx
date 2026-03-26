"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabaseClient";
import type { BoardTask } from "@/app/components/TasksBoard";
import { AppPageShell } from "@/components/ui/layout/AppPageShell";
import { TaskWorkspaceHeader } from "@/components/tasks/TaskWorkspaceHeader";
import { TaskFilterBar } from "@/components/tasks/TaskFilterBar";
import { ViewModeToggle } from "@/components/tasks/ViewModeToggle";
import { TaskDetailDrawer, type TaskDetailPayload } from "@/components/tasks/TaskDetailDrawer";
import TasksBoard from "@/app/components/TasksBoard";
import { useAssignableUsers } from "@/components/hooks/useAssignableUsers";

type TaskStatusRow = { id: string; code: string; name: string };

export default function GlobalTasksPage() {
  const t = useTranslations("tasks");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<TaskStatusRow[]>([]);
  const [scope, setScope] = useState<"global" | "my">("global");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<BoardTask | null>(null);
  const [detailSaving, setDetailSaving] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { users: assignableUsers } = useAssignableUsers({ contextType: "global" });
  const assigneeFilterOptions = useMemo(
    () => [
      { value: "", label: t("filters.allAssignees") },
      ...assignableUsers.map((u) => ({ value: u.id, label: u.label })),
    ],
    [assignableUsers, t]
  );

  const scopeOptions = useMemo(
    () => [
      { value: "global", label: t("filters.tasksGlobal") },
      { value: "my", label: t("filters.assignedToMeFilter") },
    ],
    [t]
  );

  const priorityOptions = useMemo(
    () => [
      { value: "", label: t("filters.allPriorities") },
      { value: "high", label: t("priority.high") },
      { value: "medium", label: t("priority.medium") },
      { value: "low", label: t("priority.low") },
    ],
    [t]
  );

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

  const statusOptions = useMemo(
    () => [{ value: "", label: t("filters.allStatuses") }, ...statuses.map((s) => ({ value: s.id, label: s.name }))],
    [statuses, t]
  );

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
    <div className="rb-workspace-bg min-h-full">
      <AppPageShell>
      <div className="space-y-6">
      <TaskWorkspaceHeader
        title={t("globalPage.title")}
        subtitle={t("globalPage.subtitle")}
        actions={<ViewModeToggle value={viewMode} onChange={setViewMode} />}
      />

      <TaskFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={t("filters.searchGlobal")}
        scopeOptions={scopeOptions}
        scopeValue={scope}
        onScopeChange={(v) => setScope(v as "global" | "my")}
        statusOptions={statusOptions}
        statusValue={statusFilter}
        onStatusChange={setStatusFilter}
        priorityOptions={priorityOptions}
        priorityValue={priorityFilter}
        onPriorityChange={setPriorityFilter}
        assigneeOptions={assigneeFilterOptions}
        assigneeValue={assigneeFilter}
        onAssigneeChange={setAssigneeFilter}
      />

      <section>
        <TasksBoard
          projectId={null}
          title={t("globalPage.boardTitle")}
          subtitle={t("globalPage.boardSubtitle")}
          filterByUserId={scope === "my" ? currentUserId : null}
          assigneeFilterId={assigneeFilter ? assigneeFilter : null}
          searchQuery={searchQuery}
          statusFilter={statusFilter || undefined}
          priorityFilter={priorityFilter || undefined}
          viewMode={viewMode}
          currentUserId={currentUserId}
          assigneeOptions={assigneeFilterOptions.slice(1)}
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
        saving={detailSaving}
      />
      </div>
      </AppPageShell>
    </div>
  );
}
