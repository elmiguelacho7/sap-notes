-- Testing/UAT: test cycles, cycle–script membership, cycle-scoped executions,
-- execution evidence, expanded script authoring status, optional step outcomes.

-- ---------------------------------------------------------------------------
-- test_cycles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.test_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'in_progress', 'blocked', 'completed', 'archived')),
  owner_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  planned_start_date date,
  planned_end_date date,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  goal text,
  scope_summary text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_test_cycles_project_id ON public.test_cycles (project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_test_cycles_project_status ON public.test_cycles (project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_test_cycles_project_updated ON public.test_cycles (project_id, updated_at DESC) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.test_cycles IS
  'Project-scoped UAT / SIT test waves; scripts are linked via test_cycle_scripts.';

DROP TRIGGER IF EXISTS set_test_cycles_updated_at ON public.test_cycles;
CREATE TRIGGER set_test_cycles_updated_at
  BEFORE UPDATE ON public.test_cycles
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- test_cycle_scripts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.test_cycle_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_cycle_id uuid NOT NULL REFERENCES public.test_cycles (id) ON DELETE CASCADE,
  test_script_id uuid NOT NULL REFERENCES public.test_scripts (id) ON DELETE CASCADE,
  assignee_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  priority text,
  status_override text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT test_cycle_scripts_cycle_script_unique UNIQUE (test_cycle_id, test_script_id)
);

CREATE INDEX IF NOT EXISTS idx_test_cycle_scripts_cycle_id ON public.test_cycle_scripts (test_cycle_id);
CREATE INDEX IF NOT EXISTS idx_test_cycle_scripts_script_id ON public.test_cycle_scripts (test_script_id);

COMMENT ON TABLE public.test_cycle_scripts IS
  'Membership of a test script in a cycle; optional assignee and notes per cycle.';

-- ---------------------------------------------------------------------------
-- test_executions: cycle + step outcomes
-- ---------------------------------------------------------------------------
ALTER TABLE public.test_executions
  ADD COLUMN IF NOT EXISTS test_cycle_id uuid REFERENCES public.test_cycles (id) ON DELETE SET NULL;

ALTER TABLE public.test_executions
  ADD COLUMN IF NOT EXISTS step_outcomes jsonb;

CREATE INDEX IF NOT EXISTS idx_test_executions_cycle_id ON public.test_executions (test_cycle_id, executed_at DESC)
  WHERE test_cycle_id IS NOT NULL;

COMMENT ON COLUMN public.test_executions.test_cycle_id IS
  'When set, this run was recorded in the context of a test cycle.';
COMMENT ON COLUMN public.test_executions.step_outcomes IS
  'Optional lightweight per-step results: [{ "step_id": uuid, "result": "passed"|"failed"|"blocked"|"skipped", "note": string? }]';

-- ---------------------------------------------------------------------------
-- test_execution_evidence
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.test_execution_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES public.test_executions (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  type text NOT NULL
    CHECK (type IN ('screenshot', 'attachment', 'sap_document', 'note', 'link')),
  title text,
  description text,
  file_path text,
  file_name text,
  mime_type text,
  sap_reference text,
  external_url text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_test_execution_evidence_execution ON public.test_execution_evidence (execution_id);
CREATE INDEX IF NOT EXISTS idx_test_execution_evidence_project ON public.test_execution_evidence (project_id);

COMMENT ON TABLE public.test_execution_evidence IS
  'Lightweight proof and context attached to a manual test execution.';

-- ---------------------------------------------------------------------------
-- Expand test_scripts.status (authoring lifecycle)
-- ---------------------------------------------------------------------------
UPDATE public.test_scripts SET status = 'ready_for_test' WHERE status = 'ready';

ALTER TABLE public.test_scripts DROP CONSTRAINT IF EXISTS test_scripts_status_check;

ALTER TABLE public.test_scripts
  ADD CONSTRAINT test_scripts_status_check CHECK (
    status IN (
      'draft',
      'ready_for_test',
      'in_review',
      'approved',
      'obsolete',
      'archived'
    )
  );

COMMENT ON COLUMN public.test_scripts.status IS
  'Authoring / preparation state (not execution outcome). Legacy "ready" migrated to ready_for_test.';

-- ---------------------------------------------------------------------------
-- RLS: test_cycles
-- ---------------------------------------------------------------------------
ALTER TABLE public.test_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "test_cycles_select_members" ON public.test_cycles;
CREATE POLICY "test_cycles_select_members"
  ON public.test_cycles FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR (
      deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = test_cycles.project_id AND pm.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "test_cycles_insert_editors" ON public.test_cycles;
CREATE POLICY "test_cycles_insert_editors"
  ON public.test_cycles FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = test_cycles.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'editor')
    )
  );

DROP POLICY IF EXISTS "test_cycles_update_editors" ON public.test_cycles;
CREATE POLICY "test_cycles_update_editors"
  ON public.test_cycles FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = test_cycles.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'editor')
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = test_cycles.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'editor')
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: test_cycle_scripts
-- ---------------------------------------------------------------------------
ALTER TABLE public.test_cycle_scripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "test_cycle_scripts_select_members" ON public.test_cycle_scripts;
CREATE POLICY "test_cycle_scripts_select_members"
  ON public.test_cycle_scripts FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.test_cycles c
      WHERE c.id = test_cycle_scripts.test_cycle_id
        AND c.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = c.project_id AND pm.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "test_cycle_scripts_insert_editors" ON public.test_cycle_scripts;
CREATE POLICY "test_cycle_scripts_insert_editors"
  ON public.test_cycle_scripts FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.test_cycles c
      WHERE c.id = test_cycle_scripts.test_cycle_id
        AND c.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = c.project_id
            AND pm.user_id = auth.uid()
            AND pm.role IN ('owner', 'editor')
        )
    )
  );

DROP POLICY IF EXISTS "test_cycle_scripts_update_editors" ON public.test_cycle_scripts;
CREATE POLICY "test_cycle_scripts_update_editors"
  ON public.test_cycle_scripts FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.test_cycles c
      WHERE c.id = test_cycle_scripts.test_cycle_id
        AND c.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = c.project_id
            AND pm.user_id = auth.uid()
            AND pm.role IN ('owner', 'editor')
        )
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.test_cycles c
      WHERE c.id = test_cycle_scripts.test_cycle_id
        AND c.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = c.project_id
            AND pm.user_id = auth.uid()
            AND pm.role IN ('owner', 'editor')
        )
    )
  );

DROP POLICY IF EXISTS "test_cycle_scripts_delete_editors" ON public.test_cycle_scripts;
CREATE POLICY "test_cycle_scripts_delete_editors"
  ON public.test_cycle_scripts FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.test_cycles c
      WHERE c.id = test_cycle_scripts.test_cycle_id
        AND c.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = c.project_id
            AND pm.user_id = auth.uid()
            AND pm.role IN ('owner', 'editor')
        )
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: test_execution_evidence
-- ---------------------------------------------------------------------------
ALTER TABLE public.test_execution_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "test_execution_evidence_select_members" ON public.test_execution_evidence;
CREATE POLICY "test_execution_evidence_select_members"
  ON public.test_execution_evidence FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = test_execution_evidence.project_id AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "test_execution_evidence_insert_members" ON public.test_execution_evidence;
CREATE POLICY "test_execution_evidence_insert_members"
  ON public.test_execution_evidence FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = test_execution_evidence.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'editor')
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: testing-evidence bucket (private; uploads via API / service role)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('testing-evidence', 'testing-evidence', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'testing_evidence_objects_insert_authenticated'
  ) THEN
    CREATE POLICY testing_evidence_objects_insert_authenticated
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'testing-evidence'
        AND auth.uid() IS NOT NULL
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'testing_evidence_objects_select_authenticated'
  ) THEN
    CREATE POLICY testing_evidence_objects_select_authenticated
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (bucket_id = 'testing-evidence');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
