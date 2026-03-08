-- Restrict global knowledge search to global chunks only (project_id IS NULL).
-- General agent must retrieve only from global knowledge; project agent uses project + global.
-- Additive; only replaces the function.

CREATE OR REPLACE FUNCTION public.search_knowledge_documents(query_embedding vector(1536), match_limit int DEFAULT 5)
RETURNS TABLE(
  id uuid,
  title text,
  content text,
  source text,
  module text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    kd.id,
    kd.title,
    kd.content,
    kd.source,
    kd.module
  FROM public.knowledge_documents kd
  WHERE kd.embedding IS NOT NULL
    AND kd.project_id IS NULL
  ORDER BY kd.embedding <=> query_embedding
  LIMIT LEAST(match_limit, 20);
$$;

COMMENT ON FUNCTION public.search_knowledge_documents(vector(1536), int) IS
  'Semantic search over global knowledge_documents only (project_id IS NULL). For project-scoped retrieval use search_project_knowledge_documents. Never returns other projects'' data.';
