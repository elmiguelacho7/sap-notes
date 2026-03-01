-- Create conversation_logs table for persistent LangChain project agent logging.
-- project_id is nullable for global mode; mode is "project" or "global".

CREATE TABLE IF NOT EXISTS conversation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  mode text NOT NULL CHECK (mode IN ('project', 'global')),
  user_message text NOT NULL,
  assistant_reply text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for filtering by project and querying recent logs
CREATE INDEX IF NOT EXISTS idx_conversation_logs_project_id ON conversation_logs(project_id);

CREATE INDEX IF NOT EXISTS idx_conversation_logs_created_at_desc ON conversation_logs(created_at DESC);

COMMENT ON TABLE conversation_logs IS 'Persistent log of project agent conversations (LangChain). project_id NULL = global mode.';
