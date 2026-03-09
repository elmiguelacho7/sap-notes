-- Platform-level user activation. Separate from app_role and project membership.
-- New signups (trigger) get is_active = false; admin-created users get is_active = true via upsert.

-- 1) Add column: default true so existing users keep access
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.is_active IS
  'Platform activation: false = pending admin approval, cannot access private app. Separate from app_role and project membership.';

-- 2) New signups via auth trigger must default to inactive
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
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_auth_user() IS
  'On new auth user: ensure a profiles row exists. New signups get is_active = false for admin activation.';
