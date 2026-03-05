-- Backfill profiles.email from auth.users; ensure profile exists on signup (only if missing).
-- Does not replace existing RLS.

-- 1) Add email column to profiles if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- 2) Backfill profiles.email from auth.users where id matches and profile.email is null
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE au.id = p.id AND (p.email IS NULL OR trim(p.email) = '');

-- 3) Trigger: on auth.users insert, create profile row if it does not exist
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, app_role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    'consultant'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

COMMENT ON FUNCTION public.handle_new_auth_user() IS
  'On new auth user: ensure a profiles row exists and email/full_name are set.';
