-- Phase 9: UAT / test scripts — project-scoped structured scripts, steps, and manual executions.
-- Additive only. RLS aligned with project membership (same pattern as project_tasks).

CREATE TABLE IF NOT EXISTS public.test_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  title text NOT NULL,
  objective text,
  module text,
  test_type text NOT NULL DEFAULT 'uat'
    CHECK (test_type IN ('uat', 'sit', 'regression')),
  priority text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'archived')),
  preconditions text,
  test_data text,
  expected_result text,
  related_task_id uuid REFERENCES public.project_tasks (id) ON DELETE SET NULL,
  related_ticket_id uuid REFERENCES public.tickets (id) ON DELETE SET NULL,
  related_knowledge_page_id uuid REFERENCES public.knowledge_pages (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL
);
-- Cross-table integrity (task/ticket same project as script) enforced in API/service; PG CHECK cannot use subqueries.

CREATE INDEX IF NOT EXISTS idx_test_scripts_project_id ON public.test_scripts (project_id);
CREATE INDEX IF NOT EXISTS idx_test_scripts_project_status ON public.test_scripts (project_id, status);
CREATE INDEX IF NOT EXISTS idx_test_scripts_project_updated ON public.test_scripts (project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_scripts_created_by ON public.test_scripts (created_by);

COMMENT ON TABLE public.test_scripts IS
  'Structured UAT/SIT/regression test scripts per project; traceability hooks for tasks, tickets, knowledge.';

CREATE TABLE IF NOT EXISTS public.test_script_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_script_id uuid NOT NULL REFERENCES public.test_scripts (id) ON DELETE CASCADE,
  step_order int NOT NULL,
  instruction text NOT NULL,
  expected_result text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT test_script_steps_order_positive_chk CHECK (step_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_test_script_steps_script_id ON public.test_script_steps (test_script_id);
CREATE INDEX IF NOT EXISTS idx_test_script_steps_script_order ON public.test_script_steps (test_script_id, step_order);

COMMENT ON TABLE public.test_script_steps IS
  'Ordered steps for a test script.';

DROP TRIGGER IF EXISTS set_test_script_steps_updated_at ON public.test_script_steps;
CREATE TRIGGER set_test_script_steps_updated_at
  BEFORE UPDATE ON public.test_script_steps
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.test_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_script_id uuid NOT NULL REFERENCES public.test_scripts (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  executed_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  executed_at timestamptz NOT NULL DEFAULT now(),
  result text NOT NULL
    CHECK (result IN ('passed', 'failed', 'blocked', 'not_run')),
  actual_result text,
  evidence_notes text,
  defect_ticket_id uuid REFERENCES public.tickets (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- project_id must match parent test_scripts.project_id; enforced in service on insert/update.

CREATE INDEX IF NOT EXISTS idx_test_executions_script_id ON public.test_executions (test_script_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_executions_project_id ON public.test_executions (project_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_executions_result ON public.test_executions (project_id, result);

COMMENT ON TABLE public.test_executions IS
  'Manual test run records; supports defect ticket linkage for ALM-style workflows.';

DROP TRIGGER IF EXISTS set_test_scripts_updated_at ON public.test_scripts;
CREATE TRIGGER set_test_scripts_updated_at
  BEFORE UPDATE ON public.test_scripts
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.test_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_script_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "test_scripts_select_members" ON public.test_scripts;
CREATE POLICY "test_scripts_select_members"
  ON public.test_scripts FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = test_scripts.project_id AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "test_scripts_insert_members" ON public.test_scripts;
CREATE POLICY "test_scripts_insert_members"
  ON public.test_scripts FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = test_scripts.project_id AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "test_scripts_update_members" ON public.test_scripts;
CREATE POLICY "test_scripts_update_members"
  ON public.test_scripts FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = test_scripts.project_id AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = test_scripts.project_id AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "test_scripts_delete_members" ON public.test_scripts;
CREATE POLICY "test_scripts_delete_members"
  ON public.test_scripts FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = test_scripts.project_id AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "test_script_steps_select_members" ON public.test_script_steps;
CREATE POLICY "test_script_steps_select_members"
  ON public.test_script_steps FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.test_scripts ts
      JOIN public.project_members pm ON pm.project_id = ts.project_id
      WHERE ts.id = test_script_steps.test_script_id AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "test_script_steps_insert_members" ON public.test_script_steps;
CREATE POLICY "test_script_steps_insert_members"
  ON public.test_script_steps FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.test_scripts ts
      JOIN public.project_members pm ON pm.project_id = ts.project_id
      WHERE ts.id = test_script_steps.test_script_id AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "test_script_steps_update_members" ON public.test_script_steps;
CREATE POLICY "test_script_steps_update_members"
  ON public.test_script_steps FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.test_scripts ts
      JOIN public.project_members pm ON pm.project_id = ts.project_id
      WHERE ts.id = test_script_steps.test_script_id AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.test_scripts ts
      JOIN public.project_members pm ON pm.project_id = ts.project_id
      WHERE ts.id = test_script_steps.test_script_id AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "test_script_steps_delete_members" ON public.test_script_steps;
CREATE POLICY "test_script_steps_delete_members"
  ON public.test_script_steps FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.test_scripts ts
      JOIN public.project_members pm ON pm.project_id = ts.project_id
      WHERE ts.id = test_script_steps.test_script_id AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "test_executions_select_members" ON public.test_executions;
CREATE POLICY "test_executions_select_members"
  ON public.test_executions FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = test_executions.project_id AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "test_executions_insert_members" ON public.test_executions;
CREATE POLICY "test_executions_insert_members"
  ON public.test_executions FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = test_executions.project_id AND pm.user_id = auth.uid()
    )
  );

-- Executions are append-only for v1 (audit trail); service_role bypasses RLS for admin tools.
