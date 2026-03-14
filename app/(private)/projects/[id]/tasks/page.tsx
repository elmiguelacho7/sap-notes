"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { ProjectTask } from "@/lib/types/projectTasks";
import TasksBoard, {
  type BoardTask,
  type CreateTaskPayload,
} from "@/app/components/TasksBoard";

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

const KANBAN_COLUMNS: { id: string; label: string }[] = [
  { id: "pending", label: "Por hacer" },
  { id: "in_progress", label: "En progreso" },
  { id: "blocked", label: "Bloqueado" },
  { id: "done", label: "Hecha" },
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
  const [memberProfiles, setMemberProfiles] = useState<{ id: string; full_name: string | null; email: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setErrorMsg(null);

      const [tasksRes, activitiesRes, membersRes] = await Promise.all([
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
        supabase
          .from("project_members")
          .select("profile_id, user_id")
          .eq("project_id", projectId),
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

      // Project team: same source as Team page — project_members for this project, then profiles for names.
      // Use profile_id ?? user_id so we resolve all members (profile_id may be null on some rows).
      const profileIds = (membersRes.data ?? [])
        .map((r: { profile_id?: string | null; user_id?: string | null }) => r.profile_id ?? r.user_id)
        .filter((id): id is string => id != null && id !== "");
      if (profileIds.length > 0 && !membersRes.error) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", profileIds);
        setMemberProfiles((profilesData ?? []) as { id: string; full_name: string | null; email: string | null }[]);
      } else {
        setMemberProfiles([]);
      }
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

  const visibleTasks: BoardTask[] = useMemo(() => {
    const list = activityFilter
      ? tasks.filter((t) => t.activity_id === activityFilter)
      : tasks;
    return list.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      due_date: t.due_date,
      priority: t.priority,
      activity_id: t.activity_id,
      description: t.description,
      created_at: t.created_at,
      assignee_profile_id: t.assignee_profile_id,
    }));
  }, [tasks, activityFilter]);

  const activityOptions = useMemo(
    () => activities.map((a) => ({ value: a.id, label: a.name })),
    [activities]
  );

  // Responsible dropdown: only real project team members (project_members → profiles). Same people as Team page.
  const assigneeOptions = useMemo(
    () =>
      memberProfiles.map((p) => ({
        value: p.id,
        label: p.full_name || p.email || p.id,
      })),
    [memberProfiles]
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

  const getStatusKey = useCallback((task: BoardTask) => task.status ?? "pending", []);

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
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">Tareas</h1>
          <p className="mt-0.5 text-sm text-slate-500">Organiza y gestiona las tareas del proyecto.</p>
        </header>

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
            title="Tareas del proyecto"
            subtitle="Tareas asociadas a las actividades del proyecto. Úsalas para hacer seguimiento del trabajo real."
            tasks={visibleTasks}
            columns={KANBAN_COLUMNS}
            getStatusKey={getStatusKey}
            onCreateTask={handleCreateProjectTask}
            onStatusChange={handleUpdateStatus}
            onAssigneeChange={handleAssigneeChange}
            showActivityField
            activityOptions={activityOptions}
            assigneeOptions={assigneeOptions}
            doneStatusKey="done"
            loading={loading}
            error={errorMsg}
            openCreateInitially={openCreateFromQuery}
          />
        )}
    </div>
  );
}
