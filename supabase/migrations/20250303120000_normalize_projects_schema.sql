-- Normalize projects table: controlled values for status and environment_type.
-- Fixes: projects_status_check violation and ensures environment_type consistency.

-- 1) Set default for status (so new rows get 'planned' if not provided)
ALTER TABLE public.projects
  ALTER COLUMN status SET DEFAULT 'planned';

-- 2) Backfill invalid or null status to allowed value
UPDATE public.projects
SET status = 'planned'
WHERE status IS NULL
   OR status NOT IN ('planned', 'in_progress', 'completed', 'archived');

-- 3) Enforce status check constraint (drop if exists to avoid conflict, then add)
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('planned', 'in_progress', 'completed', 'archived'));

-- 4) Backfill invalid or null environment_type to allowed value
UPDATE public.projects
SET environment_type = 'cloud_public'
WHERE environment_type IS NULL
   OR environment_type NOT IN ('cloud_public', 'on_premise');

-- 5) Enforce environment_type check constraint (drop if exists, then add)
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_environment_type_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_environment_type_check
  CHECK (environment_type IN ('cloud_public', 'on_premise'));

-- 6) Optional: set default for environment_type so new rows get a valid value
ALTER TABLE public.projects
  ALTER COLUMN environment_type SET DEFAULT 'cloud_public';

COMMENT ON CONSTRAINT projects_status_check ON public.projects IS
  'Allowed: planned, in_progress, completed, archived';
COMMENT ON CONSTRAINT projects_environment_type_check ON public.projects IS
  'Allowed: cloud_public, on_premise';
