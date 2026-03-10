-- =============================================================================
-- User identity audit: auth.users vs public.profiles
-- Run this in Supabase SQL Editor (Dashboard) to inspect linkage and mismatches.
-- =============================================================================

-- 1) Auth users without a profile row
SELECT
  au.id AS auth_id,
  au.email AS auth_email,
  au.raw_user_meta_data->>'full_name' AS auth_full_name,
  'MISSING_PROFILE' AS issue
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ORDER BY au.email;

-- 2) Profiles without a matching auth.users row (orphan profiles)
SELECT
  p.id AS profile_id,
  p.email AS profile_email,
  p.full_name AS profile_full_name,
  p.app_role,
  p.is_active,
  'ORPHAN_PROFILE' AS issue
FROM public.profiles p
LEFT JOIN auth.users au ON au.id = p.id
WHERE au.id IS NULL
ORDER BY p.email;

-- 3) Email mismatches (auth.email vs profiles.email, case-insensitive compare)
SELECT
  au.id,
  au.email AS auth_email,
  p.email AS profile_email,
  p.full_name,
  p.app_role,
  'EMAIL_MISMATCH' AS issue
FROM auth.users au
JOIN public.profiles p ON p.id = au.id
WHERE trim(lower(au.email)) IS DISTINCT FROM trim(lower(p.email))
ORDER BY au.email;

-- 4) Specific accounts: administrator@funonso.com, mguerra.marin7@gmail.com, isasis1207@gmail.com
SELECT
  au.id,
  au.email AS auth_email,
  au.raw_user_meta_data->>'full_name' AS auth_full_name,
  p.id AS profile_id,
  p.email AS profile_email,
  p.full_name AS profile_full_name,
  p.app_role,
  p.is_active,
  CASE
    WHEN p.id IS NULL THEN 'auth_only_no_profile'
    WHEN trim(lower(au.email)) IS DISTINCT FROM trim(lower(p.email)) THEN 'email_mismatch'
    ELSE 'ok'
  END AS status
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE lower(au.email) IN (
  'administrator@funonso.com',
  'mguerra.marin7@gmail.com',
  'isasis1207@gmail.com'
)
ORDER BY au.email;

-- 5) Full list: auth users with profile join (for report)
SELECT
  au.id,
  au.email AS auth_email,
  au.raw_user_meta_data->>'full_name' AS auth_full_name,
  p.id AS profile_id,
  p.email AS profile_email,
  p.full_name AS profile_full_name,
  p.app_role,
  p.is_active,
  CASE WHEN p.id IS NULL THEN 'NO_PROFILE' ELSE 'LINKED' END AS link_status
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
ORDER BY au.email;

-- 6) Full list: profiles with auth join (for report)
SELECT
  p.id,
  p.email,
  p.full_name,
  p.app_role,
  p.is_active,
  au.id AS auth_id,
  au.email AS auth_email,
  CASE WHEN au.id IS NULL THEN 'NO_AUTH_USER' ELSE 'LINKED' END AS link_status
FROM public.profiles p
LEFT JOIN auth.users au ON au.id = p.id
ORDER BY p.email;
