-- Ensure knowledge_pages supports Notion-like editor storage.
-- This is a safe, backward-compatible migration:
-- - Adds columns only if missing
-- - Does not rename/drop anything
-- - Triggers a PostgREST schema cache reload so new columns are visible immediately

ALTER TABLE public.knowledge_pages
  ADD COLUMN IF NOT EXISTS content_json jsonb,
  ADD COLUMN IF NOT EXISTS content_text text;

COMMENT ON COLUMN public.knowledge_pages.content_json IS 'Block editor document (e.g. BlockNote) as JSON.';
COMMENT ON COLUMN public.knowledge_pages.content_text IS 'Normalized plain text / markdown for search and indexing.';

-- Refresh PostgREST schema cache (Supabase API) so new columns are recognized.
NOTIFY pgrst, 'reload schema';

