-- When a project is created, automatically insert the creator as 'owner' in project_members.
-- Robust creator detection: created_by / user_id / owner_id from NEW; fallback auth.uid().
-- Idempotent: unique constraint + CREATE OR REPLACE + DROP TRIGGER IF EXISTS.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_members_project_id_user_id_key'
      AND conrelid = 'public.project_members'::regclass
  ) THEN
    ALTER TABLE public.project_members
      ADD CONSTRAINT project_members_project_id_user_id_key UNIQUE (project_id, user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.projects_add_owner_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  creator uuid;
  new_json jsonb;
BEGIN
  new_json := to_jsonb(NEW);

  creator := NULLIF(trim(coalesce(new_json->>'created_by', '')), '')::uuid;
  IF creator IS NULL THEN
    creator := NULLIF(trim(coalesce(new_json->>'user_id', '')), '')::uuid;
  END IF;
  IF creator IS NULL THEN
    creator := NULLIF(trim(coalesce(new_json->>'owner_id', '')), '')::uuid;
  END IF;
  IF creator IS NULL THEN
    creator := auth.uid();
  END IF;

  IF creator IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.project_members (project_id, user_id, role, updated_at)
  VALUES (NEW.id, creator, 'owner', now())
  ON CONFLICT (project_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_add_owner_member ON public.projects;
CREATE TRIGGER projects_add_owner_member
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.projects_add_owner_member();
