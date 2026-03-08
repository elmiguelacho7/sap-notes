/**
 * Official SAP knowledge retrieval — placeholder for curated SAP sources.
 *
 * Retrieval order (Sapito): 1) Project context, 2) Internal global knowledge,
 * 3) Official SAP sources (this module), 4) General fallback.
 *
 * Do not implement uncontrolled web scraping. Only curated/approved sources
 * (e.g. SAP Help Portal sections, official product docs) registered in
 * knowledge_sources with source_type sap_help or official_web should be used.
 *
 * When indexing is implemented, chunks will be stored in knowledge_documents
 * with a source identifier (e.g. sap_help:<url_hash>) and retrieved here.
 */

import type { KnowledgeChunk } from "./knowledgeSearch";

/**
 * Retrieve context from official SAP knowledge sources (SAP Help, official SAP web).
 * Returns empty array until indexing and search are implemented.
 * Architecture is ready for: project → global → official SAP → fallback.
 */
export async function getOfficialSapKnowledgeContext(
  _query: string,
  _topK: number = 3
): Promise<KnowledgeChunk[]> {
  // TODO: When sap_help / official_web sources are indexed into knowledge_documents,
  // run semantic search filtered by source prefix (e.g. source LIKE 'sap_help:%')
  // and project_id IS NULL. Return chunks in same shape as knowledgeSearch.
  return [];
}
