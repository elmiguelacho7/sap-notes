-- Phase 2 optimization: indexes for common queries (DATABASE_ARCHITECTURE_AUDIT.md).
-- Additive only; IF NOT EXISTS. Skip if table/column missing (e.g. projects/notes/tickets from starter).

-- project_members: "my projects" and membership lookups
CREATE INDEX IF NOT EXISTS idx_project_members_user_id
  ON public.project_members (user_id);

CREATE INDEX IF NOT EXISTS idx_project_members_user_id_project_id
  ON public.project_members (user_id, project_id);

-- project_tasks: dashboard open/overdue by project and status
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id_status
  ON public.project_tasks (project_id, status);

-- project_activities: overdue/upcoming by due_date
CREATE INDEX IF NOT EXISTS idx_project_activities_project_id_due_date
  ON public.project_activities (project_id, due_date)
  WHERE due_date IS NOT NULL;

-- projects.created_by: "owned projects" lookup (skip if column missing)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'created_by'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_projects_created_by
      ON public.projects (created_by);
  END IF;
END $$;

-- notes: listing by project and created_at (notes_today, list)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notes' AND column_name = 'project_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_notes_project_id_created_at
      ON public.notes (project_id, created_at DESC);
  END IF;
END $$;

-- tickets: open/closed by project and status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'project_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_tickets_project_id_status
      ON public.tickets (project_id, status);
  END IF;
END $$;

-- conversation_logs: already has idx_conversation_logs_user_created (user_id, created_at DESC) — no change
