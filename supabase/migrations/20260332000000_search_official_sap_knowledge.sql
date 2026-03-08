-- Official SAP Knowledge Layer: semantic search over curated SAP docs only.
-- Chunks with document_type IN ('sap_help','sap_official') and scope_type = 'global'.
-- Used by getOfficialSapKnowledgeContext(); does not break multitenant retrieval.

CREATE OR REPLACE FUNCTION public.search_official_sap_knowledge(
  query_embedding vector(1536),
  match_limit int DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  title text,
  content text,
  source text,
  module text,
  source_name text,
  external_ref text,
  source_url text,
  document_type text
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
    kd.module,
    kd.source_name,
    kd.external_ref,
    kd.source_url,
    kd.document_type
  FROM public.knowledge_documents kd
  WHERE kd.embedding IS NOT NULL
    AND kd.scope_type = 'global'
    AND kd.project_id IS NULL
    AND kd.document_type IN ('sap_help', 'sap_official')
  ORDER BY kd.embedding <=> query_embedding
  LIMIT LEAST(match_limit, 20);
$$;

COMMENT ON FUNCTION public.search_official_sap_knowledge(vector(1536), int) IS
  'Semantic search over curated official SAP documentation only (sap_help/sap_official). Shared global layer for Sapito.';
