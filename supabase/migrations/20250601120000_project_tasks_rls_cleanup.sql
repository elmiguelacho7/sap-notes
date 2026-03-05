-- Cleanly replace ALL project_tasks RLS policies with a single consistent set.
-- No helper function; membership = project_members.user_id = auth.uid().
-- Drops helper, all known policies (both naming styles), optional backfill of user_id, then creates 4 policies.

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- Drop the helper function (we don't need SECURITY DEFINER here)
DROP FUNCTION IF EXISTS public.project_tasks_is_project_member(uuid);

-- Drop ALL known policies (both naming styles)
DROP POLICY IF EXISTS "Allow select project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow insert project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow update project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow delete project tasks for members" ON public.project_tasks;

DROP POLICY IF EXISTS "project_tasks_select_for_members" ON public.project_tasks;
DROP POLICY IF EXISTS "project_tasks_insert_for_members" ON public.project_tasks;
DROP POLICY IF EXISTS "project_tasks_update_for_members" ON public.project_tasks;
DROP POLICY IF EXISTS "project_tasks_delete_for_members" ON public.project_tasks;

-- Optional: backfill project_members.user_id if null, using email match (robust)
-- This assumes profiles.email matches auth.users.email.
UPDATE public.project_members pm
SET user_id = au.id
FROM public.profiles p
JOIN auth.users au ON au.email = p.email
WHERE pm.user_id IS NULL
  AND pm.profile_id = p.id;

-- Create ONE clean set of policies based on pm.user_id = auth.uid()

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
