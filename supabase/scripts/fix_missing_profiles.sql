-- =============================================================================
-- Fix: Create missing profile rows for auth.users that have no profile.
-- Run after the audit script. Only run if audit shows "auth users without profile".
-- profiles.id = auth.users.id; email/full_name from auth; app_role default 'consultant'; is_active default false.
-- =============================================================================

INSERT INTO public.profiles (id, email, full_name, app_role, is_active)
SELECT
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    au.raw_user_meta_data->>'name',
    split_part(au.email, '@', 1)
  ),
  'consultant',
  false
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
