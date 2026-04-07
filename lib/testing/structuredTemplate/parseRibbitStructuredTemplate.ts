import * as XLSX from "xlsx";
import type { SapTestModuleValue } from "@/lib/testing/sapModuleCatalog";
import { RIBBIT_TEMPLATE_DOWNLOAD_NAME } from "@/lib/testing/structuredTemplate/generateRibbitTemplateXlsx";
import { normalizeSapImportedScript } from "@/lib/testing/sapScriptImport/normalizeSapImportedScript";
import type { SapImportedActivityDraft, SapImportedScriptDraft, SapImportedStepRow } from "@/lib/testing/sapScriptImport/types";
import { asTestScriptPriority } from "@/lib/testing/testScriptConstants";

export type StructuredTemplateStats = {
  scenarios: number;
  activities: number;
  steps: number;
  apps: number;
};

export type StructuredTemplateParseResult = {
  draft: SapImportedScriptDraft;
  warnings: string[];
  stats: StructuredTemplateStats;
};

export class StructuredTemplateParseError extends Error {
  constructor(
    message: string,
    public readonly code: "missing_sheet" | "missing_column" | "invalid_workbook" | "empty_steps",
    public readonly detail?: string
  ) {
    super(message);
    this.name = "StructuredTemplateParseError";
  }
}

function normCell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

function headerKey(h: string): string {
  return h.toLowerCase().replace(/\s+/g, " ").trim();
}

function findSheet(
  wb: XLSX.WorkBook,
  name: string
): { sheet: XLSX.WorkSheet; actualName: string } | null {
  const target = name.toLowerCase();
  for (const n of wb.SheetNames) {
    if (n.trim().toLowerCase() === target) {
      const sh = wb.Sheets[n];
      if (sh) return { sheet: sh, actualName: n };
    }
  }
  return null;
}

function rowObjects(sheet: XLSX.WorkSheet): Record<string, string>[] {
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  }).map((row) => {
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      o[String(k).trim()] = normCell(v);
    }
    return o;
  });
}

function firstDataRow(sheet: XLSX.WorkSheet): Record<string, string> | null {
  const rows = rowObjects(sheet);
  for (const r of rows) {
    const vals = Object.values(r).filter((x) => x.length > 0);
    if (vals.length > 0) return r;
  }
  return null;
}

/** Map template module labels to app catalog codes. */
function normalizeModuleFromTemplate(raw: string): { module: SapTestModuleValue; warning?: string } {
  const s = raw.trim();
  if (!s) return { module: "" };
  const lower = s.toLowerCase();
  const abbrev: Record<string, SapTestModuleValue> = {
    sd: "sd",
    mm: "mm",
    fi: "fi",
    co: "co",
    pp: "pp",
    wm: "wm",
    ewm: "ewm",
    qm: "qm",
    tm: "tm",
    btp: "btp",
    le: "le",
    basis: "basis",
    security: "security",
    abap: "abap",
    pm: "cross_functional",
    sac: "public_cloud",
    other: "cross_functional",
    "public cloud": "public_cloud",
    "on-prem": "on_prem",
    "cross-functional": "cross_functional",
  };
  if (abbrev[lower]) {
    if (lower === "pm" || lower === "sac" || lower === "other") {
      return { module: abbrev[lower], warning: `Module "${raw}" mapped to ${abbrev[lower]} (no exact catalog match).` };
    }
    return { module: abbrev[lower] };
  }
  if (lower.includes("—") || lower.includes("-")) {
    const head = lower.split(/[—\-]/)[0]?.trim() ?? "";
    if (abbrev[head]) return { module: abbrev[head] };
  }
  return { module: "", warning: `Unknown module "${raw}"; cleared.` };
}

function normalizeTestType(raw: string): "uat" | "sit" | "regression" {
  const s = raw.trim().toLowerCase();
  if (s === "sit") return "sit";
  if (s === "regression") return "regression";
  return "uat";
}

function normalizeStatus(raw: string): "draft" | "ready" | "archived" {
  const s = raw.trim().toLowerCase();
  if (s === "ready") return "ready";
  if (s === "archived") return "archived";
  return "draft";
}

function parseOptional(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  return s === "yes" || s === "y" || s === "true" || s === "1" || s === "x";
}

function col(row: Record<string, string>, ...aliases: string[]): string {
  const keys = Object.keys(row);
  for (const a of aliases) {
    const want = headerKey(a);
    for (const k of keys) {
      if (headerKey(k) === want) return row[k] ?? "";
    }
    for (const k of keys) {
      if (headerKey(k).includes(want) || want.includes(headerKey(k))) {
        if (want.length >= 4 || headerKey(k).length >= 4) return row[k] ?? "";
      }
    }
  }
  return "";
}

type StepRowParsed = {
  scenario: string;
  activity: string;
  app: string;
  order: number;
  action: string;
  instruction: string;
  expected: string;
  inputData: string;
  role: string;
  optional: boolean;
  notes: string;
  rowIndex: number;
};

export function parseRibbitStructuredTemplate(buffer: Buffer, fileName: string): StructuredTemplateParseResult {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    throw new StructuredTemplateParseError("Could not read the Excel file.", "invalid_workbook");
  }

  const scriptFound = findSheet(wb, "Script");
  const stepsFound = findSheet(wb, "Steps");
  if (!scriptFound) {
    throw new StructuredTemplateParseError('Missing required sheet "Script".', "missing_sheet", "Script");
  }
  if (!stepsFound) {
    throw new StructuredTemplateParseError('Missing required sheet "Steps".', "missing_sheet", "Steps");
  }

  const readmeFound = findSheet(wb, "README");
  const listsFound = findSheet(wb, "Lists");
  const warnings: string[] = [];
  if (!readmeFound) warnings.push('Optional sheet "README" not found — using official template is recommended.');
  if (!listsFound) warnings.push('Optional sheet "Lists" not found — use the downloadable template for valid picklists.');

  const scriptRow = firstDataRow(scriptFound.sheet);
  if (!scriptRow) {
    throw new StructuredTemplateParseError("Script sheet has no data row.", "missing_column");
  }

  const title = col(scriptRow, "Script Title", "Title");
  const testTypeRaw = col(scriptRow, "Test Type");
  if (!title.trim()) {
    throw new StructuredTemplateParseError('Script sheet: "Script Title" is required.', "missing_column", "Script Title");
  }
  if (!testTypeRaw.trim()) {
    throw new StructuredTemplateParseError('Script sheet: "Test Type" is required.', "missing_column", "Test Type");
  }

  const scopeItem = col(scriptRow, "Scope Item");
  const moduleRaw = col(scriptRow, "Module");
  const { module: moduleNorm, warning: modWarn } = normalizeModuleFromTemplate(moduleRaw);
  if (modWarn) warnings.push(modWarn);

  const priorityRaw = col(scriptRow, "Priority");
  const pr = asTestScriptPriority(priorityRaw) ?? "medium";
  if (priorityRaw.trim() && !asTestScriptPriority(priorityRaw)) {
    warnings.push(`Priority "${priorityRaw}" normalized to medium.`);
  }

  const statusRaw = col(scriptRow, "Status");
  const status = normalizeStatus(statusRaw || "draft");

  const objective = col(scriptRow, "Objective");
  const preconditions = col(scriptRow, "Preconditions");
  const businessConditions = col(scriptRow, "Business Conditions");
  const testData = col(scriptRow, "Test Data");
  const rolesRaw = col(scriptRow, "Business Roles");
  const sourceSystem = col(scriptRow, "Source System");
  let referenceNotes = col(scriptRow, "Reference Notes");
  if (sourceSystem.trim()) {
    const block = `Source system: ${sourceSystem.trim()}`;
    referenceNotes = referenceNotes.trim() ? `${referenceNotes.trim()}\n\n${block}` : block;
  }

  const business_roles = rolesRaw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const stepRowsRaw = rowObjects(stepsFound.sheet);
  const parsedSteps: StepRowParsed[] = [];
  let rowIdx = 2;
  for (const r of stepRowsRaw) {
    const scenario = col(r, "Scenario");
    const activity = col(r, "Activity");
    const instruction = col(r, "Instruction");
    const orderStr = col(r, "Step Order", "Order");
    const allEmpty = !scenario && !activity && !instruction && !orderStr;
    if (allEmpty) {
      rowIdx += 1;
      continue;
    }
    if (!scenario.trim() || !activity.trim()) {
      warnings.push(`Steps row ${rowIdx}: missing Scenario or Activity — row skipped.`);
      rowIdx += 1;
      continue;
    }
    const order = parseInt(String(orderStr).replace(/\D/g, ""), 10);
    if (!Number.isFinite(order) || order < 1) {
      warnings.push(`Steps row ${rowIdx}: invalid Step Order — defaulted to sequence.`);
    }
    if (!instruction.trim()) {
      warnings.push(`Steps row ${rowIdx}: Instruction required — row skipped.`);
      rowIdx += 1;
      continue;
    }
    parsedSteps.push({
      scenario: scenario.trim(),
      activity: activity.trim(),
      app: col(r, "App / Transaction", "App", "Transaction").trim(),
      order: Number.isFinite(order) && order >= 1 ? order : parsedSteps.length + 1,
      action: col(r, "Action").trim(),
      instruction: instruction.trim(),
      expected: col(r, "Expected Result", "Expected").trim(),
      inputData: col(r, "Input / Data", "Input", "Data").trim(),
      role: col(r, "Role").trim(),
      optional: parseOptional(col(r, "Optional")),
      notes: col(r, "Notes").trim(),
      rowIndex: rowIdx,
    });
    rowIdx += 1;
  }

  if (parsedSteps.length === 0) {
    throw new StructuredTemplateParseError("No valid step rows found on Steps sheet.", "empty_steps");
  }

  const groupMap = new Map<string, StepRowParsed[]>();
  for (const prs of parsedSteps) {
    const key = `${prs.scenario}\n${prs.activity}`;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(prs);
  }
  for (const arr of Array.from(groupMap.values())) {
    arr.sort((a: StepRowParsed, b: StepRowParsed) => a.order - b.order || a.rowIndex - b.rowIndex);
  }
  const orderedKeys = Array.from(groupMap.keys()).sort((ka, kb) => {
    const minA = Math.min(...(groupMap.get(ka) ?? []).map((x) => x.rowIndex));
    const minB = Math.min(...(groupMap.get(kb) ?? []).map((x) => x.rowIndex));
    return minA - minB;
  });

  type Group = SapImportedActivityDraft & { _key: string };
  const byKey = new Map<string, Group>();
  let activityOrder = 0;
  const appSet = new Set<string>();

  for (const key of orderedKeys) {
    const rows = groupMap.get(key) ?? [];
    const first = rows[0];
    if (!first) continue;
    const g: Group = {
      _key: key,
      scenario_name: first.scenario,
      activity_title: first.activity,
      activity_target_name: "",
      activity_target_url: "",
      business_role: "",
      activity_order: activityOrder++,
      steps: [],
    };
    byKey.set(key, g);
    let so = 1;
    for (const prs of rows) {
      if (prs.app) appSet.add(prs.app);
      const notesPart = prs.notes ? `\n\nNotes: ${prs.notes}` : "";
      const instr = prs.instruction + notesPart;
      g.steps.push({
        step_order: so++,
        step_name: prs.action || null,
        instruction: instr,
        expected_result: prs.expected || null,
        optional_flag: prs.optional,
        transaction_or_app: prs.app || null,
        business_role: prs.role || null,
        test_data_notes: prs.inputData || null,
      });
    }
  }

  const activities = orderedKeys
    .map((k) => byKey.get(k))
    .filter((x): x is Group => Boolean(x))
    .map(({ _key: _k, ...rest }) => rest);

  const scenarioSet = new Set(activities.map((a) => a.scenario_name.trim()).filter(Boolean));

  const partial: Partial<SapImportedScriptDraft> & {
    activities: SapImportedActivityDraft[];
    steps: SapImportedStepRow[];
  } = {
    title,
    objective,
    module: moduleNorm,
    test_type: normalizeTestType(testTypeRaw),
    priority: pr,
    status,
    preconditions,
    test_data: testData,
    business_conditions: businessConditions,
    reference_notes: referenceNotes,
    expected_result: "",
    scenario_path: "",
    scope_item_code: scopeItem,
    source_document_name: fileName || RIBBIT_TEMPLATE_DOWNLOAD_NAME,
    source_language: "",
    business_roles,
    activities,
    steps: [],
  };

  const draft = normalizeSapImportedScript(partial, {
    source_import_type: "structured_template",
    source_document_name: fileName || RIBBIT_TEMPLATE_DOWNLOAD_NAME,
  });

  const stats: StructuredTemplateStats = {
    scenarios: scenarioSet.size,
    activities: activities.length,
    steps: parsedSteps.length,
    apps: appSet.size,
  };

  return { draft, warnings, stats };
}
