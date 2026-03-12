-- Post-deployment verification: new RBAC permissions
SELECT key, scope
FROM public.permissions
WHERE key IN (
  'manage_any_project',
  'delete_any_project',
  'use_global_ai'
)
ORDER BY key;
