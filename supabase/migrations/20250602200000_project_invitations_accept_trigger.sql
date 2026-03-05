-- Auto-accept pending project invitations when a new profile is created (e.g. after signup).
-- Uses NEW.email to find pending invitations and inserts into project_members, then marks invitation accepted.

CREATE OR REPLACE FUNCTION public.accept_project_invitations_for_new_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv record;
BEGIN
  IF NEW.email IS NULL OR trim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  FOR inv IN
    SELECT id, project_id, role
    FROM public.project_invitations
    WHERE lower(trim(email)) = lower(trim(NEW.email))
      AND status = 'pending'
  LOOP
    INSERT INTO public.project_members (project_id, user_id, role, updated_at)
    VALUES (inv.project_id, NEW.id, inv.role, now())
    ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = EXCLUDED.updated_at;

    UPDATE public.project_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = inv.id;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accept_project_invitations_on_profile_insert ON public.profiles;
CREATE TRIGGER accept_project_invitations_on_profile_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.accept_project_invitations_for_new_profile();

COMMENT ON FUNCTION public.accept_project_invitations_for_new_profile() IS
  'On new profile insert: find pending project_invitations by email and add user to project_members, then mark invitations accepted.';
