import * as XLSX from "xlsx";
import { normalizeSapImportedScript } from "./normalizeSapImportedScript";
import type { SapImportedStepRow, SapParseResult } from "./types";

function normCell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

function headerKey(h: string): string {
  return h.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Map common SAP / Excel column headers to field keys */
function mapHeaderIndex(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const k = headerKey(h);
    if (!k) return;
    if (/^#|^no\.?|^step\s*#|^nr$/i.test(k) || k === "step") map.order = map.order ?? i;
    if (/step\s*name|activity|process\s*step|action/i.test(k)) map.name = map.name ?? i;
    if (/instruction|test\s*procedure|procedure|description/i.test(k)) map.instruction = map.instruction ?? i;
    if (/expected|result/i.test(k) && !/actual/i.test(k)) map.expected = map.expected ?? i;
    if (/role|actor|user/i.test(k)) map.role = map.role ?? i;
    if (/transaction|t-?code|app|application/i.test(k)) map.tx = map.tx ?? i;
    if (/optional/i.test(k)) map.optional = map.optional ?? i;
    if (/test\s*data|data\s*notes/i.test(k)) map.dataNotes = map.dataNotes ?? i;
  });
  return map;
}

function rowsFromSheet(
  sheet: XLSX.WorkSheet,
  warnings: string[]
): { steps: SapImportedStepRow[]; titleHint: string } {
  const rows = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  if (!rows.length) return { steps: [], titleHint: "" };

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const r = rows[i];
    if (!Array.isArray(r)) continue;
    const joined = r.map(normCell).join(" ").toLowerCase();
    if (
      /step|instruction|expected|procedure|activity|transaction|role/i.test(joined) &&
      r.filter((c) => normCell(c)).length >= 2
    ) {
      headerRowIdx = i;
      break;
    }
  }

  const headerCells = (rows[headerRowIdx] ?? []).map(normCell);
  const col = mapHeaderIndex(headerCells);
  const hasInstruction = col.instruction !== undefined;
  const hasOrder = col.order !== undefined;
  if (!hasInstruction && !hasOrder) {
    warnings.push(
      "Could not detect a standard step table header; tried best-effort column mapping."
    );
  }

  const steps: SapImportedStepRow[] = [];
  const dataStart = headerRowIdx + 1;
  let order = 1;
  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r)) continue;
    const cells = r.map(normCell);
    if (cells.every((c) => !c)) continue;

    let stepOrder = hasOrder && col.order !== undefined ? parseInt(cells[col.order].replace(/\D/g, ""), 10) : NaN;
    if (!Number.isFinite(stepOrder) || stepOrder < 1) stepOrder = order;

    const instruction =
      col.instruction !== undefined
        ? cells[col.instruction]
        : cells.find((c, j) => j > 0 && c.length > 3) ?? cells[0] ?? "";
    if (!instruction.trim()) continue;

    const stepName = col.name !== undefined ? cells[col.name] || null : null;
    const expected = col.expected !== undefined ? cells[col.expected] || null : null;
    const business_role = col.role !== undefined ? cells[col.role] || null : null;
    const transaction_or_app = col.tx !== undefined ? cells[col.tx] || null : null;
    const test_data_notes = col.dataNotes !== undefined ? cells[col.dataNotes] || null : null;
    let optional_flag = false;
    if (col.optional !== undefined) {
      const o = cells[col.optional].toLowerCase();
      optional_flag = o === "x" || o === "yes" || o === "y" || o === "true" || o === "1";
    } else {
      optional_flag = /\boptional\b/i.test(instruction);
    }

    steps.push({
      step_order: stepOrder,
      step_name: stepName?.trim() || null,
      instruction: instruction.trim(),
      expected_result: expected?.trim() || null,
      optional_flag,
      transaction_or_app: transaction_or_app?.trim() || null,
      business_role: business_role?.trim() || null,
      test_data_notes: test_data_notes?.trim() || null,
    });
    order = stepOrder + 1;
  }

  const titleHint =
    normCell(rows[0]?.[0]) && headerRowIdx > 0 ? normCell(rows[0][0]) : "";

  return { steps, titleHint };
}

export function parseSapTestScriptXlsx(buffer: Buffer, fileName: string): SapParseResult {
  const warnings: string[] = [];
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch (e) {
    warnings.push(e instanceof Error ? e.message : "Could not read XLSX");
    return {
      draft: normalizeSapImportedScript(
        { title: fileName, objective: "", steps: [] },
        { source_import_type: "sap_xlsx", source_document_name: fileName }
      ),
      warnings,
    };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    warnings.push("Workbook has no sheets.");
    return {
      draft: normalizeSapImportedScript(
        { title: fileName, objective: "", steps: [] },
        { source_import_type: "sap_xlsx", source_document_name: fileName }
      ),
      warnings,
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const { steps, titleHint } = rowsFromSheet(sheet, warnings);
  if (steps.length === 0) {
    warnings.push("No step rows extracted from the first sheet.");
  }

  const draft = normalizeSapImportedScript(
    {
      title: titleHint || fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim(),
      objective: "",
      steps,
    },
    { source_import_type: "sap_xlsx", source_document_name: fileName }
  );

  return { draft, warnings };
}
