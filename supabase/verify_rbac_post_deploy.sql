-- =============================================================================
-- Post-deployment RBAC verification (run in Supabase Dashboard → SQL Editor)
-- =============================================================================

-- 1) New permissions exist
SELECT key, scope
FROM public.permissions
WHERE key IN (
  'manage_any_project',
  'delete_any_project',
  'use_global_ai'
)
ORDER BY key;

-- 2) Role assignments for new permissions
SELECT r.key AS role_key, p.key AS permission_key
FROM public.role_permissions rp
JOIN public.roles r ON r.id = rp.role_id
JOIN public.permissions p ON p.id = rp.permission_id
WHERE p.key IN (
  'manage_any_project',
  'delete_any_project',
  'use_global_ai'
)
ORDER BY r.key, p.key;

-- 3) Which roles can create projects
SELECT r.key AS role_key, p.key AS permission_key
FROM public.role_permissions rp
JOIN public.roles r ON r.id = rp.role_id
JOIN public.permissions p ON p.id = rp.permission_id
WHERE p.key = 'create_project'
  AND r.scope = 'app'
ORDER BY r.key;
