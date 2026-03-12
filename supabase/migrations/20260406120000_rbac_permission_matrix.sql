-- RBAC: Initial permission matrix. Builds on existing roles, permissions, role_permissions.
-- Does NOT change profiles.app_role or project_members.role.
-- Idempotent: insert missing permissions; add role_permissions (ON CONFLICT DO NOTHING).

-- ========== 1. Insert missing GLOBAL (app) permissions ==========
INSERT INTO public.permissions (scope, key, name) VALUES
  ('app', 'view_dashboard', 'Ver panel principal'),
  ('app', 'view_admin_panel', 'Ver panel de administración'),
  ('app', 'manage_global_roles', 'Gestionar roles globales'),
  ('app', 'manage_user_activation', 'Gestionar activación de usuarios'),
  ('app', 'create_project', 'Crear proyectos'),
  ('app', 'manage_knowledge_sources', 'Gestionar fuentes de conocimiento'),
  ('app', 'view_global_notes', 'Ver notas globales'),
  ('app', 'manage_global_notes', 'Gestionar notas globales'),
  ('app', 'view_global_metrics', 'Ver métricas globales'),
  ('app', 'manage_platform_settings', 'Gestionar configuración de plataforma')
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, scope = EXCLUDED.scope;

-- ========== 2. Insert missing PROJECT permissions ==========
INSERT INTO public.permissions (scope, key, name) VALUES
  ('project', 'manage_project_members', 'Gestionar miembros del proyecto'),
  ('project', 'view_project_notes', 'Ver notas del proyecto'),
  ('project', 'create_project_notes', 'Crear notas del proyecto'),
  ('project', 'edit_project_notes', 'Editar notas del proyecto'),
  ('project', 'delete_project_notes', 'Eliminar notas del proyecto'),
  ('project', 'view_project_tasks', 'Ver tareas del proyecto'),
  ('project', 'manage_project_tasks', 'Gestionar tareas del proyecto'),
  ('project', 'view_project_activities', 'Ver actividades del proyecto'),
  ('project', 'manage_project_activities', 'Gestionar actividades del proyecto'),
  ('project', 'view_project_tickets', 'Ver tickets del proyecto'),
  ('project', 'manage_project_tickets', 'Gestionar tickets del proyecto'),
  ('project', 'view_project_knowledge', 'Ver conocimiento del proyecto'),
  ('project', 'manage_project_knowledge', 'Gestionar conocimiento del proyecto'),
  ('project', 'use_project_ai', 'Usar IA del proyecto')
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, scope = EXCLUDED.scope;

-- ========== 3. GLOBAL: superadmin — all app permissions ==========
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'app' AND r.key = 'superadmin' AND p.scope = 'app'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ========== 4. GLOBAL: admin — specified list (no manage_users, no manage_global_roles, no manage_user_activation, no manage_platform_settings) ==========
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'app' AND r.key = 'admin' AND p.scope = 'app'
  AND p.key IN (
    'view_dashboard', 'view_admin_panel', 'manage_clients', 'create_project',
    'view_all_projects', 'manage_knowledge_sources', 'view_global_notes',
    'manage_global_notes', 'view_global_metrics'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ========== 5. GLOBAL: consultant — view_dashboard + create_project (configurable; see comment below) ==========
-- Decision: consultant has create_project ENABLED. To disable, remove 'create_project' from the list and re-run this block.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'app' AND r.key = 'consultant' AND p.scope = 'app'
  AND p.key IN ('view_dashboard', 'create_project')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ========== 6. GLOBAL: viewer — view_dashboard only ==========
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'app' AND r.key = 'viewer' AND p.scope = 'app'
  AND p.key = 'view_dashboard'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ========== 7. PROJECT: owner — all project permissions ==========
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'project' AND r.key = 'owner' AND p.scope = 'project'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ========== 8. PROJECT: editor — all except manage_project_members ==========
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'project' AND r.key = 'editor' AND p.scope = 'project'
  AND p.key != 'manage_project_members'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ========== 9. PROJECT: viewer — view only ==========
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'project' AND r.key = 'viewer' AND p.scope = 'project'
  AND p.key IN (
    'view_project', 'view_project_notes', 'view_project_tasks',
    'view_project_activities', 'view_project_tickets', 'view_project_knowledge'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Ensure project viewer also has legacy view_* keys if they exist (view_notes, view_tasks, view_activities)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'project' AND r.key = 'viewer' AND p.scope = 'project'
  AND p.key IN ('view_notes', 'view_tasks', 'view_activities')
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMENT ON TABLE public.role_permissions IS 'Role-permission matrix. Global from profiles.app_role; project from project_members.role. See 20260406120000_rbac_permission_matrix.sql for consultant->create_project decision.';
