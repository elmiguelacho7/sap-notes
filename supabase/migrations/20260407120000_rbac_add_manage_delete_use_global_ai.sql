-- RBAC: Add manage_any_project, delete_any_project, use_global_ai.
-- Semantic: view_all_projects remains read-only; manage_any_project is the write override;
-- delete_any_project is separate/critical; use_global_ai gates global Copilot.
-- See docs/RBAC_IMPLEMENTATION_PHASE.md.

-- ========== 1. New app permissions ==========
INSERT INTO public.permissions (scope, key, name) VALUES
  ('app', 'manage_any_project', 'Gestionar cualquier proyecto'),
  ('app', 'delete_any_project', 'Eliminar cualquier proyecto'),
  ('app', 'use_global_ai', 'Usar IA global (Copilot)')
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, scope = EXCLUDED.scope;

-- ========== 2. Superadmin: manage_any_project, delete_any_project, use_global_ai ==========
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'app' AND r.key = 'superadmin' AND p.scope = 'app'
  AND p.key IN ('manage_any_project', 'delete_any_project', 'use_global_ai')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ========== 3. Admin: manage_any_project, use_global_ai ==========
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'app' AND r.key = 'admin' AND p.scope = 'app'
  AND p.key IN ('manage_any_project', 'use_global_ai')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ========== 4. Consultant: use_global_ai ==========
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'app' AND r.key = 'consultant' AND p.scope = 'app'
  AND p.key = 'use_global_ai'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ========== 5. Viewer (app): use_global_ai ==========
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'app' AND r.key = 'viewer' AND p.scope = 'app'
  AND p.key = 'use_global_ai'
ON CONFLICT (role_id, permission_id) DO NOTHING;
