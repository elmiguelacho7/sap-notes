-- 1) Añadir columna profile_id si no existe
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
