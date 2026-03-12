-- Client management evolution: extend clients table and add client_contacts, client_systems.
-- Additive only; preserves projects.client_id and existing clients rows.

-- =============================================================================
-- 1. Extend public.clients (all new columns nullable)
-- =============================================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS subindustry text,
  ADD COLUMN IF NOT EXISTS company_size_bucket text,
  ADD COLUMN IF NOT EXISTS employee_range text,
  ADD COLUMN IF NOT EXISTS annual_revenue_range text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS preferred_language text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS parent_client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS account_group text,
  ADD COLUMN IF NOT EXISTS account_tier text,
  ADD COLUMN IF NOT EXISTS ownership_type text,
  ADD COLUMN IF NOT EXISTS business_model text,
  ADD COLUMN IF NOT EXISTS main_products_services text,
  ADD COLUMN IF NOT EXISTS sap_relevance_summary text,
  ADD COLUMN IF NOT EXISTS known_pain_points text,
  ADD COLUMN IF NOT EXISTS strategic_notes text,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid;

-- Trigger to set updated_at on update
CREATE OR REPLACE FUNCTION public.clients_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_updated_at_trigger ON public.clients;
CREATE TRIGGER clients_updated_at_trigger
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.clients_set_updated_at();

-- =============================================================================
-- 2. client_contacts
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  role_title text,
  is_primary boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid
);

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_contacts_select_policy ON public.client_contacts;
CREATE POLICY client_contacts_select_policy
  ON public.client_contacts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS client_contacts_insert_policy ON public.client_contacts;
CREATE POLICY client_contacts_insert_policy
  ON public.client_contacts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role IN ('superadmin', 'admin')
    )
  );

DROP POLICY IF EXISTS client_contacts_update_policy ON public.client_contacts;
CREATE POLICY client_contacts_update_policy
  ON public.client_contacts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role IN ('superadmin', 'admin')
    )
  );

DROP POLICY IF EXISTS client_contacts_delete_policy ON public.client_contacts;
CREATE POLICY client_contacts_delete_policy
  ON public.client_contacts FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role IN ('superadmin', 'admin')
    )
  );

-- =============================================================================
-- 3. client_systems
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.client_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  system_type text,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid
);

ALTER TABLE public.client_systems ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_systems_select_policy ON public.client_systems;
CREATE POLICY client_systems_select_policy
  ON public.client_systems FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS client_systems_insert_policy ON public.client_systems;
CREATE POLICY client_systems_insert_policy
  ON public.client_systems FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role IN ('superadmin', 'admin')
    )
  );

DROP POLICY IF EXISTS client_systems_update_policy ON public.client_systems;
CREATE POLICY client_systems_update_policy
  ON public.client_systems FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role IN ('superadmin', 'admin')
    )
  );

DROP POLICY IF EXISTS client_systems_delete_policy ON public.client_systems;
CREATE POLICY client_systems_delete_policy
  ON public.client_systems FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role IN ('superadmin', 'admin')
    )
  );

-- =============================================================================
-- 4. Clients table: allow admin to write (align with manage_clients permission)
-- =============================================================================

DROP POLICY IF EXISTS clients_insert_policy ON public.clients;
CREATE POLICY clients_insert_policy ON public.clients FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role IN ('superadmin', 'admin')
    )
  );

DROP POLICY IF EXISTS clients_update_policy ON public.clients;
CREATE POLICY clients_update_policy ON public.clients FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role IN ('superadmin', 'admin')
    )
  );

DROP POLICY IF EXISTS clients_delete_policy ON public.clients;
CREATE POLICY clients_delete_policy ON public.clients FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.app_role IN ('superadmin', 'admin')
    )
  );
