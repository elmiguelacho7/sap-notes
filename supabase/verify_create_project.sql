-- Validate project creation permission: which roles have create_project
SELECT r.key AS role_key, p.key AS permission_key
FROM public.role_permissions rp
JOIN public.roles r ON r.id = rp.role_id
JOIN public.permissions p ON p.id = rp.permission_id
WHERE p.key = 'create_project'
  AND r.scope = 'app'
ORDER BY r.key;
