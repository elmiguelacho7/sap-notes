export type TestScriptType = "uat" | "sit" | "regression";
export type TestScriptStatus = "draft" | "ready" | "archived";
export type TestExecutionResult = "passed" | "failed" | "blocked" | "not_run";

export type TestScriptStepRow = {
  id: string;
  test_script_id: string;
  step_order: number;
  instruction: string;
  expected_result: string | null;
  step_name: string | null;
  optional_flag: boolean;
  transaction_or_app: string | null;
  business_role: string | null;
  test_data_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SourceImportType = "manual" | "sap_docx" | "sap_xlsx";

export type TestScriptRow = {
  id: string;
  project_id: string;
  title: string;
  objective: string | null;
  module: string | null;
  test_type: TestScriptType;
  priority: string | null;
  status: TestScriptStatus;
  preconditions: string | null;
  test_data: string | null;
  expected_result: string | null;
  scenario_path: string | null;
  source_document_name: string | null;
  source_language: string | null;
  scope_item_code: string | null;
  business_roles: unknown;
  source_import_type: SourceImportType;
  related_task_id: string | null;
  related_ticket_id: string | null;
  related_knowledge_page_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type TestExecutionRow = {
  id: string;
  test_script_id: string;
  project_id: string;
  executed_by: string;
  executed_at: string;
  result: TestExecutionResult;
  actual_result: string | null;
  evidence_notes: string | null;
  defect_ticket_id: string | null;
  created_at: string;
};

export type TestScriptListItem = TestScriptRow & {
  step_count: number;
  last_result: TestExecutionResult | null;
  last_executed_at: string | null;
};

export type TestScriptWithSteps = TestScriptRow & {
  steps: TestScriptStepRow[];
};

export type TestScriptsListResponse = {
  scripts: TestScriptListItem[];
  stats: {
    total: number;
    ready: number;
    failedLastCount: number;
    lastExecutionAt: string | null;
  };
};
