-- Testing/UAT: SAP import model — header enrichment, step metadata, controlled import source.

ALTER TABLE public.test_scripts
  ADD COLUMN IF NOT EXISTS scenario_path text,
  ADD COLUMN IF NOT EXISTS source_document_name text,
  ADD COLUMN IF NOT EXISTS source_language text,
  ADD COLUMN IF NOT EXISTS scope_item_code text,
  ADD COLUMN IF NOT EXISTS business_roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_import_type text NOT NULL DEFAULT 'manual'
    CHECK (source_import_type IN ('manual', 'sap_docx', 'sap_xlsx'));

COMMENT ON COLUMN public.test_scripts.scenario_path IS 'Variant / branch label (e.g. national vs international).';
COMMENT ON COLUMN public.test_scripts.source_document_name IS 'Original file name when imported from SAP-style doc.';
COMMENT ON COLUMN public.test_scripts.source_language IS 'Detected or declared document language.';
COMMENT ON COLUMN public.test_scripts.scope_item_code IS 'SAP Activate / fit-to-standard scope item if known.';
COMMENT ON COLUMN public.test_scripts.business_roles IS 'JSON array of role strings from import or manual entry.';
COMMENT ON COLUMN public.test_scripts.source_import_type IS 'How the script was created: manual or SAP file import.';

ALTER TABLE public.test_script_steps
  ADD COLUMN IF NOT EXISTS step_name text,
  ADD COLUMN IF NOT EXISTS optional_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS transaction_or_app text,
  ADD COLUMN IF NOT EXISTS business_role text,
  ADD COLUMN IF NOT EXISTS test_data_notes text;

COMMENT ON COLUMN public.test_script_steps.step_name IS 'Short label for the step (from SAP summary table or procedure).';
COMMENT ON COLUMN public.test_script_steps.optional_flag IS 'Optional / alternative path step.';
COMMENT ON COLUMN public.test_script_steps.transaction_or_app IS 'SAP transaction or Fiori app id when known.';
COMMENT ON COLUMN public.test_script_steps.business_role IS 'Executing business role for this step.';
COMMENT ON COLUMN public.test_script_steps.test_data_notes IS 'Test data hints for this step.';
