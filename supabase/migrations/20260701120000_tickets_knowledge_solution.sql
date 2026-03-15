-- Ticket system upgrade: solution fields, comments, references, link to knowledge.
-- Enables converting resolved tickets into knowledge pages and feeding Sapito.

-- =============================================================================
-- 1. Extend tickets table
-- =============================================================================

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS solution_markdown text,
  ADD COLUMN IF NOT EXISTS root_cause text,
  ADD COLUMN IF NOT EXISTS resolution_type text,
  ADD COLUMN IF NOT EXISTS knowledge_page_id uuid REFERENCES public.knowledge_pages (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.tickets.solution_markdown IS 'Structured solution in Markdown; used for AI memory and convert-to-knowledge.';
COMMENT ON COLUMN public.tickets.root_cause IS 'Root cause description.';
COMMENT ON COLUMN public.tickets.resolution_type IS 'Type of resolution (e.g. workaround, fix, configuration).';
COMMENT ON COLUMN public.tickets.knowledge_page_id IS 'Linked knowledge page after "Convert to Knowledge Page".';

-- =============================================================================
-- 2. ticket_comments (discussion thread)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON public.ticket_comments (ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON public.ticket_comments (created_at);

COMMENT ON TABLE public.ticket_comments IS 'Discussion comments on a ticket.';

ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

-- RLS: allow read/write if user can access the ticket (project member or global viewer).
DROP POLICY IF EXISTS ticket_comments_select ON public.ticket_comments;
CREATE POLICY ticket_comments_select ON public.ticket_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      LEFT JOIN public.project_members pm ON pm.project_id = t.project_id AND pm.profile_id = auth.uid()
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      WHERE t.id = ticket_comments.ticket_id
        AND (t.project_id IS NULL OR pm.project_id IS NOT NULL OR (p.app_role = 'superadmin'))
    )
  );

DROP POLICY IF EXISTS ticket_comments_insert ON public.ticket_comments;
CREATE POLICY ticket_comments_insert ON public.ticket_comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      LEFT JOIN public.project_members pm ON pm.project_id = t.project_id AND pm.profile_id = auth.uid()
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      WHERE t.id = ticket_comments.ticket_id
        AND (t.project_id IS NULL OR pm.project_id IS NOT NULL OR (p.app_role = 'superadmin'))
    )
  );

-- =============================================================================
-- 3. ticket_references (SAP notes, links, documents)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ticket_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets (id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('sap_note', 'link', 'document')),
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_references_ticket_id ON public.ticket_references (ticket_id);

COMMENT ON TABLE public.ticket_references IS 'References attached to a ticket (SAP note, link, document).';

ALTER TABLE public.ticket_references ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ticket_references_select ON public.ticket_references;
CREATE POLICY ticket_references_select ON public.ticket_references FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      LEFT JOIN public.project_members pm ON pm.project_id = t.project_id AND pm.profile_id = auth.uid()
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      WHERE t.id = ticket_references.ticket_id
        AND (t.project_id IS NULL OR pm.project_id IS NOT NULL OR (p.app_role = 'superadmin'))
    )
  );

DROP POLICY IF EXISTS ticket_references_insert ON public.ticket_references;
CREATE POLICY ticket_references_insert ON public.ticket_references FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets t
      LEFT JOIN public.project_members pm ON pm.project_id = t.project_id AND pm.profile_id = auth.uid()
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      WHERE t.id = ticket_references.ticket_id
        AND (t.project_id IS NULL OR pm.project_id IS NOT NULL OR (p.app_role = 'superadmin'))
    )
  );

DROP POLICY IF EXISTS ticket_references_delete ON public.ticket_references;
CREATE POLICY ticket_references_delete ON public.ticket_references FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      LEFT JOIN public.project_members pm ON pm.project_id = t.project_id AND pm.profile_id = auth.uid()
      LEFT JOIN public.profiles p ON p.id = auth.uid()
      WHERE t.id = ticket_references.ticket_id
        AND (t.project_id IS NULL OR pm.project_id IS NOT NULL OR (p.app_role = 'superadmin'))
    )
  );
