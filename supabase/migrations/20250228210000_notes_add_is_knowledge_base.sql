-- Add is_knowledge_base flag to notes for project Knowledge Base feature.
-- Notes with is_knowledge_base = true appear in the project's "Base de conocimiento" view.

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS is_knowledge_base boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN notes.is_knowledge_base IS 'When true, note is shown in project Knowledge Base.';
