-- Align profiles.app_role with public.roles (scope='app') so Admin UI can set admin/viewer.
-- Fixes: "new row for relation \"profiles\" violates check constraint \"profiles_app_role_check\""
-- when selecting Administrador (key=admin) or Lector (key=viewer).
-- Idempotent: drop existing check if present, then add check with allowed list.

-- Drop existing check (name may be profiles_app_role_check or similar)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_app_role_check;

-- Allow only app-level role keys that exist in public.roles (scope='app')
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_app_role_check
  CHECK (app_role IS NULL OR app_role IN ('superadmin', 'admin', 'consultant', 'viewer'));

COMMENT ON COLUMN public.profiles.app_role IS
  'Global app role: superadmin, admin, consultant, or viewer. Must match public.roles (scope=app) keys.';
