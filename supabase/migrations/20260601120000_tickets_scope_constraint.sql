-- Ticket scope: allow global (no project, no client), project-only, or client-only.
-- Invalid: both project_id and client_id set.
-- Replaces previous rule that required at least one of project_id or client_id.

-- Ensure tickets has client_id for client-scoped tickets (no-op if column exists)
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL;

-- Replace constraint: disallow both project and client set; allow any other combination
ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_client_or_project_chk;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_client_or_project_chk
  CHECK (NOT (project_id IS NOT NULL AND client_id IS NOT NULL));

COMMENT ON CONSTRAINT tickets_client_or_project_chk ON public.tickets IS
  'Ticket scope: global (both null), project-only, or client-only. Cannot have both project_id and client_id set.';
