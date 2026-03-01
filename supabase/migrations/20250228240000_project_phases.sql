-- Per-project SAP Activate phases (names, order, dates).
-- Each project gets its own copy of default phases; they can be edited per project.

CREATE TABLE IF NOT EXISTS public.project_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_key text NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_phases_project_order
  ON public.project_phases (project_id, sort_order);

COMMENT ON TABLE public.project_phases IS
  'SAP Activate phases per project; editable names, order, and dates.';

-- Optional: trigger to refresh updated_at (reuse if set_updated_at exists, else create)
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
END
$$;

-- Ensure trigger exists but do not fail if it already existed before
DROP TRIGGER IF EXISTS project_phases_updated_at ON public.project_phases;

CREATE TRIGGER project_phases_updated_at
  BEFORE UPDATE ON public.project_phases
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

-- RLS: allow authenticated users to manage phases (app will restrict by project access)
ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;

-- Make policies idempotent: drop if they already exist, then recreate
DROP POLICY IF EXISTS project_phases_select ON public.project_phases;
DROP POLICY IF EXISTS project_phases_insert ON public.project_phases;
DROP POLICY IF EXISTS project_phases_update ON public.project_phases;
DROP POLICY IF EXISTS project_phases_delete ON public.project_phases;

CREATE POLICY project_phases_select
  ON public.project_phases
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY project_phases_insert
  ON public.project_phases
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY project_phases_update
  ON public.project_phases
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY project_phases_delete
  ON public.project_phases
  FOR DELETE
  TO authenticated
  USING (true);
