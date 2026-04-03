/**
 * Convert pasted/imported HTML into readable plain text for procedure fields.
 * Preserves rough structure: block breaks, list items, trimmed noise.
 */
export function sanitizeImportedHtmlToText(raw: string): string {
  if (raw == null || typeof raw !== "string") return "";
  let s = raw.replace(/\r\n/g, "\n").trim();
  if (!s) return "";

  const looksHtml = /<[a-z][\s\S]*>/i.test(s);
  if (!looksHtml) {
    return collapseWs(s);
  }

  s = s
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|tr|h[1-6]|li|table)\s*>/gi, "\n")
    .replace(/<\/\s*td\s*>/gi, " ")
    .replace(/<\s*li\s*>/gi, "\n• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"');

  return collapseWs(s);
}

function collapseWs(s: string): string {
  const lines = s
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0);
  return lines.join("\n").trim();
}

/** Apply sanitizer to fields that may contain Word/HTML paste noise. */
export function sanitizeStepTextFields<T extends { instruction?: string; expected_result?: string | null }>(row: T): T {
  return {
    ...row,
    instruction: sanitizeImportedHtmlToText(row.instruction ?? ""),
    expected_result:
      row.expected_result != null ? sanitizeImportedHtmlToText(String(row.expected_result)) : null,
  };
}
