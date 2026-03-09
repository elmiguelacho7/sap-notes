-- Align platform metrics RPC with dashboard list visibility.
-- Root cause: RPC get_platform_metrics counts only member+created_by projects/notes,
-- while dashboard lists (Supabase client) had no RLS on projects/notes and could show all.
-- Fix: (1) Add RLS SELECT on projects and notes so lists show same set as RPC.
--      (2) In RPC, when user is superadmin, count all projects/notes so KPIs match list.
-- No data changes. No destructive operations. Safe and reversible.

-- ---------------------------------------------------------------------------
-- 1) RLS on public.projects (SELECT only — mutations assumed via API/service role)
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_select_member_owner_superadmin ON public.projects;
CREATE POLICY projects_select_member_owner_superadmin
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role = 'superadmin'
    )
  );

COMMENT ON POLICY projects_select_member_owner_superadmin ON public.projects IS
  'Dashboard and lists: same visibility as get_platform_metrics (member, created_by, or superadmin).';

-- ---------------------------------------------------------------------------
-- 2) RLS on public.notes (SELECT only)
-- Notes visible if their project is visible, or user is superadmin (for project_id IS NULL).
-- Soft-delete (deleted_at) is not enforced here; app continues to filter .is("deleted_at", null).
-- ---------------------------------------------------------------------------
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notes_select_project_visibility_superadmin ON public.notes;
CREATE POLICY notes_select_project_visibility_superadmin
  ON public.notes
  FOR SELECT
  TO authenticated
  USING (
    (project_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = notes.project_id
          AND (p.created_by = auth.uid()
               OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
               OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.app_role = 'superadmin'))
      )
    ))
    OR (project_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin'))
  );

COMMENT ON POLICY notes_select_project_visibility_superadmin ON public.notes IS
  'Dashboard and lists: notes in visible projects only; superadmin sees all. Matches get_platform_metrics scope.';

-- Allow insert when user has access to the project (member/owner/superadmin)
DROP POLICY IF EXISTS notes_insert_project_visibility_superadmin ON public.notes;
CREATE POLICY notes_insert_project_visibility_superadmin
  ON public.notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (project_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = notes.project_id
          AND (p.created_by = auth.uid()
               OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
               OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.app_role = 'superadmin'))
      )
    ))
    OR (project_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.app_role = 'superadmin'))
  );

-- ---------------------------------------------------------------------------
-- 3) get_platform_metrics: when user is superadmin, count all projects/notes
--    so KPIs match the list (superadmin sees all via RLS).
-- ---------------------------------------------------------------------------
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
      WHERE lower(trim(coalesce(t.status, ''))) <> 'closed'
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
  'Platform metrics for dashboard/Sapito. Scope: project_members + projects.created_by; superadmin sees all. Aligned with RLS on projects/notes.';
