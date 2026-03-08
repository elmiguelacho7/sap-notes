-- Sync diagnostics for knowledge sources: persist last error and detail for admin UX.
-- Additive; does not drop or change existing columns.

ALTER TABLE public.knowledge_sources
  ADD COLUMN IF NOT EXISTS last_sync_error text,
  ADD COLUMN IF NOT EXISTS last_sync_status_detail text;

COMMENT ON COLUMN public.knowledge_sources.last_sync_error IS 'Last sync error message for display in Admin. Cleared on successful sync.';
COMMENT ON COLUMN public.knowledge_sources.last_sync_status_detail IS 'Short sync failure code for UI: no_content, js_required, zero_chunks, embed_failed, insert_failed, other.';
