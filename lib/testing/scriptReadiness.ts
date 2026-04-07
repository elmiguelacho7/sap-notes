import type {
  CoverageHintKey,
  ReadinessBucket,
  TestScriptRow,
  TestScriptStepRow,
} from "@/lib/types/testing";

export function computeLinkedWorkCount(script: TestScriptRow): number {
  let n = 0;
  if (script.related_task_id) n += 1;
  if (script.related_ticket_id) n += 1;
  if (script.related_knowledge_page_id) n += 1;
  return n;
}

type StepAgg = {
  any_instruction: boolean;
  any_expected: boolean;
  any_txn: boolean;
  any_role: boolean;
  any_data_note: boolean;
};

function emptyStepAgg(): StepAgg {
  return {
    any_instruction: false,
    any_expected: false,
    any_txn: false,
    any_role: false,
    any_data_note: false,
  };
}

export function aggregateStepSignals(steps: TestScriptStepRow[]): StepAgg {
  const a = emptyStepAgg();
  for (const s of steps) {
    if ((s.instruction ?? "").trim().length > 0) a.any_instruction = true;
    if ((s.expected_result ?? "").trim().length > 0) a.any_expected = true;
    if ((s.transaction_or_app ?? "").trim().length > 0) a.any_txn = true;
    if ((s.business_role ?? "").trim().length > 0) a.any_role = true;
    if ((s.test_data_notes ?? "").trim().length > 0) a.any_data_note = true;
  }
  return a;
}

export function computeScriptReadiness(args: {
  script: TestScriptRow;
  stepAgg: StepAgg;
  activityCount: number;
  executionCount: number;
  cycleCount: number;
  evidenceExecutionIds: Set<string>;
  latestExecutionId: string | null;
}): { bucket: ReadinessBucket; hints: CoverageHintKey[] } {
  const { script, stepAgg, activityCount, executionCount, cycleCount, evidenceExecutionIds, latestExecutionId } =
    args;

  const hasTitle = (script.title ?? "").trim().length > 0;
  const hasSetup = !!(script.preconditions ?? "").trim() || !!(script.test_data ?? "").trim();
  const hasScriptExpected = !!(script.expected_result ?? "").trim();
  const hasExpected = hasScriptExpected || stepAgg.any_expected;
  const hasSteps = stepAgg.any_instruction;
  const hasScenarios = activityCount > 0;
  const hasTxn = stepAgg.any_txn;
  const rolesArr = Array.isArray(script.business_roles) ? (script.business_roles as string[]) : [];
  const hasRole = rolesArr.some((r) => r.trim().length > 0) || stepAgg.any_role;
  const hasTestDataField = !!(script.test_data ?? "").trim() || stepAgg.any_data_note;
  const linked = computeLinkedWorkCount(script);

  let score = 0;
  if (hasTitle) score += 1;
  if (hasSetup) score += 1;
  if (hasSteps) score += 2;
  if (hasExpected) score += 2;
  if (hasScenarios || (hasSteps && activityCount === 0 && stepAgg.any_instruction)) score += 1;
  if (hasTxn) score += 1;
  if (hasRole) score += 1;
  if (hasTestDataField) score += 1;
  if (linked > 0) score += 1;

  let bucket: ReadinessBucket;
  if (score <= 2 || !hasSteps) bucket = "not_ready";
  else if (score <= 5) bucket = "partially_ready";
  else if (score <= 7) bucket = "ready";
  else bucket = "strong";

  const hints: CoverageHintKey[] = [];
  if (!hasExpected) hints.push("no_expected_results");
  if (!hasTestDataField) hints.push("no_test_data");
  if (linked === 0) hints.push("no_linked_work_item");
  if (executionCount === 0) hints.push("no_execution_history");
  if (!hasTxn) hints.push("no_app_transaction");
  if (activityCount === 0 && hasSteps) hints.push("flat_script_only");
  if (latestExecutionId && !evidenceExecutionIds.has(latestExecutionId)) hints.push("no_evidence");
  if (cycleCount === 0) hints.push("not_in_cycle");

  return { bucket, hints };
}
