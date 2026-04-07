import * as XLSX from "xlsx";
import { normalizeSapImportedScript } from "./normalizeSapImportedScript";
import { classifyXlsxRowContent } from "./xlsxRowSemantics";
import type { SapImportedActivityDraft, SapImportedStepRow, SapParseResult } from "./types";

function normCell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

function headerKey(h: string): string {
  return h.toLowerCase().replace(/\s+/g, " ").trim();
}

/** SAP Cloud ALM / upload-style export */
type AlmColMap = {
  testCaseName: number;
  activityTitle: number;
  actionTitle: number;
  actionInstructions: number;
  actionExpected: number;
  activityTargetName: number;
  activityTargetUrl: number;
  businessRole: number;
  testCasePriority: number;
  testCaseStatus: number;
};

function mapCloudAlmHeaders(headers: string[]): AlmColMap | null {
  const norm = headers.map(headerKey);
  const idx = (pred: (k: string) => boolean) => {
    const i = norm.findIndex(pred);
    return i >= 0 ? i : -1;
  };
  const testCaseName = idx((k) => /test\s*case\s*name/.test(k));
  const activityTitle = idx((k) => /activity\s*title/.test(k));
  const actionInstructions = idx((k) => /action\s*instructions/.test(k));
  if (testCaseName < 0 || activityTitle < 0 || actionInstructions < 0) return null;

  let actionTitleCol = idx((k) => /^action\s*title$/.test(k) || k.startsWith("action title"));
  if (actionTitleCol < 0) actionTitleCol = actionInstructions;

  return {
    testCaseName,
    activityTitle,
    actionTitle: actionTitleCol,
    actionInstructions,
    actionExpected: idx((k) => /action\s*expected\s*result/.test(k)),
    activityTargetName: idx((k) => /activity\s*target\s*name/.test(k)),
    activityTargetUrl: idx((k) => /activity\s*target\s*url/.test(k)),
    businessRole: idx((k) => /business\s*role/.test(k) && !/action/.test(k)),
    testCasePriority: idx((k) => /test\s*case\s*priority/.test(k)),
    testCaseStatus: idx((k) => /test\s*case\s*status/.test(k)),
  };
}

function parseCloudAlmSheet(
  sheet: XLSX.WorkSheet,
  warnings: string[]
): {
  activities: SapImportedActivityDraft[];
  titleHint: string;
  priorityHint: string;
  refAcc: string[];
  preAcc: string[];
} {
  const rows = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  if (!rows.length) return { activities: [], titleHint: "", priorityHint: "", refAcc: [], preAcc: [] };

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const r = rows[i];
    if (!Array.isArray(r)) continue;
    const joined = r.map(normCell).join(" ").toLowerCase();
    if (/test\s*case\s*name/.test(joined) && /activity\s*title/.test(joined) && /action\s*instructions/.test(joined)) {
      headerRowIdx = i;
      break;
    }
  }

  const headerCells = (rows[headerRowIdx] ?? []).map(normCell);
  const alm = mapCloudAlmHeaders(headerCells);
  if (!alm) {
    return { activities: [], titleHint: "", priorityHint: "", refAcc: [], preAcc: [] };
  }

  warnings.push("Detected SAP Cloud ALM–style columns; grouped into test case → activity → actions.");

  type Group = SapImportedActivityDraft & { _key: string };
  const byKey = new Map<string, Group>();
  let nextActivityOrder = 0;

  let titleHint = "";
  let priorityHint = "";
  const refAcc: string[] = [];
  const preAcc: string[] = [];

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r)) continue;
    const cells = r.map(normCell);
    if (cells.every((c) => !c)) continue;

    const testCase = cells[alm.testCaseName] || "Default test case";
    const actTitle = cells[alm.activityTitle] || "Activity";
    const key = `${testCase}\n${actTitle}`;

    if (!titleHint && testCase) titleHint = testCase;
    if (!priorityHint && alm.testCasePriority >= 0 && cells[alm.testCasePriority]) {
      priorityHint = cells[alm.testCasePriority].toLowerCase();
    }

    const instr = cells[alm.actionInstructions];
    if (!instr.trim()) continue;

    const actionTitle = alm.actionTitle >= 0 ? cells[alm.actionTitle] : "";
    const expected =
      alm.actionExpected >= 0 && cells[alm.actionExpected] ? cells[alm.actionExpected] : null;

    const sem = classifyXlsxRowContent(instr, actionTitle || null, expected);
    if (sem.kind === "reference") {
      refAcc.push(sem.text);
      continue;
    }
    if (sem.kind === "setup") {
      preAcc.push(sem.text);
      continue;
    }
    if (sem.kind === "skip") continue;

    const targetName = alm.activityTargetName >= 0 ? cells[alm.activityTargetName] : "";
    const targetUrl = alm.activityTargetUrl >= 0 ? cells[alm.activityTargetUrl] : "";
    const role = alm.businessRole >= 0 ? cells[alm.businessRole] : "";

    let g = byKey.get(key);
    if (!g) {
      g = {
        _key: key,
        scenario_name: testCase,
        activity_title: actTitle,
        activity_target_name: targetName,
        activity_target_url: targetUrl,
        business_role: role,
        activity_order: nextActivityOrder++,
        steps: [],
      };
      byKey.set(key, g);
    } else {
      if (!g.activity_target_name && targetName) g.activity_target_name = targetName;
      if (!g.activity_target_url && targetUrl) g.activity_target_url = targetUrl;
      if (!g.business_role && role) g.business_role = role;
    }

    g.steps.push({
      step_order: g.steps.length + 1,
      step_name: actionTitle?.trim() || null,
      instruction: instr.trim(),
      expected_result: expected?.trim() || null,
      optional_flag: /\boptional\b/i.test(instr),
      business_role: role?.trim() || null,
    });
  }

  const activities = Array.from(byKey.values())
    .sort((a, b) => a.activity_order - b.activity_order)
    .map(({ _key: _k, ...rest }) => rest);

  return { activities, titleHint, priorityHint, refAcc, preAcc };
}

/** Map common SAP / Excel column headers to field keys (flat fallback) */
function mapHeaderIndex(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const k = headerKey(h);
    if (!k) return;
    if (/^#|^no\.?|^step\s*#|^nr$/i.test(k) || k === "step") map.order = map.order ?? i;
    if (/step\s*name|process\s*step|^action\s*title$|^action$/i.test(k)) map.name = map.name ?? i;
    if (
      /instruction|test\s*procedure|procedure|description|action\s*instructions/i.test(k) &&
      !/expected/i.test(k)
    )
      map.instruction = map.instruction ?? i;
    if (/expected|result/i.test(k) && !/actual/i.test(k)) map.expected = map.expected ?? i;
    if (/role|actor|user/i.test(k) && !/action/i.test(k)) map.role = map.role ?? i;
    if (/transaction|t-?code|app|application/i.test(k)) map.tx = map.tx ?? i;
    if (/optional/i.test(k)) map.optional = map.optional ?? i;
    if (/test\s*data|data\s*notes/i.test(k)) map.dataNotes = map.dataNotes ?? i;
    if (/^test\s*case(\s*name)?$/i.test(k)) map.testCase = map.testCase ?? i;
    if (/^scenario$/i.test(k) || /^test\s*scenario$/i.test(k)) map.scenario = map.scenario ?? i;
    if (/^activity(\s*title)?$/i.test(k) && !/target/i.test(k)) map.activityTitle = map.activityTitle ?? i;
  });
  return map;
}

function rowsFromSheet(
  sheet: XLSX.WorkSheet,
  warnings: string[]
): {
  steps: SapImportedStepRow[];
  activities: SapImportedActivityDraft[];
  titleHint: string;
  refAcc: string[];
  preAcc: string[];
} {
  const rows = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  if (!rows.length) {
    return { steps: [], activities: [], titleHint: "", refAcc: [], preAcc: [] };
  }

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

  const refAcc: string[] = [];
  const preAcc: string[] = [];
  const dataStart = headerRowIdx + 1;
  const titleHint =
    normCell(rows[0]?.[0]) && headerRowIdx > 0 ? normCell(rows[0][0]) : "";

  const hierarchical =
    hasInstruction &&
    (col.testCase !== undefined || col.scenario !== undefined || col.activityTitle !== undefined);

  const readRowCells = (r: unknown[]) => {
    const cells = r.map(normCell);
    if (cells.every((c) => !c)) return null;

    let stepOrder = hasOrder && col.order !== undefined ? parseInt(cells[col.order].replace(/\D/g, ""), 10) : NaN;

    const instruction =
      col.instruction !== undefined
        ? cells[col.instruction]
        : cells.find((c, j) => j > 0 && c.length > 3) ?? cells[0] ?? "";
    if (!instruction.trim()) return null;

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

    const sem = classifyXlsxRowContent(instruction, stepName, expected);
    if (sem.kind === "reference") {
      refAcc.push(sem.text);
      return null;
    }
    if (sem.kind === "setup") {
      preAcc.push(sem.text);
      return null;
    }
    if (sem.kind === "skip") return null;

    return {
      cells,
      stepOrder,
      instruction: instruction.trim(),
      stepName: stepName?.trim() || null,
      expected: expected?.trim() || null,
      business_role: business_role?.trim() || null,
      transaction_or_app: transaction_or_app?.trim() || null,
      test_data_notes: test_data_notes?.trim() || null,
      optional_flag,
    };
  };

  if (hierarchical) {
    warnings.push("Grouped spreadsheet rows by scenario/test case and activity columns.");
    type Group = SapImportedActivityDraft & { _key: string };
    const byKey = new Map<string, Group>();
    let nextActivityOrder = 0;
    let order = 1;

    for (let i = dataStart; i < rows.length; i++) {
      const r = rows[i];
      if (!Array.isArray(r)) continue;
      const parsed = readRowCells(r);
      if (!parsed) continue;

      let stepOrder = parsed.stepOrder;
      if (!Number.isFinite(stepOrder) || stepOrder < 1) stepOrder = order;

      const scenarioPart =
        col.testCase !== undefined
          ? parsed.cells[col.testCase]
          : col.scenario !== undefined
            ? parsed.cells[col.scenario]
            : "";
      const actPart = col.activityTitle !== undefined ? parsed.cells[col.activityTitle] : "";
      const scen = scenarioPart.trim() || "Default scenario";
      const act = actPart.trim() || "General";
      const key = `${scen}\n${act}`;

      let g = byKey.get(key);
      if (!g) {
        g = {
          _key: key,
          scenario_name: scen,
          activity_title: act,
          activity_target_name: "",
          activity_target_url: "",
          business_role: parsed.business_role ?? "",
          activity_order: nextActivityOrder++,
          steps: [],
        };
        byKey.set(key, g);
      } else if (!g.business_role && parsed.business_role) {
        g.business_role = parsed.business_role;
      }

      g.steps.push({
        step_order: g.steps.length + 1,
        step_name: parsed.stepName,
        instruction: parsed.instruction,
        expected_result: parsed.expected,
        optional_flag: parsed.optional_flag,
        transaction_or_app: parsed.transaction_or_app,
        business_role: parsed.business_role,
        test_data_notes: parsed.test_data_notes,
      });
      order = stepOrder + 1;
    }

    const activities = Array.from(byKey.values())
      .sort((a, b) => a.activity_order - b.activity_order)
      .map(({ _key: _k, ...rest }) => rest);

    return { steps: [], activities, titleHint, refAcc, preAcc };
  }

  const steps: SapImportedStepRow[] = [];
  let order = 1;
  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r)) continue;
    const parsed = readRowCells(r);
    if (!parsed) continue;

    let stepOrder = parsed.stepOrder;
    if (!Number.isFinite(stepOrder) || stepOrder < 1) stepOrder = order;

    steps.push({
      step_order: stepOrder,
      step_name: parsed.stepName,
      instruction: parsed.instruction,
      expected_result: parsed.expected,
      optional_flag: parsed.optional_flag,
      transaction_or_app: parsed.transaction_or_app,
      business_role: parsed.business_role,
      test_data_notes: parsed.test_data_notes,
    });
    order = stepOrder + 1;
  }

  return { steps, activities: [], titleHint, refAcc, preAcc };
}

function mapPriorityFromHint(h: string): string | undefined {
  const s = h.toLowerCase();
  if (s.includes("critical")) return "critical";
  if (s.includes("high")) return "high";
  if (s.includes("low")) return "low";
  if (s.includes("medium")) return "medium";
  return undefined;
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
        { title: fileName, objective: "", steps: [], activities: [] },
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
        { title: fileName, objective: "", steps: [], activities: [] },
        { source_import_type: "sap_xlsx", source_document_name: fileName }
      ),
      warnings,
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const alm = parseCloudAlmSheet(sheet, warnings);

  if (alm.activities.length > 0) {
    const pr = mapPriorityFromHint(alm.priorityHint);
    const draft = normalizeSapImportedScript(
      {
        title: alm.titleHint || fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim(),
        objective: "",
        activities: alm.activities,
        steps: [],
        priority: pr as "low" | "medium" | "high" | "critical" | undefined,
        reference_notes: alm.refAcc.join("\n\n"),
        preconditions: alm.preAcc.join("\n\n"),
      },
      { source_import_type: "sap_xlsx", source_document_name: fileName }
    );
    return { draft, warnings };
  }

  const { steps, activities, titleHint, refAcc, preAcc } = rowsFromSheet(sheet, warnings);
  if (steps.length === 0 && activities.length === 0) {
    warnings.push("No step rows extracted from the first sheet.");
  }

  if (activities.length > 0) {
    const draft = normalizeSapImportedScript(
      {
        title: titleHint || fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim(),
        objective: "",
        activities,
        steps: [],
        reference_notes: refAcc.join("\n\n"),
        preconditions: preAcc.join("\n\n"),
      },
      { source_import_type: "sap_xlsx", source_document_name: fileName }
    );
    return { draft, warnings };
  }

  const draft = normalizeSapImportedScript(
    {
      title: titleHint || fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim(),
      objective: "",
      steps,
      activities: [],
      reference_notes: refAcc.join("\n\n"),
      preconditions: preAcc.join("\n\n"),
    },
    { source_import_type: "sap_xlsx", source_document_name: fileName }
  );

  return { draft, warnings };
}
