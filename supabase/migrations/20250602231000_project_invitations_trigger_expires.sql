-- Trigger: only auto-accept pending invitations that are not expired; set accepted_by and updated_at.
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
      AND expires_at > now()
  LOOP
    INSERT INTO public.project_members (project_id, user_id, role, updated_at)
    VALUES (inv.project_id, NEW.id, inv.role, now())
    ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = EXCLUDED.updated_at;

    UPDATE public.project_invitations
    SET status = 'accepted', accepted_at = now(), accepted_by = NEW.id, updated_at = now()
    WHERE id = inv.id;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.accept_project_invitations_for_new_profile() IS
  'On new profile insert: find pending non-expired project_invitations by email, add user to project_members, mark accepted.';
