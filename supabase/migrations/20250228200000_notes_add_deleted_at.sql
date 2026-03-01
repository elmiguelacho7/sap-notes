-- Soft delete for notes. Apply this migration in Supabase so DELETE /api/notes/[id] can soft-delete.
-- After applying, list/detail queries should filter with: WHERE deleted_at IS NULL.

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN notes.deleted_at IS 'Set on soft delete; exclude from lists with WHERE deleted_at IS NULL.';
