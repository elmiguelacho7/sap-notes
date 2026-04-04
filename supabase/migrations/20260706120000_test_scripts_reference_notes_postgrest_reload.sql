-- Ensure reference_notes exists on test_scripts after the table and related UAT columns are in place.
-- Idempotent. Refreshes PostgREST schema cache so the API sees the column immediately.

ALTER TABLE public.test_scripts
  ADD COLUMN IF NOT EXISTS reference_notes text;

COMMENT ON COLUMN public.test_scripts.reference_notes IS
  'Imported or manual reference narrative (purpose, overview, appendix); kept out of execution flow in Procedure UI.';

NOTIFY pgrst, 'reload schema';
