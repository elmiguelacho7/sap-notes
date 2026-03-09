-- Public self-signup must NEVER create an active platform user.
-- Only admin-created users may be active immediately.
-- This migration runs after 20260403100000_profiles_is_active.sql and ensures that when
-- the auth trigger runs (on any INSERT into auth.users), the profile is always set to
-- is_active = false. On conflict (e.g. re-registration after partial cleanup or id reuse),
-- we UPDATE the existing row to is_active = false so no public signup path can leave a profile active.
-- Admin-created users are then upserted with is_active = true via adminService.createAdminUser().

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, app_role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    'consultant',
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    app_role = EXCLUDED.app_role,
    is_active = false;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_auth_user() IS
  'On new auth user: ensure a profiles row exists. Public signup and any re-registration always get is_active = false. Admin-created users are then upserted with is_active = true by the app.';
