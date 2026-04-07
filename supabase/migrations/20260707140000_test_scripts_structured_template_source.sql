-- Allow Ribbit official structured template as a first-class import source.

ALTER TABLE public.test_scripts
  DROP CONSTRAINT IF EXISTS test_scripts_source_import_type_check;

ALTER TABLE public.test_scripts
  ADD CONSTRAINT test_scripts_source_import_type_check
  CHECK (source_import_type IN ('manual', 'sap_docx', 'sap_xlsx', 'structured_template'));

COMMENT ON COLUMN public.test_scripts.source_import_type IS
  'How the script was created: manual, SAP file import, or official Ribbit structured template.';

NOTIFY pgrst, 'reload schema';
