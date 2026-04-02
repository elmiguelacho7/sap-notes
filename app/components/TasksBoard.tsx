"use client";

import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  FormEvent,
  useCallback,
  useRef,
} from "react";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { STANDARD_STATUS_ORDER } from "@/lib/taskWorkflow";
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
  type DragStartEvent,
  useDroppable,
  DragOverlay,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskCard } from "@/app/components/TaskCard";
import { TaskSummary } from "@/app/components/TaskSummary";
import {
  getTaskDuePresentation,
  type TaskDuePresentationLabels,
} from "@/app/components/taskDuePresentation";
import { TaskList } from "@/components/tasks/TaskList";
import { TasksBoardSkeleton } from "@/components/skeletons/TasksBoardSkeleton";
import { AssigneeDropdown } from "@/app/components/AssigneeDropdown";

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
  /** When false, hides the embedded board header (title/subtitle/CTA) so the page can own the top-level hierarchy. */
  showHeader?: boolean;
  /**
   * When this number changes, the create-task modal opens.
   * Useful when the primary CTA lives in the page header (not inside the board).
   */
  externalCreateSignal?: number;
  /** When provided, board is in "controlled" mode: use these tasks, no internal load. Requires columns, getStatusKey, onCreateTask, onStatusChange. */
  tasks?: BoardTask[];
  columns?: { id: string; label: string }[];
  getStatusKey?: (task: BoardTask) => string;
  onCreateTask?: (payload: CreateTaskPayload) => Promise<void>;
  onStatusChange?: (taskId: string, newStatusKey: string) => void | Promise<void>;
  showActivityField?: boolean;
  activityOptions?: { value: string; label: string }[];
  /** Options for Responsible (assignee) selector; only project members. When provided, create modal and cards show assignee. */
  assigneeOptions?: { value: string; label: string }[];
  /** When assignee is changed from a card. */
  onAssigneeChange?: (taskId: string, assigneeProfileId: string | null) => void | Promise<void>;
  /** When priority is changed (list or card). */
  onPriorityChange?: (taskId: string, priority: string) => void | Promise<void>;
  /** When due date is changed (list or card). */
  onDueDateChange?: (taskId: string, dueDate: string | null) => void | Promise<void>;
  /** Status key that counts as "done" for metrics (e.g. "DONE" or "done"). */
  doneStatusKey?: string;
  loading?: boolean;
  error?: string | null;
  /** When true, focus the create-task input on mount (e.g. when opened via ?new=1). */
  openCreateInitially?: boolean;
  /** Global board only: filter to tasks assigned to or created by this user id. */
  filterByUserId?: string | null;
  /** Global board only: filter by assignee_id (profiles.id). */
  assigneeFilterId?: string | null;
  /** Global board only: filter by search string (title, description). */
  searchQuery?: string;
  /** Global board only: filter by status_id. */
  statusFilter?: string;
  /** Global board only: filter by priority. */
  priorityFilter?: string;
  /** View mode: kanban (default) or list. List only applied in uncontrolled (global) mode. */
  viewMode?: "kanban" | "list";
  /** Current user id for "Assigned to me" metric (global board). */
  currentUserId?: string | null;
  /** Controlled mode: when provided, show "Assigned to me" in KPI strip. */
  assignedToMeCount?: number;
  /** When provided (global board), open task detail drawer. */
  onOpenDetail?: (task: BoardTask) => void;
  /** When changed (global board), refetch tasks (e.g. after drawer save). */
  refreshTrigger?: number | string;
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
  assignee_profile_id?: string | null;
  [key: string]: unknown;
};

export type CreateTaskPayload = {
  title: string;
  description?: string | null;
  priority: string;
  due_date: string | null;
  activity_id?: string;
  assignee_profile_id?: string | null;
};

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

/** Status code → Tailwind class for column dot and task left bar (dark mode) */
const COLUMN_COLOR_MAP: Record<string, string> = {
  TODO: "bg-slate-400",
  IN_PROGRESS: "bg-[rgb(var(--rb-brand-primary))]",
  BLOCKED: "bg-red-400",
  IN_REVIEW: "bg-amber-400",
  DONE: "bg-emerald-500",
  pending: "bg-slate-400",
  in_progress: "bg-[rgb(var(--rb-brand-primary))]",
  blocked: "bg-red-400",
  review: "bg-amber-400",
  done: "bg-emerald-500",
};

/** Status code → Tailwind border-top class for column accent (dark) */
const COLUMN_BORDER_MAP: Record<string, string> = {
  TODO: "before:bg-slate-300/70",
  IN_PROGRESS: "before:bg-[rgb(var(--rb-brand-primary))]/65",
  BLOCKED: "before:bg-red-400/60",
  IN_REVIEW: "before:bg-amber-400/65",
  DONE: "before:bg-emerald-500/65",
  pending: "before:bg-slate-300/70",
  in_progress: "before:bg-[rgb(var(--rb-brand-primary))]/65",
  blocked: "before:bg-red-400/60",
  review: "before:bg-amber-400/65",
  done: "before:bg-emerald-500/65",
};

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
      className={`${className ?? ""} ${
        isOver
          ? "ring-1 ring-[rgb(var(--rb-brand-ring))]/35 bg-[rgb(var(--rb-surface))]/70 shadow-[inset_0_0_0_1px_rgba(46,204,113,0.12)]"
          : ""
      }`}
    >
      {children}
    </div>
  );
}

type ProjectBoardColumnProps = {
  id: string;
  label: string;
  tasks: BoardTask[];
  columns: { id: string; label: string }[];
  getStatusKey: (task: BoardTask) => string;
  onStatusChange: (taskId: string, newStatusKey: string) => void | Promise<void>;
  showActivityField: boolean;
  activityOptions: { value: string; label: string }[];
  assigneeOptions?: { value: string; label: string }[];
  onAssigneeChange?: (taskId: string, assigneeProfileId: string | null) => void | Promise<void>;
  onOpenDetail?: (task: BoardTask) => void;
};

const ProjectBoardColumn = React.memo(function ProjectBoardColumn({
  id,
  label,
  tasks: colTasks,
  columns,
  getStatusKey,
  onStatusChange,
  showActivityField,
  activityOptions,
  assigneeOptions,
  onAssigneeChange,
  onOpenDetail,
}: ProjectBoardColumnProps) {
  const tBoard = useTranslations("tasks.board");
  const emptyTitle = tBoard("emptyColumnTitle");
  const emptyColumnMessage = tBoard("emptyColumnBody");
  const accentBorder = COLUMN_BORDER_MAP[id] ?? "before:bg-slate-300/70";
  const dotClass = COLUMN_COLOR_MAP[id] ?? "bg-slate-400";
  return (
    <ColumnDroppable
      id={id}
      className={`relative flex flex-col rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] p-3.5 sm:p-4 min-h-[220px] min-w-[220px] sm:min-w-[232px] lg:min-w-0 lg:w-full flex-shrink-0 transition-[background-color,box-shadow,border-color] duration-200 overflow-visible w-[220px] sm:w-[232px] lg:max-w-none max-w-full shadow-sm before:absolute before:left-0 before:right-0 before:top-0 before:h-[2px] before:rounded-t-xl ${accentBorder}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ring-1 ring-[rgb(var(--rb-surface-border))]/60 ${dotClass}`} />
          <span className="text-[13px] font-semibold leading-snug text-[rgb(var(--rb-text-primary))] tracking-tight truncate">
            {label}
          </span>
        </div>
        <span className="tabular-nums rounded-lg border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/40 px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--rb-text-muted))] shrink-0 leading-none">
          {colTasks.length}
        </span>
      </div>
      <div className="space-y-2.5 min-h-[168px] min-w-0 flex-1">
        {colTasks.length === 0 && (
          <div className="rounded-lg border border-dashed border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))]/70 px-3 py-5 text-center">
            <p className="text-xs font-medium text-[rgb(var(--rb-text-muted))] tracking-tight">{emptyTitle}</p>
            <p className="text-[10px] text-[rgb(var(--rb-text-muted))] mt-2 leading-relaxed max-w-[200px] mx-auto">
              {emptyColumnMessage}
            </p>
          </div>
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
            const assigneeLabel =
              assigneeOptions && task.assignee_profile_id
                ? assigneeOptions.find((a) => a.value === task.assignee_profile_id)?.label ?? null
                : null;
            const leftBarClass = COLUMN_COLOR_MAP[getStatusKey(task)] ?? "bg-slate-500";
            const currentStatusKey = getStatusKey(task);
            return (
              <TaskCard
                key={task.id}
                task={task}
                activityLabel={activityLabel}
                assigneeLabel={assigneeLabel}
                leftBarClass={leftBarClass}
                columns={columns}
                currentStatusKey={currentStatusKey}
                onStatusChange={onStatusChange}
                assigneeOptions={assigneeOptions}
                onAssigneeChange={onAssigneeChange}
                onOpenDetail={onOpenDetail}
                demoteStatusSelect
              />
            );
          })}
        </SortableContext>
      </div>
    </ColumnDroppable>
  );
});

export default function TasksBoard({
  projectId = null,
  title,
  subtitle,
  showHeader = true,
  externalCreateSignal,
  tasks: controlledTasks,
  columns: controlledColumns,
  getStatusKey: controlledGetStatusKey,
  onCreateTask: controlledOnCreateTask,
  onStatusChange: controlledOnStatusChange,
  showActivityField = false,
  activityOptions = [],
  assigneeOptions = [],
  onAssigneeChange,
  onPriorityChange: controlledOnPriorityChange,
  onDueDateChange: controlledOnDueDateChange,
  onOpenDetail,
  doneStatusKey = "DONE",
  loading: controlledLoading = false,
  error: controlledError,
  openCreateInitially = false,
  filterByUserId = null,
  assigneeFilterId = null,
  searchQuery: filterSearchQuery = "",
  statusFilter: filterStatusId = "",
  priorityFilter: filterPriority = "",
  viewMode = "kanban",
  currentUserId = null,
  assignedToMeCount: propAssignedToMeCount,
  refreshTrigger,
}: TasksBoardProps) {
  const isControlled =
    controlledTasks !== undefined &&
    controlledColumns !== undefined &&
    controlledGetStatusKey !== undefined &&
    controlledOnCreateTask !== undefined &&
    controlledOnStatusChange !== undefined;

  const tBoard = useTranslations("tasks.board");
  const tErrors = useTranslations("tasks.errors");
  const tPriority = useTranslations("tasks.priority");
  const tTaskCard = useTranslations("tasks.taskCard");
  const tDue = useTranslations("tasks.due");
  const tList = useTranslations("tasks.list");

  const activatePhaseOptions = useMemo(
    () => [
      { value: "", label: tBoard("phases.all") },
      { value: "discover", label: tBoard("phases.discover") },
      { value: "prepare", label: tBoard("phases.prepare") },
      { value: "explore", label: tBoard("phases.explore") },
      { value: "realize", label: tBoard("phases.realize") },
      { value: "deploy", label: tBoard("phases.deploy") },
      { value: "run", label: tBoard("phases.run") },
    ],
    [tBoard]
  );

  const duePresentationLabels: TaskDuePresentationLabels = useMemo(
    () => ({
      overdue: tDue("overdue"),
      dueToday: tDue("dueToday"),
      dueTomorrow: tDue("dueTomorrow"),
      inDays: (n: number) => tDue("inDays", { n }),
      limit: tDue("limit"),
    }),
    [tDue]
  );

  const prioritySelectOptions = useMemo(
    () => [
      { value: "high", label: tPriority("high") },
      { value: "medium", label: tPriority("medium") },
      { value: "low", label: tPriority("low") },
    ],
    [tPriority]
  );

  const headerTitle = title ?? tBoard("defaultTitle");

  const boardSubtitle = useMemo(() => {
    if (subtitle != null && subtitle !== "") return subtitle;
    return projectId ? tBoard("subtitleWithProject") : tBoard("subtitleGlobalGeneral");
  }, [subtitle, projectId, tBoard]);

  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newActivityId, setNewActivityId] = useState<string>("");

  // Filtro por fase SAP Activate (solo relevante cuando projectId está definido y no controlled)
  const [phaseFilter, setPhaseFilter] = useState<string>("");

  // Create task modal (replaces inline form)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newDueDate, setNewDueDate] = useState<string | null>(null);
  const [newExternalRef, setNewExternalRef] = useState<string>("");
  const [newAssigneeId, setNewAssigneeId] = useState<string | null>(null);
  const [createAttempted, setCreateAttempted] = useState(false);

  /** Active task id during drag (controlled mode only); used for DragOverlay. */
  const [activeDragTaskId, setActiveDragTaskId] = useState<string | null>(null);

  /** Ref to latest controlled tasks so handleControlledDragEnd can stay stable (no controlledTasks in deps). */
  const controlledTasksRef = useRef<BoardTask[] | undefined>(undefined);
  const hasCompletedInitialLoadRef = useRef(false);
  const newTitleInputRef = useRef<HTMLInputElement>(null);

  // UX: only show skeletons/placeholders on first load when there is no data yet.
  // During background refreshes, keep existing content visible and use subtle indicators.
  const initialLoading = !isControlled && !hasCompletedInitialLoadRef.current && loading;

  useLayoutEffect(() => {
    if (isControlled && controlledTasks !== undefined) {
      controlledTasksRef.current = controlledTasks;
    }
  }, [isControlled, controlledTasks]);

  useEffect(() => {
    if (openCreateInitially) {
      // URL flag ?new=1 after replace — abrir modal una vez al montar / al cambiar el flag
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización deliberada con searchParams
      setShowCreateModal(true);
    }
  }, [openCreateInitially]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowCreateModal(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  // Status TODO por defecto
  const defaultStatusId = useMemo(() => {
    const todo = statuses.find((s) => s.code === "TODO");
    return todo?.id ?? (statuses[0]?.id ?? null);
  }, [statuses]);

  // Carga inicial (solo en modo global, no controlled)
  useEffect(() => {
    if (isControlled) return;
    const loadData = async () => {
      const isBackgroundRefresh = hasCompletedInitialLoadRef.current;
      if (isBackgroundRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [{ data: statusData, error: statusError }, { data: taskData, error: taskError }] =
        await Promise.all([
          supabase
            .from("task_statuses")
            .select("*")
            .eq("is_active", true)
            .order("order_index", { ascending: true }),
          (() => {
            // General board = only tasks with project_id IS NULL. Project board = tasks for that project.
            const isGeneralBoard = projectId === null || projectId === undefined || projectId === "";
            let query = supabase.from("tasks").select("*").order("created_at", {
              ascending: true,
            });

            if (isGeneralBoard) {
              query = query.is("project_id", null);
            } else {
              query = query.eq("project_id", projectId);
            }

            return query;
          })(),
        ]);

      if (statusError) handleSupabaseError("task_statuses", statusError);
      if (taskError) handleSupabaseError("tasks", taskError);

      if (statusError || taskError) {
        setError(tErrors("loadTasks"));
        if (!isBackgroundRefresh) {
          setStatuses([]);
          setTasks([]);
        }
      } else {
        setStatuses(statusData ?? []);
        setTasks((taskData ?? []) as Task[]);
      }

      hasCompletedInitialLoadRef.current = true;
      setLoading(false);
      setIsRefreshing(false);
    };

    loadData();
  }, [projectId, isControlled, refreshTrigger, tErrors]);

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
    let active = 0; // TODO + IN_PROGRESS + REVIEW
    let overdue = 0;
    for (const t of controlledTasks) {
      const key = (controlledGetStatusKey(t) ?? "").toLowerCase().trim();
      if (key === (doneStatusKey ?? "done").toLowerCase()) completed += 1;
      else if (key === "blocked") blocked += 1;
      else if (key === "pending" || key === "in_progress" || key === "review") active += 1;
      if (key !== (doneStatusKey ?? "done").toLowerCase() && t.due_date) {
        const due = new Date(t.due_date);
        due.setHours(0, 0, 0, 0);
        if (due < today) overdue += 1;
      }
    }
    const total = controlledTasks.length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    let riskLevel: "high" | "medium" | "low" = "low";
    if (blocked > 0 || overdue > 0) riskLevel = "high";
    else if (completionRate < 50) riskLevel = "medium";
    return {
      totalActivities: total,
      activeActivities: active,
      blockedActivities: blocked,
      reviewActivities: controlledTasks.filter((t) => (controlledGetStatusKey(t) ?? "").toLowerCase().trim() === "review").length,
      completedActivities: completed,
      overdueActivities: overdue,
      completionRate,
      riskLevel,
    };
  }, [isControlled, controlledTasks, controlledGetStatusKey, doneStatusKey]);

  // Filter tasks: phase (global), filterByUserId, search, status, priority
  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (phaseFilter) list = list.filter((t) => t.activate_phase_key === phaseFilter);
    if (filterByUserId) {
      list = list.filter((t) => t.assignee_id === filterByUserId);
    }
    if (assigneeFilterId) {
      list = list.filter((t) => t.assignee_id === assigneeFilterId);
    }
    const q = (filterSearchQuery ?? "").trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const title = (t.title ?? "").toLowerCase();
        const desc = (t.description ?? "").toLowerCase();
        return title.includes(q) || desc.includes(q);
      });
    }
    if (filterStatusId) list = list.filter((t) => t.status_id === filterStatusId);
    if (filterPriority) list = list.filter((t) => t.priority === filterPriority);
    return list;
  }, [tasks, phaseFilter, filterByUserId, assigneeFilterId, filterSearchQuery, filterStatusId, filterPriority]);

  const orderedStatuses = useMemo(() => {
    const codeToOrder = new Map<string, number>(STANDARD_STATUS_ORDER.map((c, i) => [c, i]));
    return [...statuses]
      .filter((s) => codeToOrder.has((s.code ?? "").toUpperCase()))
      .sort((a, b) => (codeToOrder.get((a.code ?? "").toUpperCase()) ?? 99) - (codeToOrder.get((b.code ?? "").toUpperCase()) ?? 99));
  }, [statuses]);

  const groupedByStatus = useMemo(() => {
    return orderedStatuses.map((status) => ({
      status,
      tasks: filteredTasks.filter((t) => t.status_id === status.id),
    }));
  }, [orderedStatuses, filteredTasks]);

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

    let riskLevel: "high" | "medium" | "low" = "low";
    if (blockedActivities > 0 || overdueActivities > 0) riskLevel = "high";
    else if (completionRate < 50) riskLevel = "medium";

    const assignedToMeCount =
      currentUserId != null && currentUserId !== ""
        ? tasks.filter(
            (t) => t.assignee_id === currentUserId
          ).length
        : undefined;

    return {
      totalActivities,
      activeActivities,
      blockedActivities,
      reviewActivities,
      completedActivities,
      overdueActivities,
      completionRate,
      riskLevel,
      assignedToMeCount,
    };
  }, [filteredTasks, statuses, tasks, currentUserId]);

  /** Submit create task from modal (or programmatically). Resets form state on success. */
  const submitCreateTask = useCallback(
    async (payload: {
      title: string;
      description?: string | null;
      priority: string;
      due_date: string | null;
      activity_id?: string;
      assignee_profile_id?: string | null;
    }) => {
      if (!payload.title.trim()) return;

      if (isControlled && controlledOnCreateTask) {
        if (showActivityField && !(payload as CreateTaskPayload).activity_id?.trim()) {
          setError(tErrors("selectActivity"));
          return;
        }
        setCreating(true);
        setError(null);
        try {
          await controlledOnCreateTask({
            title: payload.title.trim(),
            description: payload.description?.trim() || null,
            priority: payload.priority,
            due_date: payload.due_date ?? null,
            ...(showActivityField && (payload as CreateTaskPayload).activity_id
              ? { activity_id: (payload as CreateTaskPayload).activity_id }
              : {}),
            ...(typeof (payload as CreateTaskPayload).assignee_profile_id !== "undefined"
              ? { assignee_profile_id: (payload as CreateTaskPayload).assignee_profile_id ?? null }
              : {}),
          });
          setNewTitle("");
          setNewDescription("");
          setNewPriority("medium");
          setNewDueDate(null);
          setNewExternalRef("");
          setNewActivityId("");
          setNewAssigneeId(null);
          setShowCreateModal(false);
        } catch (err) {
          console.error("createTask caught", serializeUnknownError(err));
          setError(err instanceof Error ? err.message : tErrors("createFailedGeneric"));
        }
        setCreating(false);
        return;
      }

      if (!defaultStatusId) return;

      setCreating(true);
      setError(null);

      const isGeneralBoard = projectId === undefined || projectId === null || projectId === "";
      const { data: { user } } = await supabase.auth.getUser();
      const insertPayload: Record<string, unknown> = {
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        priority: payload.priority,
        due_date: payload.due_date ?? null,
        external_ref: newExternalRef.trim() || null,
        status_id: defaultStatusId,
        project_id: isGeneralBoard ? null : projectId,
      };
      if (isGeneralBoard && user?.id) insertPayload.created_by = user.id;
      if (payload.assignee_profile_id !== undefined) {
        insertPayload.assignee_id = payload.assignee_profile_id ?? null;
      }

      const { data, error: insertError } = await supabase
        .from("tasks")
        .insert(insertPayload)
        .select("*")
        .single();

      if (insertError) {
        console.error("Error creating task (tasks table)", serializeUnknownError(insertError));
        const meta = {
          message: insertError.message,
          code: (insertError as { code?: string }).code,
          details: (insertError as { details?: string }).details,
          hint: (insertError as { hint?: string }).hint,
        };
        setError(
          `${tErrors("createFailedPrefix")} ${meta.message}${meta.code ? ` (${meta.code})` : ""}`
        );
      } else if (data) {
        setTasks((prev) => [...prev, data as Task]);
        setNewTitle("");
        setNewDescription("");
        setNewPriority("medium");
        setNewDueDate(null);
        setNewExternalRef("");
        setNewAssigneeId(null);
        setShowCreateModal(false);
      }

      setCreating(false);
    },
    [
      isControlled,
      controlledOnCreateTask,
      showActivityField,
      defaultStatusId,
      projectId,
      newExternalRef,
      tErrors,
    ]
  );

  // Cambio de estado desde el select (lo mantenemos como alternativa)
  const handleStatusChange = async (taskId: string, newStatusId: string) => {
    setError(null);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status_id: newStatusId } : t))
    );
    const { error: updateError } = await supabase
      .from("tasks")
      .update({ status_id: newStatusId })
      .eq("id", taskId);
    if (updateError) {
      handleSupabaseError("tasks update status", updateError);
      setError(tErrors("updateStatus"));
    }
  };

  const handlePriorityChange = async (taskId: string, priority: string) => {
    if (isControlled) return;
    setError(null);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, priority: priority as TaskPriority } : t))
    );
    const { error: updateError } = await supabase
      .from("tasks")
      .update({ priority })
      .eq("id", taskId);
    if (updateError) handleSupabaseError("tasks update priority", updateError);
  };

  const handleDueDateChange = async (taskId: string, dueDate: string | null) => {
    if (isControlled) return;
    setError(null);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, due_date: dueDate } : t))
    );
    const { error: updateError } = await supabase
      .from("tasks")
      .update({ due_date: dueDate })
      .eq("id", taskId);
    if (updateError) handleSupabaseError("tasks update due_date", updateError);
  };

  const handleAssigneeChange = async (taskId: string, nextAssigneeId: string | null) => {
    if (isControlled) {
      await onAssigneeChange?.(taskId, nextAssigneeId);
      return;
    }
    setError(null);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, assignee_id: nextAssigneeId } : t))
    );
    const { error: updateError } = await supabase
      .from("tasks")
      .update({ assignee_id: nextAssigneeId })
      .eq("id", taskId);
    if (updateError) handleSupabaseError("tasks update assignee", updateError);
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
      setError(tErrors("updateStatusDrag"));
      // si quisieras, aquí podrías recargar las tareas desde BD
    }
  };

  const effectiveLoading = isControlled ? controlledLoading : loading;
  const effectiveError = isControlled ? controlledError : error;
  const displayMetrics = isControlled ? controlledMetrics : activityMetrics;

  const dndSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor)
  );

  /**
   * Controlled (project) board: compute new status from drop target and call parent once.
   * Parent is responsible for immutable update: setTasks((prev) => prev.map(...)) with
   * a new array and only the moved task object replaced. We read latest tasks from a ref
   * so this handler stays stable and does not depend on controlledTasks.
   */
  const handleControlledDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragTaskId(null);
      if (!over || !controlledOnStatusChange || !controlledColumns || !controlledGetStatusKey) return;

      const taskId = String(active.id);
      const overId = String(over.id);
      const columnIdsSet = new Set(controlledColumns.map((c) => c.id));
      const newStatus: string | null = columnIdsSet.has(overId)
        ? overId
        : (() => {
            const tasks = controlledTasksRef.current;
            if (!tasks) return null;
            const task = tasks.find((t) => t.id === overId);
            return task ? controlledGetStatusKey(task) : null;
          })();

      if (newStatus) {
        controlledOnStatusChange(taskId, newStatus);
      }
    },
    [controlledOnStatusChange, controlledColumns, controlledGetStatusKey]
  );

  const handleControlledDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragTaskId(String(event.active.id));
  }, []);

  const externalCreatePrevRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (externalCreateSignal == null) return;
    // Avoid auto-opening on first mount when the parent passes an initial signal (e.g. 0).
    // Only open when the signal value changes after mount.
    if (externalCreatePrevRef.current === undefined) {
      externalCreatePrevRef.current = externalCreateSignal;
      return;
    }
    if (externalCreatePrevRef.current === externalCreateSignal) return;
    externalCreatePrevRef.current = externalCreateSignal;
    setError(null);
    setCreateAttempted(false);
    setShowCreateModal(true);
  }, [externalCreateSignal]);

  const boardSurfaceClass = showHeader
    ? "flex flex-col gap-5 rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] pt-4 pb-4 pl-4 pr-4 sm:pl-6 sm:pr-6 sm:pt-6 sm:pb-5 shadow-sm"
    : "flex flex-col gap-4 rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] p-4 sm:p-5 shadow-sm ring-1 ring-slate-100";

  const isGlobalListSurface = !showHeader && !isControlled && viewMode === "list";

  return (
    <div className={boardSurfaceClass}>
      {!showHeader && isRefreshing && !isControlled ? (
        <div className="flex items-center justify-end">
          <span className="text-xs font-medium text-[rgb(var(--rb-text-muted))]">
            Actualizando…
          </span>
        </div>
      ) : null}
      {showHeader ? (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-4 border-b border-[rgb(var(--rb-surface-border))]/50">
          <div>
            <h2 className="text-xl font-semibold text-[rgb(var(--rb-text-primary))]">
              {headerTitle}
            </h2>
            <p className="text-sm text-[rgb(var(--rb-text-muted))]">
              {boardSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isRefreshing && !isControlled ? (
              <span className="text-xs font-medium text-[rgb(var(--rb-text-muted))]">
                Actualizando...
              </span>
            ) : null}
            {projectId && !isControlled && (
              <div className="w-full sm:w-44">
                <label className="block text-xs font-medium text-[rgb(var(--rb-text-secondary))] mb-1">
                  {tBoard("phaseLabel")}
                </label>
                <select
                  value={phaseFilter}
                  onChange={(e) => setPhaseFilter(e.target.value)}
                  className="w-full h-10 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/30"
                >
                  {activatePhaseOptions.map((opt) => (
                    <option key={opt.value || "all"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setError(null);
                setCreateAttempted(false);
                setShowCreateModal(true);
              }}
              disabled={!isControlled && !defaultStatusId}
              className="inline-flex items-center gap-2 rounded-xl rb-btn-primary px-4 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-lg leading-none">+</span>
              {tBoard("newTask")}
            </button>
          </div>
        </div>
      ) : null}

      {effectiveError && (
        <div className="rounded-xl border border-red-200/90 bg-red-50 px-3 py-2 text-sm text-red-800">
          {effectiveError}
        </div>
      )}

      {/* Create task modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => !creating && setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5">
              <h3 className="text-lg font-semibold tracking-tight text-[rgb(var(--rb-text-primary))]">
                {tBoard("createModalTitle")}
              </h3>
              <p className="mt-1 text-sm text-[rgb(var(--rb-text-muted))]">
                Create a task and assign ownership from the start.
              </p>
            </div>
            <form
              onSubmit={async (e: FormEvent) => {
                e.preventDefault();
                setCreateAttempted(true);
                if (!newTitle.trim()) {
                  newTitleInputRef.current?.focus();
                  return;
                }
                await submitCreateTask({
                  title: newTitle,
                  description: newDescription || null,
                  priority: newPriority,
                  due_date: newDueDate ?? null,
                  ...(showActivityField ? { activity_id: newActivityId || undefined } : {}),
                  assignee_profile_id: newAssigneeId ?? null,
                });
              }}
              className="space-y-5"
            >
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--rb-text-secondary))] mb-1.5">
                  {tBoard("titleLabel")}
                </label>
                <input
                  ref={newTitleInputRef}
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => {
                    setNewTitle(e.target.value);
                    if (createAttempted && e.target.value.trim()) setError(null);
                  }}
                  placeholder={tBoard("titlePlaceholder")}
                  aria-invalid={createAttempted && !newTitle.trim() ? "true" : "false"}
                  className={`w-full h-10 rounded-xl border bg-[rgb(var(--rb-surface))]/95 px-3 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] focus:outline-none focus:ring-2 ${
                    createAttempted && !newTitle.trim()
                      ? "border-red-300/90 focus:ring-red-500/20 focus:border-red-400"
                      : "border-[rgb(var(--rb-surface-border))]/70 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/30"
                  }`}
                />
                {createAttempted && !newTitle.trim() ? (
                  <p className="mt-1.5 text-xs text-red-700">Title is required.</p>
                ) : null}
              </div>
              {assigneeOptions?.length ? (
                <div>
                  <label className="block text-xs font-medium text-[rgb(var(--rb-text-secondary))] mb-1.5">
                    Responsible / {tBoard("assigneeLabel")}
                  </label>
                  <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                    <AssigneeDropdown
                      options={assigneeOptions}
                      value={newAssigneeId}
                      onChange={(profileId) => setNewAssigneeId(profileId)}
                      placeholder={tTaskCard("unassigned")}
                      variant={newAssigneeId ? "assigned" : "unassigned"}
                      appearance="light"
                    />
                  </div>
                </div>
              ) : null}
              {showActivityField && (
                <div>
                  <label className="block text-xs font-medium text-[rgb(var(--rb-text-secondary))] mb-1.5">
                    {tBoard("activityLabel")}
                  </label>
                  <select
                    value={newActivityId}
                    onChange={(e) => setNewActivityId(e.target.value)}
                    required={showActivityField}
                    className="w-full h-10 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/30"
                  >
                    <option value="">{tBoard("selectActivity")}</option>
                    {activityOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[rgb(var(--rb-text-secondary))] mb-1.5">
                    {tBoard("priorityLabel")}
                  </label>
                  <select
                    className="w-full h-10 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/30"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                  >
                    <option value="high">{tPriority("high")}</option>
                    <option value="medium">{tPriority("medium")}</option>
                    <option value="low">{tPriority("low")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[rgb(var(--rb-text-secondary))] mb-1.5">
                    {tBoard("dueDateLabel")}
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={newDueDate ?? ""}
                      onChange={(e) => setNewDueDate(e.target.value || null)}
                      className="w-full h-10 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/30"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (creating) return;
                    setCreateAttempted(false);
                    setError(null);
                    setShowCreateModal(false);
                  }}
                  className="h-10 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-transparent px-4 text-sm font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-3))]/25 transition-colors"
                >
                  {tBoard("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={
                    creating ||
                    (!isControlled && !defaultStatusId) ||
                    (showActivityField && !newActivityId.trim())
                  }
                  className="h-10 rounded-xl bg-[rgb(var(--rb-brand-primary))] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[rgb(var(--rb-brand-primary-hover))] active:bg-[rgb(var(--rb-brand-primary-active))] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? tBoard("creating") : "Create task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Executive activity KPI row */}
      {!effectiveLoading && displayMetrics && !isGlobalListSurface && (
        <div
          className={
            showHeader
              ? ""
              : "rounded-3xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 p-2 shadow-sm ring-1 ring-[rgb(var(--rb-brand-primary))]/5"
          }
        >
          <TaskSummary
            total={displayMetrics.totalActivities}
            active={displayMetrics.activeActivities}
            blocked={displayMetrics.blockedActivities}
            overdue={displayMetrics.overdueActivities}
            completedPercent={displayMetrics.completionRate}
            riskLevel={displayMetrics.riskLevel}
            review={!isControlled ? displayMetrics.reviewActivities : undefined}
            assignedToMe={
              propAssignedToMeCount !== undefined
                ? propAssignedToMeCount
                : !isControlled && "assignedToMeCount" in displayMetrics
                  ? (displayMetrics as { assignedToMeCount?: number }).assignedToMeCount
                  : undefined
            }
          />
        </div>
      )}

      {/* List view: controlled mode (project tasks) */}
      {isControlled && viewMode === "list" && (
        <div className="relative w-full min-w-0">
          <TaskList
            tasks={controlledTasks ?? []}
            context="project"
            statusOptions={(controlledColumns ?? []).map((c) => ({ value: c.id, label: c.label }))}
            getStatusKey={controlledGetStatusKey!}
            onStatusChange={controlledOnStatusChange!}
            priorityOptions={prioritySelectOptions}
            onPriorityChange={controlledOnPriorityChange}
            assigneeOptions={assigneeOptions}
            onAssigneeChange={onAssigneeChange}
            onDueDateChange={controlledOnDueDateChange}
            onOpenDetail={onOpenDetail}
            getActivityLabel={(id) => activityOptions.find((o) => o.value === id)?.label ?? null}
            loading={effectiveLoading}
          />
        </div>
      )}

      {/* Board: controlled mode (project tasks) - Kanban */}
      {isControlled && viewMode !== "list" && (
        <div className="relative w-full min-w-0 -mx-0.5">
          {effectiveLoading ? (
            <TasksBoardSkeleton columnCount={controlledGrouped?.length ?? 5} />
          ) : (
            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCorners}
              onDragStart={handleControlledDragStart}
              onDragEnd={handleControlledDragEnd}
            >
              <div className="relative w-full min-w-0">
                <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[rgb(var(--rb-surface))] to-transparent lg:hidden" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[rgb(var(--rb-surface))] to-transparent lg:hidden" />
                <div
                  className="overflow-x-auto overflow-y-visible w-full pb-1 touch-pan-x lg:overflow-x-visible [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0"
                >
                  <div className="flex lg:grid lg:grid-cols-5 gap-3.5 sm:gap-4 items-start pb-2 pt-1 min-w-0 w-max lg:w-full min-h-[268px] pr-2 lg:pr-0">
                  {controlledGrouped.map(({ id, label, tasks: colTasks }) => (
                    <ProjectBoardColumn
                      key={id}
                      id={id}
                      label={label}
                      tasks={colTasks}
                      columns={controlledColumns!}
                      getStatusKey={controlledGetStatusKey!}
                      onStatusChange={controlledOnStatusChange!}
                      showActivityField={showActivityField}
                      activityOptions={activityOptions}
                      assigneeOptions={assigneeOptions}
                      onAssigneeChange={onAssigneeChange}
                      onOpenDetail={onOpenDetail}
                    />
                  ))}
                  </div>
                </div>
              </div>
              <DragOverlay>
                {activeDragTaskId && controlledTasks ? (() => {
                  const task = controlledTasks.find((t) => t.id === activeDragTaskId);
                  if (!task) return null;
                  const statusKey = controlledGetStatusKey?.(task) ?? "pending";
                  const leftBarClass = COLUMN_COLOR_MAP[statusKey] ?? "bg-slate-400";
                  const activityLabel =
                    showActivityField && task.activity_id
                      ? activityOptions.find((a) => a.value === task.activity_id)?.label ?? null
                      : null;
                  const assigneeLabel =
                    assigneeOptions?.length && task.assignee_profile_id
                      ? assigneeOptions.find((a) => a.value === task.assignee_profile_id)?.label ?? null
                      : null;
                  const dueOverlay = getTaskDuePresentation(task.due_date, duePresentationLabels);
                  const statusHuman =
                    controlledColumns?.find((c) => c.id === statusKey)?.label ?? statusKey;
                  return (
                    <div
                      className="relative rounded-xl bg-[rgb(var(--rb-surface))] border border-[rgb(var(--rb-surface-border))]/70 shadow-lg flex flex-col min-w-0 cursor-grabbing ring-1 ring-[rgb(var(--rb-brand-primary))]/12 select-none touch-none"
                      style={{ minWidth: 276 }}
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[10px] ${leftBarClass}`} />
                      <div className="pl-3.5 pr-3 pt-3 pb-2.5 space-y-1.5">
                        <p className="text-[15px] font-semibold leading-snug text-[rgb(var(--rb-text-primary))] pr-1">
                          {task.title}
                        </p>
                        {activityLabel && (
                          <p className="text-[10px] text-[rgb(var(--rb-text-muted))] leading-tight">
                            <span className="text-[rgb(var(--rb-text-muted))]">{tTaskCard("activity")}</span>{" "}
                            <span className="text-[rgb(var(--rb-text-secondary))]">{activityLabel}</span>
                          </p>
                        )}
                        {(assigneeOptions?.length || assigneeLabel) && (
                          <p className="text-[10px] text-[rgb(var(--rb-text-muted))]">
                            {tTaskCard("assigneeAbbr")}{" "}
                            <span
                              className={
                                assigneeLabel
                                  ? "text-[rgb(var(--rb-text-secondary))]"
                                  : "text-[rgb(var(--rb-text-muted))]"
                              }
                            >
                              {assigneeLabel ?? tTaskCard("unassigned")}
                            </span>
                          </p>
                        )}
                        {dueOverlay && (
                          <p className={`text-[11px] tabular-nums flex flex-wrap gap-x-1.5 ${dueOverlay.className}`}>
                            <span className="font-medium">{dueOverlay.line}</span>
                            {dueOverlay.sub ? (
                              <span className="font-normal opacity-90">{dueOverlay.sub}</span>
                            ) : null}
                          </p>
                        )}
                        {task.description && (
                          <p className="text-[10px] text-[rgb(var(--rb-text-secondary))] line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}
                        <p className="text-[9px] text-[rgb(var(--rb-text-muted))] pt-1">{statusHuman}</p>
                      </div>
                    </div>
                  );
                })() : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      )}

      {/* List view (global mode) */}
      {!isControlled && viewMode === "list" && (
        <div className="relative w-full min-w-0">
          {isGlobalListSurface ? (
            <div className="rounded-3xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] overflow-hidden shadow-sm ring-1 ring-[rgb(var(--rb-brand-primary))]/5">
              <div className="bg-[rgb(var(--rb-surface-2))]/55 p-3 sm:p-4">
                {displayMetrics && (
                  <TaskSummary
                    variant="embedded"
                    total={displayMetrics.totalActivities}
                    active={displayMetrics.activeActivities}
                    blocked={displayMetrics.blockedActivities}
                    overdue={displayMetrics.overdueActivities}
                    completedPercent={displayMetrics.completionRate}
                    riskLevel={displayMetrics.riskLevel}
                    review={!isControlled ? displayMetrics.reviewActivities : undefined}
                    assignedToMe={
                      propAssignedToMeCount !== undefined
                        ? propAssignedToMeCount
                        : !isControlled && "assignedToMeCount" in displayMetrics
                          ? (displayMetrics as { assignedToMeCount?: number }).assignedToMeCount
                          : undefined
                    }
                  />
                )}
              </div>
              <div className="h-px bg-[rgb(var(--rb-surface-border))]/60" />
              <div className="bg-[rgb(var(--rb-surface))] py-1">
                <TaskList
                  variant="embedded"
                  tasks={filteredTasks.map((t) => ({
                    id: t.id,
                    title: t.title,
                    status_id: t.status_id,
                    priority: t.priority,
                    due_date: t.due_date,
                    description: t.description,
                    created_at: t.created_at,
                    updated_at: t.updated_at,
                    assignee_profile_id: (t as Task).assignee_id ?? null,
                  }))}
                  context="global"
                  statusOptions={statuses.map((s) => ({ value: s.id, label: s.name }))}
                  getStatusKey={(t) => t.status_id ?? ""}
                  onStatusChange={handleStatusChange}
                  priorityOptions={prioritySelectOptions}
                  onPriorityChange={handlePriorityChange}
                  assigneeOptions={assigneeOptions?.length ? assigneeOptions : undefined}
                  onAssigneeChange={assigneeOptions?.length ? handleAssigneeChange : undefined}
                  onDueDateChange={handleDueDateChange}
                  onOpenDetail={onOpenDetail ?? undefined}
                  scopeLabel={filterByUserId ? tList("scopeMy") : tList("scopeGlobal")}
                  getProjectName={() => null}
                  loading={initialLoading}
                />
              </div>
            </div>
          ) : (
            <TaskList
              tasks={filteredTasks.map((t) => ({
                id: t.id,
                title: t.title,
                status_id: t.status_id,
                priority: t.priority,
                due_date: t.due_date,
                description: t.description,
                created_at: t.created_at,
                updated_at: t.updated_at,
                assignee_profile_id: (t as Task).assignee_id ?? null,
              }))}
              context="global"
              statusOptions={statuses.map((s) => ({ value: s.id, label: s.name }))}
              getStatusKey={(t) => t.status_id ?? ""}
              onStatusChange={handleStatusChange}
              priorityOptions={prioritySelectOptions}
              onPriorityChange={handlePriorityChange}
              assigneeOptions={assigneeOptions?.length ? assigneeOptions : undefined}
              onAssigneeChange={assigneeOptions?.length ? handleAssigneeChange : undefined}
              onDueDateChange={handleDueDateChange}
              onOpenDetail={onOpenDetail ?? undefined}
              scopeLabel={filterByUserId ? tList("scopeMy") : tList("scopeGlobal")}
              getProjectName={() => null}
              loading={initialLoading}
            />
          )}
        </div>
      )}

      {/* Board con drag & drop (global mode) — scroll container with end padding */}
      {!isControlled && viewMode !== "list" && (
      <div className="relative w-full min-w-0">
        {initialLoading ? (
          <TasksBoardSkeleton />
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[rgb(var(--rb-surface))] to-transparent lg:hidden" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[rgb(var(--rb-surface))] to-transparent lg:hidden" />
              <div className="overflow-x-auto overflow-y-visible w-full -mx-2 px-2 pb-1 touch-pan-x lg:overflow-x-visible [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4 pb-2 pr-3 lg:pr-0 min-w-0 w-max lg:w-full">
              {groupedByStatus.map(({ status, tasks }) => (
                <Droppable droppableId={status.id} key={status.id}>
                  {(provided, snapshot) => {
                    const code = status.code ?? "TODO";
                    const accentBorder = COLUMN_BORDER_MAP[code] ?? "before:bg-slate-300/70";
                    const dotClass = COLUMN_COLOR_MAP[code] ?? "bg-slate-400";
                    return (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`relative flex flex-col rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] p-3.5 sm:p-4 min-h-[228px] transition-[background-color,border-color,box-shadow] duration-150 shadow-sm before:absolute before:left-0 before:right-0 before:top-0 before:h-[3px] before:rounded-t-xl ${accentBorder} ${
                        snapshot.isDraggingOver
                          ? "ring-2 ring-[rgb(var(--rb-brand-ring))]/25 bg-[rgb(var(--rb-surface))]/80"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotClass}`}
                          />
                          <span className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--rb-text-secondary))]">
                            {status.name}
                          </span>
                        </div>
                        <span className="rounded-full border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/40 px-2 py-0.5 text-xs font-medium text-[rgb(var(--rb-text-muted))]">
                          {tasks.length}
                        </span>
                      </div>

                      <div className="space-y-2 min-h-[200px]">
                        {tasks.length === 0 && (
                          <div className="rounded-lg border border-dashed border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-6 text-center">
                            <div className="mx-auto mb-2 h-7 w-7 rounded-full border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] grid place-items-center text-[rgb(var(--rb-text-muted))]">
                              <span className="text-sm leading-none">—</span>
                            </div>
                            <p className="text-xs font-medium text-[rgb(var(--rb-text-muted))]">No tasks</p>
                            <p className="text-[10px] text-[rgb(var(--rb-text-muted))] mt-1 leading-relaxed">
                              Drag a task here, or create a new one.
                            </p>
                          </div>
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
                                className={`relative rounded-lg bg-[rgb(var(--rb-surface))] border border-[rgb(var(--rb-surface-border))]/65 p-3 hover:bg-[rgb(var(--rb-surface))]/80 transition-[background-color,border-color,box-shadow,transform] duration-150 flex flex-col gap-2.5 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-[1px] ${
                                  dragSnapshot.isDragging
                                    ? "ring-2 ring-[rgb(var(--rb-brand-ring))]/35 shadow-md z-10"
                                    : ""
                                }`}
                              >
                                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${leftBarClass}`} />
                                <div className="pl-4">
                                <div className="px-0 py-0">
                                  <p className="text-sm font-semibold tracking-tight text-[rgb(var(--rb-text-primary))] leading-snug">
                                    {task.title}
                                  </p>

                                  {(task.due_date || task.external_ref) && (
                                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[rgb(var(--rb-text-muted))]">
                                      {task.due_date ? (
                                        <span className="inline-flex items-center rounded-full border border-[rgb(var(--rb-surface-border))]/45 bg-[rgb(var(--rb-surface-3))]/12 px-2 py-0.5 text-[11px] tabular-nums">
                                          {tBoard("dueInline")} {new Date(task.due_date).toLocaleDateString()}
                                        </span>
                                      ) : null}
                                      {task.external_ref ? (
                                        <span className="inline-flex items-center rounded-full border border-[rgb(var(--rb-surface-border))]/40 bg-[rgb(var(--rb-surface-3))]/10 px-2 py-0.5 text-[11px] truncate">
                                          {tBoard("refPrefix")} <span className="ml-1 font-mono">{task.external_ref}</span>
                                        </span>
                                      ) : null}
                                    </div>
                                  )}

                                  {assigneeOptions?.length ? (
                                    <div className="mt-1.5">
                                      <p className="text-[10px] uppercase tracking-wide text-[rgb(var(--rb-text-muted))] mb-1">{tBoard("assigneeColumn")}</p>
                                      <AssigneeDropdown
                                        options={assigneeOptions}
                                        value={task.assignee_id ?? null}
                                        onChange={(profileId) => handleAssigneeChange(task.id, profileId)}
                                        placeholder={tTaskCard("unassigned")}
                                        variant={task.assignee_id ? "assigned" : "unassigned"}
                                        appearance="light"
                                        className="h-8 rounded-full px-2.5 py-1 text-xs border-[rgb(var(--rb-surface-border))]/45 bg-[rgb(var(--rb-surface-3))]/10 hover:bg-[rgb(var(--rb-surface-3))]/20"
                                      />
                                    </div>
                                  ) : null}

                                  {task.description && (
                                    <p className="text-xs text-[rgb(var(--rb-text-secondary))] line-clamp-2 mt-1 leading-relaxed">
                                      {task.description}
                                    </p>
                                  )}
                                </div>

                                <div className="px-0 pt-2.5 mt-2 border-t border-[rgb(var(--rb-surface-border))]/45 flex items-center justify-between gap-2">
                                  <select
                                    value={task.status_id}
                                    onChange={(e) =>
                                      handleStatusChange(
                                        task.id,
                                        e.target.value
                                      )
                                    }
                                    className="h-8 flex-1 min-w-0 cursor-pointer rounded-full border border-[rgb(var(--rb-surface-border))]/45 bg-[rgb(var(--rb-surface-3))]/10 px-2.5 text-[11px] text-[rgb(var(--rb-text-primary))] hover:border-[rgb(var(--rb-surface-border))]/75 hover:bg-[rgb(var(--rb-surface-3))]/20 focus:outline-none focus:ring-1 focus:ring-[rgb(var(--rb-brand-ring))]/35"
                                  >
                                    {statuses.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.name}
                                      </option>
                                    ))}
                                  </select>

                                  <span className="text-[11px] text-[rgb(var(--rb-text-muted))] tabular-nums shrink-0">
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
              </div>
            </div>
          </DragDropContext>
        )}
      </div>
      )}
    </div>
  );
}