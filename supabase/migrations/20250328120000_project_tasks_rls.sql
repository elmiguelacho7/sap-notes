-- RLS for public.project_tasks: allow authenticated users to CRUD only for projects they are members of.
-- Membership: project_members has user_id (auth.uid()) and profile_id (backfilled so profile_id = profiles.id = user_id in this schema).
-- No current_profile_id() in this codebase. We allow either pm.user_id = auth.uid() or pm.profile_id = auth.uid()
-- so both legacy and profile-based membership rows work.

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- Remove existing policies (exact names from 20250301140000_project_tasks.sql)
DROP POLICY IF EXISTS "Allow select project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow insert project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow update project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow delete project tasks for members" ON public.project_tasks;

-- Membership: user is member if project_members has a row for this project with
-- pm.user_id = auth.uid() OR pm.profile_id = auth.uid() (in this schema profiles.id = auth user id)
CREATE OR REPLACE FUNCTION public.project_tasks_is_project_member(project_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = project_uuid
      AND (pm.user_id = auth.uid() OR pm.profile_id = auth.uid())
  );
$$;

COMMENT ON FUNCTION public.project_tasks_is_project_member(uuid) IS
  'True if the current auth user is a member of the given project (project_members.user_id or project_members.profile_id = auth.uid()).';

-- 1) SELECT
CREATE POLICY "Allow select project tasks for members"
ON public.project_tasks
FOR SELECT
USING (
  auth.role() = 'service_role'
  OR public.project_tasks_is_project_member(project_id)
);

-- 2) INSERT
CREATE POLICY "Allow insert project tasks for members"
ON public.project_tasks
FOR INSERT
WITH CHECK (
  auth.role() = 'service_role'
  OR public.project_tasks_is_project_member(project_id)
);

-- 3) UPDATE
CREATE POLICY "Allow update project tasks for members"
ON public.project_tasks
FOR UPDATE
USING (
  auth.role() = 'service_role'
  OR public.project_tasks_is_project_member(project_id)
)
WITH CHECK (
  auth.role() = 'service_role'
  OR public.project_tasks_is_project_member(project_id)
);

-- 4) DELETE
CREATE POLICY "Allow delete project tasks for members"
ON public.project_tasks
FOR DELETE
USING (
  auth.role() = 'service_role'
  OR public.project_tasks_is_project_member(project_id)
);
