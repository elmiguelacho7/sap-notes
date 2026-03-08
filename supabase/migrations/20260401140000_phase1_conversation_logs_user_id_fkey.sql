-- Phase 1 hardening: conversation_logs.user_id FK to profiles (DATABASE_ARCHITECTURE_AUDIT.md)
-- In this schema profiles.id = auth.uid(), so user_id is the auth user; add FK for referential integrity.
-- Use NOT VALID so existing rows with user_id not in profiles (e.g. placeholder UUIDs) do not block the migration.
-- After cleaning invalid user_ids, run: ALTER TABLE public.conversation_logs VALIDATE CONSTRAINT conversation_logs_user_id_fkey;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversation_logs' AND column_name = 'user_id'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'conversation_logs' AND c.conname = 'conversation_logs_user_id_fkey'
  ) THEN
    ALTER TABLE public.conversation_logs
      ADD CONSTRAINT conversation_logs_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES public.profiles (id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

COMMENT ON COLUMN public.conversation_logs.user_id IS
  'Auth user who sent the message (profiles.id = auth.uid()). FK to profiles for referential integrity.';
