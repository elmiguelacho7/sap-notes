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
