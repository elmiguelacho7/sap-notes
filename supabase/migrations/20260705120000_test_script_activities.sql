-- Test script activities: ALM-style hierarchy (scenario → activity → actions/steps).

CREATE TABLE IF NOT EXISTS public.test_script_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_script_id uuid NOT NULL REFERENCES public.test_scripts (id) ON DELETE CASCADE,
  scenario_name text,
  activity_title text NOT NULL DEFAULT '',
  activity_target_name text,
  activity_target_url text,
  business_role text,
  activity_order int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_test_script_activities_script
  ON public.test_script_activities (test_script_id, activity_order);

ALTER TABLE public.test_script_steps
  ADD COLUMN IF NOT EXISTS activity_id uuid REFERENCES public.test_script_activities (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_test_script_steps_activity_id ON public.test_script_steps (activity_id);

ALTER TABLE public.test_scripts
  ADD COLUMN IF NOT EXISTS business_conditions text;

COMMENT ON TABLE public.test_script_activities IS
  'Grouped procedure units (SAP Cloud ALM activity / DOCX section); steps optionally link via activity_id.';
COMMENT ON COLUMN public.test_script_steps.activity_id IS 'Optional FK; NULL = legacy flat script or ungrouped step.';
COMMENT ON COLUMN public.test_scripts.business_conditions IS 'Imported or manual business conditions summary.';

DROP TRIGGER IF EXISTS set_test_script_activities_updated_at ON public.test_script_activities;
CREATE TRIGGER set_test_script_activities_updated_at
  BEFORE UPDATE ON public.test_script_activities
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.test_script_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "test_script_activities_select_members" ON public.test_script_activities;
CREATE POLICY "test_script_activities_select_members"
  ON public.test_script_activities FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.test_scripts ts
      JOIN public.project_members pm ON pm.project_id = ts.project_id
      WHERE ts.id = test_script_activities.test_script_id AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "test_script_activities_insert_members" ON public.test_script_activities;
CREATE POLICY "test_script_activities_insert_members"
  ON public.test_script_activities FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.test_scripts ts
      JOIN public.project_members pm ON pm.project_id = ts.project_id
      WHERE ts.id = test_script_activities.test_script_id AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "test_script_activities_update_members" ON public.test_script_activities;
CREATE POLICY "test_script_activities_update_members"
  ON public.test_script_activities FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.test_scripts ts
      JOIN public.project_members pm ON pm.project_id = ts.project_id
      WHERE ts.id = test_script_activities.test_script_id AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.test_scripts ts
      JOIN public.project_members pm ON pm.project_id = ts.project_id
      WHERE ts.id = test_script_activities.test_script_id AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "test_script_activities_delete_members" ON public.test_script_activities;
CREATE POLICY "test_script_activities_delete_members"
  ON public.test_script_activities FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.test_scripts ts
      JOIN public.project_members pm ON pm.project_id = ts.project_id
      WHERE ts.id = test_script_activities.test_script_id AND pm.user_id = auth.uid()
    )
  );
