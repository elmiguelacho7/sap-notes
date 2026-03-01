-- Link tasks to project phases (optional): each task can belong to one project_phases row.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS phase_id uuid;

-- Add FK only if it does not already exist (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_phase_id_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_phase_id_fkey
      FOREIGN KEY (phase_id)
      REFERENCES public.project_phases (id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.tasks.phase_id IS 'Optional link to project_phases; task belongs to this phase.';
