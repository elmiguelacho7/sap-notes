-- Add profile_id to project_members and backfill from profiles.id.
-- Keeps user_id; profile_id is the new domain-level link for RLS and app logic.

-- 1) Add profile_id column if it does not exist
ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS profile_id uuid;

-- 2) Backfill profile_id using profiles.id = project_members.user_id
UPDATE public.project_members pm
SET profile_id = p.id
FROM public.profiles p
WHERE p.id = pm.user_id
  AND pm.profile_id IS NULL;

-- 3) Add foreign key constraint to profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_members_profile_id_fkey'
      AND conrelid = 'public.project_members'::regclass
  ) THEN
    ALTER TABLE public.project_members
      ADD CONSTRAINT project_members_profile_id_fkey
      FOREIGN KEY (profile_id)
      REFERENCES public.profiles (id)
      ON DELETE CASCADE;
  END IF;
END
$$;

COMMENT ON COLUMN public.project_members.profile_id IS
  'FK to profiles.id; backfilled from profiles.id matching project_members.user_id.';

-- 4) (Optional, only if all rows are backfilled) you could enforce NOT NULL later:
-- ALTER TABLE public.project_members
-- ALTER COLUMN profile_id SET NOT NULL;
