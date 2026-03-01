-- Knowledge base table for SAP documentation.
-- project_id NULL = global entry; user_id = Supabase auth user who created/owns the entry.

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  module text,
  scope_item text,
  topic_type text NOT NULL,
  source text NOT NULL,
  source_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_project_module_scope
  ON knowledge_entries (project_id, module, scope_item);

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_topic_module
  ON knowledge_entries (topic_type, module);

-- Trigger to auto-update updated_at on row update
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'knowledge_entries_updated_at'
  ) THEN
    CREATE TRIGGER knowledge_entries_updated_at
      BEFORE UPDATE ON knowledge_entries
      FOR EACH ROW
      EXECUTE PROCEDURE set_updated_at();
  END IF;
END;
$$;

COMMENT ON TABLE knowledge_entries IS 'SAP documentation knowledge base. project_id NULL = global entry.';
