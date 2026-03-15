/** Unified workflow: TODO → pending, IN_PROGRESS → in_progress, BLOCKED → blocked, REVIEW → review, DONE → done */
export type ProjectTaskStatus = "pending" | "in_progress" | "blocked" | "review" | "done";
export type ProjectTaskPriority = "low" | "medium" | "high";

export type ProjectTask = {
  id: string;
  project_id: string;
  activity_id: string | null;
  title: string;
  description: string | null;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  assignee_profile_id: string | null;
  start_date: string | null;
  due_date: string | null;
  progress_pct: number;
  created_at: string;
  updated_at: string;
  /** Optional parent task for subtasks (no UI yet). */
  parent_task_id?: string | null;
};
