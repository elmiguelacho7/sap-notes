-- project_invitations: pending invites by email; auto-accepted on signup via trigger.
CREATE TABLE public.project_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  invited_by uuid NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz NULL,
  UNIQUE (project_id, email)
);

CREATE INDEX idx_project_invitations_email ON public.project_invitations (email);
CREATE INDEX idx_project_invitations_project_id ON public.project_invitations (project_id);

ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

-- SELECT: project owners/superadmins for that project
DROP POLICY IF EXISTS project_invitations_select_policy ON public.project_invitations;
CREATE POLICY project_invitations_select_policy
  ON public.project_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_invitations.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'owner'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );

-- INSERT: project owners/superadmins only
DROP POLICY IF EXISTS project_invitations_insert_policy ON public.project_invitations;
CREATE POLICY project_invitations_insert_policy
  ON public.project_invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_invitations.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'owner'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );

-- UPDATE: project owners/superadmins (trigger will update via service role)
DROP POLICY IF EXISTS project_invitations_update_policy ON public.project_invitations;
CREATE POLICY project_invitations_update_policy
  ON public.project_invitations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_invitations.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'owner'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );

COMMENT ON TABLE public.project_invitations IS
  'Pending project invites by email; accepted automatically when the user signs up (trigger on profiles).';
