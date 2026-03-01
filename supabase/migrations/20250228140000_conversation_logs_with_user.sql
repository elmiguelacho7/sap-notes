-- Conversation logs: per-user, per-project history for the LangChain project agent.
-- user_id = Supabase auth user id (from frontend). project_id NULL = global dashboard mode.
-- Made idempotent so it can be re-run safely if the table and indexes already exist.

CREATE TABLE IF NOT EXISTS public.conversation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('project', 'global')),
  user_message text NOT NULL,
  assistant_reply text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_logs_project_user_created
  ON public.conversation_logs (project_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_logs_user_created
  ON public.conversation_logs (user_id, created_at DESC);

COMMENT ON TABLE public.conversation_logs IS
  'Per-user, per-project conversation log for LangChain project agent. project_id NULL = global mode.';