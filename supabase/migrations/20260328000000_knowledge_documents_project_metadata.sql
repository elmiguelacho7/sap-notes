-- Add project and source metadata to knowledge_documents for project-scoped retrieval and grounding.
-- Additive; does not remove existing columns. Internal project knowledge is primary; external SAP sources are a future secondary layer.

ALTER TABLE public.knowledge_documents
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS external_ref text,
  ADD COLUMN IF NOT EXISTS chunk_index integer,
  ADD COLUMN IF NOT EXISTS mime_type text;

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_project_id
  ON public.knowledge_documents (project_id)
  WHERE project_id IS NOT NULL;

COMMENT ON COLUMN public.knowledge_documents.project_id IS 'Project this chunk belongs to; NULL for legacy/global chunks. Project knowledge is queried first.';
COMMENT ON COLUMN public.knowledge_documents.source_type IS 'e.g. google_drive_file, google_drive_folder';
COMMENT ON COLUMN public.knowledge_documents.external_ref IS 'e.g. Drive file ID for grounding';

-- Project-scoped semantic search: use for Sapito when answering in project context.
CREATE OR REPLACE FUNCTION public.search_project_knowledge_documents(
  p_project_id uuid,
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
  source_type text,
  source_url text,
  document_type text,
  topic text,
  sap_component text,
  mime_type text,
  chunk_index int
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
    kd.source_type,
    kd.source_url,
    kd.document_type,
    kd.topic,
    kd.sap_component,
    kd.mime_type,
    kd.chunk_index
  FROM public.knowledge_documents kd
  WHERE kd.project_id = p_project_id
    AND kd.embedding IS NOT NULL
  ORDER BY kd.embedding <=> query_embedding
  LIMIT LEAST(match_limit, 20);
$$;

COMMENT ON FUNCTION public.search_project_knowledge_documents(uuid, vector(1536), int) IS
  'Semantic search over project-scoped knowledge_documents. Use for Sapito project answers; external SAP sources are a future layer.';
