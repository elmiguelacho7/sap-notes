-- Multi-tenant knowledge scope: scope_type, user_id, and strict isolation for Sapito.
-- scope_type: 'global' | 'project' | 'user'. Backfill from existing project_id.

-- 1) Add columns
ALTER TABLE public.knowledge_documents
  ADD COLUMN IF NOT EXISTS scope_type text,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

-- 2) Backfill scope_type from project_id (existing rows)
UPDATE public.knowledge_documents
SET scope_type = CASE
  WHEN project_id IS NOT NULL THEN 'project'
  ELSE 'global'
END
WHERE scope_type IS NULL;

-- 3) Default for future inserts (global when not specified)
ALTER TABLE public.knowledge_documents
  ALTER COLUMN scope_type SET DEFAULT 'global';

-- 4) Optional: ensure remaining NULLs are global (e.g. rows inserted between add and backfill)
UPDATE public.knowledge_documents SET scope_type = 'global' WHERE scope_type IS NULL;

COMMENT ON COLUMN public.knowledge_documents.scope_type IS 'Isolation scope: global (shared), project (project_id), user (user_id). Used for multi-tenant retrieval.';
COMMENT ON COLUMN public.knowledge_documents.user_id IS 'Owner for user-scoped documents; only this user can retrieve them.';

-- 5) Trigger: keep scope_type consistent with project_id / user_id
CREATE OR REPLACE FUNCTION public.knowledge_documents_scope_sync()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.project_id IS NOT NULL AND (NEW.scope_type IS NULL OR NEW.scope_type = 'global') THEN
    NEW.scope_type := 'project';
  ELSIF NEW.user_id IS NOT NULL AND (NEW.scope_type IS NULL OR NEW.scope_type = 'global') AND NEW.project_id IS NULL THEN
    NEW.scope_type := 'user';
  ELSIF NEW.scope_type IS NULL THEN
    NEW.scope_type := 'global';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS knowledge_documents_scope_sync_trigger ON public.knowledge_documents;
CREATE TRIGGER knowledge_documents_scope_sync_trigger
  BEFORE INSERT OR UPDATE OF project_id, user_id, scope_type
  ON public.knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.knowledge_documents_scope_sync();

-- 6) Index for multitenant filter
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_scope_type_project_user
  ON public.knowledge_documents (scope_type, project_id, user_id)
  WHERE embedding IS NOT NULL;
