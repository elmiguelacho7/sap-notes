-- SAP Project Memory: store and reuse solutions discovered during projects.
-- Sapito learns from ticket closures, project notes, and document additions.

CREATE TABLE IF NOT EXISTS public.project_knowledge_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,

  title text,
  problem text,
  solution text NOT NULL,
  module text,

  source_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  embedding vector(1536)
);

COMMENT ON TABLE public.project_knowledge_memory IS 'SAP solutions learned from project experience (tickets, notes, documents). Used by Sapito with priority over documents and global knowledge.';
COMMENT ON COLUMN public.project_knowledge_memory.source_type IS 'Origin: ticket_closed, project_note, document_added';
COMMENT ON COLUMN public.project_knowledge_memory.embedding IS 'OpenAI text-embedding-3-small (1536 dims) for semantic search.';

CREATE INDEX IF NOT EXISTS idx_project_knowledge_memory_project_user
  ON public.project_knowledge_memory (project_id, user_id)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_knowledge_memory_embedding
  ON public.project_knowledge_memory
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 1);

-- Semantic search over project memory (filter by project_id and optionally user_id).
CREATE OR REPLACE FUNCTION public.search_project_knowledge_memory(
  p_project_id uuid,
  p_user_id uuid,
  query_embedding vector(1536),
  match_limit int DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  title text,
  problem text,
  solution text,
  module text,
  source_type text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.title,
    m.problem,
    m.solution,
    m.module,
    m.source_type,
    m.created_at
  FROM public.project_knowledge_memory m
  WHERE m.project_id = p_project_id
    AND (p_user_id IS NULL OR m.user_id = p_user_id)
    AND m.embedding IS NOT NULL
  ORDER BY m.embedding <=> query_embedding
  LIMIT LEAST(match_limit, 20);
$$;

COMMENT ON FUNCTION public.search_project_knowledge_memory(uuid, uuid, vector(1536), int) IS
  'Semantic search over project_knowledge_memory for Sapito. Filtered by project and user; used before documents and global knowledge.';
