/**
 * Official SAP knowledge retrieval — curated SAP Help / official SAP docs.
 *
 * Retrieval order (Sapito): 1) Project context, 2) Internal global knowledge,
 * 3) Official SAP sources (this module), 4) General fallback.
 *
 * Only curated/approved sources (knowledge_sources with source_type sap_help or
 * official_web) are indexed into knowledge_documents with document_type sap_help
 * or sap_official. No uncontrolled web scraping.
 */

import {
  searchOfficialSapKnowledge,
  type KnowledgeChunk,
} from "@/lib/ai/knowledgeSearch";

/**
 * Retrieve context from official SAP knowledge (sap_help / sap_official chunks).
 * Runs semantic search over knowledge_documents where document_type IN ('sap_help','sap_official')
 * and scope_type = 'global'. Returns empty array when none indexed.
 */
export async function getOfficialSapKnowledgeContext(
  query: string,
  topK: number = 4
): Promise<KnowledgeChunk[]> {
  return searchOfficialSapKnowledge(query.trim(), topK);
}
