-- Phase 1 hardening: document knowledge_documents and project_knowledge_memory access (DATABASE_ARCHITECTURE_AUDIT.md)
-- RLS is NOT enabled on these tables in this migration. Access is intentionally via:
-- - search_* RPCs (SECURITY INVOKER) that filter by project_id / user_id / scope_type
-- - App and ingest use service_role for writes and bulk reads
-- Enabling RLS would require policies that mirror RPC logic and careful testing; deferred to a later phase.
-- This migration only adds documentation.

COMMENT ON TABLE public.knowledge_documents IS
  'Chunked technical documents for Sapito semantic search; embedding from OpenAI text-embedding-3-small (1536 dims). Access: RPC-only (search_knowledge_documents, search_project_knowledge_documents, search_knowledge_documents_multitenant, search_official_sap_knowledge) and service_role for ingest. RLS not enabled by design; isolation enforced by RPC parameters (project_id, user_id, scope_type). Defense-in-depth RLS may be added in a future phase.';

COMMENT ON TABLE public.project_knowledge_memory IS
  'SAP solutions learned from project experience (tickets, notes, documents). Used by Sapito with priority over documents and global knowledge. Access: RPC search_project_knowledge_memory(project_id, user_id, ...) and service_role for writes. RLS not enabled; isolation by project_id/user_id in RPC and app. Defense-in-depth RLS may be added in a future phase.';
