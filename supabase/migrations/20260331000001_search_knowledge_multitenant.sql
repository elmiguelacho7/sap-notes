-- Multi-tenant knowledge search: strict isolation by scope_type, project_id, user_id.
-- Security: never returns project docs for other projects or user docs for other users.

CREATE OR REPLACE FUNCTION public.search_knowledge_documents_multitenant(
  p_project_id uuid,
  p_user_id uuid,
  query_embedding vector(1536),
  match_limit int DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  title text,
  content text,
  source text,
  module text,
  source_name text,
  external_ref text,
  scope_type text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH allowed AS (
    SELECT
      kd.id,
      kd.title,
      kd.content,
      kd.source,
      kd.module,
      kd.source_name,
      kd.external_ref,
      kd.scope_type,
      kd.embedding,
      CASE kd.scope_type
        WHEN 'project' THEN 1
        WHEN 'user' THEN 2
        WHEN 'global' THEN 3
        ELSE 4
      END AS priority
    FROM public.knowledge_documents kd
    WHERE kd.embedding IS NOT NULL
      AND (
        (p_project_id IS NULL AND kd.scope_type = 'global')
        OR
        (p_project_id IS NOT NULL AND (
          kd.scope_type = 'global'
          OR (kd.scope_type = 'project' AND kd.project_id = p_project_id)
          OR (kd.scope_type = 'user' AND kd.user_id = p_user_id)
        ))
      )
  )
  SELECT
    a.id,
    a.title,
    a.content,
    a.source,
    a.module,
    a.source_name,
    a.external_ref,
    a.scope_type
  FROM allowed a
  ORDER BY a.priority ASC, a.embedding <=> query_embedding
  LIMIT LEAST(match_limit, 50);
$$;

COMMENT ON FUNCTION public.search_knowledge_documents_multitenant(uuid, uuid, vector(1536), int) IS
  'Multi-tenant semantic search: global always; with projectId also project and user scope. Priority: project > user > global. Never returns other projects or other users'' docs.';
