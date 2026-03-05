-- RBAC Phase 1: roles, permissions, role_permissions. No change to profiles.app_role or project_members.role yet.

CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('app', 'project')),
  key text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, key)
);

CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('app', 'project')),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions (id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_roles_scope ON public.roles (scope);
CREATE INDEX idx_permissions_scope ON public.permissions (scope);
CREATE INDEX idx_role_permissions_role ON public.role_permissions (role_id);

-- RLS: only superadmin can mutate; authenticated can read
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roles_select ON public.roles;
CREATE POLICY roles_select ON public.roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS roles_insert ON public.roles;
CREATE POLICY roles_insert ON public.roles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'superadmin'));

DROP POLICY IF EXISTS roles_update ON public.roles;
CREATE POLICY roles_update ON public.roles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'superadmin'));

DROP POLICY IF EXISTS roles_delete ON public.roles;
CREATE POLICY roles_delete ON public.roles FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'superadmin'));

DROP POLICY IF EXISTS permissions_select ON public.permissions;
CREATE POLICY permissions_select ON public.permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS permissions_insert ON public.permissions;
CREATE POLICY permissions_insert ON public.permissions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'superadmin'));

DROP POLICY IF EXISTS permissions_update ON public.permissions;
CREATE POLICY permissions_update ON public.permissions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'superadmin'));

DROP POLICY IF EXISTS permissions_delete ON public.permissions;
CREATE POLICY permissions_delete ON public.permissions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'superadmin'));

DROP POLICY IF EXISTS role_permissions_select ON public.role_permissions;
CREATE POLICY role_permissions_select ON public.role_permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS role_permissions_insert ON public.role_permissions;
CREATE POLICY role_permissions_insert ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'superadmin'));

DROP POLICY IF EXISTS role_permissions_delete ON public.role_permissions;
CREATE POLICY role_permissions_delete ON public.role_permissions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'superadmin'));

-- Seed permissions (app + project)
INSERT INTO public.permissions (scope, key, name) VALUES
  ('app', 'manage_users', 'Gestionar usuarios'),
  ('app', 'manage_clients', 'Gestionar clientes'),
  ('app', 'view_all_projects', 'Ver todos los proyectos'),
  ('app', 'manage_roles', 'Gestionar roles y permisos'),
  ('project', 'view_project', 'Ver proyecto'),
  ('project', 'edit_project', 'Editar proyecto'),
  ('project', 'manage_members', 'Gestionar miembros'),
  ('project', 'view_tasks', 'Ver tareas'),
  ('project', 'edit_tasks', 'Editar tareas'),
  ('project', 'create_tasks', 'Crear tareas'),
  ('project', 'view_notes', 'Ver notas'),
  ('project', 'edit_notes', 'Editar notas'),
  ('project', 'create_notes', 'Crear notas'),
  ('project', 'view_activities', 'Ver actividades'),
  ('project', 'edit_activities', 'Editar actividades')
ON CONFLICT (key) DO NOTHING;

-- Seed roles (app + project). Use key matching existing app_role / project_members.role for future wiring.
INSERT INTO public.roles (scope, key, name, is_active) VALUES
  ('app', 'superadmin', 'Superadministrador', true),
  ('app', 'admin', 'Administrador', true),
  ('app', 'consultant', 'Consultor', true),
  ('app', 'viewer', 'Lector (app)', true),
  ('project', 'owner', 'Propietario', true),
  ('project', 'editor', 'Editor', true),
  ('project', 'viewer', 'Lector', true)
ON CONFLICT (scope, key) DO UPDATE SET name = EXCLUDED.name, is_active = EXCLUDED.is_active;

-- Seed role_permissions (reference by key via subqueries; roles/permissions are now inserted)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'app' AND p.scope = 'app' AND r.key = 'superadmin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'app' AND p.scope = 'app' AND r.key = 'admin' AND p.key IN ('manage_clients', 'view_all_projects')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'project' AND p.scope = 'project' AND r.key = 'owner'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'project' AND p.scope = 'project' AND r.key = 'editor'
  AND p.key IN ('view_project', 'edit_project', 'view_tasks', 'edit_tasks', 'create_tasks', 'view_notes', 'edit_notes', 'create_notes', 'view_activities', 'edit_activities')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'project' AND p.scope = 'project' AND r.key = 'viewer'
  AND p.key IN ('view_project', 'view_tasks', 'view_notes', 'view_activities')
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMENT ON TABLE public.roles IS 'RBAC roles (app scope = global; project scope = per-project). Phase 1: management only.';
COMMENT ON TABLE public.permissions IS 'RBAC permissions by scope. Phase 1: management only.';
COMMENT ON TABLE public.role_permissions IS 'Role-permission mapping. Phase 1: management only.';
