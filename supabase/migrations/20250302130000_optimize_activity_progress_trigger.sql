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
