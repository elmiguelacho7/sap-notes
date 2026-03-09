-- RLS write policies for public.projects so client-side create and edit flows keep working.
-- Does not remove or relax the existing SELECT alignment from 20260402140000_align_platform_metrics_rls.sql.
-- No data changes. Non-destructive.

-- ---------------------------------------------------------------------------
-- projects INSERT: authenticated user can create a project for themselves
-- (created_by = auth.uid()) or without creator set (created_by IS NULL);
-- trigger projects_add_owner_member then adds the user as owner when created_by is null.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS projects_insert_authenticated_creator ON public.projects;
CREATE POLICY projects_insert_authenticated_creator
  ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    OR created_by IS NULL
  );

COMMENT ON POLICY projects_insert_authenticated_creator ON public.projects IS
  'Project creation: creator must be self or unset (trigger adds owner).';

-- ---------------------------------------------------------------------------
-- projects UPDATE: project owner (created_by), project member with owner/editor role,
-- or superadmin. Viewers cannot update.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS projects_update_owner_editor_superadmin ON public.projects;
CREATE POLICY projects_update_owner_editor_superadmin
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'editor')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );

COMMENT ON POLICY projects_update_owner_editor_superadmin ON public.projects IS
  'Project edit: owner, editor, or superadmin. Used by planning page and any client-side project update.';
