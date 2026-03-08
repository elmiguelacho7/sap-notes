-- =============================================================================
-- SUPABASE PUBLIC SCHEMA (Structure only — no data)
-- =============================================================================
-- Generated from Supabase migrations in order. Use for schema audit.
-- Includes: tables, columns, primary keys, foreign keys, indexes, constraints,
--           triggers, functions, RLS policies.
-- INSERT/UPDATE statements (reference or backfill data) have been omitted.
-- =============================================================================

-- -------- Migration: 20250228120000_create_conversation_logs.sql --------

-- Create conversation_logs table for persistent LangChain project agent logging.
-- project_id is nullable for global mode; mode is "project" or "global".

CREATE TABLE IF NOT EXISTS conversation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  mode text NOT NULL CHECK (mode IN ('project', 'global')),
  user_message text NOT NULL,
  assistant_reply text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for filtering by project and querying recent logs
CREATE INDEX IF NOT EXISTS idx_conversation_logs_project_id ON conversation_logs(project_id);

CREATE INDEX IF NOT EXISTS idx_conversation_logs_created_at_desc ON conversation_logs(created_at DESC);

COMMENT ON TABLE conversation_logs IS 'Persistent log of project agent conversations (LangChain). project_id NULL = global mode.';


-- -------- Migration: 20250228140000_conversation_logs_with_user.sql --------

-- Conversation logs: per-user, per-project history for the LangChain project agent.
-- user_id = Supabase auth user id (from frontend). project_id NULL = global dashboard mode.
-- Made idempotent so it can be re-run safely if the table and indexes already exist.

CREATE TABLE IF NOT EXISTS public.conversation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('project', 'global')),
  user_message text NOT NULL,
  assistant_reply text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_logs_project_user_created
  ON public.conversation_logs (project_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_logs_user_created
  ON public.conversation_logs (user_id, created_at DESC);

COMMENT ON TABLE public.conversation_logs IS
  'Per-user, per-project conversation log for LangChain project agent. project_id NULL = global mode.';

-- -------- Migration: 20250228150000_create_knowledge_entries.sql --------

-- Knowledge base table for SAP documentation.
-- project_id NULL = global entry; user_id = Supabase auth user who created/owns the entry.

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  module text,
  scope_item text,
  topic_type text NOT NULL,
  source text NOT NULL,
  source_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_project_module_scope
  ON knowledge_entries (project_id, module, scope_item);

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_topic_module
  ON knowledge_entries (topic_type, module);

-- Trigger to auto-update updated_at on row update
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'knowledge_entries_updated_at'
  ) THEN
    CREATE TRIGGER knowledge_entries_updated_at
      BEFORE UPDATE ON knowledge_entries
      FOR EACH ROW
      EXECUTE PROCEDURE set_updated_at();
  END IF;
END;
$$;

COMMENT ON TABLE knowledge_entries IS 'SAP documentation knowledge base. project_id NULL = global entry.';


-- -------- Migration: 20250228200000_notes_add_deleted_at.sql --------

-- Soft delete for notes. Apply this migration in Supabase so DELETE /api/notes/[id] can soft-delete.
-- After applying, list/detail queries should filter with: WHERE deleted_at IS NULL.

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN notes.deleted_at IS 'Set on soft delete; exclude from lists with WHERE deleted_at IS NULL.';


-- -------- Migration: 20250228210000_notes_add_is_knowledge_base.sql --------

-- Add is_knowledge_base flag to notes for project Knowledge Base feature.
-- Notes with is_knowledge_base = true appear in the project's "Base de conocimiento" view.

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS is_knowledge_base boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN notes.is_knowledge_base IS 'When true, note is shown in project Knowledge Base.';


-- -------- Migration: 20250228220000_activate_phases_and_templates.sql --------

-- SAP Activate phases (reference data)
CREATE TABLE IF NOT EXISTS activate_phases (
  phase_key text PRIMARY KEY,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  duration_percent numeric(5,2) NOT NULL DEFAULT 0
);

COMMENT ON TABLE activate_phases IS 'SAP Activate methodology phases for project planning.';

-- [Reference data INSERT omitted: activate_phases seed]

-- Activity templates:
CREATE TABLE IF NOT EXISTS activity_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activate_phase_key text NOT NULL REFERENCES activate_phases(phase_key) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('task', 'milestone')),
  module text,
  default_duration_days int NOT NULL DEFAULT 1,
  offset_percent_in_phase numeric(5,2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_templates_phase ON activity_templates(activate_phase_key);
CREATE INDEX IF NOT EXISTS idx_activity_templates_active ON activity_templates(is_active) WHERE is_active = true;

-- Allow one template per (phase, name) for idempotent seed
CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_templates_phase_name ON activity_templates(activate_phase_key, name);

COMMENT ON TABLE activity_templates IS 'Templates for generating project activities from SAP Activate phases.';

-- [Reference data INSERT omitted: activity_templates seed]

-- -------- Migration: 20250228230000_projects_tasks_activate_fields.sql --------

-- Extend projects: planning dates and optional Activate fields
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS planned_end_date date,
  ADD COLUMN IF NOT EXISTS current_phase_key text REFERENCES public.activate_phases(phase_key) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS activate_template_type text;

COMMENT ON COLUMN public.projects.start_date IS 'Project start date for SAP Activate planning.';
COMMENT ON COLUMN public.projects.planned_end_date IS 'Planned project end date for phase scheduling.';
COMMENT ON COLUMN public.projects.current_phase_key IS 'Current SAP Activate phase (optional).';
COMMENT ON COLUMN public.projects.activate_template_type IS 'Template type e.g. Greenfield, Rollout (optional).';

-- Extend tasks (activities): link to Activate phase and planned dates
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS activate_phase_key text REFERENCES public.activate_phases(phase_key) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS planned_start_date date,
  ADD COLUMN IF NOT EXISTS planned_end_date date,
  ADD COLUMN IF NOT EXISTS is_template_generated boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tasks.activate_phase_key IS 'SAP Activate phase this task belongs to.';
COMMENT ON COLUMN public.tasks.planned_start_date IS 'Planned start date from project plan.';
COMMENT ON COLUMN public.tasks.planned_end_date IS 'Planned end date from project plan.';
COMMENT ON COLUMN public.tasks.is_template_generated IS 'True if created from activity_templates on project creation.';

CREATE INDEX IF NOT EXISTS idx_tasks_activate_phase
  ON public.tasks (activate_phase_key)
  WHERE activate_phase_key IS NOT NULL;

-- -------- Migration: 20250228240000_project_phases.sql --------

-- Per-project SAP Activate phases (names, order, dates).
-- Each project gets its own copy of default phases; they can be edited per project.

CREATE TABLE IF NOT EXISTS public.project_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_key text NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_phases_project_order
  ON public.project_phases (project_id, sort_order);

COMMENT ON TABLE public.project_phases IS
  'SAP Activate phases per project; editable names, order, and dates.';

-- Optional: trigger to refresh updated_at (reuse if set_updated_at exists, else create)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END
$$;

-- Ensure trigger exists but do not fail if it already existed before
DROP TRIGGER IF EXISTS project_phases_updated_at ON public.project_phases;

CREATE TRIGGER project_phases_updated_at
  BEFORE UPDATE ON public.project_phases
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

-- RLS: allow authenticated users to manage phases (app will restrict by project access)
ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;

-- Make policies idempotent: drop if they already exist, then recreate
DROP POLICY IF EXISTS project_phases_select ON public.project_phases;
DROP POLICY IF EXISTS project_phases_insert ON public.project_phases;
DROP POLICY IF EXISTS project_phases_update ON public.project_phases;
DROP POLICY IF EXISTS project_phases_delete ON public.project_phases;

CREATE POLICY project_phases_select
  ON public.project_phases
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY project_phases_insert
  ON public.project_phases
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY project_phases_update
  ON public.project_phases
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY project_phases_delete
  ON public.project_phases
  FOR DELETE
  TO authenticated
  USING (true);


-- -------- Migration: 20250301090000_tasks_phase_id.sql --------

-- Link tasks to project phases (optional): each task can belong to one project_phases row.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS phase_id uuid;

-- Add FK only if it does not already exist (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_phase_id_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_phase_id_fkey
      FOREIGN KEY (phase_id)
      REFERENCES public.project_phases (id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.tasks.phase_id IS 'Optional link to project_phases; task belongs to this phase.';


-- -------- Migration: 20250301110000_project_activities.sql --------

-- Project activities: structured activities per SAP Activate phase (phase, owner, status, priority, dates).

CREATE TABLE IF NOT EXISTS public.project_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  phase_id uuid NOT NULL REFERENCES public.project_phases (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  owner_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planned',
  priority text NOT NULL DEFAULT 'medium',
  start_date date,
  due_date date,
  progress_pct smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_activities_project_phase
  ON public.project_activities (project_id, phase_id);

COMMENT ON TABLE public.project_activities IS
  'Structured project activities per SAP Activate phase (planner workspace).';

-- Trigger to keep updated_at in sync (reuse set_updated_at from project_phases migration)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS set_project_activities_updated_at ON public.project_activities;

CREATE TRIGGER set_project_activities_updated_at
  BEFORE UPDATE ON public.project_activities
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

-- RLS: allow service_role and project members (project_members.user_id = auth.uid())
ALTER TABLE public.project_activities ENABLE ROW LEVEL SECURITY;

-- Make policies idempotent: drop if they already exist
DROP POLICY IF EXISTS "Allow select project activities for members" ON public.project_activities;
DROP POLICY IF EXISTS "Allow insert project activities for members" ON public.project_activities;
DROP POLICY IF EXISTS "Allow update project activities for members" ON public.project_activities;
DROP POLICY IF EXISTS "Allow delete project activities for members" ON public.project_activities;

CREATE POLICY "Allow select project activities for members"
  ON public.project_activities
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = project_activities.project_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow insert project activities for members"
  ON public.project_activities
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = project_activities.project_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow update project activities for members"
  ON public.project_activities
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = project_activities.project_id
        AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = project_activities.project_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow delete project activities for members"
  ON public.project_activities
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = project_activities.project_id
        AND pm.user_id = auth.uid()
    )
  );


-- -------- Migration: 20250301113000_update_project_activities_policies.sql --------

-- 1) AÃ±adir columna profile_id si no existe
ALTER TABLE public.project_members
ADD COLUMN IF NOT EXISTS profile_id uuid;

-- 2) Rellenar profile_id buscando el perfil correspondiente
-- Suponemos que public.profiles.id = auth user id y coincide con project_members.user_id
UPDATE public.project_members pm
SET profile_id = p.id
FROM public.profiles p
WHERE p.id = pm.user_id
  AND pm.profile_id IS NULL;

-- 3) Crear la foreign key si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_members_profile_id_fkey'
      AND conrelid = 'public.project_members'::regclass
  ) THEN
    ALTER TABLE public.project_members
    ADD CONSTRAINT project_members_profile_id_fkey
    FOREIGN KEY (profile_id)
    REFERENCES public.profiles (id)
    ON DELETE CASCADE;
  END IF;
END;
$$;


-- -------- Migration: 20250301120000_project_members_add_profile_id.sql --------

-- Add profile_id to project_members and backfill from profiles.id.
-- Keeps user_id; profile_id is the new domain-level link for RLS and app logic.

-- 1) Add profile_id column if it does not exist
ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS profile_id uuid;

-- 2) Backfill profile_id using profiles.id = project_members.user_id
UPDATE public.project_members pm
SET profile_id = p.id
FROM public.profiles p
WHERE p.id = pm.user_id
  AND pm.profile_id IS NULL;

-- 3) Add foreign key constraint to profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_members_profile_id_fkey'
      AND conrelid = 'public.project_members'::regclass
  ) THEN
    ALTER TABLE public.project_members
      ADD CONSTRAINT project_members_profile_id_fkey
      FOREIGN KEY (profile_id)
      REFERENCES public.profiles (id)
      ON DELETE CASCADE;
  END IF;
END
$$;

COMMENT ON COLUMN public.project_members.profile_id IS
  'FK to profiles.id; backfilled from profiles.id matching project_members.user_id.';

-- 4) (Optional, only if all rows are backfilled) you could enforce NOT NULL later:
-- ALTER TABLE public.project_members
-- ALTER COLUMN profile_id SET NOT NULL;


-- -------- Migration: 20250301140000_project_tasks.sql --------

-- Project tasks: tasks belonging to a project, optionally linked to an activity (project_activities).

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.project_activities (id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'medium',
  assignee_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  start_date date,
  due_date date,
  progress_pct smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON public.project_tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_activity_id ON public.project_tasks (activity_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_due_date ON public.project_tasks (due_date);

COMMENT ON TABLE public.project_tasks IS
  'Tasks at project level; optionally linked to a project_activity.';

DROP TRIGGER IF EXISTS set_project_tasks_updated_at ON public.project_tasks;
CREATE TRIGGER set_project_tasks_updated_at
  BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow insert project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow update project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow delete project tasks for members" ON public.project_tasks;

CREATE POLICY "Allow select project tasks for members"
  ON public.project_tasks FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_tasks.project_id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow insert project tasks for members"
  ON public.project_tasks FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_tasks.project_id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow update project tasks for members"
  ON public.project_tasks FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_tasks.project_id AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_tasks.project_id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow delete project tasks for members"
  ON public.project_tasks FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_tasks.project_id AND pm.user_id = auth.uid()
    )
  );


-- -------- Migration: 20250302120000_recalculate_activity_progress.sql --------

-- Automatic calculation of project_activities.progress_pct from project_tasks.
-- When a task is inserted, updated (status or activity_id), or deleted,
-- the linked activity's progress_pct is recalculated as:
--   (tasks with status = 'done') / (total tasks for that activity) * 100

CREATE OR REPLACE FUNCTION public.recalculate_activity_progress(activity_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_tasks bigint;
  done_tasks bigint;
  new_pct smallint;
BEGIN
  IF activity_uuid IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
    INTO total_tasks
    FROM public.project_tasks
   WHERE activity_id = activity_uuid;

  IF total_tasks = 0 THEN
    new_pct := 0;
  ELSE
    SELECT COUNT(*)
      INTO done_tasks
      FROM public.project_tasks
     WHERE activity_id = activity_uuid
       AND LOWER(TRIM(status)) = 'done';

    new_pct := (ROUND((done_tasks::numeric / total_tasks::numeric) * 100))::smallint;
    new_pct := LEAST(100, GREATEST(0, new_pct));
  END IF;

  UPDATE public.project_activities
     SET progress_pct = new_pct
   WHERE id = activity_uuid;
END;
$$;

COMMENT ON FUNCTION public.recalculate_activity_progress(uuid) IS
  'Recalculates project_activities.progress_pct from project_tasks (done count / total count * 100).';

-- Trigger function: run recalculate for affected activity/activities
CREATE OR REPLACE FUNCTION public.trg_recalculate_activity_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.activity_id IS NOT NULL THEN
      PERFORM recalculate_activity_progress(NEW.activity_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.activity_id IS NOT NULL THEN
      PERFORM recalculate_activity_progress(OLD.activity_id);
    END IF;
    IF NEW.activity_id IS NOT NULL THEN
      PERFORM recalculate_activity_progress(NEW.activity_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.activity_id IS NOT NULL THEN
      PERFORM recalculate_activity_progress(OLD.activity_id);
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.trg_recalculate_activity_progress() IS
  'Trigger: after project_tasks INSERT/UPDATE/DELETE, recalc project_activities.progress_pct.';

DROP TRIGGER IF EXISTS recalculate_activity_progress_on_project_tasks ON public.project_tasks;
DROP TRIGGER IF EXISTS recalculate_activity_progress_on_project_tasks_ins ON public.project_tasks;
DROP TRIGGER IF EXISTS recalculate_activity_progress_on_project_tasks_upd ON public.project_tasks;
DROP TRIGGER IF EXISTS recalculate_activity_progress_on_project_tasks_del ON public.project_tasks;

CREATE TRIGGER recalculate_activity_progress_on_project_tasks_ins
  AFTER INSERT ON public.project_tasks
  FOR EACH ROW
  WHEN (NEW.activity_id IS NOT NULL)
  EXECUTE PROCEDURE public.trg_recalculate_activity_progress();

CREATE TRIGGER recalculate_activity_progress_on_project_tasks_upd
  AFTER UPDATE OF status, activity_id ON public.project_tasks
  FOR EACH ROW
  WHEN (
    (OLD.activity_id IS NOT NULL OR NEW.activity_id IS NOT NULL)
    AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.activity_id IS DISTINCT FROM NEW.activity_id)
  )
  EXECUTE PROCEDURE public.trg_recalculate_activity_progress();

CREATE TRIGGER recalculate_activity_progress_on_project_tasks_del
  AFTER DELETE ON public.project_tasks
  FOR EACH ROW
  WHEN (OLD.activity_id IS NOT NULL)
  EXECUTE PROCEDURE public.trg_recalculate_activity_progress();


-- -------- Migration: 20250302130000_optimize_activity_progress_trigger.sql --------

-- Optimize activity progress trigger: recalculate only when status or activity_id actually change.
-- Add indexes for recalculate_activity_progress() lookups (idempotent).

-- 1) Indexes for performance (recalculate_activity_progress counts by activity_id and status)
CREATE INDEX IF NOT EXISTS idx_project_tasks_activity_id ON public.project_tasks (activity_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_activity_id_status ON public.project_tasks (activity_id, status);

-- 2) Trigger function: on UPDATE, only recalc when status or activity_id changed
CREATE OR REPLACE FUNCTION public.trg_recalculate_activity_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.activity_id IS NOT NULL THEN
      PERFORM recalculate_activity_progress(NEW.activity_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only recalculate when something that affects progress actually changed
    IF OLD.status IS DISTINCT FROM NEW.status OR OLD.activity_id IS DISTINCT FROM NEW.activity_id THEN
      IF OLD.activity_id IS DISTINCT FROM NEW.activity_id THEN
        -- Activity changed: recalc both old and new activity
        IF OLD.activity_id IS NOT NULL THEN
          PERFORM recalculate_activity_progress(OLD.activity_id);
        END IF;
        IF NEW.activity_id IS NOT NULL THEN
          PERFORM recalculate_activity_progress(NEW.activity_id);
        END IF;
      ELSE
        -- Same activity, status changed
        IF NEW.activity_id IS NOT NULL THEN
          PERFORM recalculate_activity_progress(NEW.activity_id);
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.activity_id IS NOT NULL THEN
      PERFORM recalculate_activity_progress(OLD.activity_id);
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.trg_recalculate_activity_progress() IS
  'Trigger: after project_tasks INSERT/UPDATE/DELETE, recalc project_activities.progress_pct. On UPDATE only runs when status or activity_id changed.';

DROP TRIGGER IF EXISTS recalculate_activity_progress_on_project_tasks ON public.project_tasks;
DROP TRIGGER IF EXISTS recalculate_activity_progress_on_project_tasks_ins ON public.project_tasks;
DROP TRIGGER IF EXISTS recalculate_activity_progress_on_project_tasks_upd ON public.project_tasks;
DROP TRIGGER IF EXISTS recalculate_activity_progress_on_project_tasks_del ON public.project_tasks;

CREATE TRIGGER recalculate_activity_progress_on_project_tasks_ins
  AFTER INSERT ON public.project_tasks
  FOR EACH ROW
  WHEN (NEW.activity_id IS NOT NULL)
  EXECUTE PROCEDURE public.trg_recalculate_activity_progress();

CREATE TRIGGER recalculate_activity_progress_on_project_tasks_upd
  AFTER UPDATE OF status, activity_id ON public.project_tasks
  FOR EACH ROW
  WHEN (
    (OLD.activity_id IS NOT NULL OR NEW.activity_id IS NOT NULL)
    AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.activity_id IS DISTINCT FROM NEW.activity_id)
  )
  EXECUTE PROCEDURE public.trg_recalculate_activity_progress();

CREATE TRIGGER recalculate_activity_progress_on_project_tasks_del
  AFTER DELETE ON public.project_tasks
  FOR EACH ROW
  WHEN (OLD.activity_id IS NOT NULL)
  EXECUTE PROCEDURE public.trg_recalculate_activity_progress();


-- -------- Migration: 20250302140000_activity_risk_metrics_view.sql --------

CREATE OR REPLACE VIEW public.activity_risk_metrics AS
WITH metrics AS (
  SELECT
    pt.activity_id,
    COUNT(*)::integer AS total_tasks,
    (COUNT(*) FILTER (WHERE LOWER(TRIM(pt.status)) = 'done'))::integer AS done_tasks,
    (COUNT(*) FILTER (
      WHERE pt.due_date IS NOT NULL
        AND pt.due_date < current_date
        AND LOWER(TRIM(pt.status)) <> 'done'
    ))::integer AS overdue_tasks,
    (COUNT(*) FILTER (WHERE LOWER(TRIM(pt.status)) = 'blocked'))::integer AS blocked_tasks
  FROM public.project_tasks pt
  WHERE pt.activity_id IS NOT NULL
  GROUP BY pt.activity_id
),
derived AS (
  SELECT
    activity_id,
    total_tasks,
    done_tasks,
    (total_tasks - done_tasks)::integer AS open_tasks,
    overdue_tasks,
    blocked_tasks,
    COALESCE(
      ROUND(
        (overdue_tasks::numeric / NULLIF((total_tasks - done_tasks)::numeric, 0)) * 100
      )::integer,
      0
    ) AS overdue_pct
  FROM metrics
)
SELECT
  activity_id,
  total_tasks,
  done_tasks,
  open_tasks,
  overdue_tasks,
  blocked_tasks,
  overdue_pct,
  CASE
    WHEN blocked_tasks > 0 OR overdue_pct >= 30 THEN 'HIGH'
    WHEN overdue_pct >= 10 THEN 'MEDIUM'
    ELSE 'LOW'
  END AS risk_level
FROM derived;

COMMENT ON VIEW public.activity_risk_metrics IS
  'Per-activity risk metrics from project_tasks: total/done/open/overdue/blocked counts, overdue_pct, risk_level (HIGH/MEDIUM/LOW).';


-- -------- Migration: 20250303120000_normalize_projects_schema.sql --------

-- Normalize projects table: controlled values for status and environment_type.
-- Fixes: projects_status_check violation and ensures environment_type consistency.

-- 1) Set default for status (so new rows get 'planned' if not provided)
ALTER TABLE public.projects
  ALTER COLUMN status SET DEFAULT 'planned';

-- 2) Backfill invalid or null status to allowed value
UPDATE public.projects
SET status = 'planned'
WHERE status IS NULL
   OR status NOT IN ('planned', 'in_progress', 'completed', 'archived');

-- 3) Enforce status check constraint (drop if exists to avoid conflict, then add)
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('planned', 'in_progress', 'completed', 'archived'));

-- 4) Backfill invalid or null environment_type to allowed value
UPDATE public.projects
SET environment_type = 'cloud_public'
WHERE environment_type IS NULL
   OR environment_type NOT IN ('cloud_public', 'on_premise');

-- 5) Enforce environment_type check constraint (drop if exists, then add)
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_environment_type_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_environment_type_check
  CHECK (environment_type IN ('cloud_public', 'on_premise'));

-- 6) Optional: set default for environment_type so new rows get a valid value
ALTER TABLE public.projects
  ALTER COLUMN environment_type SET DEFAULT 'cloud_public';

COMMENT ON CONSTRAINT projects_status_check ON public.projects IS
  'Allowed: planned, in_progress, completed, archived';
COMMENT ON CONSTRAINT projects_environment_type_check ON public.projects IS
  'Allowed: cloud_public, on_premise';


-- -------- Migration: 20250303140000_activate_plan_templates.sql --------

-- SAP Activate plan generator: template tables and seed data.
-- These tables are read-only reference data; the generator copies from them into project_phases, project_activities, project_tasks.

-- 1) Phase templates (keys must match usage: discover, prepare, explore, realize, deploy, run)
CREATE TABLE IF NOT EXISTS public.activate_phase_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_key text UNIQUE NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL
);

COMMENT ON TABLE public.activate_phase_templates IS 'Templates for project_phases; phase_key is NOT NULL in project_phases.';

-- 2) Activity templates (one per phase_key; project_activities uses name, description, status, priority, start_date, due_date; no risk column)
CREATE TABLE IF NOT EXISTS public.activate_activity_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_key text NOT NULL REFERENCES public.activate_phase_templates(phase_key) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order int NOT NULL,
  default_risk text CHECK (default_risk IS NULL OR default_risk IN ('LOW', 'MEDIUM', 'HIGH')),
  default_status text
);

CREATE INDEX IF NOT EXISTS idx_activate_activity_templates_phase ON public.activate_activity_templates(phase_key, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS idx_activate_activity_templates_phase_name ON public.activate_activity_templates(phase_key, name);

COMMENT ON TABLE public.activate_activity_templates IS 'Templates for project_activities; project_activities has name, not title.';

-- 3) Task templates (project_tasks uses title NOT NULL, description, status, priority, due_date)
CREATE TABLE IF NOT EXISTS public.activate_task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_template_id uuid NOT NULL REFERENCES public.activate_activity_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order int NOT NULL,
  offset_days int
);

CREATE INDEX IF NOT EXISTS idx_activate_task_templates_activity ON public.activate_task_templates(activity_template_id, sort_order);

COMMENT ON TABLE public.activate_task_templates IS 'Templates for project_tasks; project_tasks uses title column.';

-- RLS: allow read for authenticated (generator runs server-side with service role)
ALTER TABLE public.activate_phase_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activate_activity_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activate_task_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activate_phase_templates_select ON public.activate_phase_templates;
CREATE POLICY activate_phase_templates_select ON public.activate_phase_templates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS activate_activity_templates_select ON public.activate_activity_templates;
CREATE POLICY activate_activity_templates_select ON public.activate_activity_templates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS activate_task_templates_select ON public.activate_task_templates;
CREATE POLICY activate_task_templates_select ON public.activate_task_templates FOR SELECT TO authenticated USING (true);

-- ========== SEED: 6 phases, ~6 activities per phase, 2â€“4 tasks per activity (Spanish names, ASCII keys) ==========

INSERT INTO public.activate_phase_templates (phase_key, name, sort_order) VALUES
  ('discover', 'Discover', 1),
  ('prepare', 'Prepare', 2),
  ('explore', 'Explore', 3),
  ('realize', 'Realize', 4),
  ('deploy', 'Deploy', 5),
  ('run', 'Run', 6)
ON CONFLICT (phase_key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

-- Seed activities per phase (we need activity_template ids for task templates; use a DO block to get stable ids)
DO $$
DECLARE
  pid_disc uuid; pid_prep uuid; pid_expl uuid; pid_real uuid; pid_dep uuid; pid_run uuid;
  aid uuid;
  act_rec RECORD;
BEGIN
  FOR act_rec IN SELECT id, phase_key FROM public.activate_phase_templates ORDER BY sort_order
  LOOP
    IF act_rec.phase_key = 'discover' THEN pid_disc := act_rec.id;
    ELSIF act_rec.phase_key = 'prepare' THEN pid_prep := act_rec.id;
    ELSIF act_rec.phase_key = 'explore' THEN pid_expl := act_rec.id;
    ELSIF act_rec.phase_key = 'realize' THEN pid_real := act_rec.id;
    ELSIF act_rec.phase_key = 'deploy' THEN pid_dep := act_rec.id;
    ELSIF act_rec.phase_key = 'run' THEN pid_run := act_rec.id;
    END IF;
  END LOOP;

  INSERT INTO public.activate_activity_templates (phase_key, name, description, sort_order, default_status) VALUES
    ('discover', 'Kick-off y alineaciÃ³n', 'ReuniÃ³n inicial y alineaciÃ³n con stakeholders', 1, 'planned'),
    ('discover', 'AnÃ¡lisis de brechas inicial', 'AnÃ¡lisis de brechas y requisitos iniciales', 2, 'planned'),
    ('discover', 'EvaluaciÃ³n de entorno', 'EvaluaciÃ³n del entorno SAP actual', 3, 'planned'),
    ('discover', 'DefiniciÃ³n de alcance', 'DefiniciÃ³n y acuerdo del alcance', 4, 'planned'),
    ('discover', 'Plan del proyecto', 'ElaboraciÃ³n del plan del proyecto', 5, 'planned'),
    ('discover', 'Cierre Discover', 'RevisiÃ³n y cierre de fase Discover', 6, 'planned'),
    ('prepare', 'PreparaciÃ³n del entorno', 'PreparaciÃ³n y configuraciÃ³n del entorno', 1, 'planned'),
    ('prepare', 'DiseÃ±o de soluciÃ³n (borrador)', 'DiseÃ±o inicial de la soluciÃ³n', 2, 'planned'),
    ('prepare', 'ConfiguraciÃ³n base', 'ConfiguraciÃ³n base del sistema', 3, 'planned'),
    ('prepare', 'MigraciÃ³n de datos (diseÃ±o)', 'DiseÃ±o de la migraciÃ³n de datos', 4, 'planned'),
    ('prepare', 'IntegraciÃ³n (diseÃ±o)', 'DiseÃ±o de integraciones', 5, 'planned'),
    ('prepare', 'Cierre Prepare', 'RevisiÃ³n y cierre de fase Prepare', 6, 'planned'),
    ('explore', 'Prototipos por mÃ³dulo', 'Desarrollo de prototipos por mÃ³dulo', 1, 'planned'),
    ('explore', 'ValidaciÃ³n con negocio', 'ValidaciÃ³n con usuarios de negocio', 2, 'planned'),
    ('explore', 'Ajustes de diseÃ±o', 'Ajustes segÃºn feedback', 3, 'planned'),
    ('explore', 'Pruebas exploratorias', 'Pruebas exploratorias tempranas', 4, 'planned'),
    ('explore', 'DocumentaciÃ³n Explore', 'DocumentaciÃ³n de la fase Explore', 5, 'planned'),
    ('explore', 'Cierre Explore', 'RevisiÃ³n y cierre de fase Explore', 6, 'planned'),
    ('realize', 'Desarrollo y configuraciÃ³n', 'Desarrollo y configuraciÃ³n detallada', 1, 'planned'),
    ('realize', 'Pruebas unitarias', 'Pruebas unitarias e integraciÃ³n', 2, 'planned'),
    ('realize', 'UAT', 'Pruebas de aceptaciÃ³n de usuario', 3, 'planned'),
    ('realize', 'MigraciÃ³n de datos (ejecuciÃ³n)', 'EjecuciÃ³n de migraciÃ³n de datos', 4, 'planned'),
    ('realize', 'DocumentaciÃ³n tÃ©cnica', 'DocumentaciÃ³n tÃ©cnica y funcional', 5, 'planned'),
    ('realize', 'Cierre Realize', 'RevisiÃ³n y cierre de fase Realize', 6, 'planned'),
    ('deploy', 'PreparaciÃ³n cutover', 'PreparaciÃ³n para cutover', 1, 'planned'),
    ('deploy', 'Cutover y go-live', 'Cutover y puesta en producciÃ³n', 2, 'planned'),
    ('deploy', 'Hipercare inicial', 'Hipercare post go-live', 3, 'planned'),
    ('deploy', 'Transferencia a soporte', 'Transferencia al equipo de soporte', 4, 'planned'),
    ('deploy', 'Cierre Deploy', 'RevisiÃ³n y cierre de fase Deploy', 5, 'planned'),
    ('run', 'EstabilizaciÃ³n', 'EstabilizaciÃ³n del sistema', 1, 'planned'),
    ('run', 'OptimizaciÃ³n', 'OptimizaciÃ³n y mejoras', 2, 'planned'),
    ('run', 'Cierre del proyecto', 'Cierre formal del proyecto', 3, 'planned')
  ON CONFLICT (phase_key, name) DO NOTHING;
END $$;

-- Seed task templates (2â€“4 tasks per activity); reference activity_templates by (phase_key, name)
-- Use upsert by (activity_template_id, sort_order) to avoid duplicates on re-run (no unique on task name)
INSERT INTO public.activate_task_templates (activity_template_id, name, description, sort_order, offset_days)
SELECT at.id, t.task_name, NULL::text, t.sort_order, t.offset_days
FROM (VALUES
  ('discover', 'Kick-off y alineaciÃ³n', 'Preparar agenda y materiales', 1, 0),
  ('discover', 'Kick-off y alineaciÃ³n', 'Ejecutar reuniÃ³n kick-off', 2, 1),
  ('discover', 'Kick-off y alineaciÃ³n', 'Documentar acuerdos', 3, 2),
  ('discover', 'AnÃ¡lisis de brechas inicial', 'Recopilar requisitos', 1, 0),
  ('discover', 'AnÃ¡lisis de brechas inicial', 'AnÃ¡lisis de brechas', 2, 3),
  ('discover', 'AnÃ¡lisis de brechas inicial', 'Informe de brechas', 3, 5),
  ('discover', 'EvaluaciÃ³n de entorno', 'Inventario de sistemas', 1, 0),
  ('discover', 'EvaluaciÃ³n de entorno', 'EvaluaciÃ³n tÃ©cnica', 2, 2),
  ('discover', 'DefiniciÃ³n de alcance', 'Workshop alcance', 1, 0),
  ('discover', 'DefiniciÃ³n de alcance', 'Documento de alcance', 2, 2),
  ('discover', 'Plan del proyecto', 'Cronograma inicial', 1, 0),
  ('discover', 'Plan del proyecto', 'Plan de recursos', 2, 1),
  ('discover', 'Plan del proyecto', 'AprobaciÃ³n del plan', 3, 3),
  ('discover', 'Cierre Discover', 'RevisiÃ³n de entregables', 1, 0),
  ('discover', 'Cierre Discover', 'Gate approval', 2, 1),
  ('prepare', 'PreparaciÃ³n del entorno', 'Solicitud de entornos', 1, 0),
  ('prepare', 'PreparaciÃ³n del entorno', 'ConfiguraciÃ³n inicial', 2, 5),
  ('prepare', 'PreparaciÃ³n del entorno', 'ValidaciÃ³n de entornos', 3, 10),
  ('prepare', 'DiseÃ±o de soluciÃ³n (borrador)', 'DiseÃ±o por mÃ³dulo', 1, 0),
  ('prepare', 'DiseÃ±o de soluciÃ³n (borrador)', 'RevisiÃ³n de diseÃ±o', 2, 7),
  ('prepare', 'DiseÃ±o de soluciÃ³n (borrador)', 'AprobaciÃ³n de diseÃ±o', 3, 14),
  ('prepare', 'ConfiguraciÃ³n base', 'ConfiguraciÃ³n global', 1, 0),
  ('prepare', 'ConfiguraciÃ³n base', 'ConfiguraciÃ³n por Ã¡rea', 2, 5),
  ('prepare', 'MigraciÃ³n de datos (diseÃ±o)', 'EspecificaciÃ³n de migraciÃ³n', 1, 0),
  ('prepare', 'MigraciÃ³n de datos (diseÃ±o)', 'DiseÃ±o de extracciÃ³n', 2, 3),
  ('prepare', 'IntegraciÃ³n (diseÃ±o)', 'Mapa de integraciones', 1, 0),
  ('prepare', 'IntegraciÃ³n (diseÃ±o)', 'EspecificaciÃ³n de interfaces', 2, 5),
  ('prepare', 'Cierre Prepare', 'RevisiÃ³n Prepare', 1, 0),
  ('prepare', 'Cierre Prepare', 'Gate approval', 2, 1),
  ('explore', 'Prototipos por mÃ³dulo', 'Prototipo mÃ³dulo 1', 1, 0),
  ('explore', 'Prototipos por mÃ³dulo', 'Prototipo mÃ³dulo 2', 2, 5),
  ('explore', 'Prototipos por mÃ³dulo', 'IntegraciÃ³n de prototipos', 3, 10),
  ('explore', 'ValidaciÃ³n con negocio', 'Sesiones de validaciÃ³n', 1, 0),
  ('explore', 'ValidaciÃ³n con negocio', 'Registro de feedback', 2, 3),
  ('explore', 'Ajustes de diseÃ±o', 'Ajustes de configuraciÃ³n', 1, 0),
  ('explore', 'Ajustes de diseÃ±o', 'RevalidaciÃ³n', 2, 5),
  ('explore', 'Pruebas exploratorias', 'EjecuciÃ³n de pruebas', 1, 0),
  ('explore', 'Pruebas exploratorias', 'Informe de pruebas', 2, 5),
  ('explore', 'DocumentaciÃ³n Explore', 'DocumentaciÃ³n funcional', 1, 0),
  ('explore', 'Cierre Explore', 'RevisiÃ³n Explore', 1, 0),
  ('explore', 'Cierre Explore', 'Gate approval', 2, 1),
  ('realize', 'Desarrollo y configuraciÃ³n', 'ConfiguraciÃ³n detallada', 1, 0),
  ('realize', 'Desarrollo y configuraciÃ³n', 'Desarrollo de objetos', 2, 15),
  ('realize', 'Desarrollo y configuraciÃ³n', 'RevisiÃ³n de cÃ³digo', 3, 25),
  ('realize', 'Pruebas unitarias', 'Casos de prueba', 1, 0),
  ('realize', 'Pruebas unitarias', 'EjecuciÃ³n pruebas unitarias', 2, 10),
  ('realize', 'Pruebas unitarias', 'Pruebas de integraciÃ³n', 3, 20),
  ('realize', 'UAT', 'PreparaciÃ³n UAT', 1, 0),
  ('realize', 'UAT', 'EjecuciÃ³n UAT', 2, 5),
  ('realize', 'UAT', 'Cierre de defectos', 3, 15),
  ('realize', 'MigraciÃ³n de datos (ejecuciÃ³n)', 'ExtracciÃ³n', 1, 0),
  ('realize', 'MigraciÃ³n de datos (ejecuciÃ³n)', 'Carga y validaciÃ³n', 2, 5),
  ('realize', 'DocumentaciÃ³n tÃ©cnica', 'Manuales de usuario', 1, 0),
  ('realize', 'DocumentaciÃ³n tÃ©cnica', 'DocumentaciÃ³n tÃ©cnica', 2, 5),
  ('realize', 'Cierre Realize', 'RevisiÃ³n Realize', 1, 0),
  ('realize', 'Cierre Realize', 'Gate approval', 2, 1),
  ('deploy', 'PreparaciÃ³n cutover', 'Plan de cutover', 1, 0),
  ('deploy', 'PreparaciÃ³n cutover', 'EjecuciÃ³n dry-run', 2, 3),
  ('deploy', 'Cutover y go-live', 'EjecuciÃ³n cutover', 1, 0),
  ('deploy', 'Cutover y go-live', 'Go-live', 2, 1),
  ('deploy', 'Hipercare inicial', 'Soporte hipercare', 1, 0),
  ('deploy', 'Hipercare inicial', 'Monitoreo', 2, 5),
  ('deploy', 'Transferencia a soporte', 'Handover documentaciÃ³n', 1, 0),
  ('deploy', 'Transferencia a soporte', 'SesiÃ³n de transferencia', 2, 2),
  ('deploy', 'Cierre Deploy', 'RevisiÃ³n Deploy', 1, 0),
  ('run', 'EstabilizaciÃ³n', 'Monitoreo post go-live', 1, 0),
  ('run', 'EstabilizaciÃ³n', 'ResoluciÃ³n de incidencias', 2, 7),
  ('run', 'OptimizaciÃ³n', 'AnÃ¡lisis de mejoras', 1, 0),
  ('run', 'OptimizaciÃ³n', 'ImplementaciÃ³n mejoras', 2, 5),
  ('run', 'Cierre del proyecto', 'Informe de cierre', 1, 0),
  ('run', 'Cierre del proyecto', 'Lecciones aprendidas', 2, 2)
) AS t(phase_key, act_name, task_name, sort_order, offset_days)
JOIN public.activate_activity_templates at ON at.phase_key = t.phase_key AND at.name = t.act_name
ON CONFLICT DO NOTHING;


-- -------- Migration: 20250328120000_project_tasks_rls.sql --------

-- RLS for public.project_tasks: allow authenticated users to CRUD only for projects they are members of.
-- Membership: project_members has user_id (auth.uid()) and profile_id (backfilled so profile_id = profiles.id = user_id in this schema).
-- No current_profile_id() in this codebase. We allow either pm.user_id = auth.uid() or pm.profile_id = auth.uid()
-- so both legacy and profile-based membership rows work.

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- Remove existing policies (exact names from 20250301140000_project_tasks.sql)
DROP POLICY IF EXISTS "Allow select project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow insert project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow update project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow delete project tasks for members" ON public.project_tasks;

-- Membership: user is member if project_members has a row for this project with
-- pm.user_id = auth.uid() OR pm.profile_id = auth.uid() (in this schema profiles.id = auth user id)
CREATE OR REPLACE FUNCTION public.project_tasks_is_project_member(project_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = project_uuid
      AND (pm.user_id = auth.uid() OR pm.profile_id = auth.uid())
  );
$$;

COMMENT ON FUNCTION public.project_tasks_is_project_member(uuid) IS
  'True if the current auth user is a member of the given project (project_members.user_id or project_members.profile_id = auth.uid()).';

-- 1) SELECT
CREATE POLICY "Allow select project tasks for members"
ON public.project_tasks
FOR SELECT
USING (
  auth.role() = 'service_role'
  OR public.project_tasks_is_project_member(project_id)
);

-- 2) INSERT
CREATE POLICY "Allow insert project tasks for members"
ON public.project_tasks
FOR INSERT
WITH CHECK (
  auth.role() = 'service_role'
  OR public.project_tasks_is_project_member(project_id)
);

-- 3) UPDATE
CREATE POLICY "Allow update project tasks for members"
ON public.project_tasks
FOR UPDATE
USING (
  auth.role() = 'service_role'
  OR public.project_tasks_is_project_member(project_id)
)
WITH CHECK (
  auth.role() = 'service_role'
  OR public.project_tasks_is_project_member(project_id)
);

-- 4) DELETE
CREATE POLICY "Allow delete project tasks for members"
ON public.project_tasks
FOR DELETE
USING (
  auth.role() = 'service_role'
  OR public.project_tasks_is_project_member(project_id)
);


-- -------- Migration: 20250601000000_project_tasks_rls_cleanup.sql --------

-- Replace ALL project_tasks RLS policies with a single consistent set.
-- Membership: public.project_members.user_id = auth.uid() only (no profile_id, no helper).
-- Drops both "Allow ..." and "project_tasks_*" policies to remove duplicates.

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies (exact names from pg_policies)
DROP POLICY IF EXISTS "Allow delete project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow insert project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow select project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow update project tasks for members" ON public.project_tasks;

DROP POLICY IF EXISTS "project_tasks_insert_for_members" ON public.project_tasks;
DROP POLICY IF EXISTS "project_tasks_select_for_members" ON public.project_tasks;
DROP POLICY IF EXISTS "project_tasks_update_for_members" ON public.project_tasks;
DROP POLICY IF EXISTS "project_tasks_delete_for_members" ON public.project_tasks;

-- SELECT
CREATE POLICY "project_tasks_select_for_members"
ON public.project_tasks
FOR SELECT
USING (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = project_tasks.project_id
      AND pm.user_id = auth.uid()
  )
);

-- INSERT
CREATE POLICY "project_tasks_insert_for_members"
ON public.project_tasks
FOR INSERT
WITH CHECK (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = project_tasks.project_id
      AND pm.user_id = auth.uid()
  )
);

-- UPDATE
CREATE POLICY "project_tasks_update_for_members"
ON public.project_tasks
FOR UPDATE
USING (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = project_tasks.project_id
      AND pm.user_id = auth.uid()
  )
)
WITH CHECK (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = project_tasks.project_id
      AND pm.user_id = auth.uid()
  )
);

-- DELETE
CREATE POLICY "project_tasks_delete_for_members"
ON public.project_tasks
FOR DELETE
USING (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = project_tasks.project_id
      AND pm.user_id = auth.uid()
  )
);


-- -------- Migration: 20250601120000_project_tasks_rls_cleanup.sql --------

-- Cleanly replace ALL project_tasks RLS policies with a single consistent set.
-- No helper function; membership = project_members.user_id = auth.uid().
-- Drops helper, all known policies (both naming styles), optional backfill of user_id, then creates 4 policies.

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- Drop the helper function (we don't need SECURITY DEFINER here)
DROP FUNCTION IF EXISTS public.project_tasks_is_project_member(uuid);

-- Drop ALL known policies (both naming styles)
DROP POLICY IF EXISTS "Allow select project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow insert project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow update project tasks for members" ON public.project_tasks;
DROP POLICY IF EXISTS "Allow delete project tasks for members" ON public.project_tasks;

DROP POLICY IF EXISTS "project_tasks_select_for_members" ON public.project_tasks;
DROP POLICY IF EXISTS "project_tasks_insert_for_members" ON public.project_tasks;
DROP POLICY IF EXISTS "project_tasks_update_for_members" ON public.project_tasks;
DROP POLICY IF EXISTS "project_tasks_delete_for_members" ON public.project_tasks;

-- Optional: backfill project_members.user_id if null, using email match (robust)
-- This assumes profiles.email matches auth.users.email.
UPDATE public.project_members pm
SET user_id = au.id
FROM public.profiles p
JOIN auth.users au ON au.email = p.email
WHERE pm.user_id IS NULL
  AND pm.profile_id = p.id;

-- Create ONE clean set of policies based on pm.user_id = auth.uid()

-- SELECT
CREATE POLICY "project_tasks_select_for_members"
ON public.project_tasks
FOR SELECT
USING (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = project_tasks.project_id
      AND pm.user_id = auth.uid()
  )
);

-- INSERT
CREATE POLICY "project_tasks_insert_for_members"
ON public.project_tasks
FOR INSERT
WITH CHECK (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = project_tasks.project_id
      AND pm.user_id = auth.uid()
  )
);

-- UPDATE
CREATE POLICY "project_tasks_update_for_members"
ON public.project_tasks
FOR UPDATE
USING (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = project_tasks.project_id
      AND pm.user_id = auth.uid()
  )
)
WITH CHECK (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = project_tasks.project_id
      AND pm.user_id = auth.uid()
  )
);

-- DELETE
CREATE POLICY "project_tasks_delete_for_members"
ON public.project_tasks
FOR DELETE
USING (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = project_tasks.project_id
      AND pm.user_id = auth.uid()
  )
);


-- -------- Migration: 20250602150000_projects_auto_add_owner_member.sql --------

-- When a project is created, automatically insert the creator as 'owner' in project_members.
-- Robust creator detection: created_by / user_id / owner_id from NEW; fallback auth.uid().
-- Idempotent: unique constraint + CREATE OR REPLACE + DROP TRIGGER IF EXISTS.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_members_project_id_user_id_key'
      AND conrelid = 'public.project_members'::regclass
  ) THEN
    ALTER TABLE public.project_members
      ADD CONSTRAINT project_members_project_id_user_id_key UNIQUE (project_id, user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.projects_add_owner_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  creator uuid;
  new_json jsonb;
BEGIN
  new_json := to_jsonb(NEW);

  creator := NULLIF(trim(coalesce(new_json->>'created_by', '')), '')::uuid;
  IF creator IS NULL THEN
    creator := NULLIF(trim(coalesce(new_json->>'user_id', '')), '')::uuid;
  END IF;
  IF creator IS NULL THEN
    creator := NULLIF(trim(coalesce(new_json->>'owner_id', '')), '')::uuid;
  END IF;
  IF creator IS NULL THEN
    creator := auth.uid();
  END IF;

  IF creator IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.project_members (project_id, user_id, role, updated_at)
  VALUES (NEW.id, creator, 'owner', now())
  ON CONFLICT (project_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_add_owner_member ON public.projects;
CREATE TRIGGER projects_add_owner_member
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.projects_add_owner_member();


-- -------- Migration: 20250602160000_project_members_rls.sql --------

-- RLS on public.project_members: members can read; only owner or superadmin can insert/update/delete.
-- Assumes profiles.id = auth.uid() and profiles.app_role = 'superadmin' for superadmins.

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_members_select_policy ON public.project_members;
CREATE POLICY project_members_select_policy
  ON public.project_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
        AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS project_members_insert_policy ON public.project_members;
CREATE POLICY project_members_insert_policy
  ON public.project_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'owner'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );

DROP POLICY IF EXISTS project_members_update_policy ON public.project_members;
CREATE POLICY project_members_update_policy
  ON public.project_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'owner'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );

DROP POLICY IF EXISTS project_members_delete_policy ON public.project_members;
CREATE POLICY project_members_delete_policy
  ON public.project_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'owner'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );


-- -------- Migration: 20250602170000_clients_table.sql --------

-- Minimal clients table and projects.client_id. Idempotent where possible.

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid
);

-- Optional unique on name to avoid duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.clients'::regclass
      AND conname = 'clients_name_key'
  ) THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_name_key UNIQUE (name);
  END IF;
END $$;

-- Link projects to client
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL;

-- RLS: superadmin CRUD; authenticated can SELECT (read-only for non-admin)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clients_select_policy ON public.clients;
CREATE POLICY clients_select_policy
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS clients_insert_policy ON public.clients;
CREATE POLICY clients_insert_policy
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );

DROP POLICY IF EXISTS clients_update_policy ON public.clients;
CREATE POLICY clients_update_policy
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );

DROP POLICY IF EXISTS clients_delete_policy ON public.clients;
CREATE POLICY clients_delete_policy
  ON public.clients
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );


-- -------- Migration: 20250602180000_projects_backfill_owner_members.sql --------

-- Backfill project_members: add one owner per project when a creator column exists and no member exists yet.
-- Uses same creator detection as trigger: created_by, user_id, owner_id (only if column exists).
-- ON CONFLICT (project_id, user_id) DO NOTHING.

DO $$
DECLARE
  creator_expr text := NULL;
  has_created_by boolean;
  has_user_id boolean;
  has_owner_id boolean;
  sql text;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'created_by') INTO has_created_by;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'user_id') INTO has_user_id;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'owner_id') INTO has_owner_id;

  IF NOT has_created_by AND NOT has_user_id AND NOT has_owner_id THEN
    RETURN;
  END IF;

  creator_expr := 'COALESCE(';
  IF has_created_by THEN creator_expr := creator_expr || 'p.created_by'; ELSE creator_expr := creator_expr || 'NULL'; END IF;
  creator_expr := creator_expr || '::uuid, ';
  IF has_user_id THEN creator_expr := creator_expr || 'p.user_id'; ELSE creator_expr := creator_expr || 'NULL'; END IF;
  creator_expr := creator_expr || '::uuid, ';
  IF has_owner_id THEN creator_expr := creator_expr || 'p.owner_id'; ELSE creator_expr := creator_expr || 'NULL'; END IF;
  creator_expr := creator_expr || '::uuid)';

  sql := format(
    $q$
    INSERT INTO public.project_members (project_id, user_id, role, updated_at)
    SELECT p.id, creator.uid, 'owner', now()
    FROM public.projects p
    CROSS JOIN LATERAL (
      SELECT %s AS uid
    ) creator
    WHERE creator.uid IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = p.id AND pm.user_id = creator.uid
      )
    ON CONFLICT (project_id, user_id) DO NOTHING
    $q$,
    creator_expr
  );
  EXECUTE sql;
END;
$$;


-- -------- Migration: 20250602190000_project_invitations.sql --------

-- project_invitations: pending invites by email; auto-accepted on signup via trigger.
CREATE TABLE public.project_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  invited_by uuid NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz NULL,
  UNIQUE (project_id, email)
);

CREATE INDEX idx_project_invitations_email ON public.project_invitations (email);
CREATE INDEX idx_project_invitations_project_id ON public.project_invitations (project_id);

ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

-- SELECT: project owners/superadmins for that project
DROP POLICY IF EXISTS project_invitations_select_policy ON public.project_invitations;
CREATE POLICY project_invitations_select_policy
  ON public.project_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_invitations.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'owner'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );

-- INSERT: project owners/superadmins only
DROP POLICY IF EXISTS project_invitations_insert_policy ON public.project_invitations;
CREATE POLICY project_invitations_insert_policy
  ON public.project_invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_invitations.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'owner'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );

-- UPDATE: project owners/superadmins (trigger will update via service role)
DROP POLICY IF EXISTS project_invitations_update_policy ON public.project_invitations;
CREATE POLICY project_invitations_update_policy
  ON public.project_invitations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_invitations.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'owner'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );

COMMENT ON TABLE public.project_invitations IS
  'Pending project invites by email; accepted automatically when the user signs up (trigger on profiles).';


-- -------- Migration: 20250602200000_project_invitations_accept_trigger.sql --------

-- Auto-accept pending project invitations when a new profile is created (e.g. after signup).
-- Uses NEW.email to find pending invitations and inserts into project_members, then marks invitation accepted.

CREATE OR REPLACE FUNCTION public.accept_project_invitations_for_new_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv record;
BEGIN
  IF NEW.email IS NULL OR trim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  FOR inv IN
    SELECT id, project_id, role
    FROM public.project_invitations
    WHERE lower(trim(email)) = lower(trim(NEW.email))
      AND status = 'pending'
  LOOP
    INSERT INTO public.project_members (project_id, user_id, role, updated_at)
    VALUES (inv.project_id, NEW.id, inv.role, now())
    ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = EXCLUDED.updated_at;

    UPDATE public.project_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = inv.id;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accept_project_invitations_on_profile_insert ON public.profiles;
CREATE TRIGGER accept_project_invitations_on_profile_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.accept_project_invitations_for_new_profile();

COMMENT ON FUNCTION public.accept_project_invitations_for_new_profile() IS
  'On new profile insert: find pending project_invitations by email and add user to project_members, then mark invitations accepted.';


-- -------- Migration: 20250602210000_rbac_roles_permissions.sql --------

-- RBAC Phase 1: roles, permissions, role_permissions. No change to profiles.app_role or project_members.role yet.

CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('app', 'project')),
  key text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, key)
);

CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('app', 'project')),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions (id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_roles_scope ON public.roles (scope);
CREATE INDEX idx_permissions_scope ON public.permissions (scope);
CREATE INDEX idx_role_permissions_role ON public.role_permissions (role_id);

-- RLS: only superadmin can mutate; authenticated can read
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roles_select ON public.roles;
CREATE POLICY roles_select ON public.roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS roles_insert ON public.roles;
CREATE POLICY roles_insert ON public.roles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'superadmin'));

DROP POLICY IF EXISTS roles_update ON public.roles;
CREATE POLICY roles_update ON public.roles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'superadmin'));

DROP POLICY IF EXISTS roles_delete ON public.roles;
CREATE POLICY roles_delete ON public.roles FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'superadmin'));

DROP POLICY IF EXISTS permissions_select ON public.permissions;
CREATE POLICY permissions_select ON public.permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS permissions_insert ON public.permissions;
CREATE POLICY permissions_insert ON public.permissions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'superadmin'));

DROP POLICY IF EXISTS permissions_update ON public.permissions;
CREATE POLICY permissions_update ON public.permissions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'superadmin'));

DROP POLICY IF EXISTS permissions_delete ON public.permissions;
CREATE POLICY permissions_delete ON public.permissions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'superadmin'));

DROP POLICY IF EXISTS role_permissions_select ON public.role_permissions;
CREATE POLICY role_permissions_select ON public.role_permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS role_permissions_insert ON public.role_permissions;
CREATE POLICY role_permissions_insert ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'superadmin'));

DROP POLICY IF EXISTS role_permissions_delete ON public.role_permissions;
CREATE POLICY role_permissions_delete ON public.role_permissions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'superadmin'));

-- Seed permissions (app + project)
INSERT INTO public.permissions (scope, key, name) VALUES
  ('app', 'manage_users', 'Gestionar usuarios'),
  ('app', 'manage_clients', 'Gestionar clientes'),
  ('app', 'view_all_projects', 'Ver todos los proyectos'),
  ('app', 'manage_roles', 'Gestionar roles y permisos'),
  ('project', 'view_project', 'Ver proyecto'),
  ('project', 'edit_project', 'Editar proyecto'),
  ('project', 'manage_members', 'Gestionar miembros'),
  ('project', 'view_tasks', 'Ver tareas'),
  ('project', 'edit_tasks', 'Editar tareas'),
  ('project', 'create_tasks', 'Crear tareas'),
  ('project', 'view_notes', 'Ver notas'),
  ('project', 'edit_notes', 'Editar notas'),
  ('project', 'create_notes', 'Crear notas'),
  ('project', 'view_activities', 'Ver actividades'),
  ('project', 'edit_activities', 'Editar actividades')
ON CONFLICT (key) DO NOTHING;

-- Seed roles (app + project). Use key matching existing app_role / project_members.role for future wiring.
INSERT INTO public.roles (scope, key, name, is_active) VALUES
  ('app', 'superadmin', 'Superadministrador', true),
  ('app', 'admin', 'Administrador', true),
  ('app', 'consultant', 'Consultor', true),
  ('app', 'viewer', 'Lector (app)', true),
  ('project', 'owner', 'Propietario', true),
  ('project', 'editor', 'Editor', true),
  ('project', 'viewer', 'Lector', true)
ON CONFLICT (scope, key) DO UPDATE SET name = EXCLUDED.name, is_active = EXCLUDED.is_active;

-- Seed role_permissions (reference by key via subqueries; roles/permissions are now inserted)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'app' AND p.scope = 'app' AND r.key = 'superadmin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'app' AND p.scope = 'app' AND r.key = 'admin' AND p.key IN ('manage_clients', 'view_all_projects')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'project' AND p.scope = 'project' AND r.key = 'owner'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'project' AND p.scope = 'project' AND r.key = 'editor'
  AND p.key IN ('view_project', 'edit_project', 'view_tasks', 'edit_tasks', 'create_tasks', 'view_notes', 'edit_notes', 'create_notes', 'view_activities', 'edit_activities')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.scope = 'project' AND p.scope = 'project' AND r.key = 'viewer'
  AND p.key IN ('view_project', 'view_tasks', 'view_notes', 'view_activities')
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMENT ON TABLE public.roles IS 'RBAC roles (app scope = global; project scope = per-project). Phase 1: management only.';
COMMENT ON TABLE public.permissions IS 'RBAC permissions by scope. Phase 1: management only.';
COMMENT ON TABLE public.role_permissions IS 'Role-permission mapping. Phase 1: management only.';


-- -------- Migration: 20250602230000_project_invitations_token_expiry.sql --------

-- Project invitations: add token_hash, expires_at, accepted_by, updated_at; add 'expired' status; RLS for accept by invitee.
-- Existing pending rows are marked expired so they require re-invite with the new token flow.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1) Add new columns (nullable first for backfill)
ALTER TABLE public.project_invitations
  ADD COLUMN IF NOT EXISTS token_hash text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '7 days'),
  ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2) Add 'expired' to status check (recreate constraint)
ALTER TABLE public.project_invitations DROP CONSTRAINT IF EXISTS project_invitations_status_check;
ALTER TABLE public.project_invitations
  ADD CONSTRAINT project_invitations_status_check
  CHECK (status IN ('pending', 'accepted', 'revoked', 'expired'));

-- 3) invited_by FK to profiles (if column exists and no FK yet)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'project_invitations' AND column_name = 'invited_by') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.project_invitations'::regclass AND conname = 'project_invitations_invited_by_fkey') THEN
      ALTER TABLE public.project_invitations
        ADD CONSTRAINT project_invitations_invited_by_fkey
        FOREIGN KEY (invited_by) REFERENCES public.profiles (id);
    END IF;
  END IF;
END $$;

-- 4) Backfill: existing rows get expires_at and a placeholder token_hash; pending without token -> expired
UPDATE public.project_invitations
SET
  expires_at = COALESCE(invited_at, now()) + interval '7 days',
  updated_at = COALESCE(invited_at, now())
WHERE expires_at IS NULL;

UPDATE public.project_invitations
SET
  token_hash = encode(
    extensions.digest(convert_to(id::text || '-legacy', 'utf8'), 'sha256'),
    'hex'
  ),
  status = 'expired'
WHERE status = 'pending' AND (token_hash IS NULL OR token_hash = '');

UPDATE public.project_invitations
SET token_hash = encode(
  extensions.digest(convert_to(id::text || '-legacy', 'utf8'), 'sha256'),
  'hex'
)
WHERE token_hash IS NULL;

-- 5) Enforce NOT NULL and UNIQUE on token_hash
-- Allow multiple invites to same email (different tokens); drop project_id+email unique if present
ALTER TABLE public.project_invitations DROP CONSTRAINT IF EXISTS project_invitations_project_id_email_key;
ALTER TABLE public.project_invitations ALTER COLUMN token_hash SET NOT NULL;
ALTER TABLE public.project_invitations ALTER COLUMN expires_at SET NOT NULL;

DROP INDEX IF EXISTS project_invitations_token_hash_key;
CREATE UNIQUE INDEX project_invitations_token_hash_key ON public.project_invitations (token_hash);

-- 6) Indexes for lookup and listing
CREATE INDEX IF NOT EXISTS idx_project_invitations_status ON public.project_invitations (status);
CREATE INDEX IF NOT EXISTS idx_project_invitations_expires_at ON public.project_invitations (expires_at);

-- 7) Helper: current user's email from auth.users (for RLS)
CREATE OR REPLACE FUNCTION public.get_auth_user_email()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION public.get_auth_user_email() IS 'Returns the current authenticated user email for RLS (e.g. invite accept by email match).';

-- 8) SELECT: project members (any role) or superadmin
DROP POLICY IF EXISTS project_invitations_select_policy ON public.project_invitations;
CREATE POLICY project_invitations_select_policy
  ON public.project_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_invitations.project_id
        AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );

-- 9) UPDATE: two cases â€” (a) owner/superadmin can revoke; (b) invitee can accept (pending, not expired, email match)
DROP POLICY IF EXISTS project_invitations_update_policy ON public.project_invitations;
CREATE POLICY project_invitations_update_policy_owner
  ON public.project_invitations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_invitations.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'owner'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );

CREATE POLICY project_invitations_update_policy_invitee_accept
  ON public.project_invitations
  FOR UPDATE
  USING (
    status = 'pending'
    AND expires_at > now()
    AND lower(trim(COALESCE(public.get_auth_user_email(), ''))) = lower(trim(email))
  )
  WITH CHECK (
    status = 'accepted'
    AND accepted_by = auth.uid()
    AND accepted_at IS NOT NULL
  );

COMMENT ON TABLE public.project_invitations IS
  'Project invites by email; token_hash for secure single-use links; accept via POST /api/invitations/accept or trigger on profile insert.';


-- -------- Migration: 20250602231000_project_invitations_trigger_expires.sql --------

-- Trigger: only auto-accept pending invitations that are not expired; set accepted_by and updated_at.
CREATE OR REPLACE FUNCTION public.accept_project_invitations_for_new_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv record;
BEGIN
  IF NEW.email IS NULL OR trim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  FOR inv IN
    SELECT id, project_id, role
    FROM public.project_invitations
    WHERE lower(trim(email)) = lower(trim(NEW.email))
      AND status = 'pending'
      AND expires_at > now()
  LOOP
    INSERT INTO public.project_members (project_id, user_id, role, updated_at)
    VALUES (inv.project_id, NEW.id, inv.role, now())
    ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = EXCLUDED.updated_at;

    UPDATE public.project_invitations
    SET status = 'accepted', accepted_at = now(), accepted_by = NEW.id, updated_at = now()
    WHERE id = inv.id;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.accept_project_invitations_for_new_profile() IS
  'On new profile insert: find pending non-expired project_invitations by email, add user to project_members, mark accepted.';


-- -------- Migration: 20250602232000_profiles_email_backfill.sql --------

-- Backfill profiles.email from auth.users; ensure profile exists on signup (only if missing).
-- Does not replace existing RLS.

-- 1) Add email column to profiles if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- 2) Backfill profiles.email from auth.users where id matches and profile.email is null
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE au.id = p.id AND (p.email IS NULL OR trim(p.email) = '');

-- 3) Trigger: on auth.users insert, create profile row if it does not exist
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, app_role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    'consultant'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

COMMENT ON FUNCTION public.handle_new_auth_user() IS
  'On new auth user: ensure a profiles row exists and email/full_name are set.';


-- -------- Migration: 20260305190000_knowledge_module.sql --------

-- Knowledge module: Notion-like structured knowledge (spaces, pages, blocks, tags, links).
-- Uses profiles.id (owner_profile_id) and project_members.user_id for auth (profiles.id = auth.uid()).

-- 1) knowledge_spaces
CREATE TABLE IF NOT EXISTS public.knowledge_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'project', 'org')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_spaces_owner ON public.knowledge_spaces (owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_spaces_project ON public.knowledge_spaces (project_id);

-- 2) knowledge_pages
CREATE TABLE IF NOT EXISTS public.knowledge_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.knowledge_spaces (id) ON DELETE CASCADE,
  owner_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  page_type text NOT NULL DEFAULT 'how_to'
    CHECK (page_type IN ('how_to', 'troubleshooting', 'template', 'decision', 'meeting_note', 'config', 'cutover_runbook', 'reference')),
  summary text,
  is_published boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_pages_space_updated ON public.knowledge_pages (space_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_pages_owner ON public.knowledge_pages (owner_profile_id);

-- 3) knowledge_blocks
CREATE TABLE IF NOT EXISTS public.knowledge_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.knowledge_pages (id) ON DELETE CASCADE,
  block_type text NOT NULL
    CHECK (block_type IN ('rich_text', 'checklist', 'code', 'link', 'callout')),
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_blocks_page_sort ON public.knowledge_blocks (page_id, sort_order);

-- 4) knowledge_tags
CREATE TABLE IF NOT EXISTS public.knowledge_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_profile_id, name)
);

-- 5) knowledge_page_tags
CREATE TABLE IF NOT EXISTS public.knowledge_page_tags (
  page_id uuid NOT NULL REFERENCES public.knowledge_pages (id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.knowledge_tags (id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, tag_id)
);

-- 6) knowledge_page_links
CREATE TABLE IF NOT EXISTS public.knowledge_page_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_page_id uuid NOT NULL REFERENCES public.knowledge_pages (id) ON DELETE CASCADE,
  to_page_id uuid NOT NULL REFERENCES public.knowledge_pages (id) ON DELETE CASCADE,
  link_type text NOT NULL DEFAULT 'references'
    CHECK (link_type IN ('references', 'depends_on', 'related', 'duplicate_of')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_page_id, to_page_id, link_type)
);

-- 7) knowledge_page_projects
CREATE TABLE IF NOT EXISTS public.knowledge_page_projects (
  page_id uuid NOT NULL REFERENCES public.knowledge_pages (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_page_projects_project ON public.knowledge_page_projects (project_id);

-- Triggers: updated_at (reuse set_updated_at if exists)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS knowledge_spaces_updated_at ON public.knowledge_spaces;
CREATE TRIGGER knowledge_spaces_updated_at
  BEFORE UPDATE ON public.knowledge_spaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS knowledge_pages_updated_at ON public.knowledge_pages;
CREATE TRIGGER knowledge_pages_updated_at
  BEFORE UPDATE ON public.knowledge_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS knowledge_blocks_updated_at ON public.knowledge_blocks;
CREATE TRIGGER knowledge_blocks_updated_at
  BEFORE UPDATE ON public.knowledge_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.knowledge_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_page_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_page_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_page_projects ENABLE ROW LEVEL SECURITY;

-- knowledge_spaces: owner CRUD; project member or superadmin can SELECT when project_id is set
DROP POLICY IF EXISTS knowledge_spaces_select_owner ON public.knowledge_spaces;
CREATE POLICY knowledge_spaces_select_owner ON public.knowledge_spaces FOR SELECT
  USING (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS knowledge_spaces_select_project ON public.knowledge_spaces;
CREATE POLICY knowledge_spaces_select_project ON public.knowledge_spaces FOR SELECT
  USING (
    project_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = knowledge_spaces.project_id AND pm.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin')
    )
  );

DROP POLICY IF EXISTS knowledge_spaces_insert ON public.knowledge_spaces;
CREATE POLICY knowledge_spaces_insert ON public.knowledge_spaces FOR INSERT
  WITH CHECK (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS knowledge_spaces_update ON public.knowledge_spaces;
CREATE POLICY knowledge_spaces_update ON public.knowledge_spaces FOR UPDATE
  USING (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS knowledge_spaces_delete ON public.knowledge_spaces;
CREATE POLICY knowledge_spaces_delete ON public.knowledge_spaces FOR DELETE
  USING (owner_profile_id = auth.uid());

-- knowledge_pages: owner CRUD; project member/superadmin SELECT when space is project-linked
DROP POLICY IF EXISTS knowledge_pages_select_owner ON public.knowledge_pages;
CREATE POLICY knowledge_pages_select_owner ON public.knowledge_pages FOR SELECT
  USING (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS knowledge_pages_select_project ON public.knowledge_pages;
CREATE POLICY knowledge_pages_select_project ON public.knowledge_pages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.knowledge_spaces ks
      WHERE ks.id = knowledge_pages.space_id AND ks.project_id IS NOT NULL
        AND (EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = ks.project_id AND pm.user_id = auth.uid())
             OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin'))
    )
  );

DROP POLICY IF EXISTS knowledge_pages_insert ON public.knowledge_pages;
CREATE POLICY knowledge_pages_insert ON public.knowledge_pages FOR INSERT
  WITH CHECK (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS knowledge_pages_update ON public.knowledge_pages;
CREATE POLICY knowledge_pages_update ON public.knowledge_pages FOR UPDATE
  USING (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS knowledge_pages_delete ON public.knowledge_pages;
CREATE POLICY knowledge_pages_delete ON public.knowledge_pages FOR DELETE
  USING (owner_profile_id = auth.uid());

-- knowledge_blocks: follow page access (owner or project member read; only owner write)
DROP POLICY IF EXISTS knowledge_blocks_select_owner ON public.knowledge_blocks;
CREATE POLICY knowledge_blocks_select_owner ON public.knowledge_blocks FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_blocks.page_id AND kp.owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS knowledge_blocks_select_project ON public.knowledge_blocks;
CREATE POLICY knowledge_blocks_select_project ON public.knowledge_blocks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.knowledge_pages kp
      JOIN public.knowledge_spaces ks ON ks.id = kp.space_id
      WHERE kp.id = knowledge_blocks.page_id AND ks.project_id IS NOT NULL
        AND (EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = ks.project_id AND pm.user_id = auth.uid())
             OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin'))
    )
  );

DROP POLICY IF EXISTS knowledge_blocks_insert ON public.knowledge_blocks;
CREATE POLICY knowledge_blocks_insert ON public.knowledge_blocks FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_blocks.page_id AND kp.owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS knowledge_blocks_update ON public.knowledge_blocks;
CREATE POLICY knowledge_blocks_update ON public.knowledge_blocks FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_blocks.page_id AND kp.owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS knowledge_blocks_delete ON public.knowledge_blocks;
CREATE POLICY knowledge_blocks_delete ON public.knowledge_blocks FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_blocks.page_id AND kp.owner_profile_id = auth.uid())
  );

-- knowledge_tags: owner only
DROP POLICY IF EXISTS knowledge_tags_select ON public.knowledge_tags;
CREATE POLICY knowledge_tags_select ON public.knowledge_tags FOR SELECT
  USING (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS knowledge_tags_insert ON public.knowledge_tags;
CREATE POLICY knowledge_tags_insert ON public.knowledge_tags FOR INSERT
  WITH CHECK (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS knowledge_tags_update ON public.knowledge_tags;
CREATE POLICY knowledge_tags_update ON public.knowledge_tags FOR UPDATE
  USING (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS knowledge_tags_delete ON public.knowledge_tags;
CREATE POLICY knowledge_tags_delete ON public.knowledge_tags FOR DELETE
  USING (owner_profile_id = auth.uid());

-- knowledge_page_tags: allow if user can read/write the page (simplified: page owner)
DROP POLICY IF EXISTS knowledge_page_tags_select ON public.knowledge_page_tags;
CREATE POLICY knowledge_page_tags_select ON public.knowledge_page_tags FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_page_tags.page_id AND kp.owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS knowledge_page_tags_select_project ON public.knowledge_page_tags;
CREATE POLICY knowledge_page_tags_select_project ON public.knowledge_page_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.knowledge_pages kp
      JOIN public.knowledge_spaces ks ON ks.id = kp.space_id
      WHERE kp.id = knowledge_page_tags.page_id AND ks.project_id IS NOT NULL
        AND (EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = ks.project_id AND pm.user_id = auth.uid())
             OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin'))
    )
  );

DROP POLICY IF EXISTS knowledge_page_tags_insert ON public.knowledge_page_tags;
CREATE POLICY knowledge_page_tags_insert ON public.knowledge_page_tags FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_page_tags.page_id AND kp.owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS knowledge_page_tags_delete ON public.knowledge_page_tags;
CREATE POLICY knowledge_page_tags_delete ON public.knowledge_page_tags FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_page_tags.page_id AND kp.owner_profile_id = auth.uid())
  );

-- knowledge_page_links: allow if user can read/write from_page
DROP POLICY IF EXISTS knowledge_page_links_select ON public.knowledge_page_links;
CREATE POLICY knowledge_page_links_select ON public.knowledge_page_links FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_page_links.from_page_id AND kp.owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS knowledge_page_links_select_project ON public.knowledge_page_links;
CREATE POLICY knowledge_page_links_select_project ON public.knowledge_page_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.knowledge_pages kp
      JOIN public.knowledge_spaces ks ON ks.id = kp.space_id
      WHERE kp.id = knowledge_page_links.from_page_id AND ks.project_id IS NOT NULL
        AND (EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = ks.project_id AND pm.user_id = auth.uid())
             OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin'))
    )
  );

DROP POLICY IF EXISTS knowledge_page_links_insert ON public.knowledge_page_links;
CREATE POLICY knowledge_page_links_insert ON public.knowledge_page_links FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_page_links.from_page_id AND kp.owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS knowledge_page_links_delete ON public.knowledge_page_links;
CREATE POLICY knowledge_page_links_delete ON public.knowledge_page_links FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_page_links.from_page_id AND kp.owner_profile_id = auth.uid())
  );

-- knowledge_page_projects: allow if user owns the page
DROP POLICY IF EXISTS knowledge_page_projects_select ON public.knowledge_page_projects;
CREATE POLICY knowledge_page_projects_select ON public.knowledge_page_projects FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_page_projects.page_id AND kp.owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS knowledge_page_projects_select_project ON public.knowledge_page_projects;
CREATE POLICY knowledge_page_projects_select_project ON public.knowledge_page_projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = knowledge_page_projects.project_id AND pm.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin')
  );

DROP POLICY IF EXISTS knowledge_page_projects_insert ON public.knowledge_page_projects;
CREATE POLICY knowledge_page_projects_insert ON public.knowledge_page_projects FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_page_projects.page_id AND kp.owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS knowledge_page_projects_delete ON public.knowledge_page_projects;
CREATE POLICY knowledge_page_projects_delete ON public.knowledge_page_projects FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.knowledge_pages kp WHERE kp.id = knowledge_page_projects.page_id AND kp.owner_profile_id = auth.uid())
  );

COMMENT ON TABLE public.knowledge_spaces IS 'Knowledge spaces (global or project-scoped).';
COMMENT ON TABLE public.knowledge_pages IS 'Structured knowledge pages with type and slug per space.';
COMMENT ON TABLE public.knowledge_blocks IS 'Block-based content (rich_text, checklist, code, etc.).';


-- -------- Migration: 20260305210000_knowledge_search.sql --------

-- Knowledge full-text search: tsvector, trigger, GIN index, view, and search RPC.
-- Additive; does not modify existing CRUD.

-- 1) Add search_vector column to knowledge_pages
ALTER TABLE public.knowledge_pages
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2) Backfill existing rows
UPDATE public.knowledge_pages
SET search_vector = to_tsvector('english',
  coalesce(title, '') || ' ' || coalesce(summary, '')
)
WHERE search_vector IS NULL;

-- 3) Trigger to keep search_vector updated
CREATE OR REPLACE FUNCTION public.knowledge_pages_search_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' || coalesce(NEW.summary, '')
  );
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS knowledge_pages_search_update ON public.knowledge_pages;
CREATE TRIGGER knowledge_pages_search_update
  BEFORE INSERT OR UPDATE
  ON public.knowledge_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.knowledge_pages_search_trigger();

-- 4) GIN index for full-text search
CREATE INDEX IF NOT EXISTS knowledge_pages_search_idx
  ON public.knowledge_pages
  USING GIN (search_vector);

-- 5) View (structure for future extension; rank is query-dependent, so view uses placeholder)
DROP VIEW IF EXISTS public.knowledge_search_view;
CREATE VIEW public.knowledge_search_view AS
SELECT
  id AS page_id,
  title,
  summary,
  page_type,
  space_id,
  ts_rank(search_vector, plainto_tsquery('english', '')) AS rank
FROM public.knowledge_pages;

-- 6) RPC for search (respects RLS via SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.search_knowledge(query text)
RETURNS TABLE(
  page_id uuid,
  title text,
  summary text,
  page_type text,
  space_id uuid,
  rank real
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    kp.id AS page_id,
    kp.title,
    kp.summary,
    kp.page_type,
    kp.space_id,
    ts_rank(kp.search_vector, plainto_tsquery('english', coalesce(trim(query), ''))) AS rank
  FROM public.knowledge_pages kp
  WHERE kp.deleted_at IS NULL
    AND kp.search_vector @@ plainto_tsquery('english', coalesce(trim(query), ''))
  ORDER BY rank DESC;
$$;

COMMENT ON FUNCTION public.search_knowledge(text) IS 'Full-text search over knowledge_pages (title, summary). RLS applies.';


-- -------- Migration: 20260305220000_knowledge_graph.sql --------

-- Knowledge graph: view and indexes for page relationships.
-- Additive; does not modify existing CRUD.

-- Indexes for efficient lookups by from_page_id and to_page_id
CREATE INDEX IF NOT EXISTS knowledge_page_links_from_idx
  ON public.knowledge_page_links (from_page_id);

CREATE INDEX IF NOT EXISTS knowledge_page_links_to_idx
  ON public.knowledge_page_links (to_page_id);

-- Graph view: links with titles (excludes deleted pages)
DROP VIEW IF EXISTS public.knowledge_graph_view;
CREATE VIEW public.knowledge_graph_view AS
SELECT
  l.from_page_id,
  p1.title AS from_title,
  l.to_page_id,
  p2.title AS to_title,
  l.link_type
FROM public.knowledge_page_links l
JOIN public.knowledge_pages p1 ON p1.id = l.from_page_id
JOIN public.knowledge_pages p2 ON p2.id = l.to_page_id
WHERE p1.deleted_at IS NULL
  AND p2.deleted_at IS NULL;

COMMENT ON VIEW public.knowledge_graph_view IS 'Page links with titles for graph visualization. RLS on underlying tables applies.';


-- -------- Migration: 20260305270000_fix_project_members_rls_no_recursion.sql --------

-- Helper: get_my_profile_id (profiles.id = auth.uid())
create or replace function public.get_my_profile_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

-- Helper: superadmin check
create or replace function public.is_superadmin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = public.get_my_profile_id()
      and p.app_role = 'superadmin'
  )
$$;

-- Helper: project membership check for OTHER table policies
-- row_security off prevents RLS recursion when used from other table policies
create or replace function public.is_project_member(project_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_uuid
      and pm.profile_id = public.get_my_profile_id()
  )
$$;

grant execute on function public.get_my_profile_id() to authenticated;
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.is_project_member(uuid) to authenticated;

-- Rebuild project_members policies with NO recursion
alter table public.project_members enable row level security;

do $$
declare pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname='public' and tablename='project_members'
  loop
    execute format('drop policy if exists %I on public.project_members;', pol.policyname);
  end loop;
end $$;

-- SELECT: only own row OR superadmin (no membership check -> no recursion)
create policy "project_members_select_own_or_superadmin"
on public.project_members
for select
to authenticated
using (
  public.is_superadmin()
  OR profile_id = public.get_my_profile_id()
);

-- Write operations: superadmin only (safe default)
create policy "project_members_insert_superadmin"
on public.project_members
for insert
to authenticated
with check (public.is_superadmin());

create policy "project_members_update_superadmin"
on public.project_members
for update
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

create policy "project_members_delete_superadmin"
on public.project_members
for delete
to authenticated
using (public.is_superadmin());


-- -------- Migration: 20260306000000_knowledge_documents_pgvector.sql --------

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


-- -------- Migration: 20260307000000_project_sources.sql --------

-- Project Sources: foundational tables for external knowledge sources per project.
-- Additive; does not modify project_links or other existing tables.

-- 1) project_sources
CREATE TABLE IF NOT EXISTS public.project_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  source_type text NOT NULL,
  name text NOT NULL,
  description text,
  source_url text,
  external_id text,
  external_parent_id text,
  sync_enabled boolean NOT NULL DEFAULT false,
  sync_mode text NOT NULL DEFAULT 'manual',
  last_synced_at timestamptz,
  last_sync_status text NOT NULL DEFAULT 'never',
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_sources_source_type_check
    CHECK (source_type IN (
      'google_drive_folder',
      'google_drive_file',
      'sharepoint_library',
      'confluence_space',
      'jira_project',
      'web_url',
      'manual_upload'
    )),
  CONSTRAINT project_sources_sync_mode_check
    CHECK (sync_mode IN ('manual', 'scheduled')),
  CONSTRAINT project_sources_last_sync_status_check
    CHECK (last_sync_status IN ('never', 'success', 'partial', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_project_sources_project_id ON public.project_sources (project_id);
CREATE INDEX IF NOT EXISTS idx_project_sources_source_type ON public.project_sources (source_type);

COMMENT ON TABLE public.project_sources IS
  'External knowledge sources per project (Drive, SharePoint, Confluence, Jira, web URL, manual). Future sync into Sapito knowledge.';

-- updated_at trigger
DROP TRIGGER IF EXISTS set_project_sources_updated_at ON public.project_sources;
CREATE TRIGGER set_project_sources_updated_at
  BEFORE UPDATE ON public.project_sources
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

-- 2) project_source_sync_jobs
CREATE TABLE IF NOT EXISTS public.project_source_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_source_id uuid NOT NULL REFERENCES public.project_sources (id) ON DELETE CASCADE,
  trigger_type text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  files_seen integer NOT NULL DEFAULT 0,
  files_processed integer NOT NULL DEFAULT 0,
  files_skipped integer NOT NULL DEFAULT 0,
  files_failed integer NOT NULL DEFAULT 0,
  error_summary text,
  initiated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_source_sync_jobs_trigger_type_check
    CHECK (trigger_type IN ('manual', 'scheduled', 'webhook')),
  CONSTRAINT project_source_sync_jobs_status_check
    CHECK (status IN ('running', 'success', 'partial', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_project_source_sync_jobs_source_id ON public.project_source_sync_jobs (project_source_id);
CREATE INDEX IF NOT EXISTS idx_project_source_sync_jobs_started_at ON public.project_source_sync_jobs (started_at DESC);

COMMENT ON TABLE public.project_source_sync_jobs IS
  'Sync job runs for project_sources; future use for Google Drive / SharePoint sync.';

-- 3) RLS on project_sources (mirror project_tasks: service_role or project member)
ALTER TABLE public.project_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_sources_select_for_members"
  ON public.project_sources FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_sources.project_id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "project_sources_insert_for_members"
  ON public.project_sources FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_sources.project_id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "project_sources_update_for_members"
  ON public.project_sources FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_sources.project_id AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_sources.project_id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "project_sources_delete_for_members"
  ON public.project_sources FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_sources.project_id AND pm.user_id = auth.uid()
    )
  );

-- 4) RLS on project_source_sync_jobs (access via project_sources.project_id)
ALTER TABLE public.project_source_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_source_sync_jobs_select_for_members"
  ON public.project_source_sync_jobs FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_sources ps
      JOIN public.project_members pm ON pm.project_id = ps.project_id AND pm.user_id = auth.uid()
      WHERE ps.id = project_source_sync_jobs.project_source_id
    )
  );

CREATE POLICY "project_source_sync_jobs_insert_for_members"
  ON public.project_source_sync_jobs FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_sources ps
      JOIN public.project_members pm ON pm.project_id = ps.project_id AND pm.user_id = auth.uid()
      WHERE ps.id = project_source_sync_jobs.project_source_id
    )
  );

CREATE POLICY "project_source_sync_jobs_update_for_members"
  ON public.project_source_sync_jobs FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_sources ps
      JOIN public.project_members pm ON pm.project_id = ps.project_id AND pm.user_id = auth.uid()
      WHERE ps.id = project_source_sync_jobs.project_source_id
    )
  );

CREATE POLICY "project_source_sync_jobs_delete_for_members"
  ON public.project_source_sync_jobs FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.project_sources ps
      JOIN public.project_members pm ON pm.project_id = ps.project_id AND pm.user_id = auth.uid()
      WHERE ps.id = project_source_sync_jobs.project_source_id
    )
  );


-- -------- Migration: 20260308000000_external_integrations.sql --------

-- External integrations: OAuth-connected accounts (Google Drive, etc.) for project sources.
-- Additive; does not modify existing project_sources RLS, only adds column and new table.

-- 1) external_integrations
CREATE TABLE IF NOT EXISTS public.external_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  owner_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  display_name text NOT NULL,
  account_email text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_integrations_provider_check
    CHECK (provider IN ('google_drive')),
  CONSTRAINT external_integrations_status_check
    CHECK (status IN ('active', 'expired', 'revoked', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_external_integrations_owner ON public.external_integrations (owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_external_integrations_provider ON public.external_integrations (provider);
CREATE INDEX IF NOT EXISTS idx_external_integrations_status ON public.external_integrations (status);

COMMENT ON TABLE public.external_integrations IS
  'OAuth-connected external accounts (e.g. Google Drive) for syncing project sources. Tokens server-side only.';

DROP TRIGGER IF EXISTS set_external_integrations_updated_at ON public.external_integrations;
CREATE TRIGGER set_external_integrations_updated_at
  BEFORE UPDATE ON public.external_integrations
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

-- 2) RLS: users can only read/write their own integrations
ALTER TABLE public.external_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "external_integrations_select_own"
  ON public.external_integrations FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR owner_profile_id = auth.uid()
  );

CREATE POLICY "external_integrations_insert_own"
  ON public.external_integrations FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR owner_profile_id = auth.uid()
  );

CREATE POLICY "external_integrations_update_own"
  ON public.external_integrations FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR owner_profile_id = auth.uid()
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR owner_profile_id = auth.uid()
  );

CREATE POLICY "external_integrations_delete_own"
  ON public.external_integrations FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR owner_profile_id = auth.uid()
  );

-- 3) Add integration_id to project_sources (additive)
ALTER TABLE public.project_sources
  ADD COLUMN IF NOT EXISTS integration_id uuid REFERENCES public.external_integrations (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_sources_integration_id ON public.project_sources (integration_id);

COMMENT ON COLUMN public.project_sources.integration_id IS
  'Optional link to an external_integration (e.g. Google Drive) owned by the user. Validated on insert/update.';


-- -------- Migration: 20260328000000_knowledge_documents_project_metadata.sql --------

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
  external_ref text
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
    kd.external_ref
  FROM public.knowledge_documents kd
  WHERE kd.project_id = p_project_id
    AND kd.embedding IS NOT NULL
  ORDER BY kd.embedding <=> query_embedding
  LIMIT LEAST(match_limit, 20);
$$;

COMMENT ON FUNCTION public.search_project_knowledge_documents(uuid, vector(1536), int) IS
  'Semantic search over project-scoped knowledge_documents. Use for Sapito project answers; external SAP sources are a future layer.';


-- -------- Migration: 20260329000000_knowledge_sources.sql --------

-- Knowledge sources: unified table for agent knowledge (global + project-scoped).
-- Separates operational project_links from ingestible sources used by Sapito.
-- Additive; does not drop or alter project_links or project_sources.
-- project_id must be NULL when scope_type = 'global'; must be set when scope_type = 'project'.

-- 1) knowledge_sources
CREATE TABLE IF NOT EXISTS public.knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL,
  project_id uuid REFERENCES public.projects (id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_name text NOT NULL,
  external_ref text,
  source_url text,
  status text NOT NULL DEFAULT 'active',
  sync_enabled boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  integration_id uuid REFERENCES public.external_integrations (id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_sources_scope_type_check
    CHECK (scope_type IN ('global', 'project')),
  CONSTRAINT knowledge_sources_scope_project_check
    CHECK (
      (scope_type = 'global' AND project_id IS NULL)
      OR (scope_type = 'project' AND project_id IS NOT NULL)
    ),
  CONSTRAINT knowledge_sources_status_check
    CHECK (status IN ('active', 'paused', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_knowledge_sources_scope_project
  ON public.knowledge_sources (scope_type, project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_source_type
  ON public.knowledge_sources (source_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_integration_id
  ON public.knowledge_sources (integration_id)
  WHERE integration_id IS NOT NULL;

COMMENT ON TABLE public.knowledge_sources IS
  'Agent knowledge sources: global (admin-curated) and project-scoped. Used for ingestion/sync into knowledge_documents. Not operational links.';
COMMENT ON COLUMN public.knowledge_sources.scope_type IS 'global = admin-curated reusable; project = private to one project.';
COMMENT ON COLUMN public.knowledge_sources.project_id IS 'NULL for global; required for project scope. Project knowledge is never shared across projects.';

DROP TRIGGER IF EXISTS set_knowledge_sources_updated_at ON public.knowledge_sources;
CREATE TRIGGER set_knowledge_sources_updated_at
  BEFORE UPDATE ON public.knowledge_sources
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

-- 2) RLS: global only for superadmin; project for project members
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_sources_select_global_superadmin"
  ON public.knowledge_sources FOR SELECT
  USING (
    scope_type = 'global'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );

CREATE POLICY "knowledge_sources_select_project_members"
  ON public.knowledge_sources FOR SELECT
  USING (
    scope_type = 'project'
    AND project_id IS NOT NULL
    AND (
      auth.role() = 'service_role'
      OR EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = knowledge_sources.project_id AND pm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "knowledge_sources_insert_global_superadmin"
  ON public.knowledge_sources FOR INSERT
  WITH CHECK (
    scope_type = 'global'
    AND project_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );

CREATE POLICY "knowledge_sources_insert_project_members"
  ON public.knowledge_sources FOR INSERT
  WITH CHECK (
    scope_type = 'project'
    AND project_id IS NOT NULL
    AND (
      auth.role() = 'service_role'
      OR EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = knowledge_sources.project_id AND pm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "knowledge_sources_update_global_superadmin"
  ON public.knowledge_sources FOR UPDATE
  USING (
    scope_type = 'global'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  )
  WITH CHECK (
    scope_type = 'global'
    AND project_id IS NULL
  );

CREATE POLICY "knowledge_sources_update_project_members"
  ON public.knowledge_sources FOR UPDATE
  USING (
    scope_type = 'project'
    AND project_id IS NOT NULL
    AND (
      auth.role() = 'service_role'
      OR EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = knowledge_sources.project_id AND pm.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (scope_type = 'project' AND project_id IS NOT NULL);

CREATE POLICY "knowledge_sources_delete_global_superadmin"
  ON public.knowledge_sources FOR DELETE
  USING (
    scope_type = 'global'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );

CREATE POLICY "knowledge_sources_delete_project_members"
  ON public.knowledge_sources FOR DELETE
  USING (
    scope_type = 'project'
    AND project_id IS NOT NULL
    AND (
      auth.role() = 'service_role'
      OR EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = knowledge_sources.project_id AND pm.user_id = auth.uid()
      )
    )
  );

-- 3) Migrate existing project_sources into knowledge_sources (idempotent: only insert if not already present by external_ref + project_id + source_type)
INSERT INTO public.knowledge_sources (
  scope_type,
  project_id,
  source_type,
  source_name,
  external_ref,
  source_url,
  status,
  sync_enabled,
  last_synced_at,
  integration_id,
  created_by,
  created_at,
  updated_at
)
SELECT
  'project',
  ps.project_id,
  ps.source_type,
  ps.name,
  ps.external_id,
  ps.source_url,
  'active',
  COALESCE(ps.sync_enabled, false),
  ps.last_synced_at,
  ps.integration_id,
  ps.created_by,
  ps.created_at,
  ps.updated_at
FROM public.project_sources ps
WHERE NOT EXISTS (
  SELECT 1 FROM public.knowledge_sources ks
  WHERE ks.scope_type = 'project'
    AND ks.project_id = ps.project_id
    AND ks.source_type = ps.source_type
    AND ks.source_name = ps.name
    AND (
      (ks.external_ref IS NOT NULL AND ps.external_id IS NOT NULL AND ks.external_ref = ps.external_id)
      OR (ks.external_ref IS NULL AND ps.external_id IS NULL)
    )
);


-- -------- Migration: 20260329000001_global_knowledge_search_only.sql --------

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


-- -------- Migration: 20260330000000_knowledge_documents_sap_fields.sql --------

-- SAP Knowledge Engine: optional metadata fields for curated SAP documentation.
-- Additive; does not remove or change existing columns. Safe for existing data.

ALTER TABLE public.knowledge_documents
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS sap_component text;

COMMENT ON COLUMN public.knowledge_documents.topic IS 'SAP topic e.g. enterprise_structure, idoc_config';
COMMENT ON COLUMN public.knowledge_documents.source_url IS 'URL of source document e.g. SAP Help';
COMMENT ON COLUMN public.knowledge_documents.document_type IS 'e.g. sap_help, sap_note, curated';
COMMENT ON COLUMN public.knowledge_documents.sap_component IS 'SAP component e.g. SD-BF, MM';


-- -------- Migration: 20260331000000_knowledge_documents_scope_multitenant.sql --------

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


-- -------- Migration: 20260331000001_search_knowledge_multitenant.sql --------

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


-- -------- Migration: 20260332000000_project_knowledge_memory.sql --------

-- SAP Project Memory: store and reuse solutions discovered during projects.
-- Sapito learns from ticket closures, project notes, and document additions.

CREATE TABLE IF NOT EXISTS public.project_knowledge_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,

  title text,
  problem text,
  solution text NOT NULL,
  module text,

  source_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  embedding vector(1536)
);

COMMENT ON TABLE public.project_knowledge_memory IS 'SAP solutions learned from project experience (tickets, notes, documents). Used by Sapito with priority over documents and global knowledge.';
COMMENT ON COLUMN public.project_knowledge_memory.source_type IS 'Origin: ticket_closed, project_note, document_added';
COMMENT ON COLUMN public.project_knowledge_memory.embedding IS 'OpenAI text-embedding-3-small (1536 dims) for semantic search.';

CREATE INDEX IF NOT EXISTS idx_project_knowledge_memory_project_user
  ON public.project_knowledge_memory (project_id, user_id)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_knowledge_memory_embedding
  ON public.project_knowledge_memory
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 1);

-- Semantic search over project memory (filter by project_id and optionally user_id).
CREATE OR REPLACE FUNCTION public.search_project_knowledge_memory(
  p_project_id uuid,
  p_user_id uuid,
  query_embedding vector(1536),
  match_limit int DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  title text,
  problem text,
  solution text,
  module text,
  source_type text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.title,
    m.problem,
    m.solution,
    m.module,
    m.source_type,
    m.created_at
  FROM public.project_knowledge_memory m
  WHERE m.project_id = p_project_id
    AND (p_user_id IS NULL OR m.user_id = p_user_id)
    AND m.embedding IS NOT NULL
  ORDER BY m.embedding <=> query_embedding
  LIMIT LEAST(match_limit, 20);
$$;

COMMENT ON FUNCTION public.search_project_knowledge_memory(uuid, uuid, vector(1536), int) IS
  'Semantic search over project_knowledge_memory for Sapito. Filtered by project and user; used before documents and global knowledge.';


-- -------- Migration: 20260332000001_search_official_sap_knowledge.sql --------

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


-- -------- Migration: 20260333000000_knowledge_sources_sync_diagnostics.sql --------

-- Sync diagnostics for knowledge sources: persist last error and detail for admin UX.
-- Additive; does not drop or change existing columns.

ALTER TABLE public.knowledge_sources
  ADD COLUMN IF NOT EXISTS last_sync_error text,
  ADD COLUMN IF NOT EXISTS last_sync_status_detail text;

COMMENT ON COLUMN public.knowledge_sources.last_sync_error IS 'Last sync error message for display in Admin. Cleared on successful sync.';
COMMENT ON COLUMN public.knowledge_sources.last_sync_status_detail IS 'Short sync failure code for UI: no_content, js_required, zero_chunks, embed_failed, insert_failed, other.';

