-- Knowledge full-text search: tsvector, trigger, GIN index, view, and search RPC.
-- Additive; does not modify existing CRUD.

-- 1) Add search_vector column to knowledge_pages
ALTER TABLE public.knowledge_pages
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2) Backfill existing rows
UPDATE public.knowledge_pages
SET search_vector = to_tsvector('english',
  coalesce(title, '') || ' ' || coalesce(summary, '')
)
WHERE search_vector IS NULL;

-- 3) Trigger to keep search_vector updated
CREATE OR REPLACE FUNCTION public.knowledge_pages_search_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' || coalesce(NEW.summary, '')
  );
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS knowledge_pages_search_update ON public.knowledge_pages;
CREATE TRIGGER knowledge_pages_search_update
  BEFORE INSERT OR UPDATE
  ON public.knowledge_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.knowledge_pages_search_trigger();

-- 4) GIN index for full-text search
CREATE INDEX IF NOT EXISTS knowledge_pages_search_idx
  ON public.knowledge_pages
  USING GIN (search_vector);

-- 5) View (structure for future extension; rank is query-dependent, so view uses placeholder)
DROP VIEW IF EXISTS public.knowledge_search_view;
CREATE VIEW public.knowledge_search_view AS
SELECT
  id AS page_id,
  title,
  summary,
  page_type,
  space_id,
  ts_rank(search_vector, plainto_tsquery('english', '')) AS rank
FROM public.knowledge_pages;

-- 6) RPC for search (respects RLS via SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.search_knowledge(query text)
RETURNS TABLE(
  page_id uuid,
  title text,
  summary text,
  page_type text,
  space_id uuid,
  rank real
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    kp.id AS page_id,
    kp.title,
    kp.summary,
    kp.page_type,
    kp.space_id,
    ts_rank(kp.search_vector, plainto_tsquery('english', coalesce(trim(query), ''))) AS rank
  FROM public.knowledge_pages kp
  WHERE kp.deleted_at IS NULL
    AND kp.search_vector @@ plainto_tsquery('english', coalesce(trim(query), ''))
  ORDER BY rank DESC;
$$;

COMMENT ON FUNCTION public.search_knowledge(text) IS 'Full-text search over knowledge_pages (title, summary). RLS applies.';
