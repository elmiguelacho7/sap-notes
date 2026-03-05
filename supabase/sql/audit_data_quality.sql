-- =============================================================================
-- Data quality audit: invalid values, orphans, unexpected nulls
-- Run against your Supabase Postgres to detect data issues.
-- =============================================================================

-- 1) Invalid project statuses (values not in allowed set)
-- Allowed: planned, in_progress, completed, archived
SELECT DISTINCT status AS invalid_status
FROM public.projects
WHERE status IS NOT NULL
  AND status NOT IN ('planned', 'in_progress', 'completed', 'archived');

-- 2) Invalid environment_type (values not in allowed set)
-- Allowed: cloud_public, on_premise
SELECT DISTINCT environment_type AS invalid_environment_type
FROM public.projects
WHERE environment_type IS NOT NULL
  AND environment_type NOT IN ('cloud_public', 'on_premise');

-- 3) Count of projects with invalid status (for backfill)
SELECT COUNT(*) AS projects_with_invalid_status
FROM public.projects
WHERE status IS NULL
   OR status NOT IN ('planned', 'in_progress', 'completed', 'archived');

-- 4) Count of projects with invalid environment_type
SELECT COUNT(*) AS projects_with_invalid_environment_type
FROM public.projects
WHERE environment_type IS NOT NULL
  AND environment_type NOT IN ('cloud_public', 'on_premise');

-- 5) Orphaned project_activities (no phase_id or phase_id not in project_phases)
SELECT pa.id, pa.project_id, pa.phase_id, pa.name
FROM public.project_activities pa
LEFT JOIN public.project_phases pp ON pp.id = pa.phase_id
WHERE pa.phase_id IS NULL
   OR pp.id IS NULL;

-- 6) Orphaned project_tasks (no activity_id or activity_id not in project_activities)
SELECT pt.id, pt.project_id, pt.activity_id, pt.title
FROM public.project_tasks pt
LEFT JOIN public.project_activities pa ON pa.id = pt.activity_id
WHERE pt.activity_id IS NULL
   OR pa.id IS NULL;

-- 7) Orphaned project_phases (project_id not in projects)
SELECT pp.id, pp.project_id, pp.name
FROM public.project_phases pp
LEFT JOIN public.projects p ON p.id = pp.project_id
WHERE p.id IS NULL;

-- 8) Null values where app may expect data (projects)
SELECT id, name,
  CASE WHEN status IS NULL THEN 'status_null' END AS status_issue,
  CASE WHEN environment_type IS NULL THEN 'environment_type_null' END AS env_issue
FROM public.projects
WHERE status IS NULL OR environment_type IS NULL;

-- 9) Summary: distinct status and environment_type currently in DB
SELECT 'Current distinct statuses' AS audit_type, status AS value
FROM (SELECT DISTINCT status FROM public.projects) s
UNION ALL
SELECT 'Current distinct environment_type', environment_type
FROM (SELECT DISTINCT environment_type FROM public.projects) e;
