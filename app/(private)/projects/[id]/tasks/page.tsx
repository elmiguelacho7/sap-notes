"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { ProjectTask } from "@/lib/types/projectTasks";
import { PROJECT_STATUS_KEYS } from "@/lib/taskWorkflow";
import TasksBoard, {
  type BoardTask,
  type CreateTaskPayload,
} from "@/app/components/TasksBoard";
import { TaskWorkspaceHeader } from "@/components/tasks/TaskWorkspaceHeader";
import { TaskFilterBar } from "@/components/tasks/TaskFilterBar";
import { ViewModeToggle, type ViewMode } from "@/components/tasks/ViewModeToggle";
import { TaskDetailDrawer, type TaskDetailPayload } from "@/components/tasks/TaskDetailDrawer";
import { useAssignableUsers } from "@/components/hooks/useAssignableUsers";

function serializeUnknownError(e: unknown): Record<string, unknown> {
  if (e instanceof Error) {
    return { name: e.name, message: e.message, stack: e.stack };
  }
  if (typeof e === "object" && e !== null) {
    const anyE = e as Record<string, unknown>;
    return {
      message: anyE.message,
      code: anyE.code,
      details: anyE.details,
      hint: anyE.hint,
      status: anyE.status,
      statusCode: anyE.statusCode,
      ...anyE,
    };
  }
  return { value: e };
}

/** Unified workflow: same order as global board (TODO → … → DONE) */
const KANBAN_COLUMNS: { id: string; label: string }[] = [
  { id: "pending", label: "Por hacer" },
  { id: "in_progress", label: "En progreso" },
  { id: "blocked", label: "Bloqueado" },
  { id: "review", label: "En revisión" },
  { id: "done", label: "Hecho" },
];

export default function ProjectTasksPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const projectId = (params?.id ?? "") as string;
  const activityFilter = searchParams?.get("activity") || null;
  const openCreateFromQuery = searchParams?.get("new") === "1";

  const [showCreandoBanner, setShowCreandoBanner] = useState(false);
  useEffect(() => {
    if (openCreateFromQuery && pathname) {
      setShowCreandoBanner(true);
      router.replace(pathname);
      const t = setTimeout(() => setShowCreandoBanner(false), 2000);
      return () => clearTimeout(t);
    }
  }, [openCreateFromQuery, pathname, router]);

  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [activities, setActivities] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const { users: assignableUsers } = useAssignableUsers({ contextType: "project", projectId });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [detailTask, setDetailTask] = useState<BoardTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setErrorMsg(null);

      const [tasksRes, activitiesRes] = await Promise.all([
        supabase
          .from("project_tasks")
          .select("*")
          .eq("project_id", projectId)
          .order("due_date", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("project_activities")
          .select("id, name")
          .eq("project_id", projectId)
          .order("name"),
      ]);

      if (tasksRes.error) {
        console.error("Error loading tasks", tasksRes.error);
        setTasks([]);
      } else {
        setTasks((tasksRes.data ?? []) as ProjectTask[]);
      }

      if (activitiesRes.error) {
        setActivities([]);
      } else {
        setActivities(
          ((activitiesRes.data ?? []) as { id: string; name: string }[]).map((a) => ({
            id: a.id,
            name: a.name,
          }))
        );
      }

      // Assignable users (Responsable) come from useAssignableUsers hook (project members).
    } catch (err) {
      console.error("Error loading tasks", err);
      setErrorMsg("No se pudieron cargar las tareas del proyecto.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .maybeSingle()
      .then(({ data }) => setProjectName((data as { name?: string } | null)?.name ?? null));
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled) setCurrentUserId(user?.id ?? null);
    });
    return () => { cancelled = true; };
  }, []);

  const visibleTasks: BoardTask[] = useMemo(() => {
    let list = activityFilter
      ? tasks.filter((t) => t.activity_id === activityFilter)
      : tasks;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const title = (t.title ?? "").toLowerCase();
        const desc = (t.description ?? "").toLowerCase();
        return title.includes(q) || desc.includes(q);
      });
    }
    if (statusFilter) {
      list = list.filter((t) => (t.status ?? "").toLowerCase() === statusFilter.toLowerCase());
    }
    if (priorityFilter) {
      list = list.filter((t) => (t.priority ?? "").toLowerCase() === priorityFilter.toLowerCase());
    }
    if (assigneeFilter) {
      list = list.filter((t) => (t.assignee_profile_id ?? "") === assigneeFilter);
    }
    return list.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      due_date: t.due_date,
      priority: t.priority,
      activity_id: t.activity_id,
      description: t.description,
      created_at: t.created_at,
      updated_at: t.updated_at,
      assignee_profile_id: t.assignee_profile_id,
    }));
  }, [tasks, activityFilter, searchQuery, statusFilter, priorityFilter, assigneeFilter]);

  const activityOptions = useMemo(
    () => activities.map((a) => ({ value: a.id, label: a.name })),
    [activities]
  );

  // Responsable options from shared hook (project members only).
  const assigneeOptions = useMemo(
    () => assignableUsers.map((u) => ({ value: u.id, label: u.label })),
    [assignableUsers]
  );

  const assignedToMeCount = useMemo(() => {
    if (!currentUserId) return 0;
    return visibleTasks.filter((t) => t.assignee_profile_id === currentUserId).length;
  }, [visibleTasks, currentUserId]);

  const activityFilterOptions = useMemo(
    () => [
      { value: "", label: "All activities" },
      ...activities.map((a) => ({ value: a.id, label: a.name })),
    ],
    [activities]
  );

  const statusFilterOptions = useMemo(
    () => [
      { value: "", label: "Todos los estados" },
      ...KANBAN_COLUMNS.map((c) => ({ value: c.id, label: c.label })),
    ],
    []
  );

  const priorityFilterOptions = useMemo(
    () => [
      { value: "", label: "Todas las prioridades" },
      { value: "high", label: "Alta" },
      { value: "medium", label: "Media" },
      { value: "low", label: "Baja" },
    ],
    []
  );

  const assigneeFilterOptions = useMemo(
    () => [
      { value: "", label: "Todos los responsables" },
      ...assigneeOptions.map((o) => ({ value: o.value, label: o.label })),
    ],
    [assigneeOptions]
  );

  const handleCreateProjectTask = useCallback(
    async (payload: CreateTaskPayload) => {
      if (!projectId) return;
      if (!payload.activity_id) {
        throw new Error("Selecciona una actividad.");
      }

      console.debug("[createTask] start");
      const insertPayload = {
        project_id: projectId,
        activity_id: payload.activity_id,
        title: payload.title,
        description: payload.description ?? null,
        priority: payload.priority ?? "medium",
        due_date: payload.due_date ?? null,
        status: "pending",
        assignee_profile_id: payload.assignee_profile_id ?? null,
      };
      console.debug("[createTask] payload", insertPayload);

      const { data: createdRow, error } = await supabase
        .from("project_tasks")
        .insert(insertPayload)
        .select("*")
        .single();

      if (error) {
        const meta = {
          message: error.message,
          code: (error as { code?: string }).code,
          details: (error as { details?: string }).details,
          hint: (error as { hint?: string }).hint,
        };
        console.error("Error creating task", serializeUnknownError(error));
        console.debug("[createTask] failure", serializeUnknownError(error));
        throw new Error(
          `Supabase task insert failed: ${meta.message} | code=${meta.code ?? "?"} | details=${meta.details ?? ""} | hint=${meta.hint ?? ""}`
        );
      }

      console.debug("[createTask] success", createdRow);
      await loadData();
    },
    [projectId, loadData]
  );

  const handleUpdateStatus = useCallback(
    (taskId: string, newStatusKey: string) => {
      let previousStatus: ProjectTask["status"] | null = null;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          previousStatus = t.status;
          return { ...t, status: newStatusKey as ProjectTask["status"] };
        })
      );
      supabase
        .from("project_tasks")
        .update({ status: newStatusKey })
        .eq("id", taskId)
        .then(({ error }) => {
          if (error) {
            console.error("Error updating task status", error);
            if (previousStatus !== null) {
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === taskId ? { ...t, status: previousStatus! } : t
                )
              );
            }
          }
        });
    },
    []
  );

  const handleAssigneeChange = useCallback(
    (taskId: string, assigneeProfileId: string | null) => {
      let previous: string | null = null;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          previous = t.assignee_profile_id;
          return { ...t, assignee_profile_id: assigneeProfileId };
        })
      );
      supabase
        .from("project_tasks")
        .update({ assignee_profile_id: assigneeProfileId })
        .eq("id", taskId)
        .then(({ error }) => {
          if (error) {
            console.error("Error updating task assignee", error);
            setTasks((prev) =>
              prev.map((t) =>
                t.id === taskId ? { ...t, assignee_profile_id: previous } : t
              )
            );
          }
        });
    },
    []
  );

  const handleUpdatePriority = useCallback((taskId: string, priority: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id !== taskId ? t : { ...t, priority: priority as ProjectTask["priority"] }))
    );
    supabase
      .from("project_tasks")
      .update({ priority })
      .eq("id", taskId)
      .then(({ error }) => {
        if (error) console.error("Error updating task priority", error);
      });
  }, []);

  const handleUpdateDueDate = useCallback((taskId: string, dueDate: string | null) => {
    setTasks((prev) =>
      prev.map((t) => (t.id !== taskId ? t : { ...t, due_date: dueDate }))
    );
    supabase
      .from("project_tasks")
      .update({ due_date: dueDate })
      .eq("id", taskId)
      .then(({ error }) => {
        if (error) console.error("Error updating task due date", error);
      });
  }, []);

  const handleSaveDetail = useCallback(
    async (taskId: string, payload: TaskDetailPayload) => {
      setDetailSaving(true);
      try {
        const { error } = await supabase
          .from("project_tasks")
          .update({
            title: payload.title,
            description: payload.description,
            status: payload.status,
            priority: payload.priority,
            assignee_profile_id: payload.assignee_profile_id,
            due_date: payload.due_date,
            activity_id: payload.activity_id ?? null,
          })
          .eq("id", taskId);
        if (error) throw error;
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id !== taskId) return t;
            return {
              ...t,
              title: payload.title,
              description: payload.description,
              status: payload.status as ProjectTask["status"],
              priority: payload.priority as ProjectTask["priority"],
              assignee_profile_id: payload.assignee_profile_id,
              due_date: payload.due_date,
              activity_id: payload.activity_id ?? null,
            };
          })
        );
        setDetailOpen(false);
        setDetailTask(null);
      } catch (e) {
        console.error("Error saving task detail", e);
      } finally {
        setDetailSaving(false);
      }
    },
    []
  );

  const validStatuses = useMemo(() => new Set(PROJECT_STATUS_KEYS), []);
  const getStatusKey = useCallback(
    (task: BoardTask) => {
      const s = (task.status ?? "pending").toLowerCase().trim();
      return validStatuses.has(s as (typeof PROJECT_STATUS_KEYS)[number]) ? s : "pending";
    },
    [validStatuses]
  );

  if (!projectId) {
    return (
      <div className="w-full min-w-0 bg-slate-950">
        <p className="text-sm text-slate-400">No se ha encontrado el identificador del proyecto.</p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6 bg-slate-950">
        {showCreandoBanner && (
          <div className="rounded-xl border border-slate-600/80 bg-slate-800/60 px-3 py-2 text-xs text-slate-400 transition-opacity duration-300">
            Creando...
          </div>
        )}
        <TaskWorkspaceHeader
          title="Tasks"
          subtitle="Organize and track project tasks. Same task system as the global workspace, scoped to this project."
          actions={
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          }
        />

        <TaskFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search project tasks..."
          scopeOptions={activityFilterOptions}
          scopeValue={activityFilter ?? ""}
          onScopeChange={(value) => {
            const url = value
              ? `/projects/${projectId}/tasks?activity=${encodeURIComponent(value)}`
              : `/projects/${projectId}/tasks`;
            router.push(url);
          }}
          statusOptions={statusFilterOptions}
          statusValue={statusFilter}
          onStatusChange={setStatusFilter}
          priorityOptions={priorityFilterOptions}
          priorityValue={priorityFilter}
          onPriorityChange={setPriorityFilter}
          assigneeOptions={assigneeFilterOptions}
          assigneeValue={assigneeFilter}
          onAssigneeChange={setAssigneeFilter}
        />

        {activityFilter && (
          <p className="text-sm text-slate-400">
            Mostrando tareas de la actividad seleccionada.{" "}
            <Link
              href={`/projects/${projectId}/tasks`}
              className="font-medium text-indigo-400 hover:text-indigo-300"
            >
              Ver todas
            </Link>
          </p>
        )}

        {errorMsg && (
          <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {errorMsg}
          </div>
        )}

        {activities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700/60 bg-slate-800/30 px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-300">Sin tareas aún</p>
            <p className="mt-1 text-sm text-slate-500">
              Crea actividades en Planificación → Actividades por fase. Luego podrás crear tareas vinculadas.
            </p>
          </div>
        ) : (
          <TasksBoard
            title="Board"
            subtitle="Project tasks linked to activities. Drag to change status."
            tasks={visibleTasks}
            columns={KANBAN_COLUMNS}
            getStatusKey={getStatusKey}
            onCreateTask={handleCreateProjectTask}
            onStatusChange={handleUpdateStatus}
            onAssigneeChange={handleAssigneeChange}
            onPriorityChange={handleUpdatePriority}
            onDueDateChange={handleUpdateDueDate}
            onOpenDetail={(task) => {
              setDetailTask(task);
              setDetailOpen(true);
            }}
            showActivityField
            activityOptions={activityOptions}
            assigneeOptions={assigneeOptions}
            doneStatusKey="done"
            loading={loading}
            error={errorMsg}
            viewMode={viewMode}
            openCreateInitially={openCreateFromQuery}
            assignedToMeCount={assignedToMeCount}
          />
        )}

      <TaskDetailDrawer
        task={detailTask}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailTask(null);
        }}
        onSave={handleSaveDetail}
        context="project"
        statusOptions={KANBAN_COLUMNS.map((c) => ({ value: c.id, label: c.label }))}
        priorityOptions={[
          { value: "high", label: "Alta" },
          { value: "medium", label: "Media" },
          { value: "low", label: "Baja" },
        ]}
        assigneeOptions={assigneeOptions}
        activityOptions={activityOptions}
        projectName={projectName}
        saving={detailSaving}
      />
    </div>
  );
}
