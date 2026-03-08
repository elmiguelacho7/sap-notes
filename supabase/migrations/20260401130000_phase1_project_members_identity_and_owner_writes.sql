-- Phase 1 hardening: project_members identity standard + owner write path (DATABASE_ARCHITECTURE_AUDIT.md)
-- 1) Canonical identity: user_id = auth.uid(). Policies and helpers use user_id consistently.
-- 2) Owners can manage members from the client: INSERT/UPDATE/DELETE allowed when current user is owner of that project.
-- 3) is_project_member(project_uuid) and is_project_owner(project_uuid) use user_id; avoid recursion via SECURITY DEFINER + row_security = off.

-- Helper: is the current user an owner of the given project? (Used for write policies; no recursion.)
CREATE OR REPLACE FUNCTION public.is_project_owner(project_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = project_uuid
      AND pm.user_id = auth.uid()
      AND pm.role = 'owner'
  );
$$;

COMMENT ON FUNCTION public.is_project_owner(uuid) IS
  'True if the current auth user is an owner of the given project (project_members.user_id = auth.uid() AND role = ''owner''). Used for RLS write policies; row_security = off to avoid recursion.';

-- Standardize is_project_member to use user_id (canonical identity)
CREATE OR REPLACE FUNCTION public.is_project_member(project_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = project_uuid
      AND pm.user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_project_member(uuid) IS
  'True if the current auth user is a member of the given project (project_members.user_id = auth.uid()). Canonical identity: user_id.';

GRANT EXECUTE ON FUNCTION public.is_project_owner(uuid) TO authenticated;

-- Document canonical identity on project_members
COMMENT ON COLUMN public.project_members.user_id IS
  'Canonical identity: auth.uid() of the member. Used by RLS and app for membership checks. profile_id is legacy/denormalized; prefer user_id.';

-- Replace all project_members policies: SELECT by user_id or superadmin; write by superadmin OR project owner
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_members'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_members;', pol.policyname);
  END LOOP;
END $$;

-- SELECT: own row (user_id = auth.uid()) OR superadmin — no membership check to avoid recursion
CREATE POLICY "project_members_select_own_or_superadmin"
  ON public.project_members
  FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin()
    OR user_id = auth.uid()
  );

-- INSERT: superadmin OR current user is owner of the project being inserted
CREATE POLICY "project_members_insert_superadmin_or_owner"
  ON public.project_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR public.is_project_owner(project_id)
  );

-- UPDATE: superadmin OR current user is owner of the project of the row
CREATE POLICY "project_members_update_superadmin_or_owner"
  ON public.project_members
  FOR UPDATE
  TO authenticated
  USING (
    public.is_superadmin()
    OR public.is_project_owner(project_id)
  )
  WITH CHECK (
    public.is_superadmin()
    OR public.is_project_owner(project_id)
  );

-- DELETE: superadmin OR current user is owner of the project of the row
CREATE POLICY "project_members_delete_superadmin_or_owner"
  ON public.project_members
  FOR DELETE
  TO authenticated
  USING (
    public.is_superadmin()
    OR public.is_project_owner(project_id)
  );

COMMENT ON TABLE public.project_members IS
  'Project membership. RLS: SELECT own row or superadmin; INSERT/UPDATE/DELETE superadmin or project owner. Identity: user_id = auth.uid() is canonical.';
