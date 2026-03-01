"use client";

import { useEffect, useMemo, useState, FormEvent, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  DndContext,
  closestCorners,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  type DragEndEvent,
  useDroppable,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskCard } from "@/app/components/TaskCard";

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
  activate_phase_key: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  is_template_generated?: boolean;
  created_at: string;
  updated_at: string;
};

type TasksBoardProps = {
  projectId?: string | null; // null → global board (load from "tasks"); when using controlled mode, pass tasks/onCreateTask instead
  title?: string;
  subtitle?: string;
  /** When provided, board is in "controlled" mode: use these tasks, no internal load. Requires columns, getStatusKey, onCreateTask, onStatusChange. */
  tasks?: BoardTask[];
  columns?: { id: string; label: string }[];
  getStatusKey?: (task: BoardTask) => string;
  onCreateTask?: (payload: CreateTaskPayload) => Promise<void>;
  onStatusChange?: (taskId: string, newStatusKey: string) => Promise<void>;
  showActivityField?: boolean;
  activityOptions?: { value: string; label: string }[];
  /** Status key that counts as "done" for metrics (e.g. "DONE" or "done"). */
  doneStatusKey?: string;
  loading?: boolean;
  error?: string | null;
};

export type BoardTask = {
  id: string;
  title: string;
  status_id?: string;
  status?: string;
  due_date?: string | null;
  priority?: string;
  activity_id?: string | null;
  description?: string | null;
  external_ref?: string | null;
  created_at?: string;
  [key: string]: unknown;
};

export type CreateTaskPayload = {
  title: string;
  description?: string | null;
  priority: string;
  due_date: string | null;
  activity_id?: string;
};

/** Status code (uppercase from DB) → Tailwind background class for column dot and task left bar */
const COLUMN_COLOR_MAP: Record<string, string> = {
  TODO: "bg-slate-400",
  IN_PROGRESS: "bg-blue-500",
  BLOCKED: "bg-rose-500",
  IN_REVIEW: "bg-violet-500",
  DONE: "bg-emerald-500",
  pending: "bg-slate-400",
  in_progress: "bg-blue-500",
  blocked: "bg-rose-500",
  done: "bg-emerald-500",
};

/** Status code → Tailwind border-top class for column accent */
const COLUMN_BORDER_MAP: Record<string, string> = {
  TODO: "border-t-slate-400",
  IN_PROGRESS: "border-t-blue-500",
  BLOCKED: "border-t-rose-500",
  IN_REVIEW: "border-t-violet-500",
  DONE: "border-t-emerald-500",
  pending: "border-t-slate-400",
  in_progress: "border-t-blue-500",
  blocked: "border-t-rose-500",
  done: "border-t-emerald-500",
};

const ACTIVATE_PHASE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todas las fases" },
  { value: "discover", label: "Discover" },
  { value: "prepare", label: "Prepare" },
  { value: "explore", label: "Explore" },
  { value: "realize", label: "Realize" },
  { value: "deploy", label: "Deploy" },
  { value: "run", label: "Run" },
];

function ColumnDroppable({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      id={id}
      className={`${className ?? ""} ${isOver ? "ring-1 ring-indigo-300 bg-indigo-50/40" : ""}`}
    >
      {children}
    </div>
  );
}

export default function TasksBoard({
  projectId = null,
  title = "Tablero de tareas",
  subtitle,
  tasks: controlledTasks,
  columns: controlledColumns,
  getStatusKey: controlledGetStatusKey,
  onCreateTask: controlledOnCreateTask,
  onStatusChange: controlledOnStatusChange,
  showActivityField = false,
  activityOptions = [],
  doneStatusKey = "DONE",
  loading: controlledLoading = false,
  error: controlledError,
}: TasksBoardProps) {
  const isControlled =
    controlledTasks !== undefined &&
    controlledColumns !== undefined &&
    controlledGetStatusKey !== undefined &&
    controlledOnCreateTask !== undefined &&
    controlledOnStatusChange !== undefined;

  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newActivityId, setNewActivityId] = useState<string>("");

  // Filtro por fase SAP Activate (solo relevante cuando projectId está definido y no controlled)
  const [phaseFilter, setPhaseFilter] = useState<string>("");

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

  // Carga inicial (solo en modo global, no controlled)
  useEffect(() => {
    if (isControlled) return;
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
        setError("No se pudieron cargar las tareas. Inténtalo de nuevo.");
        setStatuses([]);
        setTasks([]);
      } else {
        setStatuses(statusData ?? []);
        setTasks((taskData ?? []) as Task[]);
      }

      setLoading(false);
    };

    loadData();
  }, [projectId, isControlled]);

  // Datos para modo controlled
  const controlledGrouped = useMemo(() => {
    if (!isControlled || !controlledTasks || !controlledColumns || !controlledGetStatusKey)
      return [];
    return controlledColumns.map((col) => ({
      id: col.id,
      label: col.label,
      tasks: controlledTasks.filter((t) => controlledGetStatusKey(t) === col.id),
    }));
  }, [isControlled, controlledTasks, controlledColumns, controlledGetStatusKey]);

  const controlledMetrics = useMemo(() => {
    if (!isControlled || !controlledTasks || !controlledGetStatusKey || !doneStatusKey)
      return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let completed = 0;
    let blocked = 0;
    let overdue = 0;
    for (const t of controlledTasks) {
      const key = controlledGetStatusKey(t);
      if (key === doneStatusKey) completed += 1;
      if (key === "blocked" || key === "BLOCKED") blocked += 1;
      if (key !== doneStatusKey && t.due_date) {
        const due = new Date(t.due_date);
        due.setHours(0, 0, 0, 0);
        if (due < today) overdue += 1;
      }
    }
    const total = controlledTasks.length;
    const active = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    let riskLevel: "Alto" | "Medio" | "Bajo" = "Bajo";
    if (blocked > 0 || overdue > 0) riskLevel = "Alto";
    else if (completionRate < 50) riskLevel = "Medio";
    return {
      totalActivities: total,
      activeActivities: active,
      blockedActivities: blocked,
      reviewActivities: 0,
      completedActivities: completed,
      overdueActivities: overdue,
      completionRate,
      riskLevel,
    };
  }, [isControlled, controlledTasks, controlledGetStatusKey, doneStatusKey]);

  // Agrupado por estado para pintar columnas (opcionalmente filtrado por fase)
  const filteredTasks = useMemo(() => {
    if (!phaseFilter) return tasks;
    return tasks.filter((t) => t.activate_phase_key === phaseFilter);
  }, [tasks, phaseFilter]);

  const groupedByStatus = useMemo(() => {
    return statuses.map((status) => ({
      status,
      tasks: filteredTasks.filter((t) => t.status_id === status.id),
    }));
  }, [statuses, filteredTasks]);

  // Métricas derivadas de tareas (sin llamadas a BD) — usamos tareas filtradas
  const activityMetrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getStatusCode = (task: Task) =>
      statuses.find((s) => s.id === task.status_id)?.code ?? "TODO";

    let completedActivities = 0;
    let blockedActivities = 0;
    let reviewActivities = 0;
    let overdueActivities = 0;

    for (const task of filteredTasks) {
      const code = getStatusCode(task);
      if (code === "DONE") completedActivities += 1;
      if (code === "BLOCKED") blockedActivities += 1;
      if (code === "IN_REVIEW") reviewActivities += 1;
      if (code !== "DONE" && task.due_date) {
        const due = new Date(task.due_date);
        due.setHours(0, 0, 0, 0);
        if (due < today) overdueActivities += 1;
      }
    }

    const totalActivities = filteredTasks.length;
    const activeActivities = totalActivities - completedActivities;
    const completionRate =
      totalActivities > 0
        ? Math.round((completedActivities / totalActivities) * 100)
        : 0;

    let riskLevel: "Alto" | "Medio" | "Bajo" = "Bajo";
    if (blockedActivities > 0 || overdueActivities > 0) riskLevel = "Alto";
    else if (completionRate < 50) riskLevel = "Medio";

    return {
      totalActivities,
      activeActivities,
      blockedActivities,
      reviewActivities,
      completedActivities,
      overdueActivities,
      completionRate,
      riskLevel,
    };
  }, [filteredTasks, statuses]);

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
    if (!newTitle.trim()) return;

    if (isControlled && controlledOnCreateTask) {
      if (showActivityField && !newActivityId.trim()) {
        setError("Selecciona una actividad.");
        return;
      }
      setCreating(true);
      setError(null);
      try {
        await controlledOnCreateTask({
          title: newTitle.trim(),
          description: newDescription.trim() || null,
          priority: newPriority,
          due_date: newDueDate ?? null,
          ...(showActivityField && newActivityId ? { activity_id: newActivityId } : {}),
        });
        setNewTitle("");
        setNewDescription("");
        setNewPriority("medium");
        setNewDueDate(null);
        setNewExternalRef("");
        setNewActivityId("");
      } catch (err) {
        setError("No se pudo crear la tarea.");
      }
      setCreating(false);
      return;
    }

    if (!defaultStatusId) return;

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
      setError("No se pudo crear la tarea.");
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
      ? "Tareas asociadas a este proyecto"
      : "Tareas generales (no asociadas a un proyecto)");

  const effectiveLoading = isControlled ? controlledLoading : loading;
  const effectiveError = isControlled ? controlledError : error;
  const displayMetrics = isControlled ? controlledMetrics : activityMetrics;

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleControlledDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || !controlledOnStatusChange || !controlledColumns || !controlledGetStatusKey || !controlledTasks)
        return;
      const taskId = String(active.id);
      const columnIds = controlledColumns.map((c) => c.id);
      const newStatus =
        columnIds.includes(String(over.id))
          ? String(over.id)
          : (() => {
              const task = controlledTasks.find((t) => t.id === over.id);
              return task ? controlledGetStatusKey(task) : null;
            })();
      if (newStatus) {
        controlledOnStatusChange(taskId, newStatus);
      }
    },
    [
      controlledOnStatusChange,
      controlledColumns,
      controlledGetStatusKey,
      controlledTasks,
    ]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header + formulario nueva tarea */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {title}
          </h2>
          <p className="text-sm text-slate-500">
            {boardSubtitle}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 md:items-end">
          {projectId && !isControlled && (
            <div className="w-full sm:w-44">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Fase SAP Activate
              </label>
              <select
                value={phaseFilter}
                onChange={(e) => setPhaseFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {ACTIVATE_PHASE_OPTIONS.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showActivityField && (
            <div className="w-full sm:w-44">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Actividad
              </label>
              <select
                value={newActivityId}
                onChange={(e) => setNewActivityId(e.target.value)}
                required={showActivityField}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Actividad</option>
                {activityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

        <form
          onSubmit={handleCreateTask}
          className="flex flex-col md:flex-row gap-2 md:items-end rounded-2xl bg-white border border-slate-200 shadow-sm p-3"
        >
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Nueva tarea
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Ej. Crear flujo de presupuestos"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="md:w-48">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Prioridad
            </label>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={
              creating ||
              (!isControlled && !defaultStatusId) ||
              (showActivityField && !newActivityId.trim())
            }
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? "Creando..." : "Añadir"}
          </button>
        </form>
        </div>
      </div>

      {effectiveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {effectiveError}
        </div>
      )}

      {/* Executive activity KPI row */}
      {!effectiveLoading && displayMetrics && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center flex-wrap gap-6">
              <span className="text-sm text-slate-600">
                Total: <span className="font-semibold text-slate-900">{displayMetrics.totalActivities}</span>
              </span>
              <span className="text-sm text-slate-600">
                Activas: <span className="font-semibold text-slate-900">{displayMetrics.activeActivities}</span>
              </span>
              <span className={`text-sm ${displayMetrics.blockedActivities > 0 ? "text-rose-600" : "text-slate-600"}`}>
                Bloqueadas: <span className="font-semibold">{displayMetrics.blockedActivities}</span>
              </span>
              {!isControlled && (
              <span className="text-sm text-slate-600">
                En revisión: <span className="font-semibold text-slate-900">{displayMetrics.reviewActivities}</span>
              </span>
              )}
              <span className={`text-sm ${displayMetrics.overdueActivities > 0 ? "text-amber-600" : "text-slate-600"}`}>
                Vencidas: <span className="font-semibold">{displayMetrics.overdueActivities}</span>
              </span>
              <span className="text-sm text-slate-600">
                Completado: <span className="font-semibold text-slate-900">{displayMetrics.completionRate}%</span>
              </span>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                displayMetrics.riskLevel === "Alto"
                  ? "bg-rose-100 text-rose-600"
                  : displayMetrics.riskLevel === "Medio"
                    ? "bg-amber-100 text-amber-600"
                    : "bg-emerald-100 text-emerald-600"
              }`}
            >
              Riesgo {displayMetrics.riskLevel}
            </span>
          </div>
          <div className="mt-3 h-2 w-full bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${displayMetrics.completionRate}%` }}
            />
          </div>
        </div>
      )}

      {/* Board: controlled mode (project tasks) */}
      {isControlled && (
        <div className="relative">
          {effectiveLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500">
              Cargando tablero de tareas...
            </div>
          ) : (
            <DndContext
              collisionDetection={closestCorners}
              onDragEnd={handleControlledDragEnd}
              sensors={dndSensors}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {controlledGrouped.map(({ id, label, tasks: colTasks }) => {
                  const accentBorder = COLUMN_BORDER_MAP[id] ?? "border-t-slate-400";
                  const dotClass = COLUMN_COLOR_MAP[id] ?? "bg-slate-400";
                  return (
                    <ColumnDroppable
                      key={id}
                      id={id}
                      className={`flex flex-col rounded-2xl p-3 max-h-[70vh] border-t-4 ${accentBorder} bg-slate-200/60`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotClass}`} />
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                            {label}
                          </span>
                        </div>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {colTasks.length}
                        </span>
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                        {colTasks.length === 0 && (
                          <p className="text-xs text-slate-400 px-1 py-2">Sin tareas.</p>
                        )}
                        <SortableContext
                          items={colTasks.map((t) => t.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {colTasks.map((task) => {
                            const activityLabel =
                              showActivityField && task.activity_id
                                ? activityOptions.find((a) => a.value === task.activity_id)?.label ?? null
                                : null;
                            const leftBarClass =
                              COLUMN_COLOR_MAP[controlledGetStatusKey!(task)] ?? "bg-slate-400";
                            const currentStatusKey = controlledGetStatusKey!(task);
                            return (
                              <TaskCard
                                key={task.id}
                                task={task}
                                activityLabel={activityLabel}
                                leftBarClass={leftBarClass}
                                columns={controlledColumns!}
                                currentStatusKey={currentStatusKey}
                                onStatusChange={controlledOnStatusChange!}
                              />
                            );
                          })}
                        </SortableContext>
                      </div>
                    </ColumnDroppable>
                  );
                })}
              </div>
            </DndContext>
          )}
        </div>
      )}

      {/* Board con drag & drop (global mode) */}
      {!isControlled && (
      <div className="relative">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-500">
            Cargando tablero de tareas...
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {groupedByStatus.map(({ status, tasks }) => (
                <Droppable droppableId={status.id} key={status.id}>
                  {(provided, snapshot) => {
                    const code = status.code ?? "TODO";
                    const isTodo = code === "TODO";
                    const columnBg = isTodo ? "bg-slate-300/60" : "bg-slate-200/60";
                    const accentBorder = COLUMN_BORDER_MAP[code] ?? "border-t-slate-400";
                    const dotClass = COLUMN_COLOR_MAP[code] ?? "bg-slate-400";
                    return (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex flex-col rounded-2xl p-3 max-h-[70vh] transition-colors border-t-4 ${accentBorder} ${columnBg} ${
                        snapshot.isDraggingOver
                          ? "bg-indigo-50/60 ring-1 ring-indigo-200"
                          : ""
                      }`}
                    >
                      {/* Col header */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotClass}`}
                          />
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                            {status.name}
                          </span>
                        </div>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {tasks.length}
                        </span>
                      </div>

                      {/* Tasks list */}
                      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                        {tasks.length === 0 && (
                          <p className="text-xs text-slate-400 px-1 py-2">
                            Sin tareas.
                          </p>
                        )}

                        {tasks.map((task, index) => (
                          <Draggable
                            key={task.id}
                            draggableId={task.id}
                            index={index}
                          >
                            {(dragProvided, dragSnapshot) => {
                              const taskStatus = statuses.find((s) => s.id === task.status_id);
                              const statusCode = taskStatus?.code ?? "TODO";
                              const leftBarClass = COLUMN_COLOR_MAP[statusCode] ?? "bg-slate-400";
                              return (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={`relative rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col gap-1.5 overflow-hidden ${
                                  dragSnapshot.isDragging
                                    ? "ring-2 ring-indigo-500 shadow-lg"
                                    : ""
                                }`}
                              >
                                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${leftBarClass}`} />
                                <div className="pl-4">
                                <div className="px-3 py-2">
                                  <p className="text-sm font-semibold text-slate-900">
                                    {task.title}
                                  </p>

                                  {task.external_ref && (
                                    <p className="text-xs text-slate-500 mt-0.5">
                                      Ref:{" "}
                                      <span className="font-mono">
                                        {task.external_ref}
                                      </span>
                                    </p>
                                  )}

                                  {task.due_date && (
                                    <p className="text-xs text-slate-500">
                                      Límite:{" "}
                                      {new Date(
                                        task.due_date
                                      ).toLocaleDateString()}
                                    </p>
                                  )}

                                  {task.description && (
                                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                                      {task.description}
                                    </p>
                                  )}
                                </div>

                                <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50/50">
                                  <select
                                    value={task.status_id}
                                    onChange={(e) =>
                                      handleStatusChange(
                                        task.id,
                                        e.target.value
                                      )
                                    }
                                    className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  >
                                    {statuses.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.name}
                                      </option>
                                    ))}
                                  </select>

                                  <span className="text-[11px] text-slate-400 shrink-0">
                                    {new Date(
                                      task.created_at
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                                </div>
                              </div>
                              );
                            }}
                          </Draggable>
                        ))}

                        {provided.placeholder}
                      </div>
                    </div>
                    );
                  }}
                </Droppable>
              ))}
            </div>
          </DragDropContext>
        )}
      </div>
      )}
    </div>
  );
}