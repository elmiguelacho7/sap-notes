export type TestScriptType = "uat" | "sit" | "regression";
/** Authoring / preparation lifecycle (not execution outcome). */
export type TestScriptStatus =
  | "draft"
  | "ready_for_test"
  | "in_review"
  | "approved"
  | "obsolete"
  | "archived";

export type TestCycleStatus =
  | "draft"
  | "ready"
  | "in_progress"
  | "blocked"
  | "completed"
  | "archived";

export type TestExecutionResult = "passed" | "failed" | "blocked" | "not_run";

export type ReadinessBucket = "not_ready" | "partially_ready" | "ready" | "strong";

export type CoverageHintKey =
  | "no_expected_results"
  | "no_test_data"
  | "no_linked_work_item"
  | "no_execution_history"
  | "no_app_transaction"
  | "flat_script_only"
  | "no_evidence"
  | "not_in_cycle";

export type TestExecutionEvidenceType = "screenshot" | "attachment" | "sap_document" | "note" | "link";

export type TestExecutionStepOutcome = {
  step_id: string;
  result: "passed" | "failed" | "blocked" | "skipped";
  note?: string | null;
};

export type TestScriptActivityRow = {
  id: string;
  test_script_id: string;
  scenario_name: string | null;
  activity_title: string;
  activity_target_name: string | null;
  activity_target_url: string | null;
  business_role: string | null;
  activity_order: number;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

export type TestScriptStepRow = {
  id: string;
  test_script_id: string;
  activity_id: string | null;
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

export type SourceImportType = "manual" | "sap_docx" | "sap_xlsx" | "structured_template";

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
  business_conditions: string | null;
  /** Narrative / reference content kept out of the main execution runbook. */
  reference_notes: string | null;
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
  test_cycle_id: string | null;
  step_outcomes: TestExecutionStepOutcome[] | null;
  created_at: string;
  /** Display name when enriched by the API (profile full_name or email). */
  executed_by_display?: string | null;
};

export type TestExecutionEvidenceRow = {
  id: string;
  execution_id: string;
  project_id: string;
  type: TestExecutionEvidenceType;
  title: string | null;
  description: string | null;
  file_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  sap_reference: string | null;
  external_url: string | null;
  created_by: string | null;
  created_at: string;
};

export type TestScriptListItem = TestScriptRow & {
  step_count: number;
  last_result: TestExecutionResult | null;
  last_executed_at: string | null;
  last_executed_by_display: string | null;
  execution_count: number;
  failed_execution_count: number;
  /** Latest execution id for this script (any cycle), when any run exists. */
  last_execution_id: string | null;
  readiness_bucket: ReadinessBucket;
  coverage_hints: CoverageHintKey[];
  cycle_count: number;
  linked_work_items_count: number;
};

export type TestScriptWithSteps = TestScriptRow & {
  activities: TestScriptActivityRow[];
  steps: TestScriptStepRow[];
};

/** Resolved titles for linked work items (script GET). */
export type LinkedTraceabilityItem = {
  id: string;
  title: string;
  badge: string | null;
  meta: string | null;
};

export type TestScriptExecutionSummary = {
  total_runs: number;
  failed_runs: number;
  defect_linked_count: number;
  last_result: TestExecutionResult | null;
  last_executed_at: string | null;
  last_executed_by_display: string | null;
  last_execution_id: string | null;
};

export type TestCycleSummary = {
  id: string;
  name: string;
};

export type TestScriptWithViewerContext = TestScriptWithSteps & {
  traceability_linked: {
    task: LinkedTraceabilityItem | null;
    ticket: LinkedTraceabilityItem | null;
    knowledge_page: LinkedTraceabilityItem | null;
  };
  execution_summary: TestScriptExecutionSummary;
  cycles_for_script: TestCycleSummary[];
  readiness_bucket: ReadinessBucket;
  coverage_hints: CoverageHintKey[];
};

/** Picker / search API row. */
export type TraceabilitySearchHit = {
  id: string;
  title: string;
  subtitle: string | null;
  meta: string | null;
};

export type TestScriptsListResponse = {
  scripts: TestScriptListItem[];
  stats: {
    total: number;
    /** Scripts in ready_for_test or approved authoring states. */
    ready: number;
    failedLastCount: number;
    lastExecutionAt: string | null;
    cycles_total: number;
    scripts_in_cycles_distinct: number;
    executions_total: number;
    failed_runs_total: number;
    open_defects: number;
    coverage_pct: number;
    readiness: {
      not_ready: number;
      partially_ready: number;
      ready: number;
      strong: number;
    };
    never_executed: number;
    not_in_cycle: number;
    no_traceability: number;
    no_evidence_on_latest: number;
  };
};

export type TestCycleRow = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: TestCycleStatus;
  owner_profile_id: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  goal: string | null;
  scope_summary: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type TestCycleListItem = TestCycleRow & {
  script_count: number;
  passed: number;
  failed: number;
  blocked: number;
  not_run: number;
  executed: number;
  open_defects: number;
  owner_display: string | null;
};

export type TestCycleScriptMember = {
  id: string;
  test_cycle_id: string;
  test_script_id: string;
  assignee_profile_id: string | null;
  priority: string | null;
  status_override: string | null;
  notes: string | null;
  created_at: string;
};

export type TestCycleDetailScriptRow = TestScriptListItem & {
  cycle_membership_id: string;
  assignee_profile_id: string | null;
  member_priority: string | null;
  status_override: string | null;
  member_notes: string | null;
  member_created_at: string;
  latest_cycle_result: TestExecutionResult | null;
  latest_cycle_executed_at: string | null;
  latest_cycle_execution_id: string | null;
  defect_count_cycle: number;
  evidence_count_latest_cycle: number;
  assignee_display: string | null;
};

export type TestCycleDetailResponse = {
  cycle: TestCycleRow & { owner_display: string | null };
  scripts: TestCycleDetailScriptRow[];
  kpis: {
    scripts: number;
    executed: number;
    passed: number;
    failed: number;
    blocked: number;
    not_run: number;
    open_defects: number;
    evidence_coverage_pct: number;
  };
};

export type TestingControlSummaryResponse = {
  cycles: TestCycleListItem[];
  stats: TestScriptsListResponse["stats"];
};
