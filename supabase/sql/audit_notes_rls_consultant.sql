-- =============================================================================
-- Audit: why can a consultant receive global notes from GET /api/notes?
-- Run in Supabase Dashboard → SQL Editor. No writes; read-only.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TASK 1 — Active RLS policies on public.notes
-- ---------------------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual AS qual_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'notes'
ORDER BY policyname;

-- ---------------------------------------------------------------------------
-- TASK 2 — RLS enabled on public.notes?
-- ---------------------------------------------------------------------------
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'notes'
  AND c.relkind = 'r';

-- If rls_enabled = false, consultants can see all rows (RLS is off).

-- ---------------------------------------------------------------------------
-- Optional: Migration order — 20260404110000_notes_global_superadmin_only.sql
-- must be applied so global notes are superadmin-only. Check applied migrations:
-- ---------------------------------------------------------------------------
-- SELECT version, name FROM supabase_migrations.schema_migrations
-- WHERE name LIKE '%notes%' ORDER BY version;
-- Expect to see 20260404110000_notes_global_superadmin_only.sql applied after
-- 20260404100000 and 20260402140000. If 20260404110000 is missing, run it
-- (or apply via Supabase Dashboard) so the SELECT policy is:
--   project_id IS NULL AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND app_role = 'superadmin')

-- ---------------------------------------------------------------------------
-- Optional: auth.uid() for a given JWT is not available in raw SQL.
-- Use GET /api/notes with debug logging (see route) to confirm jwt.sub and
-- notes returned.
-- ---------------------------------------------------------------------------
