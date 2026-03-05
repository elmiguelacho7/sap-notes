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
