-- Add content storage and searchable text for Notion-like document pages.
-- content_json: BlockNote (or other block editor) document JSON.
-- content_text: Normalized plain text / markdown for full-text search and future Sapito indexing.

ALTER TABLE public.knowledge_pages
  ADD COLUMN IF NOT EXISTS content_json jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS content_text text DEFAULT NULL;

COMMENT ON COLUMN public.knowledge_pages.content_json IS 'Block editor document (e.g. BlockNote) as JSON.';
COMMENT ON COLUMN public.knowledge_pages.content_text IS 'Normalized plain text / markdown for search and indexing.';

-- Include content_text in full-text search vector
CREATE OR REPLACE FUNCTION public.knowledge_pages_search_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.summary, '') || ' ' ||
    coalesce(NEW.content_text, '')
  );
  RETURN NEW;
END
$$;

-- Recompute search_vector for all rows (include content_text in formula)
UPDATE public.knowledge_pages
SET search_vector = to_tsvector('english',
  coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(content_text, '')
);
