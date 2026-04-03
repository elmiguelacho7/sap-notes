import type { SapTestModuleValue } from "@/lib/testing/sapModuleCatalog";
import { asTestScriptPriority, type TestScriptPriority } from "@/lib/testing/testScriptConstants";
import type { SapImportedScriptDraft, SapImportedStepRow, SourceImportType } from "./types";

function clampSteps(steps: SapImportedStepRow[]): SapImportedStepRow[] {
  const seen = new Set<number>();
  const out: SapImportedStepRow[] = [];
  let order = 1;
  for (const s of steps) {
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

function dedupeRoles(roles: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of roles) {
    const t = r.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

export interface NormalizeOptions {
  source_import_type: SourceImportType;
  source_document_name: string;
}

/**
 * Shared post-parse cleanup: trim strings, dedupe roles, renumber steps, default enums.
 */
export function normalizeSapImportedScript(
  partial: Partial<SapImportedScriptDraft> & { steps?: SapImportedStepRow[] },
  opts: NormalizeOptions
): SapImportedScriptDraft {
  const priority = asTestScriptPriority(partial.priority as string | undefined) ?? "medium";
  const testType = partial.test_type;
  const tt: "uat" | "sit" | "regression" =
    testType === "sit" || testType === "regression" ? testType : "uat";
  const status =
    partial.status === "ready" || partial.status === "archived" ? partial.status : "draft";
  const module = (partial.module as SapTestModuleValue | undefined) ?? "";

  return {
    title: (partial.title ?? "Imported test script").trim() || "Imported test script",
    objective: (partial.objective ?? "").trim(),
    module,
    test_type: tt,
    priority: priority as TestScriptPriority,
    status,
    scenario_path: (partial.scenario_path ?? "").trim(),
    source_document_name: (opts.source_document_name || (partial.source_document_name ?? "")).trim(),
    source_language: (partial.source_language ?? "").trim(),
    scope_item_code: (partial.scope_item_code ?? "").trim(),
    preconditions: (partial.preconditions ?? "").trim(),
    test_data: (partial.test_data ?? "").trim(),
    expected_result: (partial.expected_result ?? "").trim(),
    business_roles: dedupeRoles(partial.business_roles ?? []),
    source_import_type: opts.source_import_type,
    steps: clampSteps(partial.steps ?? []),
  };
}
