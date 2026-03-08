# SAP Documentation Ingestion (Curated Only)

Index **explicitly registered** SAP Help / official SAP URLs into `knowledge_documents` for the Official SAP Knowledge Layer. No web crawling; only URLs listed in `sources.json` (or admin-registered sources) are fetched.

## Usage

```bash
# Optional: set path to sources JSON (default: scripts/sap-doc-ingestion/sources.json)
export SAP_DOC_SOURCES=./sources.json
npx tsx scripts/sap-doc-ingestion/importSapDocs.ts
```

Requires: `OPENAI_API_KEY`, `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## Source shape

Each entry in `sources.json`:

- `url` — single page URL (required)
- `title` — display title
- `module` — e.g. SD, MM, EWM, BC
- `topic` — e.g. enterprise_structure, ale_idoc, handling_unit
- `document_type` — `sap_help` or `sap_official`

See `sources.example.json`. Replace example ALE/IDOC and EWM URLs with real SAP Help links for your product/version.

## Validation / test cases

1. **Sales organization** — Use the sales-organization-configuration URL in the example; run the script, then ask Sapito (global): "How do I configure sales organization in SAP?" Expect an answer grounded in the indexed content.
2. **ALE/IDOC** — Add a valid SAP Help URL for IDoc overview; ingest; ask "What is ALE/IDoc?" in global mode. Expect retrieval from official SAP layer.
3. **Handling unit / EWM** — Add a valid EWM handling unit URL; ingest; ask "How do handling units work in EWM?" in global mode. In project mode, the same question should use official SAP as fallback after project memory/documents.

After ingestion, documents are chunked, embedded, and stored with `scope_type = 'global'` and `document_type = 'sap_help'` or `'sap_official'`. Retrieval uses `search_official_sap_knowledge`; Sapito can ground with "According to SAP documentation...".
