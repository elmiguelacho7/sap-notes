-- Knowledge sources: unified table for agent knowledge (global + project-scoped).
-- Separates operational project_links from ingestible sources used by Sapito.
-- Additive; does not drop or alter project_links or project_sources.
-- project_id must be NULL when scope_type = 'global'; must be set when scope_type = 'project'.

-- 1) knowledge_sources
CREATE TABLE IF NOT EXISTS public.knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL,
  project_id uuid REFERENCES public.projects (id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_name text NOT NULL,
  external_ref text,
  source_url text,
  status text NOT NULL DEFAULT 'active',
  sync_enabled boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  integration_id uuid REFERENCES public.external_integrations (id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_sources_scope_type_check
    CHECK (scope_type IN ('global', 'project')),
  CONSTRAINT knowledge_sources_scope_project_check
    CHECK (
      (scope_type = 'global' AND project_id IS NULL)
      OR (scope_type = 'project' AND project_id IS NOT NULL)
    ),
  CONSTRAINT knowledge_sources_status_check
    CHECK (status IN ('active', 'paused', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_knowledge_sources_scope_project
  ON public.knowledge_sources (scope_type, project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_source_type
  ON public.knowledge_sources (source_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_integration_id
  ON public.knowledge_sources (integration_id)
  WHERE integration_id IS NOT NULL;

COMMENT ON TABLE public.knowledge_sources IS
  'Agent knowledge sources: global (admin-curated) and project-scoped. Used for ingestion/sync into knowledge_documents. Not operational links.';
COMMENT ON COLUMN public.knowledge_sources.scope_type IS 'global = admin-curated reusable; project = private to one project.';
COMMENT ON COLUMN public.knowledge_sources.project_id IS 'NULL for global; required for project scope. Project knowledge is never shared across projects.';

DROP TRIGGER IF EXISTS set_knowledge_sources_updated_at ON public.knowledge_sources;
CREATE TRIGGER set_knowledge_sources_updated_at
  BEFORE UPDATE ON public.knowledge_sources
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

-- 2) RLS: global only for superadmin; project for project members
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_sources_select_global_superadmin"
  ON public.knowledge_sources FOR SELECT
  USING (
    scope_type = 'global'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );

CREATE POLICY "knowledge_sources_select_project_members"
  ON public.knowledge_sources FOR SELECT
  USING (
    scope_type = 'project'
    AND project_id IS NOT NULL
    AND (
      auth.role() = 'service_role'
      OR EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = knowledge_sources.project_id AND pm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "knowledge_sources_insert_global_superadmin"
  ON public.knowledge_sources FOR INSERT
  WITH CHECK (
    scope_type = 'global'
    AND project_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );

CREATE POLICY "knowledge_sources_insert_project_members"
  ON public.knowledge_sources FOR INSERT
  WITH CHECK (
    scope_type = 'project'
    AND project_id IS NOT NULL
    AND (
      auth.role() = 'service_role'
      OR EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = knowledge_sources.project_id AND pm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "knowledge_sources_update_global_superadmin"
  ON public.knowledge_sources FOR UPDATE
  USING (
    scope_type = 'global'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  )
  WITH CHECK (
    scope_type = 'global'
    AND project_id IS NULL
  );

CREATE POLICY "knowledge_sources_update_project_members"
  ON public.knowledge_sources FOR UPDATE
  USING (
    scope_type = 'project'
    AND project_id IS NOT NULL
    AND (
      auth.role() = 'service_role'
      OR EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = knowledge_sources.project_id AND pm.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (scope_type = 'project' AND project_id IS NOT NULL);

CREATE POLICY "knowledge_sources_delete_global_superadmin"
  ON public.knowledge_sources FOR DELETE
  USING (
    scope_type = 'global'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );

CREATE POLICY "knowledge_sources_delete_project_members"
  ON public.knowledge_sources FOR DELETE
  USING (
    scope_type = 'project'
    AND project_id IS NOT NULL
    AND (
      auth.role() = 'service_role'
      OR EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = knowledge_sources.project_id AND pm.user_id = auth.uid()
      )
    )
  );

-- 3) Migrate existing project_sources into knowledge_sources (idempotent: only insert if not already present by external_ref + project_id + source_type)
INSERT INTO public.knowledge_sources (
  scope_type,
  project_id,
  source_type,
  source_name,
  external_ref,
  source_url,
  status,
  sync_enabled,
  last_synced_at,
  integration_id,
  created_by,
  created_at,
  updated_at
)
SELECT
  'project',
  ps.project_id,
  ps.source_type,
  ps.name,
  ps.external_id,
  ps.source_url,
  'active',
  COALESCE(ps.sync_enabled, false),
  ps.last_synced_at,
  ps.integration_id,
  ps.created_by,
  ps.created_at,
  ps.updated_at
FROM public.project_sources ps
WHERE NOT EXISTS (
  SELECT 1 FROM public.knowledge_sources ks
  WHERE ks.scope_type = 'project'
    AND ks.project_id = ps.project_id
    AND ks.source_type = ps.source_type
    AND ks.source_name = ps.name
    AND (
      (ks.external_ref IS NOT NULL AND ps.external_id IS NOT NULL AND ks.external_ref = ps.external_id)
      OR (ks.external_ref IS NULL AND ps.external_id IS NULL)
    )
);
