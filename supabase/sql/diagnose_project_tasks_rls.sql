-- =============================================================================
-- project_tasks RLS diagnostic script
-- Run this in Supabase Dashboard → SQL Editor (as the user or with service_role).
-- Replace <PROJECT_UUID> with the project id you are testing (e.g. from the URL).
-- =============================================================================

-- 1) Who am I (auth uid) – run with "Run as user" or note this is for the anon/authenticated role
SELECT auth.uid() AS my_auth_uid;

-- 2) Find my profile (this schema: profiles.id = auth.uid())
SELECT id AS profile_id, full_name, email, app_role
FROM public.profiles
WHERE id = auth.uid()
LIMIT 1;

-- 3) Check membership for a specific project
-- Replace the uuid below with your project id (from URL or from query 5), then run.
SELECT pm.id, pm.project_id, pm.user_id, pm.profile_id, pm.role,
       auth.uid() AS my_auth_uid,
       (pm.user_id = auth.uid() OR pm.profile_id = auth.uid()) AS membership_check_passes
FROM public.project_members pm
WHERE pm.project_id = '00000000-0000-0000-0000-000000000000';  -- ← REPLACE with your project uuid

-- If no rows: you are not a member → RLS will block. Add membership (query 6) or use a project where you are member.

-- 4) Verify policies on project_tasks
SELECT policyname, permissive, roles, cmd,
       LEFT(qual::text, 120) AS qual_preview,
       LEFT(with_check::text, 120) AS with_check_preview
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'project_tasks'
ORDER BY cmd, policyname;

-- 5) Optional: list projects you are a member of (so you can pick a valid project_id)
SELECT p.id AS project_id, p.name,
       pm.user_id, pm.profile_id, pm.role,
       (pm.user_id = auth.uid() OR pm.profile_id = auth.uid()) AS i_am_member
FROM public.projects p
JOIN public.project_members pm ON pm.project_id = p.id
WHERE pm.user_id = auth.uid() OR pm.profile_id = auth.uid()
ORDER BY p.name;

-- 6) If you need to add yourself as member (run with service_role or as admin)
-- project_members: id, user_id, project_id, role, profile_id (nullable), updated_at
-- Replace <PROJECT_UUID> with the project id, then run:
/*
INSERT INTO public.project_members (project_id, user_id, role, updated_at)
VALUES ('<PROJECT_UUID>', auth.uid(), 'owner', now())
ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = now();
*/
-- If your table has profile_id and you use it: also set profile_id = auth.uid() (if profiles.id = auth.uid()).
