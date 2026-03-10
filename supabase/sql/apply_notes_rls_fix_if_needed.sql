-- =============================================================================
-- Apply ONLY if the audit classified state as A (RLS disabled) or B (wrong policies).
-- Removes legacy permissive "own" policies and ensures only intended policies remain.
-- Idempotent: safe to run multiple times.
-- Run in Supabase Dashboard → SQL Editor.
-- =============================================================================

-- Ensure RLS is enabled (fixes A)
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Remove legacy permissive "own" policies (fixes B when both old and new exist)
DROP POLICY IF EXISTS notes_select_own ON public.notes;
DROP POLICY IF EXISTS notes_insert_own ON public.notes;
DROP POLICY IF EXISTS notes_update_own ON public.notes;
DROP POLICY IF EXISTS notes_delete_own ON public.notes;

-- ---------------------------------------------------------------------------
-- SELECT: project notes by project visibility; global notes ONLY superadmin
-- ---------------------------------------------------------------------------
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
    OR (project_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin'))
  );

COMMENT ON POLICY notes_select_project_visibility_superadmin ON public.notes IS
  'Notes: project notes by project visibility; global notes (project_id IS NULL) only superadmin. Consultants must not see global notes.';

-- ---------------------------------------------------------------------------
-- INSERT: project notes when project visible; global notes ONLY superadmin
-- ---------------------------------------------------------------------------
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
    OR (project_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin'))
  );

-- ---------------------------------------------------------------------------
-- UPDATE/DELETE: global superadmin-only; project member/owner/superadmin
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS notes_update_owner_project_superadmin ON public.notes;
CREATE POLICY notes_update_owner_project_superadmin
  ON public.notes FOR UPDATE TO authenticated
  USING (
    (project_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.projects p WHERE p.id = notes.project_id AND (p.created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())))
      OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.app_role = 'superadmin')
    ))
    OR (project_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin'))
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
    OR (project_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin'))
  );
