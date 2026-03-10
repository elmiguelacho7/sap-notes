-- Notes visibility: global notes (project_id IS NULL) must be visible only to superadmin.
-- Consultants must NOT see global notes. Project notes remain visible to project members or superadmin.
-- This migration replaces the notes SELECT/INSERT (and optionally UPDATE/DELETE for global) so that:
--   (A) Global notes: only superadmin can read (and insert).
--   (B) Project notes: project member or superadmin (unchanged).
--   (C) deleted_at: app continues to filter; RLS does not need to enforce (no policy change for that).
-- Idempotent: DROP POLICY IF EXISTS then CREATE POLICY.

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
-- UPDATE/DELETE: align global to superadmin-only; project unchanged
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
