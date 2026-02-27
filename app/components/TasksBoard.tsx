"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";

type TaskStatus = {
  id: string;
  code: "TODO" | "IN_PROGRESS" | "BLOCKED" | "IN_REVIEW" | "DONE" | string;
  name: string;
  color: string | null;
  order_index: number;
};

type TaskPriority = "low" | "medium" | "high";

type Task = {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status_id: string;
  priority: TaskPriority;
  due_date: string | null;
  estimate: number | null;
  external_ref: string | null;
  created_by: string | null;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
};

type TasksBoardProps = {
  projectId?: string | null; // null → generales; id → por proyecto
  title?: string;
  subtitle?: string;
};

export default function TasksBoard({
  projectId = null,
  title = "Tablero de actividades",
  subtitle,
}: TasksBoardProps) {
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formulario nueva tarea
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newDueDate, setNewDueDate] = useState<string | null>(null);
  const [newExternalRef, setNewExternalRef] = useState<string>("");

  // Status TODO por defecto
  const defaultStatusId = useMemo(() => {
    const todo = statuses.find((s) => s.code === "TODO");
    return todo?.id ?? (statuses[0]?.id ?? null);
  }, [statuses]);

  // Carga inicial
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      const [{ data: statusData, error: statusError }, { data: taskData, error: taskError }] =
        await Promise.all([
          supabase
            .from("task_statuses")
            .select("*")
            .eq("is_active", true)
            .order("order_index", { ascending: true }),
          (() => {
            let query = supabase.from("tasks").select("*").order("created_at", {
              ascending: true,
            });

            if (projectId === null) {
              // Tablero general → solo tareas sin proyecto
              query = query.is("project_id", null);
            } else if (projectId) {
              // Tablero de un proyecto concreto
              query = query.eq("project_id", projectId);
            }

            return query;
          })(),
        ]);

      if (statusError) handleSupabaseError("task_statuses", statusError);
      if (taskError) handleSupabaseError("tasks", taskError);

      if (statusError || taskError) {
        setError("No se pudieron cargar las actividades. Inténtalo de nuevo.");
        setStatuses([]);
        setTasks([]);
      } else {
        setStatuses(statusData ?? []);
        setTasks((taskData ?? []) as Task[]);
      }

      setLoading(false);
    };

    loadData();
  }, [projectId]);

  // Agrupado por estado para pintar columnas
  const groupedByStatus = useMemo(() => {
    return statuses.map((status) => ({
      status,
      tasks: tasks.filter((t) => t.status_id === status.id),
    }));
  }, [statuses, tasks]);

  const getPriorityLabel = (priority: TaskPriority) => {
    switch (priority) {
      case "high":
        return "Alta";
      case "medium":
        return "Media";
      case "low":
        return "Baja";
      default:
        return priority;
    }
  };

  const getPriorityBadgeClass = (priority: TaskPriority) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
      default:
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }
  };

  // Crear nueva tarea por formulario
  const handleCreateTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !defaultStatusId) return;

    setCreating(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("tasks")
      .insert({
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        priority: newPriority,
        due_date: newDueDate ? newDueDate : null,
        external_ref: newExternalRef.trim() || null,
        status_id: defaultStatusId,
        project_id: projectId ?? null,
      })
      .select("*")
      .single();

    if (insertError) {
      handleSupabaseError("tasks insert", insertError);
      setError("No se pudo crear la actividad.");
    } else if (data) {
      setTasks((prev) => [...prev, data as Task]);
      setNewTitle("");
      setNewDescription("");
      setNewPriority("medium");
      setNewDueDate(null);
      setNewExternalRef("");
    }

    setCreating(false);
  };

  // Cambio de estado desde el select (lo mantenemos como alternativa)
  const handleStatusChange = async (taskId: string, newStatusId: string) => {
    setError(null);

    // update optimista
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status_id: newStatusId } : t))
    );

    const { error: updateError } = await supabase
      .from("tasks")
      .update({ status_id: newStatusId })
      .eq("id", taskId);

    if (updateError) {
      handleSupabaseError("tasks update status", updateError);
      setError("No se pudo actualizar el estado.");
      // en caso extremo podrías recargar desde BD
    }
  };

  // Drag & drop → mover tarjeta de una columna a otra
  const handleDragEnd = async (result: DropResult) => {
    setError(null);

    const { destination, source, draggableId } = result;

    // No hay destino (se soltó fuera)
    if (!destination) return;

    // Misma columna y misma posición → nada
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const taskId = draggableId;
    const newStatusId = destination.droppableId; // usamos status.id como droppableId

    // Si la columna no cambió, podemos ignorar (no estamos gestionando orden por ahora)
    if (source.droppableId === destination.droppableId) {
      return;
    }

    // update optimista
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status_id: newStatusId } : t))
    );

    // Persistir cambio en Supabase
    const { error: updateError } = await supabase
      .from("tasks")
      .update({ status_id: newStatusId })
      .eq("id", taskId);

    if (updateError) {
      handleSupabaseError("tasks update drag", updateError);
      setError("No se pudo actualizar el estado al mover la tarjeta.");
      // si quisieras, aquí podrías recargar las tareas desde BD
    }
  };

  const boardSubtitle =
    subtitle ??
    (projectId
      ? "Actividades asociadas a este proyecto"
      : "Actividades generales (no asociadas a un proyecto)");

  return (
    <div className="flex flex-col gap-6">
      {/* Header + formulario nueva tarea */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
            {title}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {boardSubtitle}
          </p>
        </div>

        <form
          onSubmit={handleCreateTask}
          className="flex flex-col md:flex-row gap-2 md:items-end bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl p-3 md:p-4 shadow-sm"
        >
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Nueva actividad
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Ej. Crear flujo de presupuestos"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="md:w-48">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Prioridad
            </label>
            <select
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
            >
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
          </div>

          <div className="md:w-44">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Fecha límite
            </label>
            <input
              type="date"
              value={newDueDate ?? ""}
              onChange={(e) => setNewDueDate(e.target.value || null)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={creating || !defaultStatusId}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? "Creando..." : "Añadir"}
          </button>
        </form>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Board con drag & drop */}
      <div className="relative">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-500">
            Cargando tablero de actividades...
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {groupedByStatus.map(({ status, tasks }) => (
                <Droppable droppableId={status.id} key={status.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex flex-col rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 shadow-sm max-h-[70vh] transition-colors ${
                        snapshot.isDraggingOver
                          ? "bg-indigo-50/60 dark:bg-slate-800/70"
                          : ""
                      }`}
                    >
                      {/* Col header */}
                      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-slate-400" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                            {status.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {tasks.length}
                        </span>
                      </div>

                      {/* Tasks list */}
                      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
                        {tasks.length === 0 && (
                          <p className="text-[11px] text-slate-400 px-1 py-1">
                            Sin actividades.
                          </p>
                        )}

                        {tasks.map((task, index) => (
                          <Draggable
                            key={task.id}
                            draggableId={task.id}
                            index={index}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={`rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 shadow-xs flex flex-col gap-1 text-xs transition-transform ${
                                  dragSnapshot.isDragging
                                    ? "ring-2 ring-indigo-500 scale-[1.01]"
                                    : ""
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="font-medium text-slate-800 dark:text-slate-100">
                                    {task.title}
                                  </p>
                                  {task.priority && (
                                    <span
                                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getPriorityBadgeClass(
                                        task.priority
                                      )}`}
                                    >
                                      {getPriorityLabel(task.priority)}
                                    </span>
                                  )}
                                </div>

                                {task.external_ref && (
                                  <p className="text-[11px] text-slate-500">
                                    Ref:{" "}
                                    <span className="font-mono">
                                      {task.external_ref}
                                    </span>
                                  </p>
                                )}

                                {task.due_date && (
                                  <p className="text-[11px] text-slate-500">
                                    Límite:{" "}
                                    {new Date(
                                      task.due_date
                                    ).toLocaleDateString()}
                                  </p>
                                )}

                                {task.description && (
                                  <p className="text-[11px] text-slate-500 line-clamp-3">
                                    {task.description}
                                  </p>
                                )}

                                <div className="mt-2 flex items-center justify-between gap-2">
                                  <select
                                    value={task.status_id}
                                    onChange={(e) =>
                                      handleStatusChange(
                                        task.id,
                                        e.target.value
                                      )
                                    }
                                    className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  >
                                    {statuses.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.name}
                                      </option>
                                    ))}
                                  </select>

                                  <span className="text-[10px] text-slate-400">
                                    {new Date(
                                      task.created_at
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}

                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              ))}
            </div>
          </DragDropContext>
        )}
      </div>
    </div>
  );
}