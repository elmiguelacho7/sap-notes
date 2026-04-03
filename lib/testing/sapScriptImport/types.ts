import type { SapTestModuleValue } from "@/lib/testing/sapModuleCatalog";
import type { TestScriptPriority } from "@/lib/testing/testScriptConstants";

export type SourceImportType = "manual" | "sap_docx" | "sap_xlsx";

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

export interface SapImportedScriptDraft {
  title: string;
  objective: string;
  module: SapTestModuleValue;
  test_type: "uat" | "sit" | "regression";
  priority: TestScriptPriority;
  status: "draft" | "ready" | "archived";
  scenario_path: string;
  source_document_name: string;
  source_language: string;
  scope_item_code: string;
  preconditions: string;
  test_data: string;
  expected_result: string;
  business_roles: string[];
  source_import_type: SourceImportType;
  steps: SapImportedStepRow[];
}

export interface SapParseResult {
  draft: SapImportedScriptDraft;
  warnings: string[];
}
