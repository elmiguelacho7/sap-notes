-- SAP Knowledge Engine: optional metadata fields for curated SAP documentation.
-- Additive; does not remove or change existing columns. Safe for existing data.

ALTER TABLE public.knowledge_documents
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS sap_component text;

COMMENT ON COLUMN public.knowledge_documents.topic IS 'SAP topic e.g. enterprise_structure, idoc_config';
COMMENT ON COLUMN public.knowledge_documents.source_url IS 'URL of source document e.g. SAP Help';
COMMENT ON COLUMN public.knowledge_documents.document_type IS 'e.g. sap_help, sap_note, curated';
COMMENT ON COLUMN public.knowledge_documents.sap_component IS 'SAP component e.g. SD-BF, MM';
