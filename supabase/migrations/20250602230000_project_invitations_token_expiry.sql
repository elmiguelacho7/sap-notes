-- Project invitations: add token_hash, expires_at, accepted_by, updated_at; add 'expired' status; RLS for accept by invitee.
-- Existing pending rows are marked expired so they require re-invite with the new token flow.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1) Add new columns (nullable first for backfill)
ALTER TABLE public.project_invitations
  ADD COLUMN IF NOT EXISTS token_hash text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '7 days'),
  ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2) Add 'expired' to status check (recreate constraint)
ALTER TABLE public.project_invitations DROP CONSTRAINT IF EXISTS project_invitations_status_check;
ALTER TABLE public.project_invitations
  ADD CONSTRAINT project_invitations_status_check
  CHECK (status IN ('pending', 'accepted', 'revoked', 'expired'));

-- 3) invited_by FK to profiles (if column exists and no FK yet)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'project_invitations' AND column_name = 'invited_by') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.project_invitations'::regclass AND conname = 'project_invitations_invited_by_fkey') THEN
      ALTER TABLE public.project_invitations
        ADD CONSTRAINT project_invitations_invited_by_fkey
        FOREIGN KEY (invited_by) REFERENCES public.profiles (id);
    END IF;
  END IF;
END $$;

-- 4) Backfill: existing rows get expires_at and a placeholder token_hash; pending without token -> expired
UPDATE public.project_invitations
SET
  expires_at = COALESCE(invited_at, now()) + interval '7 days',
  updated_at = COALESCE(invited_at, now())
WHERE expires_at IS NULL;

UPDATE public.project_invitations
SET
  token_hash = encode(
    extensions.digest(convert_to(id::text || '-legacy', 'utf8'), 'sha256'),
    'hex'
  ),
  status = 'expired'
WHERE status = 'pending' AND (token_hash IS NULL OR token_hash = '');

UPDATE public.project_invitations
SET token_hash = encode(
  extensions.digest(convert_to(id::text || '-legacy', 'utf8'), 'sha256'),
  'hex'
)
WHERE token_hash IS NULL;

-- 5) Enforce NOT NULL and UNIQUE on token_hash
-- Allow multiple invites to same email (different tokens); drop project_id+email unique if present
ALTER TABLE public.project_invitations DROP CONSTRAINT IF EXISTS project_invitations_project_id_email_key;
ALTER TABLE public.project_invitations ALTER COLUMN token_hash SET NOT NULL;
ALTER TABLE public.project_invitations ALTER COLUMN expires_at SET NOT NULL;

DROP INDEX IF EXISTS project_invitations_token_hash_key;
CREATE UNIQUE INDEX project_invitations_token_hash_key ON public.project_invitations (token_hash);

-- 6) Indexes for lookup and listing
CREATE INDEX IF NOT EXISTS idx_project_invitations_status ON public.project_invitations (status);
CREATE INDEX IF NOT EXISTS idx_project_invitations_expires_at ON public.project_invitations (expires_at);

-- 7) Helper: current user's email from auth.users (for RLS)
CREATE OR REPLACE FUNCTION public.get_auth_user_email()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION public.get_auth_user_email() IS 'Returns the current authenticated user email for RLS (e.g. invite accept by email match).';

-- 8) SELECT: project members (any role) or superadmin
DROP POLICY IF EXISTS project_invitations_select_policy ON public.project_invitations;
CREATE POLICY project_invitations_select_policy
  ON public.project_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_invitations.project_id
        AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );

-- 9) UPDATE: two cases — (a) owner/superadmin can revoke; (b) invitee can accept (pending, not expired, email match)
DROP POLICY IF EXISTS project_invitations_update_policy ON public.project_invitations;
CREATE POLICY project_invitations_update_policy_owner
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

CREATE POLICY project_invitations_update_policy_invitee_accept
  ON public.project_invitations
  FOR UPDATE
  USING (
    status = 'pending'
    AND expires_at > now()
    AND lower(trim(COALESCE(public.get_auth_user_email(), ''))) = lower(trim(email))
  )
  WITH CHECK (
    status = 'accepted'
    AND accepted_by = auth.uid()
    AND accepted_at IS NOT NULL
  );

COMMENT ON TABLE public.project_invitations IS
  'Project invites by email; token_hash for secure single-use links; accept via POST /api/invitations/accept or trigger on profile insert.';
