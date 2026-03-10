-- =============================================================================
-- Run in Supabase Dashboard → SQL Editor for direct verification.
-- These queries read auth.users and public.profiles directly (no pagination).
-- =============================================================================

-- TASK 1: administrator@funonso.com
SELECT
  u.id AS auth_id,
  u.email AS auth_email,
  p.id AS profile_id,
  p.email AS profile_email,
  p.full_name,
  p.app_role,
  p.is_active
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE lower(u.email) = lower('administrator@funonso.com');

-- TASK 2: JWT sub (normalized to 36-char UUID; raw had trailing '2')
SELECT
  u.id AS auth_id,
  u.email AS auth_email,
  p.id AS profile_id,
  p.email AS profile_email,
  p.full_name,
  p.app_role,
  p.is_active
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.id = '1acc2b99-6fe0-49f5-b28d-15f33d85abcb';

-- TASK 4: Safe fix — insert missing profiles ONLY for the two known emails
-- Run only after confirming these auth users exist and have no profile.
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
  AND lower(au.email) IN (
    'miguelacho2005@gmail.com',
    'miguelacho@gmail.com'
  )
ON CONFLICT (id) DO NOTHING
RETURNING id, email, full_name, app_role, is_active;

-- TASK 5 (Case B): If JWT user exists in auth but has no profile, create one (default consultant).
-- Run only after confirming auth.users has this id and profiles does not.
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
WHERE au.id = '1acc2b99-6fe0-49f5-b28d-15f33d85abcb'
  AND p.id IS NULL
ON CONFLICT (id) DO NOTHING
RETURNING id, email, full_name, app_role, is_active;
