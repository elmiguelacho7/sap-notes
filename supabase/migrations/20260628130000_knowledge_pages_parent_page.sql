-- Knowledge pages: add optional parent_page_id for future subpage support (nested pages).
-- No UI changes in this migration; structure only.

ALTER TABLE public.knowledge_pages
  ADD COLUMN IF NOT EXISTS parent_page_id uuid REFERENCES public.knowledge_pages (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_pages_parent_page_id
  ON public.knowledge_pages (parent_page_id)
  WHERE parent_page_id IS NOT NULL;

COMMENT ON COLUMN public.knowledge_pages.parent_page_id IS 'Optional parent page for subpages. NULL = top-level page in the space.';
