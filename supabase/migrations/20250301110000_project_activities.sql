-- Project activities: structured activities per SAP Activate phase (phase, owner, status, priority, dates).

CREATE TABLE IF NOT EXISTS public.project_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  phase_id uuid NOT NULL REFERENCES public.project_phases (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  owner_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planned',
  priority text NOT NULL DEFAULT 'medium',
  start_date date,
  due_date date,
  progress_pct smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_activities_project_phase
  ON public.project_activities (project_id, phase_id);

COMMENT ON TABLE public.project_activities IS
  'Structured project activities per SAP Activate phase (planner workspace).';

-- Trigger to keep updated_at in sync (reuse set_updated_at from project_phases migration)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS set_project_activities_updated_at ON public.project_activities;

CREATE TRIGGER set_project_activities_updated_at
  BEFORE UPDATE ON public.project_activities
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

-- RLS: allow service_role and project members (project_members.user_id = auth.uid())
ALTER TABLE public.project_activities ENABLE ROW LEVEL SECURITY;

-- Make policies idempotent: drop if they already exist
DROP POLICY IF EXISTS "Allow select project activities for members" ON public.project_activities;
DROP POLICY IF EXISTS "Allow insert project activities for members" ON public.project_activities;
DROP POLICY IF EXISTS "Allow update project activities for members" ON public.project_activities;
DROP POLICY IF EXISTS "Allow delete project activities for members" ON public.project_activities;

CREATE POLICY "Allow select project activities for members"
  ON public.project_activities
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = project_activities.project_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow insert project activities for members"
  ON public.project_activities
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = project_activities.project_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow update project activities for members"
  ON public.project_activities
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = project_activities.project_id
        AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = project_activities.project_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow delete project activities for members"
  ON public.project_activities
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = project_activities.project_id
        AND pm.user_id = auth.uid()
    )
  );
