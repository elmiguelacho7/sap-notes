/**
 * Server-side text extraction from PDF and DOCX buffers.
 * Used by Google Drive sync to ingest PDF/DOCX into knowledge_documents.
 * Fails gracefully; no secrets or document content in logs.
 */

/**
 * Extract text from a PDF buffer. Returns null on failure.
 */
export async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    const p = await import("pdf-parse");
    const pdfParse = (p as { default?: (buf: Buffer) => Promise<{ text?: string }> }).default ?? p;
    if (typeof pdfParse !== "function") return null;
    const data = await (pdfParse as (buf: Buffer) => Promise<{ text?: string }>)(buffer);
    const text = data?.text?.trim();
    if (!text || text.length === 0) return null;
    return text.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
  } catch (err) {
    console.warn("[documentExtractors] PDF extraction failed:", err instanceof Error ? err.message : "unknown");
    return null;
  }
}

/**
 * Extract plain text from a DOCX buffer. Returns null on failure.
 */
export async function extractDocxText(buffer: Buffer): Promise<string | null> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    const text = result?.value?.trim();
    if (!text || text.length === 0) return null;
    return text.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
  } catch (err) {
    console.warn("[documentExtractors] DOCX extraction failed:", err instanceof Error ? err.message : "unknown");
    return null;
  }
}
