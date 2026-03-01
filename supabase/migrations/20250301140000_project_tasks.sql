-- Project tasks: tasks belonging to a project, optionally linked to an activity (project_activities).

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.project_activities (id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'medium',
  assignee_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  start_date date,
  due_date date,
  progress_pct smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON public.project_tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_activity_id ON public.project_tasks (activity_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_due_date ON public.project_tasks (due_date);

COMMENT ON TABLE public.project_tasks IS
  'Tasks at project level; optionally linked to a project_activity.';

DROP TRIGGER IF EXISTS set_project_tasks_updated_at ON public.project_tasks;
CREATE TRIGGER set_project_tasks_updated_at
  BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow insert project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow update project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow delete project tasks for members" ON public.project_tasks;

CREATE POLICY "Allow select project tasks for members"
  ON public.project_tasks FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_tasks.project_id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow insert project tasks for members"
  ON public.project_tasks FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_tasks.project_id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow update project tasks for members"
  ON public.project_tasks FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_tasks.project_id AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_tasks.project_id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow delete project tasks for members"
  ON public.project_tasks FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_tasks.project_id AND pm.user_id = auth.uid()
    )
  );
