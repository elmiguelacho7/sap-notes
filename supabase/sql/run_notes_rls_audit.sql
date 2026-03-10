-- =============================================================================
-- Run in Supabase Dashboard → SQL Editor (project: same as your app).
-- Copy the result of each query and paste into the final output template.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Query A — Active policies on public.notes
-- Run this block, copy the full result (all rows).
-- ---------------------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'notes'
ORDER BY policyname;

-- ---------------------------------------------------------------------------
-- Query B — RLS enabled on public.notes?
-- Run this block, copy the full result (one row).
-- ---------------------------------------------------------------------------
SELECT
  c.relname AS relname,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'notes'
  AND c.relkind = 'r';
