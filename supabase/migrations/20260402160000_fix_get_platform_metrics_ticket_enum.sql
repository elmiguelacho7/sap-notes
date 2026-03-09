-- Fix get_platform_metrics: tickets.status is ENUM (ticket_status).
-- PostgreSQL cannot coalesce an ENUM with ''; causes: invalid input value for enum ticket_status: ""
-- Replace unsafe: lower(trim(coalesce(t.status, ''))) <> 'closed'
-- With safe:     t.status IS NULL OR t.status::text <> 'closed'
-- Non-destructive: function replace only. All other logic unchanged.

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
  v_is_superadmin boolean;
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

  SELECT (p.app_role = 'superadmin')
  INTO v_is_superadmin
  FROM public.profiles p
  WHERE p.id = p_user_id
  LIMIT 1;

  IF v_is_superadmin THEN
    -- Superadmin sees all in dashboard lists (RLS); count all for consistency.
    RETURN QUERY
    WITH projs AS (
      SELECT p.id, p.status
      FROM projects p
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
      WHERE n.deleted_at IS NULL
    ),
    n_today AS (
      SELECT count(*)::bigint FROM notes n
      WHERE n.deleted_at IS NULL AND n.created_at >= v_today
    ),
    t_open AS (
      SELECT count(*)::bigint FROM tickets t
      WHERE (t.status IS NULL OR t.status::text <> 'closed')
    )
    SELECT
      (SELECT count(*)::bigint FROM projs),
      (SELECT cnt FROM active_count),
      (SELECT * FROM n_total),
      (SELECT * FROM n_today),
      (SELECT * FROM t_open);
    RETURN;
  END IF;

  -- Non-superadmin: same as before — member + created_by project set
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
      AND (t.status IS NULL OR t.status::text <> 'closed')
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
  'Platform metrics for dashboard/Sapito. Scope: project_members + projects.created_by; superadmin sees all. tickets_open uses enum-safe status check.';
