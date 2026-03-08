/**
 * Lightweight query normalization for SAP-style questions to improve retrieval recall.
 * Used before generating the embedding for vector search.
 * Do not overcomplicate: small expansion layer only.
 */

const SAP_TERM_EXPANSIONS: Array<{ pattern: RegExp; expansion: string }> = [
  { pattern: /\bcusto\b/gi, expansion: "customizing" },
  { pattern: /\borganizaci[oó]n de ventas\b/gi, expansion: "sales organization" },
  { pattern: /\borganizacion de ventas\b/gi, expansion: "sales organization" },
  { pattern: /\bventas\b/gi, expansion: "sales" },
  { pattern: /\bidoc\b/gi, expansion: "ALE IDOC" },
  { pattern: /\bhu\b/gi, expansion: "handling unit" },
  { pattern: /\bewm\b/gi, expansion: "EWM warehouse" },
  { pattern: /\bmm\b/gi, expansion: "materials management" },
  { pattern: /\bsd\b/gi, expansion: "sales distribution" },
  { pattern: /\bfi\b/gi, expansion: "finance" },
  { pattern: /\bco\b/gi, expansion: "controlling" },
  { pattern: /\bconfiguraci[oó]n\b/gi, expansion: "configuration" },
  { pattern: /\btransacci[oó]n\b/gi, expansion: "transaction" },
  { pattern: /\bproceso\b/gi, expansion: "process" },
];

/**
 * Returns a single string with original query plus expansions for known SAP terms.
 * Used as the search query for embedding to improve recall. Original terms are preserved.
 */
export function normalizeQueryForSap(query: string | undefined): string {
  if (!query || typeof query !== "string") return "";
  const trimmed = query.trim();
  if (!trimmed) return "";

  const parts: string[] = [trimmed];
  for (const { pattern, expansion } of SAP_TERM_EXPANSIONS) {
    if (trimmed.match(pattern)) {
      parts.push(expansion);
    }
  }
  return Array.from(new Set(parts)).join(" ").trim();
}
