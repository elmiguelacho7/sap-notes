-- Allow project members to SELECT all project_members rows for projects they belong to.
-- Used so the Tasks page can build the assignee (Responsible) dropdown from project_members only.
-- is_project_member is SECURITY DEFINER with row_security = off, so no recursion.

CREATE POLICY "project_members_select_same_project"
  ON public.project_members
  FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

COMMENT ON POLICY "project_members_select_same_project" ON public.project_members IS
  'Allow reading all members of a project when the current user is a member of that project (for assignee/team lists).';
