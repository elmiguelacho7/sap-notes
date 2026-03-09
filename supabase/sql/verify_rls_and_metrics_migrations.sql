-- Run this in Supabase Dashboard → SQL Editor against the same project as your app.
-- Use to verify RLS and get_platform_metrics state. No writes; read-only checks.

-- ---------------------------------------------------------------------------
-- 1) Which project am I connected to? (host only, no secrets)
-- ---------------------------------------------------------------------------
SELECT current_database() AS db_name, inet_server_addr() AS server_ip;

-- ---------------------------------------------------------------------------
-- 2) Migration history: are our migrations applied?
-- (Only works if migrations were applied via Supabase CLI; may be empty on some hosts.)
-- ---------------------------------------------------------------------------
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE name IN (
  '20260402140000_align_platform_metrics_rls.sql',
  '20260402150000_projects_rls_writes.sql'
)
ORDER BY version;

-- If the above returns 0 rows, those migrations have NOT been applied.

-- ---------------------------------------------------------------------------
-- 3) RLS enabled on projects and notes?
-- ---------------------------------------------------------------------------
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('projects', 'notes')
  AND c.relkind = 'r'
ORDER BY c.relname;

-- Expect: projects true, notes true. If false, RLS migrations are not applied.

-- ---------------------------------------------------------------------------
-- 4) Policies on projects
-- ---------------------------------------------------------------------------
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'projects'
ORDER BY policyname;

-- Expect at least: projects_select_*, projects_insert_*, projects_update_*
-- (exact names from 20260402140000 and 20260402150000)

-- ---------------------------------------------------------------------------
-- 5) Policies on notes
-- ---------------------------------------------------------------------------
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notes'
ORDER BY policyname;

-- Expect at least: notes_select_*, notes_insert_*

-- ---------------------------------------------------------------------------
-- 6) get_platform_metrics: does it have superadmin branch?
-- Inspect function source for 'v_is_superadmin' or 'superadmin'.
-- ---------------------------------------------------------------------------
SELECT
  p.proname AS function_name,
  CASE
    WHEN pg_get_functiondef(p.oid) LIKE '%v_is_superadmin%' THEN 'has_superadmin_branch'
    WHEN pg_get_functiondef(p.oid) LIKE '%superadmin%' AND pg_get_functiondef(p.oid) LIKE '%profiles%' THEN 'likely_new_version'
    ELSE 'possibly_old_version'
  END AS version_hint
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'get_platform_metrics';

-- If version_hint = 'possibly_old_version', the alignment migration was not applied.

-- ---------------------------------------------------------------------------
-- 7) Optional: for a given user id, what would RPC return? (replace with real uuid)
-- ---------------------------------------------------------------------------
-- SELECT * FROM get_platform_metrics('YOUR-USER-UUID-HERE');

-- ---------------------------------------------------------------------------
-- 8) Do projects have created_by populated? (affects RPC counts for non-superadmin)
-- ---------------------------------------------------------------------------
SELECT
  count(*) AS total_projects,
  count(created_by) AS with_created_by,
  count(*) - count(created_by) AS without_created_by
FROM public.projects;

-- ---------------------------------------------------------------------------
-- 9) project_members: sample count (are users linked to projects?)
-- ---------------------------------------------------------------------------
SELECT count(*) AS project_members_count FROM public.project_members;
