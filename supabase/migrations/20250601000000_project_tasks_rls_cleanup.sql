-- Replace ALL project_tasks RLS policies with a single consistent set.
-- Membership: public.project_members.user_id = auth.uid() only (no profile_id, no helper).
-- Drops both "Allow ..." and "project_tasks_*" policies to remove duplicates.

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies (exact names from pg_policies)
DROP POLICY IF EXISTS "Allow delete project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow insert project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow select project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow update project tasks for members" ON public.project_tasks;

DROP POLICY IF EXISTS "project_tasks_insert_for_members" ON public.project_tasks;
DROP POLICY IF EXISTS "project_tasks_select_for_members" ON public.project_tasks;
DROP POLICY IF EXISTS "project_tasks_update_for_members" ON public.project_tasks;
DROP POLICY IF EXISTS "project_tasks_delete_for_members" ON public.project_tasks;

-- SELECT
CREATE POLICY "project_tasks_select_for_members"
ON public.project_tasks
FOR SELECT
USING (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = project_tasks.project_id
      AND pm.user_id = auth.uid()
  )
);

-- INSERT
CREATE POLICY "project_tasks_insert_for_members"
ON public.project_tasks
FOR INSERT
WITH CHECK (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = project_tasks.project_id
      AND pm.user_id = auth.uid()
  )
);

-- UPDATE
CREATE POLICY "project_tasks_update_for_members"
ON public.project_tasks
FOR UPDATE
USING (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = project_tasks.project_id
      AND pm.user_id = auth.uid()
  )
)
WITH CHECK (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = project_tasks.project_id
      AND pm.user_id = auth.uid()
  )
);

-- DELETE
CREATE POLICY "project_tasks_delete_for_members"
ON public.project_tasks
FOR DELETE
USING (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = project_tasks.project_id
      AND pm.user_id = auth.uid()
  )
);
