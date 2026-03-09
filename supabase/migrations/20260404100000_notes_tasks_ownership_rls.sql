-- Notes and tasks ownership: ensure newly registered users only see their own personal data.
-- - Notes with project_id IS NULL = personal; must be restricted to created_by = auth.uid() (or superadmin).
-- - Tasks with project_id IS NULL = personal/general board; must be restricted to created_by = auth.uid() (or project member for project_id set).
-- - project_tasks already has RLS by project membership; this migration only touches public.notes and public.tasks.

-- ---------------------------------------------------------------------------
-- 1) notes: add created_by for ownership of personal notes (project_id IS NULL)
-- ---------------------------------------------------------------------------
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS created_by uuid;

COMMENT ON COLUMN public.notes.created_by IS
  'Owner of the note (auth user id). Used for personal notes (project_id IS NULL); project notes inherit visibility from project.';

-- Backfill: leave NULL for existing rows; RLS will treat NULL created_by + project_id IS NULL as superadmin-only
-- (no arbitrary user assigned). New inserts must set created_by = auth.uid() for project_id IS NULL.

-- Replace notes SELECT policy: project notes by project visibility; personal notes (project_id IS NULL) by created_by = auth.uid() or superadmin
DROP POLICY IF EXISTS notes_select_project_visibility_superadmin ON public.notes;
CREATE POLICY notes_select_project_visibility_superadmin
  ON public.notes
  FOR SELECT
  TO authenticated
  USING (
    (project_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = notes.project_id
          AND (p.created_by = auth.uid()
               OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
               OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.app_role = 'superadmin'))
      )
    ))
    OR (project_id IS NULL AND (
      notes.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin')
    ))
  );

COMMENT ON POLICY notes_select_project_visibility_superadmin ON public.notes IS
  'Notes: project notes by project visibility; personal notes (project_id IS NULL) only by owner (created_by) or superadmin.';

-- Replace notes INSERT policy: allow insert for project notes (project visible) or personal notes (set created_by = auth.uid())
DROP POLICY IF EXISTS notes_insert_project_visibility_superadmin ON public.notes;
CREATE POLICY notes_insert_project_visibility_superadmin
  ON public.notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (project_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = notes.project_id
          AND (p.created_by = auth.uid()
               OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
               OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.app_role = 'superadmin'))
      )
    ))
    OR (project_id IS NULL AND notes.created_by = auth.uid())
  );

-- Add UPDATE/DELETE for notes so owner/project/superadmin can modify
DROP POLICY IF EXISTS notes_update_owner_project_superadmin ON public.notes;
CREATE POLICY notes_update_owner_project_superadmin
  ON public.notes FOR UPDATE TO authenticated
  USING (
    (project_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.projects p WHERE p.id = notes.project_id AND (p.created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())))
      OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.app_role = 'superadmin')
    ))
    OR (project_id IS NULL AND (notes.created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin')))
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS notes_delete_owner_project_superadmin ON public.notes;
CREATE POLICY notes_delete_owner_project_superadmin
  ON public.notes FOR DELETE TO authenticated
  USING (
    (project_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.projects p WHERE p.id = notes.project_id AND (p.created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())))
      OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.app_role = 'superadmin')
    ))
    OR (project_id IS NULL AND (notes.created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin')))
  );

-- ---------------------------------------------------------------------------
-- 2) tasks: add created_by if missing; enable RLS; restrict general board to owner
-- ---------------------------------------------------------------------------
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS created_by uuid;

COMMENT ON COLUMN public.tasks.created_by IS
  'Owner for general/personal tasks (project_id IS NULL). For project tasks, visibility is by project membership.';

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (from other migrations)
DROP POLICY IF EXISTS tasks_select_policy ON public.tasks;
DROP POLICY IF EXISTS tasks_insert_policy ON public.tasks;
DROP POLICY IF EXISTS tasks_update_policy ON public.tasks;
DROP POLICY IF EXISTS tasks_delete_policy ON public.tasks;
DROP POLICY IF EXISTS tasks_select_member_or_owner ON public.tasks;
DROP POLICY IF EXISTS tasks_insert_member_or_owner ON public.tasks;
DROP POLICY IF EXISTS tasks_update_member_or_owner ON public.tasks;
DROP POLICY IF EXISTS tasks_delete_member_or_owner ON public.tasks;

-- SELECT: project_id NOT NULL → project member; project_id IS NULL → created_by = auth.uid() or superadmin
CREATE POLICY tasks_select_member_or_owner
  ON public.tasks FOR SELECT TO authenticated
  USING (
    auth.role() = 'service_role'
    OR (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid()
    ))
    OR (project_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = tasks.project_id AND p.created_by = auth.uid()))
    OR (project_id IS NULL AND (tasks.created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin')))
  );

-- INSERT: project_id NOT NULL → project member; project_id IS NULL → must set created_by = auth.uid()
CREATE POLICY tasks_insert_member_or_owner
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    auth.role() = 'service_role'
    OR (project_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = tasks.project_id AND p.created_by = auth.uid())
    ))
    OR (project_id IS NULL AND tasks.created_by = auth.uid())
  );

-- UPDATE/DELETE: same visibility as SELECT
CREATE POLICY tasks_update_member_or_owner
  ON public.tasks FOR UPDATE TO authenticated
  USING (
    auth.role() = 'service_role'
    OR (project_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = tasks.project_id AND p.created_by = auth.uid())
    ))
    OR (project_id IS NULL AND (tasks.created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin')))
  )
  WITH CHECK (true);

CREATE POLICY tasks_delete_member_or_owner
  ON public.tasks FOR DELETE TO authenticated
  USING (
    auth.role() = 'service_role'
    OR (project_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = tasks.project_id AND p.created_by = auth.uid())
    ))
    OR (project_id IS NULL AND (tasks.created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin')))
  );

COMMENT ON POLICY tasks_select_member_or_owner ON public.tasks IS
  'Tasks: project tasks by project membership; general tasks (project_id IS NULL) only by owner (created_by) or superadmin.';
