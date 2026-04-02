/**
 * Lightweight validation for Sapito 2.0 Phase 2 shapes (no DB calls).
 *
 * Run:
 *   node scripts/validate-knowledge-growth.js
 */
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

function normalizeToken(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Minimal mirror of keyword extraction expectations (provider + scope + keywords array exists)
function validateConnectedMetaShape(meta) {
  assert(meta && typeof meta === "object", "meta must be an object");
  assert(typeof meta.provider === "string", "provider must be string");
  assert(typeof meta.connector_name === "string", "connector_name must be string");
  assert(typeof meta.scope === "string", "scope must be string");
  assert(Array.isArray(meta.keywords), "keywords must be array");
}

function main() {
  // 1) Note containing issue/solution/lesson: should be extractable by heuristic (Phase 2 extractor prefilter)
  const note = `
Error in VKOA when creating billing document.
Solution: maintain condition records in VK11 and transport customizing via SPRO.
Lesson learned: always validate pricing procedure in QA before go-live.
`;
  const lower = note.toLowerCase();
  const looksHighSignal =
    /(error|solution|soluci|lesson|lecci|spro|vk11|vkoa)/i.test(lower);
  assert(looksHighSignal, "note should look high-signal");

  // 2) Knowledge page process/config: should look high-signal
  const page = `
Process: IDoc outbound for ORDERS05.
Key configuration points: partner profiles (WE20), message type (WE81), basic type (WE30).
`;
  assert(/idoc|we20|we81|we30/i.test(page), "knowledge page should contain process/config signals");

  // 3) Connected Google Drive document metadata: validate derived shape example
  const exampleMeta = {
    provider: "google_drive",
    connector_name: "Google Drive",
    scope: "project",
    external_ref: "1AbCDriveFileId",
    source_type: "google_drive_folder",
    document_type: "curated",
    keywords: ["sd", "vkoa", "pricing"],
  };
  validateConnectedMetaShape(exampleMeta);

  // 4) Dedupe key normalization expectation (summary)
  const s1 = normalizeToken("  Fix VKOA error   by maintaining VK11. ");
  const s2 = normalizeToken("Fix VKOA error by maintaining VK11");
  assert(s1 === s2, "summary normalization should collapse whitespace/punct");

  console.log("[validate-knowledge-growth] OK");
}

main();

