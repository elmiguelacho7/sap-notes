-- Phase 1: Quota / capacity limits (role_limits + user_limits).
-- Evaluation: user_limits override -> role_limits (by app role) -> unlimited.
-- Superadmin is treated as unlimited in application code.

-- ========== 1. role_limits (default by app role) ==========
CREATE TABLE IF NOT EXISTS public.role_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  limit_key text NOT NULL,
  value integer NOT NULL CHECK (value > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, limit_key)
);

CREATE INDEX IF NOT EXISTS idx_role_limits_role_id ON public.role_limits (role_id);
CREATE INDEX IF NOT EXISTS idx_role_limits_limit_key ON public.role_limits (limit_key);

COMMENT ON TABLE public.role_limits IS 'Quota defaults by app role. Only app-scope roles (superadmin, admin, consultant, viewer) are used.';

-- ========== 2. user_limits (per-user override) ==========
CREATE TABLE IF NOT EXISTS public.user_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  limit_key text NOT NULL,
  value integer NOT NULL CHECK (value > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, limit_key)
);

CREATE INDEX IF NOT EXISTS idx_user_limits_user_id ON public.user_limits (user_id);
CREATE INDEX IF NOT EXISTS idx_user_limits_limit_key ON public.user_limits (limit_key);

COMMENT ON TABLE public.user_limits IS 'Per-user quota overrides. Takes precedence over role_limits.';

-- ========== 3. RLS ==========
ALTER TABLE public.role_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_limits ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user (for enforcement and UI)
DROP POLICY IF EXISTS role_limits_select ON public.role_limits;
CREATE POLICY role_limits_select ON public.role_limits FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS user_limits_select ON public.user_limits;
CREATE POLICY user_limits_select ON public.user_limits FOR SELECT TO authenticated USING (true);

-- Write: superadmin only
DROP POLICY IF EXISTS role_limits_insert ON public.role_limits;
CREATE POLICY role_limits_insert ON public.role_limits FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'superadmin'));

DROP POLICY IF EXISTS role_limits_update ON public.role_limits;
CREATE POLICY role_limits_update ON public.role_limits FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'superadmin'));

DROP POLICY IF EXISTS role_limits_delete ON public.role_limits;
CREATE POLICY role_limits_delete ON public.role_limits FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'superadmin'));

DROP POLICY IF EXISTS user_limits_insert ON public.user_limits;
CREATE POLICY user_limits_insert ON public.user_limits FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'superadmin'));

DROP POLICY IF EXISTS user_limits_update ON public.user_limits;
CREATE POLICY user_limits_update ON public.user_limits FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'superadmin'));

DROP POLICY IF EXISTS user_limits_delete ON public.user_limits;
CREATE POLICY user_limits_delete ON public.user_limits FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'superadmin'));
