/**
 * Unified task workflow for the platform.
 * Used by both global tasks (task_statuses) and project tasks (project_tasks.status).
 */

export const STANDARD_STATUS_ORDER = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "REVIEW",
  "DONE",
] as const;

/** Status codes for global board (task_statuses.code) */
export type GlobalStatusCode = (typeof STANDARD_STATUS_ORDER)[number];

/** Status keys for project board (project_tasks.status) */
export const PROJECT_STATUS_KEYS = [
  "pending",
  "in_progress",
  "blocked",
  "review",
  "done",
] as const;

export type ProjectStatusKey = (typeof PROJECT_STATUS_KEYS)[number];

/** Map global status code → project status key */
export const GLOBAL_TO_PROJECT_STATUS: Record<GlobalStatusCode, ProjectStatusKey> = {
  TODO: "pending",
  IN_PROGRESS: "in_progress",
  BLOCKED: "blocked",
  REVIEW: "review",
  DONE: "done",
};

/** Spanish labels for display (project board and any unified UI) */
export const STATUS_LABELS_ES: Record<ProjectStatusKey, string> = {
  pending: "Por hacer",
  in_progress: "En progreso",
  blocked: "Bloqueado",
  review: "En revisión",
  done: "Hecho",
};

/** Spanish labels for global board (task_statuses.name can be stored in DB; this is fallback) */
export const GLOBAL_STATUS_LABELS_ES: Record<GlobalStatusCode, string> = {
  TODO: "Por hacer",
  IN_PROGRESS: "En progreso",
  BLOCKED: "Bloqueado",
  REVIEW: "En revisión",
  DONE: "Hecho",
};

/** Active = TODO + IN_PROGRESS + REVIEW (not BLOCKED, not DONE) */
export function isActiveStatusCode(code: string): boolean {
  const u = code.toUpperCase();
  return u === "TODO" || u === "IN_PROGRESS" || u === "REVIEW";
}

export function isActiveProjectStatus(status: string): boolean {
  const s = (status ?? "").toLowerCase().trim();
  return s === "pending" || s === "in_progress" || s === "review";
}

export function isBlockedStatusCode(code: string): boolean {
  return code.toUpperCase() === "BLOCKED";
}

export function isBlockedProjectStatus(status: string): boolean {
  return (status ?? "").toLowerCase().trim() === "blocked";
}

export function isDoneStatusCode(code: string): boolean {
  return code.toUpperCase() === "DONE";
}

export function isDoneProjectStatus(status: string): boolean {
  return (status ?? "").toLowerCase().trim() === "done";
}

/** Priority for task cards */
export type TaskPriorityKey = "high" | "medium" | "low";

export const PRIORITY_LABELS: Record<TaskPriorityKey, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};
