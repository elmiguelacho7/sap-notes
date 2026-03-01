-- Extend projects: planning dates and optional Activate fields
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS planned_end_date date,
  ADD COLUMN IF NOT EXISTS current_phase_key text REFERENCES public.activate_phases(phase_key) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS activate_template_type text;

COMMENT ON COLUMN public.projects.start_date IS 'Project start date for SAP Activate planning.';
COMMENT ON COLUMN public.projects.planned_end_date IS 'Planned project end date for phase scheduling.';
COMMENT ON COLUMN public.projects.current_phase_key IS 'Current SAP Activate phase (optional).';
COMMENT ON COLUMN public.projects.activate_template_type IS 'Template type e.g. Greenfield, Rollout (optional).';

-- Extend tasks (activities): link to Activate phase and planned dates
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS activate_phase_key text REFERENCES public.activate_phases(phase_key) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS planned_start_date date,
  ADD COLUMN IF NOT EXISTS planned_end_date date,
  ADD COLUMN IF NOT EXISTS is_template_generated boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tasks.activate_phase_key IS 'SAP Activate phase this task belongs to.';
COMMENT ON COLUMN public.tasks.planned_start_date IS 'Planned start date from project plan.';
COMMENT ON COLUMN public.tasks.planned_end_date IS 'Planned end date from project plan.';
COMMENT ON COLUMN public.tasks.is_template_generated IS 'True if created from activity_templates on project creation.';

CREATE INDEX IF NOT EXISTS idx_tasks_activate_phase
  ON public.tasks (activate_phase_key)
  WHERE activate_phase_key IS NOT NULL;