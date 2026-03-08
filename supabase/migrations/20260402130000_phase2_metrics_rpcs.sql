-- Phase 2 optimization: metrics RPCs — single source of truth for dashboard and Sapito.
-- Access scope: member projects (project_members.user_id) + owned projects (projects.created_by).
-- SECURITY DEFINER so service role or authenticated can call; access enforced inside function.

-- Platform metrics: projects_total, projects_active, notes_total, notes_today, tickets_open
CREATE OR REPLACE FUNCTION public.get_platform_metrics(p_user_id uuid)
RETURNS TABLE(
  projects_total bigint,
  projects_active bigint,
  notes_total bigint,
  notes_today bigint,
  tickets_open bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_ids uuid[];
  v_today date := current_date;
BEGIN
  IF p_user_id IS NULL THEN
    projects_total := 0;
    projects_active := 0;
    notes_total := 0;
    notes_today := 0;
    tickets_open := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT array_agg(DISTINCT id)
  INTO v_project_ids
  FROM (
    SELECT project_id AS id FROM project_members WHERE user_id = p_user_id
    UNION
    SELECT id FROM projects WHERE created_by = p_user_id
  ) AS accessible;

  IF v_project_ids IS NULL OR array_length(v_project_ids, 1) IS NULL THEN
    projects_total := 0;
    projects_active := 0;
    notes_total := 0;
    notes_today := 0;
    tickets_open := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  RETURN QUERY
  WITH projs AS (
    SELECT p.id, p.status
    FROM projects p
    WHERE p.id = ANY(v_project_ids)
  ),
  active_count AS (
    SELECT count(*)::bigint AS cnt
    FROM projs
    WHERE projs.status IS NULL
       OR (lower(trim(projs.status)) <> 'completed'
           AND lower(trim(projs.status)) <> 'archived'
           AND projs.status NOT LIKE '%cerrado%'
           AND projs.status NOT LIKE '%closed%')
  ),
  n_total AS (
    SELECT count(*)::bigint FROM notes n
    WHERE n.project_id = ANY(v_project_ids) AND n.deleted_at IS NULL
  ),
  n_today AS (
    SELECT count(*)::bigint FROM notes n
    WHERE n.project_id = ANY(v_project_ids) AND n.deleted_at IS NULL
      AND n.created_at >= v_today
  ),
  t_open AS (
    SELECT count(*)::bigint FROM tickets t
    WHERE t.project_id = ANY(v_project_ids)
      AND lower(trim(coalesce(t.status, ''))) <> 'closed'
  )
  SELECT
    (SELECT count(*)::bigint FROM projs),
    (SELECT cnt FROM active_count),
    (SELECT * FROM n_total),
    (SELECT * FROM n_today),
    (SELECT * FROM t_open);
END;
$$;

COMMENT ON FUNCTION public.get_platform_metrics(uuid) IS
  'Platform metrics for dashboard/Sapito. Scope: project_members + projects.created_by. Returns projects_total, projects_active, notes_total, notes_today, tickets_open.';

-- Project metrics: single project; returns one row only if user has access
CREATE OR REPLACE FUNCTION public.get_project_metrics(p_project_id uuid, p_user_id uuid)
RETURNS TABLE(
  project_id uuid,
  project_name text,
  project_status text,
  open_tasks bigint,
  overdue_tasks bigint,
  blocked_tasks bigint,
  open_tickets bigint,
  high_priority_tickets bigint,
  overdue_activities bigint,
  upcoming_activities bigint,
  total_notes bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_access boolean;
  v_today date := current_date;
BEGIN
  project_id := p_project_id;
  project_name := NULL;
  project_status := NULL;
  open_tasks := 0;
  overdue_tasks := 0;
  blocked_tasks := 0;
  open_tickets := 0;
  high_priority_tickets := 0;
  overdue_activities := 0;
  upcoming_activities := 0;
  total_notes := 0;

  IF p_project_id IS NULL OR p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM project_members pm WHERE pm.project_id = p_project_id AND pm.user_id = p_user_id
    UNION ALL
    SELECT 1 FROM projects p WHERE p.id = p_project_id AND p.created_by = p_user_id
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM projects WHERE id = p_project_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH p AS (
    SELECT pr.id, pr.name, pr.status
    FROM projects pr
    WHERE pr.id = p_project_id
    LIMIT 1
  ),
  task_counts AS (
    SELECT
      count(*) FILTER (WHERE lower(trim(coalesce(pt.status, ''))) <> 'done')::bigint AS open_t,
      count(*) FILTER (WHERE pt.due_date IS NOT NULL AND pt.due_date < v_today AND lower(trim(coalesce(pt.status, ''))) <> 'done')::bigint AS overdue_t,
      count(*) FILTER (WHERE lower(trim(coalesce(pt.status, ''))) = 'blocked')::bigint AS blocked_t
    FROM project_tasks pt
    WHERE pt.project_id = p_project_id
  ),
  ticket_counts AS (
    SELECT
      count(*) FILTER (WHERE lower(trim(coalesce(t.status, ''))) <> 'closed')::bigint AS open_tkt,
      count(*) FILTER (WHERE lower(trim(coalesce(t.priority, ''))) IN ('high', 'urgent'))::bigint AS high_pri
    FROM tickets t
    WHERE t.project_id = p_project_id
  ),
  act_counts AS (
    SELECT
      count(*) FILTER (WHERE pa.due_date IS NOT NULL AND pa.due_date < v_today)::bigint AS overdue_a,
      count(*) FILTER (WHERE pa.due_date IS NOT NULL AND pa.due_date >= v_today)::bigint AS upcoming_a
    FROM project_activities pa
    WHERE pa.project_id = p_project_id
  ),
  note_count AS (
    SELECT count(*)::bigint FROM notes n
    WHERE n.project_id = p_project_id AND n.deleted_at IS NULL
  )
  SELECT
    (SELECT id FROM p),
    (SELECT name FROM p),
    (SELECT status FROM p),
    (SELECT open_t FROM task_counts),
    (SELECT overdue_t FROM task_counts),
    (SELECT blocked_t FROM task_counts),
    (SELECT open_tkt FROM ticket_counts),
    (SELECT high_pri FROM ticket_counts),
    (SELECT overdue_a FROM act_counts),
    (SELECT upcoming_a FROM act_counts),
    (SELECT * FROM note_count);
END;
$$;

COMMENT ON FUNCTION public.get_project_metrics(uuid, uuid) IS
  'Project metrics for one project. Returns one row only if user has access (member or owner). Used by Sapito and project dashboard.';

-- Grant execute to service_role and authenticated (app uses service role; RLS callers use authenticated)
GRANT EXECUTE ON FUNCTION public.get_platform_metrics(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_platform_metrics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_project_metrics(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_project_metrics(uuid, uuid) TO authenticated;
