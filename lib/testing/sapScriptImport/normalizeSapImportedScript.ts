import type { SapTestModuleValue } from "@/lib/testing/sapModuleCatalog";
import { asTestScriptPriority, type TestScriptPriority } from "@/lib/testing/testScriptConstants";
import { sanitizeImportedHtmlToText } from "@/lib/testing/sanitizeImportedHtml";
import type { SapImportedActivityDraft, SapImportedScriptDraft, SapImportedStepRow, SourceImportType } from "./types";

function clean(s: string): string {
  return sanitizeImportedHtmlToText(s);
}

function cleanStep(s: SapImportedStepRow): SapImportedStepRow {
  return {
    ...s,
    step_name: s.step_name != null ? clean(s.step_name) || null : null,
    instruction: clean(s.instruction ?? ""),
    expected_result: s.expected_result != null ? clean(s.expected_result) || null : null,
    transaction_or_app: s.transaction_or_app != null ? clean(s.transaction_or_app) || null : null,
    business_role: s.business_role != null ? clean(s.business_role) || null : null,
    test_data_notes: s.test_data_notes != null ? clean(s.test_data_notes) || null : null,
  };
}

function clampSteps(steps: SapImportedStepRow[]): SapImportedStepRow[] {
  const seen = new Set<number>();
  const out: SapImportedStepRow[] = [];
  let order = 1;
  for (const s of steps.map(cleanStep)) {
    const inst = (s.instruction ?? "").trim();
    if (!inst) continue;
    let o = typeof s.step_order === "number" && s.step_order > 0 ? Math.floor(s.step_order) : order;
    while (seen.has(o)) o += 1;
    seen.add(o);
    out.push({
      step_order: o,
      step_name: s.step_name?.trim() || null,
      instruction: inst,
      expected_result: s.expected_result?.trim() || null,
      optional_flag: Boolean(s.optional_flag),
      transaction_or_app: s.transaction_or_app?.trim() || null,
      business_role: s.business_role?.trim() || null,
      test_data_notes: s.test_data_notes?.trim() || null,
    });
    order = o + 1;
  }
  return out.sort((a, b) => a.step_order - b.step_order);
}

function normalizeActivities(acts: SapImportedActivityDraft[]): SapImportedActivityDraft[] {
  return acts
    .map((a, idx) => ({
      scenario_name: clean(a.scenario_name ?? ""),
      activity_title: clean(a.activity_title ?? "").trim() || `Activity ${idx + 1}`,
      activity_target_name: clean(a.activity_target_name ?? ""),
      activity_target_url: clean(a.activity_target_url ?? "").trim(),
      business_role: clean(a.business_role ?? ""),
      activity_order: typeof a.activity_order === "number" ? a.activity_order : idx,
      steps: clampSteps(a.steps ?? []),
    }))
    .filter((a) => a.steps.length > 0 || a.activity_title.length > 0);
}

function dedupeRoles(roles: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of roles) {
    const t = clean(r).trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

function flattenActivities(acts: SapImportedActivityDraft[]): SapImportedStepRow[] {
  const out: SapImportedStepRow[] = [];
  let order = 1;
  for (const a of acts) {
    for (const s of a.steps) {
      out.push({ ...s, step_order: order++ });
    }
  }
  return out;
}

export interface NormalizeOptions {
  source_import_type: SourceImportType;
  source_document_name: string;
}

/**
 * Shared post-parse cleanup: trim strings, dedupe roles, sanitize HTML-ish text, hierarchy.
 */
export function normalizeSapImportedScript(
  partial: Partial<SapImportedScriptDraft> & {
    steps?: SapImportedStepRow[];
    activities?: SapImportedActivityDraft[];
  },
  opts: NormalizeOptions
): SapImportedScriptDraft {
  const priority = asTestScriptPriority(partial.priority as string | undefined) ?? "medium";
  const testType = partial.test_type;
  const tt: "uat" | "sit" | "regression" =
    testType === "sit" || testType === "regression" ? testType : "uat";
  const status =
    partial.status === "archived"
      ? "archived"
      : partial.status === "ready" || partial.status === "ready_for_test"
        ? "ready_for_test"
        : "draft";
  const module = (partial.module as SapTestModuleValue | undefined) ?? "";

  const activities = normalizeActivities(partial.activities ?? []);
  const flatSteps = clampSteps(partial.steps ?? []);
  const steps = activities.length > 0 ? flattenActivities(activities) : flatSteps;

  return {
    title: clean(partial.title ?? "Imported test script").trim() || "Imported test script",
    objective: clean(partial.objective ?? ""),
    module,
    test_type: tt,
    priority: priority as TestScriptPriority,
    status,
    scenario_path: clean(partial.scenario_path ?? ""),
    source_document_name: (opts.source_document_name || (partial.source_document_name ?? "")).trim(),
    source_language: clean(partial.source_language ?? ""),
    scope_item_code: clean(partial.scope_item_code ?? ""),
    preconditions: clean(partial.preconditions ?? ""),
    test_data: clean(partial.test_data ?? ""),
    business_conditions: clean(partial.business_conditions ?? ""),
    reference_notes: clean(partial.reference_notes ?? ""),
    expected_result: clean(partial.expected_result ?? ""),
    business_roles: dedupeRoles(partial.business_roles ?? []),
    source_import_type: opts.source_import_type,
    activities,
    steps,
  };
}
