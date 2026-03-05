-- Knowledge graph: view and indexes for page relationships.
-- Additive; does not modify existing CRUD.

-- Indexes for efficient lookups by from_page_id and to_page_id
CREATE INDEX IF NOT EXISTS knowledge_page_links_from_idx
  ON public.knowledge_page_links (from_page_id);

CREATE INDEX IF NOT EXISTS knowledge_page_links_to_idx
  ON public.knowledge_page_links (to_page_id);

-- Graph view: links with titles (excludes deleted pages)
DROP VIEW IF EXISTS public.knowledge_graph_view;
CREATE VIEW public.knowledge_graph_view AS
SELECT
  l.from_page_id,
  p1.title AS from_title,
  l.to_page_id,
  p2.title AS to_title,
  l.link_type
FROM public.knowledge_page_links l
JOIN public.knowledge_pages p1 ON p1.id = l.from_page_id
JOIN public.knowledge_pages p2 ON p2.id = l.to_page_id
WHERE p1.deleted_at IS NULL
  AND p2.deleted_at IS NULL;

COMMENT ON VIEW public.knowledge_graph_view IS 'Page links with titles for graph visualization. RLS on underlying tables applies.';
