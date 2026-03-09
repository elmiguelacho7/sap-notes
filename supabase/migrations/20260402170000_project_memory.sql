-- Project memory: structured knowledge extracted from project notes (problems, solutions, decisions, etc.).
-- Used by automatic extraction on note create/update. Sapito can use this for project-history answers.

CREATE TABLE IF NOT EXISTS public.project_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  memory_type text NOT NULL,
  title text,
  summary text NOT NULL,
  source_type text NOT NULL,
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.project_memory IS 'Structured project knowledge extracted from notes: problem, solution, decision, workaround, lesson, configuration.';
COMMENT ON COLUMN public.project_memory.memory_type IS 'One of: problem, solution, decision, workaround, lesson, configuration';
COMMENT ON COLUMN public.project_memory.source_type IS 'Origin: project_note';
COMMENT ON COLUMN public.project_memory.source_id IS 'Reference to notes.id when source_type = project_note';

CREATE INDEX IF NOT EXISTS idx_project_memory_project_id ON public.project_memory (project_id);
CREATE INDEX IF NOT EXISTS idx_project_memory_source ON public.project_memory (source_type, source_id);
