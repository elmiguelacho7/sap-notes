/**
 * SAP pattern detection for Sapito.
 * Detects common SAP transactions, concepts, and terms to increase SAP intent confidence.
 */

/** Patterns that strongly indicate SAP context (transactions, tech terms). */
export const SAP_PATTERNS = [
  "VA01", "VA02", "VA03", "VK01", "VK02", "VK11", "VK12", "VL01N", "VL02N", "VL03N",
  "MIGO", "MIRO", "ME21N", "ME22N", "ME23N", "MM01", "MM02", "MM03",
  "SPRO", "SE38", "SE24", "SE80", "SM30", "SM31", "ST22", "SM21", "SM37", "WE20",
  "IDOC", "IDocs", "ALE", "EDI",
  "HU", "ATP", "CCM", "CO-PA", "COPA", "EWM", "WM", "SD", "MM", "FI", "CO",
  "FICO", "S/4HANA", "S4HANA", "ECC", "BTP", "Fiori", "FIORI",
] as const;

/**
 * Returns SAP patterns found in the message (case-insensitive, word-boundary aware).
 * Used to boost SAP intent confidence in classification.
 */
export function detectSapPatterns(message: string): string[] {
  if (!message || typeof message !== "string") return [];
  const normalized = message.replace(/\s+/g, " ").trim();
  const found: string[] = [];
  const seen = new Set<string>();
  for (const pattern of SAP_PATTERNS) {
    const key = pattern.toLowerCase().replace(/-/g, "");
    if (seen.has(key)) continue;
    const regex = new RegExp(`\\b${escapeRegex(pattern)}\\b`, "i");
    if (regex.test(message) || normalized.toLowerCase().includes(key)) {
      found.push(pattern);
      seen.add(key);
    }
  }
  return found;
}

/** Whether the message contains at least one known SAP pattern (increases intent confidence). */
export function hasSapPattern(message: string): boolean {
  return detectSapPatterns(message).length > 0;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
