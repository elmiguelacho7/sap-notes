-- External integrations: OAuth-connected accounts (Google Drive, etc.) for project sources.
-- Additive; does not modify existing project_sources RLS, only adds column and new table.

-- 1) external_integrations
CREATE TABLE IF NOT EXISTS public.external_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  owner_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  display_name text NOT NULL,
  account_email text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_integrations_provider_check
    CHECK (provider IN ('google_drive')),
  CONSTRAINT external_integrations_status_check
    CHECK (status IN ('active', 'expired', 'revoked', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_external_integrations_owner ON public.external_integrations (owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_external_integrations_provider ON public.external_integrations (provider);
CREATE INDEX IF NOT EXISTS idx_external_integrations_status ON public.external_integrations (status);

COMMENT ON TABLE public.external_integrations IS
  'OAuth-connected external accounts (e.g. Google Drive) for syncing project sources. Tokens server-side only.';

DROP TRIGGER IF EXISTS set_external_integrations_updated_at ON public.external_integrations;
CREATE TRIGGER set_external_integrations_updated_at
  BEFORE UPDATE ON public.external_integrations
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

-- 2) RLS: users can only read/write their own integrations
ALTER TABLE public.external_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "external_integrations_select_own"
  ON public.external_integrations FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR owner_profile_id = auth.uid()
  );

CREATE POLICY "external_integrations_insert_own"
  ON public.external_integrations FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR owner_profile_id = auth.uid()
  );

CREATE POLICY "external_integrations_update_own"
  ON public.external_integrations FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR owner_profile_id = auth.uid()
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR owner_profile_id = auth.uid()
  );

CREATE POLICY "external_integrations_delete_own"
  ON public.external_integrations FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR owner_profile_id = auth.uid()
  );

-- 3) Add integration_id to project_sources (additive)
ALTER TABLE public.project_sources
  ADD COLUMN IF NOT EXISTS integration_id uuid REFERENCES public.external_integrations (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_sources_integration_id ON public.project_sources (integration_id);

COMMENT ON COLUMN public.project_sources.integration_id IS
  'Optional link to an external_integration (e.g. Google Drive) owned by the user. Validated on insert/update.';
