/**
 * Phase 3 / Phase 5: External SAP fallback boundary (architecture only).
 *
 * Intentionally lightweight and disabled by default — no latency regression.
 * Future implementations can plug in behind `ExternalSapFallbackProvider`:
 * - official SAP curated corpora
 * - SAP Help–derived indexed content
 * - curated troubleshooting references
 *
 * Orchestration treats results as `external_supporting` in source governance; keep `enabled()` false until configured.
 */
export type ExternalSapDocument = {
  title: string;
  snippet: string;
  source_url?: string | null;
  provider: "sap_help" | "sap_note" | "community" | "web" | "unknown";
  confidence: "low" | "medium" | "high";
};

export type ExternalSapFallbackProvider = {
  name: string;
  enabled(): boolean;
  search(params: { query: string; topK: number }): Promise<ExternalSapDocument[]>;
};

export class DisabledExternalSapFallback implements ExternalSapFallbackProvider {
  name = "disabled";
  enabled(): boolean {
    return false;
  }
  async search(): Promise<ExternalSapDocument[]> {
    return [];
  }
}

/**
 * Resolve provider (future-ready). For now always returns disabled.
 * This keeps latency unchanged and avoids accidental external calls.
 */
export function getExternalSapFallbackProvider(): ExternalSapFallbackProvider {
  return new DisabledExternalSapFallback();
}

