"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { ProjectTask } from "@/lib/types/projectTasks";
import TasksBoard, {
  type BoardTask,
  type CreateTaskPayload,
} from "@/app/components/TasksBoard";
import { ChevronLeft } from "lucide-react";

const KANBAN_COLUMNS: { id: string; label: string }[] = [
  { id: "pending", label: "Por hacer" },
  { id: "in_progress", label: "En progreso" },
  { id: "blocked", label: "Bloqueado" },
  { id: "done", label: "Hecha" },
];

export default function ProjectTasksPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const projectId = (params?.id ?? "") as string;
  const activityFilter = searchParams?.get("activity") || null;

  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [activities, setActivities] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    }));
  }, [tasks, activityFilter]);

  const activityOptions = useMemo(
    () => activities.map((a) => ({ value: a.id, label: a.name })),
    [activities]
  );

  const handleCreateProjectTask = useCallback(
    async (payload: CreateTaskPayload) => {
      if (!projectId) return;
      if (!payload.activity_id) {
        throw new Error("Selecciona una actividad.");
      }

      const { error } = await supabase.from("project_tasks").insert({
        project_id: projectId,
        activity_id: payload.activity_id,
        title: payload.title,
        description: payload.description ?? null,
        priority: payload.priority ?? "medium",
        due_date: payload.due_date ?? null,
        status: "pending",
      });

      if (error) {
        console.error("Error creating task", error);
        throw new Error(error.message || "No se pudo crear la tarea.");
      }
      await loadData();
    },
    [projectId, loadData]
  );

  const handleUpdateStatus = useCallback(
    async (taskId: string, newStatusKey: string) => {
      const { error } = await supabase
        .from("project_tasks")
        .update({ status: newStatusKey })
        .eq("id", taskId);

      if (error) {
        console.error("Error updating task status", error);
        return;
      }
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: newStatusKey as ProjectTask["status"] } : t
        )
      );
    },
    []
  );

  const getStatusKey = useCallback((task: BoardTask) => task.status ?? "pending", []);

  if (!projectId) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <p className="text-sm text-slate-600">No se ha encontrado el identificador del proyecto.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-indigo-600"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver al proyecto
        </Link>

        {activityFilter && (
          <p className="text-sm text-slate-600">
            Mostrando tareas de la actividad seleccionada.{" "}
            <Link
              href={`/projects/${projectId}/tasks`}
              className="font-medium text-indigo-600 hover:text-indigo-700"
            >
              Ver todas
            </Link>
          </p>
        )}

        {errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {activities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500">
            Crea primero actividades en Planificación → Actividades por fase. Luego podrás crear
            tareas vinculadas a cada actividad.
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
            showActivityField
            activityOptions={activityOptions}
            doneStatusKey="done"
            loading={loading}
            error={errorMsg}
          />
        )}
      </div>
    </main>
  );
}
