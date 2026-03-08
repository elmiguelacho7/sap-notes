-- Phase 1 hardening: project_phases RLS (DATABASE_ARCHITECTURE_AUDIT.md)
-- Replace permissive authenticated USING (true) with project-membership based access.
-- Access: service_role OR user is a member of the project (project_members.user_id = auth.uid()).

ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_phases_select ON public.project_phases;
DROP POLICY IF EXISTS project_phases_insert ON public.project_phases;
DROP POLICY IF EXISTS project_phases_update ON public.project_phases;
DROP POLICY IF EXISTS project_phases_delete ON public.project_phases;

CREATE POLICY project_phases_select
  ON public.project_phases
  FOR SELECT
  TO authenticated
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_phases.project_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY project_phases_insert
  ON public.project_phases
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_phases.project_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY project_phases_update
  ON public.project_phases
  FOR UPDATE
  TO authenticated
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_phases.project_id
        AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_phases.project_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY project_phases_delete
  ON public.project_phases
  FOR DELETE
  TO authenticated
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_phases.project_id
        AND pm.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.project_phases IS
  'SAP Activate phases per project; editable names, order, and dates. RLS: project members only (service_role or project_members.user_id = auth.uid()).';
