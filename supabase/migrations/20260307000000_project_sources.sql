-- Project Sources: foundational tables for external knowledge sources per project.
-- Additive; does not modify project_links or other existing tables.

-- 1) project_sources
CREATE TABLE IF NOT EXISTS public.project_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  source_type text NOT NULL,
  name text NOT NULL,
  description text,
  source_url text,
  external_id text,
  external_parent_id text,
  sync_enabled boolean NOT NULL DEFAULT false,
  sync_mode text NOT NULL DEFAULT 'manual',
  last_synced_at timestamptz,
  last_sync_status text NOT NULL DEFAULT 'never',
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_sources_source_type_check
    CHECK (source_type IN (
      'google_drive_folder',
      'google_drive_file',
      'sharepoint_library',
      'confluence_space',
      'jira_project',
      'web_url',
      'manual_upload'
    )),
  CONSTRAINT project_sources_sync_mode_check
    CHECK (sync_mode IN ('manual', 'scheduled')),
  CONSTRAINT project_sources_last_sync_status_check
    CHECK (last_sync_status IN ('never', 'success', 'partial', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_project_sources_project_id ON public.project_sources (project_id);
CREATE INDEX IF NOT EXISTS idx_project_sources_source_type ON public.project_sources (source_type);

COMMENT ON TABLE public.project_sources IS
  'External knowledge sources per project (Drive, SharePoint, Confluence, Jira, web URL, manual). Future sync into Sapito knowledge.';

-- updated_at trigger
DROP TRIGGER IF EXISTS set_project_sources_updated_at ON public.project_sources;
CREATE TRIGGER set_project_sources_updated_at
  BEFORE UPDATE ON public.project_sources
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

-- 2) project_source_sync_jobs
CREATE TABLE IF NOT EXISTS public.project_source_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_source_id uuid NOT NULL REFERENCES public.project_sources (id) ON DELETE CASCADE,
  trigger_type text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  files_seen integer NOT NULL DEFAULT 0,
  files_processed integer NOT NULL DEFAULT 0,
  files_skipped integer NOT NULL DEFAULT 0,
  files_failed integer NOT NULL DEFAULT 0,
  error_summary text,
  initiated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_source_sync_jobs_trigger_type_check
    CHECK (trigger_type IN ('manual', 'scheduled', 'webhook')),
  CONSTRAINT project_source_sync_jobs_status_check
    CHECK (status IN ('running', 'success', 'partial', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_project_source_sync_jobs_source_id ON public.project_source_sync_jobs (project_source_id);
CREATE INDEX IF NOT EXISTS idx_project_source_sync_jobs_started_at ON public.project_source_sync_jobs (started_at DESC);

COMMENT ON TABLE public.project_source_sync_jobs IS
  'Sync job runs for project_sources; future use for Google Drive / SharePoint sync.';

-- 3) RLS on project_sources (mirror project_tasks: service_role or project member)
ALTER TABLE public.project_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_sources_select_for_members"
  ON public.project_sources FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_sources.project_id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "project_sources_insert_for_members"
  ON public.project_sources FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_sources.project_id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "project_sources_update_for_members"
  ON public.project_sources FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_sources.project_id AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_sources.project_id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "project_sources_delete_for_members"
  ON public.project_sources FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_sources.project_id AND pm.user_id = auth.uid()
    )
  );

-- 4) RLS on project_source_sync_jobs (access via project_sources.project_id)
ALTER TABLE public.project_source_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_source_sync_jobs_select_for_members"
  ON public.project_source_sync_jobs FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_sources ps
      JOIN public.project_members pm ON pm.project_id = ps.project_id AND pm.user_id = auth.uid()
      WHERE ps.id = project_source_sync_jobs.project_source_id
    )
  );

CREATE POLICY "project_source_sync_jobs_insert_for_members"
  ON public.project_source_sync_jobs FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_sources ps
      JOIN public.project_members pm ON pm.project_id = ps.project_id AND pm.user_id = auth.uid()
      WHERE ps.id = project_source_sync_jobs.project_source_id
    )
  );

CREATE POLICY "project_source_sync_jobs_update_for_members"
  ON public.project_source_sync_jobs FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_sources ps
      JOIN public.project_members pm ON pm.project_id = ps.project_id AND pm.user_id = auth.uid()
      WHERE ps.id = project_source_sync_jobs.project_source_id
    )
  );

CREATE POLICY "project_source_sync_jobs_delete_for_members"
  ON public.project_source_sync_jobs FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_sources ps
      JOIN public.project_members pm ON pm.project_id = ps.project_id AND pm.user_id = auth.uid()
      WHERE ps.id = project_source_sync_jobs.project_source_id
    )
  );
