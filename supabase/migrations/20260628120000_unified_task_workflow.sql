-- Unified task workflow: standard statuses + parent_task_id for subtasks support.
-- 1) Ensure task_statuses exists and has the 5 standard statuses (TODO, IN_PROGRESS, BLOCKED, REVIEW, DONE).
-- 2) Add parent_task_id to project_tasks for future subtasks (no UI in this migration).

-- task_statuses: create if not exists (some setups may have it from seed)
CREATE TABLE IF NOT EXISTS public.task_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text,
  color text,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique index on code for upsert (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_statuses_code ON public.task_statuses (code);

-- Seed the 5 standard statuses; update name/order if row exists
INSERT INTO public.task_statuses (code, name, order_index, is_active)
VALUES
  ('TODO', 'Por hacer', 0, true),
  ('IN_PROGRESS', 'En progreso', 1, true),
  ('BLOCKED', 'Bloqueado', 2, true),
  ('REVIEW', 'En revisión', 3, true),
  ('DONE', 'Hecho', 4, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  order_index = EXCLUDED.order_index,
  is_active = EXCLUDED.is_active;

-- project_tasks: add parent_task_id for subtasks (optional, no UI in this pass)
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.project_tasks (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_tasks_parent_task_id
  ON public.project_tasks (parent_task_id)
  WHERE parent_task_id IS NOT NULL;

COMMENT ON COLUMN public.project_tasks.parent_task_id IS 'Optional parent task for subtasks. NULL = top-level task.';
