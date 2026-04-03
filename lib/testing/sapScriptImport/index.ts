export type { SapImportedScriptDraft, SapImportedStepRow, SapParseResult, SourceImportType } from "./types";
export { normalizeSapImportedScript } from "./normalizeSapImportedScript";
export { parseSapTestScriptDocx } from "./parseSapTestScriptDocx";
export { parseSapTestScriptXlsx } from "./parseSapTestScriptXlsx";

import { parseSapTestScriptDocx } from "./parseSapTestScriptDocx";
import { parseSapTestScriptXlsx } from "./parseSapTestScriptXlsx";
import type { SapParseResult } from "./types";

export async function parseSapTestScriptFile(buffer: Buffer, fileName: string): Promise<SapParseResult> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".docx")) {
    return parseSapTestScriptDocx(buffer, fileName);
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return parseSapTestScriptXlsx(buffer, fileName);
  }
  throw new Error("Unsupported file type. Use .docx, .xlsx, or .xls.");
}
