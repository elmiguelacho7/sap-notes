-- Knowledge module: Notion-like structured knowledge (spaces, pages, blocks, tags, links).
-- Uses profiles.id (owner_profile_id) and project_members.user_id for auth (profiles.id = auth.uid()).

-- 1) knowledge_spaces
CREATE TABLE IF NOT EXISTS public.knowledge_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'project', 'org')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_spaces_owner ON public.knowledge_spaces (owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_spaces_project ON public.knowledge_spaces (project_id);

-- 2) knowledge_pages
CREATE TABLE IF NOT EXISTS public.knowledge_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.knowledge_spaces (id) ON DELETE CASCADE,
  owner_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  page_type text NOT NULL DEFAULT 'how_to'
    CHECK (page_type IN ('how_to', 'troubleshooting', 'template', 'decision', 'meeting_note', 'config', 'cutover_runbook', 'reference')),
  summary text,
  is_published boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_pages_space_updated ON public.knowledge_pages (space_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_pages_owner ON public.knowledge_pages (owner_profile_id);

-- 3) knowledge_blocks
CREATE TABLE IF NOT EXISTS public.knowledge_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.knowledge_pages (id) ON DELETE CASCADE,
  block_type text NOT NULL
    CHECK (block_type IN ('rich_text', 'checklist', 'code', 'link', 'callout')),
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_blocks_page_sort ON public.knowledge_blocks (page_id, sort_order);

-- 4) knowledge_tags
CREATE TABLE IF NOT EXISTS public.knowledge_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_profile_id, name)
);

-- 5) knowledge_page_tags
CREATE TABLE IF NOT EXISTS public.knowledge_page_tags (
  page_id uuid NOT NULL REFERENCES public.knowledge_pages (id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.knowledge_tags (id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, tag_id)
);

-- 6) knowledge_page_links
CREATE TABLE IF NOT EXISTS public.knowledge_page_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_page_id uuid NOT NULL REFERENCES public.knowledge_pages (id) ON DELETE CASCADE,
  to_page_id uuid NOT NULL REFERENCES public.knowledge_pages (id) ON DELETE CASCADE,
  link_type text NOT NULL DEFAULT 'references'
    CHECK (link_type IN ('references', 'depends_on', 'related', 'duplicate_of')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_page_id, to_page_id, link_type)
);

-- 7) knowledge_page_projects
CREATE TABLE IF NOT EXISTS public.knowledge_page_projects (
  page_id uuid NOT NULL REFERENCES public.knowledge_pages (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_page_projects_project ON public.knowledge_page_projects (project_id);

-- Triggers: updated_at (reuse set_updated_at if exists)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS knowledge_spaces_updated_at ON public.knowledge_spaces;
CREATE TRIGGER knowledge_spaces_updated_at
  BEFORE UPDATE ON public.knowledge_spaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS knowledge_pages_updated_at ON public.knowledge_pages;
CREATE TRIGGER knowledge_pages_updated_at
  BEFORE UPDATE ON public.knowledge_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS knowledge_blocks_updated_at ON public.knowledge_blocks;
CREATE TRIGGER knowledge_blocks_updated_at
  BEFORE UPDATE ON public.knowledge_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.knowledge_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_page_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_page_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_page_projects ENABLE ROW LEVEL SECURITY;

-- knowledge_spaces: owner CRUD; project member or superadmin can SELECT when project_id is set
DROP POLICY IF EXISTS knowledge_spaces_select_owner ON public.knowledge_spaces;
CREATE POLICY knowledge_spaces_select_owner ON public.knowledge_spaces FOR SELECT
  USING (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS knowledge_spaces_select_project ON public.knowledge_spaces;
CREATE POLICY knowledge_spaces_select_project ON public.knowledge_spaces FOR SELECT
  USING (
    project_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = knowledge_spaces.project_id AND pm.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin')
    )
  );

DROP POLICY IF EXISTS knowledge_spaces_insert ON public.knowledge_spaces;
CREATE POLICY knowledge_spaces_insert ON public.knowledge_spaces FOR INSERT
  WITH CHECK (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS knowledge_spaces_update ON public.knowledge_spaces;
CREATE POLICY knowledge_spaces_update ON public.knowledge_spaces FOR UPDATE
  USING (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS knowledge_spaces_delete ON public.knowledge_spaces;
CREATE POLICY knowledge_spaces_delete ON public.knowledge_spaces FOR DELETE
  USING (owner_profile_id = auth.uid());

-- knowledge_pages: owner CRUD; project member/superadmin SELECT when space is project-linked
DROP POLICY IF EXISTS knowledge_pages_select_owner ON public.knowledge_pages;
CREATE POLICY knowledge_pages_select_owner ON public.knowledge_pages FOR SELECT
  USING (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS knowledge_pages_select_project ON public.knowledge_pages;
CREATE POLICY knowledge_pages_select_project ON public.knowledge_pages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.knowledge_spaces ks
      WHERE ks.id = knowledge_pages.space_id AND ks.project_id IS NOT NULL
        AND (EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = ks.project_id AND pm.user_id = auth.uid())
             OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin'))
    )
  );

DROP POLICY IF EXISTS knowledge_pages_insert ON public.knowledge_pages;
CREATE POLICY knowledge_pages_insert ON public.knowledge_pages FOR INSERT
  WITH CHECK (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS knowledge_pages_update ON public.knowledge_pages;
CREATE POLICY knowledge_pages_update ON public.knowledge_pages FOR UPDATE
  USING (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS knowledge_pages_delete ON public.knowledge_pages;
CREATE POLICY knowledge_pages_delete ON public.knowledge_pages FOR DELETE
  USING (owner_profile_id = auth.uid());

-- knowledge_blocks: follow page access (owner or project member read; only owner write)
DROP POLICY IF EXISTS knowledge_blocks_select_owner ON public.knowledge_blocks;
CREATE POLICY knowledge_blocks_select_owner ON public.knowledge_blocks FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_blocks.page_id AND kp.owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS knowledge_blocks_select_project ON public.knowledge_blocks;
CREATE POLICY knowledge_blocks_select_project ON public.knowledge_blocks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.knowledge_pages kp
      JOIN public.knowledge_spaces ks ON ks.id = kp.space_id
      WHERE kp.id = knowledge_blocks.page_id AND ks.project_id IS NOT NULL
        AND (EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = ks.project_id AND pm.user_id = auth.uid())
             OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin'))
    )
  );

DROP POLICY IF EXISTS knowledge_blocks_insert ON public.knowledge_blocks;
CREATE POLICY knowledge_blocks_insert ON public.knowledge_blocks FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_blocks.page_id AND kp.owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS knowledge_blocks_update ON public.knowledge_blocks;
CREATE POLICY knowledge_blocks_update ON public.knowledge_blocks FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_blocks.page_id AND kp.owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS knowledge_blocks_delete ON public.knowledge_blocks;
CREATE POLICY knowledge_blocks_delete ON public.knowledge_blocks FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_blocks.page_id AND kp.owner_profile_id = auth.uid())
  );

-- knowledge_tags: owner only
DROP POLICY IF EXISTS knowledge_tags_select ON public.knowledge_tags;
CREATE POLICY knowledge_tags_select ON public.knowledge_tags FOR SELECT
  USING (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS knowledge_tags_insert ON public.knowledge_tags;
CREATE POLICY knowledge_tags_insert ON public.knowledge_tags FOR INSERT
  WITH CHECK (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS knowledge_tags_update ON public.knowledge_tags;
CREATE POLICY knowledge_tags_update ON public.knowledge_tags FOR UPDATE
  USING (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS knowledge_tags_delete ON public.knowledge_tags;
CREATE POLICY knowledge_tags_delete ON public.knowledge_tags FOR DELETE
  USING (owner_profile_id = auth.uid());

-- knowledge_page_tags: allow if user can read/write the page (simplified: page owner)
DROP POLICY IF EXISTS knowledge_page_tags_select ON public.knowledge_page_tags;
CREATE POLICY knowledge_page_tags_select ON public.knowledge_page_tags FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_page_tags.page_id AND kp.owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS knowledge_page_tags_select_project ON public.knowledge_page_tags;
CREATE POLICY knowledge_page_tags_select_project ON public.knowledge_page_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.knowledge_pages kp
      JOIN public.knowledge_spaces ks ON ks.id = kp.space_id
      WHERE kp.id = knowledge_page_tags.page_id AND ks.project_id IS NOT NULL
        AND (EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = ks.project_id AND pm.user_id = auth.uid())
             OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin'))
    )
  );

DROP POLICY IF EXISTS knowledge_page_tags_insert ON public.knowledge_page_tags;
CREATE POLICY knowledge_page_tags_insert ON public.knowledge_page_tags FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_page_tags.page_id AND kp.owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS knowledge_page_tags_delete ON public.knowledge_page_tags;
CREATE POLICY knowledge_page_tags_delete ON public.knowledge_page_tags FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_page_tags.page_id AND kp.owner_profile_id = auth.uid())
  );

-- knowledge_page_links: allow if user can read/write from_page
DROP POLICY IF EXISTS knowledge_page_links_select ON public.knowledge_page_links;
CREATE POLICY knowledge_page_links_select ON public.knowledge_page_links FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_page_links.from_page_id AND kp.owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS knowledge_page_links_select_project ON public.knowledge_page_links;
CREATE POLICY knowledge_page_links_select_project ON public.knowledge_page_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.knowledge_pages kp
      JOIN public.knowledge_spaces ks ON ks.id = kp.space_id
      WHERE kp.id = knowledge_page_links.from_page_id AND ks.project_id IS NOT NULL
        AND (EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = ks.project_id AND pm.user_id = auth.uid())
             OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin'))
    )
  );

DROP POLICY IF EXISTS knowledge_page_links_insert ON public.knowledge_page_links;
CREATE POLICY knowledge_page_links_insert ON public.knowledge_page_links FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_page_links.from_page_id AND kp.owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS knowledge_page_links_delete ON public.knowledge_page_links;
CREATE POLICY knowledge_page_links_delete ON public.knowledge_page_links FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_page_links.from_page_id AND kp.owner_profile_id = auth.uid())
  );

-- knowledge_page_projects: allow if user owns the page
DROP POLICY IF EXISTS knowledge_page_projects_select ON public.knowledge_page_projects;
CREATE POLICY knowledge_page_projects_select ON public.knowledge_page_projects FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_page_projects.page_id AND kp.owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS knowledge_page_projects_select_project ON public.knowledge_page_projects;
CREATE POLICY knowledge_page_projects_select_project ON public.knowledge_page_projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = knowledge_page_projects.project_id AND pm.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin')
  );

DROP POLICY IF EXISTS knowledge_page_projects_insert ON public.knowledge_page_projects;
CREATE POLICY knowledge_page_projects_insert ON public.knowledge_page_projects FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_page_projects.page_id AND kp.owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS knowledge_page_projects_delete ON public.knowledge_page_projects;
CREATE POLICY knowledge_page_projects_delete ON public.knowledge_page_projects FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_page_projects.page_id AND kp.owner_profile_id = auth.uid())
  );

COMMENT ON TABLE public.knowledge_spaces IS 'Knowledge spaces (global or project-scoped).';
COMMENT ON TABLE public.knowledge_pages IS 'Structured knowledge pages with type and slug per space.';
COMMENT ON TABLE public.knowledge_blocks IS 'Block-based content (rich_text, checklist, code, etc.).';
