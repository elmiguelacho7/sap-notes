-- SAP Knowledge Engine: pgvector extension and knowledge_documents table for semantic search.
-- Additive; does not modify existing tables.

-- 1) Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) knowledge_documents table (chunked technical documents with embeddings)
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  content text NOT NULL,
  source text,
  module text,
  created_at timestamptz NOT NULL DEFAULT now(),
  embedding vector(1536)
);

COMMENT ON TABLE public.knowledge_documents IS 'Chunked technical documents for Sapito semantic search; embedding from OpenAI text-embedding-3-small (1536 dims).';

-- 3) IVFFlat index for cosine similarity search (lists=1 valid for empty/small table; increase after bulk load)
CREATE INDEX IF NOT EXISTS knowledge_embedding_idx
  ON public.knowledge_documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 1);

-- 4) RPC for semantic search (used by lib/ai/knowledgeSearch.ts; service role bypasses RLS)
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
  ORDER BY kd.embedding <=> query_embedding
  LIMIT LEAST(match_limit, 20);
$$;

COMMENT ON FUNCTION public.search_knowledge_documents(vector(1536), int) IS 'Semantic similarity search over knowledge_documents. Returns top match_limit chunks by cosine similarity.';
