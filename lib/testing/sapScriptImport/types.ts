import type { SapTestModuleValue } from "@/lib/testing/sapModuleCatalog";
import type { TestScriptPriority } from "@/lib/testing/testScriptConstants";

export type SourceImportType = "manual" | "sap_docx" | "sap_xlsx" | "structured_template";

/** Raw row from XLSX before normalization */
export interface SapImportedStepRow {
  step_order: number;
  step_name?: string | null;
  instruction: string;
  expected_result?: string | null;
  optional_flag?: boolean;
  transaction_or_app?: string | null;
  business_role?: string | null;
  test_data_notes?: string | null;
}

/** One SAP Cloud ALM activity (or DOCX section) with nested actions. */
export interface SapImportedActivityDraft {
  scenario_name: string;
  activity_title: string;
  activity_target_name: string;
  activity_target_url: string;
  business_role: string;
  activity_order: number;
  steps: SapImportedStepRow[];
}

export interface SapImportedScriptDraft {
  title: string;
  objective: string;
  module: SapTestModuleValue;
  test_type: "uat" | "sit" | "regression";
  priority: TestScriptPriority;
  status: "draft" | "ready" | "ready_for_test" | "archived";
  scenario_path: string;
  source_document_name: string;
  source_language: string;
  scope_item_code: string;
  preconditions: string;
  test_data: string;
  business_conditions: string;
  reference_notes: string;
  expected_result: string;
  business_roles: string[];
  source_import_type: SourceImportType;
  /** ALM hierarchy when detected; empty = use flat `steps` only. */
  activities: SapImportedActivityDraft[];
  /** Flat steps (legacy / DOCX fallback); ignored on save when `activities` non-empty. */
  steps: SapImportedStepRow[];
}

export interface SapParseResult {
  draft: SapImportedScriptDraft;
  warnings: string[];
}
