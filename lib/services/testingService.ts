import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidSapTestModule } from "@/lib/testing/sapModuleCatalog";
import { TEST_SCRIPT_PRIORITIES } from "@/lib/testing/testScriptConstants";
import { aggregateStepSignals, computeLinkedWorkCount, computeScriptReadiness } from "@/lib/testing/scriptReadiness";
import type {
  LinkedTraceabilityItem,
  SourceImportType,
  TestCycleDetailResponse,
  TestCycleListItem,
  TestCycleRow,
  TestCycleScriptMember,
  TestExecutionEvidenceRow,
  TestExecutionResult,
  TestExecutionRow,
  TestExecutionStepOutcome,
  TestScriptActivityRow,
  TestScriptExecutionSummary,
  TestScriptListItem,
  TestScriptRow,
  TestScriptStatus,
  TestScriptsListResponse,
  TestScriptStepRow,
  TestScriptType,
  TestScriptWithSteps,
  TestScriptWithViewerContext,
  TestingControlSummaryResponse,
  TraceabilitySearchHit,
} from "@/lib/types/testing";

const CLIENT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Optional FK UUIDs: invalid strings would make Postgres uuid columns reject the whole row. */
function optionalRelatedUuid(v: string | null | undefined): string | null {
  const t = v?.trim() || null;
  if (!t) return null;
  return CLIENT_UUID_RE.test(t) ? t : null;
}

function activityIdOrNew(id: string | undefined | null): string {
  if (id && CLIENT_UUID_RE.test(id.trim())) return id.trim();
  return randomUUID();
}

const TEST_TYPES = new Set<string>(["uat", "sit", "regression"]);
const STATUSES = new Set<string>([
  "draft",
  "ready_for_test",
  "in_review",
  "approved",
  "obsolete",
  "archived",
  "ready",
]);
const RESULTS = new Set<string>(["passed", "failed", "blocked", "not_run"]);
const CYCLE_STATUSES = new Set<string>([
  "draft",
  "ready",
  "in_progress",
  "blocked",
  "completed",
  "archived",
]);
const EVIDENCE_TYPES = new Set<string>(["screenshot", "attachment", "sap_document", "note", "link"]);
const SOURCE_IMPORT_TYPES = new Set<string>(["manual", "sap_docx", "sap_xlsx", "structured_template"]);

function asTestType(v: string | undefined | null): TestScriptType {
  const s = (v ?? "uat").toLowerCase();
  return TEST_TYPES.has(s) ? (s as TestScriptType) : "uat";
}

function asStatus(v: string | undefined | null): TestScriptStatus {
  const s = (v ?? "draft").toLowerCase();
  if (s === "ready") return "ready_for_test";
  return STATUSES.has(s) ? (s as TestScriptStatus) : "draft";
}

function asCycleStatus(v: string | undefined | null): TestCycleRow["status"] {
  const s = (v ?? "draft").toLowerCase();
  return CYCLE_STATUSES.has(s) ? (s as TestCycleRow["status"]) : "draft";
}

function asResult(v: string | undefined | null): TestExecutionResult {
  const s = (v ?? "not_run").toLowerCase();
  return RESULTS.has(s) ? (s as TestExecutionResult) : "not_run";
}

function asSourceImportType(v: string | undefined | null): SourceImportType {
  const s = (v ?? "manual").toLowerCase();
  return SOURCE_IMPORT_TYPES.has(s) ? (s as SourceImportType) : "manual";
}

function asPriorityStored(v: string | undefined | null): string | null {
  if (v == null || !String(v).trim()) return null;
  const s = String(v).toLowerCase().trim();
  return (TEST_SCRIPT_PRIORITIES as readonly string[]).includes(s) ? s : null;
}

function normalizeModule(v: string | undefined | null): string | null {
  if (v == null || !String(v).trim()) return null;
  const s = String(v).trim();
  if (!isValidSapTestModule(s) || s === "") return null;
  return s;
}

function normalizeBusinessRoles(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter((x) => x.length > 0)
      .slice(0, 50);
  }
  return [];
}

async function assertScriptProject(scriptId: string, projectId: string): Promise<TestScriptRow | null> {
  const { data, error } = await supabaseAdmin
    .from("test_scripts")
    .select("*")
    .eq("id", scriptId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as TestScriptRow | null;
}

async function validateTaskInProject(taskId: string, projectId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("project_tasks")
    .select("id")
    .eq("id", taskId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

async function validateTicketInProject(ticketId: string, projectId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("tickets")
    .select("id")
    .eq("id", ticketId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

async function validateKnowledgePageInProject(pageId: string, projectId: string): Promise<boolean> {
  const { data: page, error: pErr } = await supabaseAdmin
    .from("knowledge_pages")
    .select("space_id")
    .eq("id", pageId)
    .is("deleted_at", null)
    .maybeSingle();
  if (pErr || !page) return false;
  const { data: space, error: sErr } = await supabaseAdmin
    .from("knowledge_spaces")
    .select("id")
    .eq("id", (page as { space_id: string }).space_id)
    .eq("project_id", projectId)
    .maybeSingle();
  return !sErr && !!space;
}

async function profileDisplayByIds(userIds: string[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return new Map();
  const { data, error } = await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids);
  if (error || !data) return new Map();
  const m = new Map<string, string>();
  for (const p of data as { id: string; full_name: string | null; email: string | null }[]) {
    m.set(p.id, (p.full_name?.trim() || p.email?.trim() || p.id) ?? p.id);
  }
  return m;
}

function sanitizeIlikeFragment(raw: string): string {
  return raw.replace(/%/g, "").replace(/_/g, "").replace(/,/g, "").trim().slice(0, 80);
}

/** Batch list fields for arbitrary script rows in a project (avoids full-project list for cycle detail). */
export async function enrichTestScriptsWithListFields(
  projectId: string,
  list: TestScriptRow[]
): Promise<TestScriptListItem[]> {
  if (list.length === 0) return [];
  const ids = list.map((s) => s.id);

  const { data: cycleIdRows } = await supabaseAdmin
    .from("test_cycles")
    .select("id")
    .eq("project_id", projectId)
    .is("deleted_at", null);
  const cycleIds = (cycleIdRows ?? []).map((r) => (r as { id: string }).id);

  const { data: stepsAgg, error: stErr } = await supabaseAdmin
    .from("test_script_steps")
    .select("test_script_id")
    .in("test_script_id", ids);
  if (stErr) throw new Error(stErr.message);
  const stepCountByScript = new Map<string, number>();
  for (const row of stepsAgg ?? []) {
    const sid = (row as { test_script_id: string }).test_script_id;
    stepCountByScript.set(sid, (stepCountByScript.get(sid) ?? 0) + 1);
  }

  const { data: stepDetailRows, error: sdErr } = await supabaseAdmin
    .from("test_script_steps")
    .select("test_script_id, instruction, expected_result, transaction_or_app, business_role, test_data_notes")
    .in("test_script_id", ids);
  if (sdErr) throw new Error(sdErr.message);
  const stepsGrouped = new Map<string, TestScriptStepRow[]>();
  for (const raw of stepDetailRows ?? []) {
    const r = raw as TestScriptStepRow;
    const arr = stepsGrouped.get(r.test_script_id) ?? [];
    arr.push(r);
    stepsGrouped.set(r.test_script_id, arr);
  }

  const { data: actRows, error: aErr } = await supabaseAdmin
    .from("test_script_activities")
    .select("test_script_id")
    .in("test_script_id", ids);
  if (aErr) throw new Error(aErr.message);
  const activityCountByScript = new Map<string, number>();
  for (const row of actRows ?? []) {
    const sid = (row as { test_script_id: string }).test_script_id;
    activityCountByScript.set(sid, (activityCountByScript.get(sid) ?? 0) + 1);
  }

  let cycleMembership: { test_script_id: string }[] = [];
  if (cycleIds.length > 0) {
    const { data: mem, error: mErr } = await supabaseAdmin
      .from("test_cycle_scripts")
      .select("test_script_id")
      .in("test_cycle_id", cycleIds);
    if (mErr) throw new Error(mErr.message);
    cycleMembership = (mem ?? []) as { test_script_id: string }[];
  }
  const cycleCountByScript = new Map<string, number>();
  for (const row of cycleMembership) {
    cycleCountByScript.set(row.test_script_id, (cycleCountByScript.get(row.test_script_id) ?? 0) + 1);
  }

  const { data: execRows, error: eErr } = await supabaseAdmin
    .from("test_executions")
    .select("id, test_script_id, result, executed_at, executed_by")
    .eq("project_id", projectId)
    .in("test_script_id", ids)
    .order("executed_at", { ascending: false });
  if (eErr) throw new Error(eErr.message);

  const lastByScript = new Map<
    string,
    { id: string; result: TestExecutionResult; executed_at: string; executed_by: string }
  >();
  const countByScript = new Map<string, { total: number; failed: number }>();
  for (const row of execRows ?? []) {
    const r = row as {
      id: string;
      test_script_id: string;
      result: string;
      executed_at: string;
      executed_by: string;
    };
    if (!lastByScript.has(r.test_script_id)) {
      lastByScript.set(r.test_script_id, {
        id: r.id,
        result: asResult(r.result),
        executed_at: r.executed_at,
        executed_by: r.executed_by,
      });
    }
    const c = countByScript.get(r.test_script_id) ?? { total: 0, failed: 0 };
    c.total += 1;
    if (r.result === "failed") c.failed += 1;
    countByScript.set(r.test_script_id, c);
  }

  const latestExecIds = Array.from(lastByScript.values())
    .map((x) => x.id)
    .filter(Boolean);
  let evidenceExecutionIds = new Set<string>();
  if (latestExecIds.length > 0) {
    const { data: evRows, error: evErr } = await supabaseAdmin
      .from("test_execution_evidence")
      .select("execution_id")
      .eq("project_id", projectId)
      .in("execution_id", latestExecIds);
    if (evErr) throw new Error(evErr.message);
    for (const e of evRows ?? []) {
      evidenceExecutionIds.add((e as { execution_id: string }).execution_id);
    }
  }

  const lastRunnerIds = Array.from(lastByScript.values()).map((x) => x.executed_by);
  const profileMap = await profileDisplayByIds(lastRunnerIds);

  return list.map((s) => {
    const last = lastByScript.get(s.id);
    const counts = countByScript.get(s.id);
    const execution_count = counts?.total ?? 0;
    const stepAgg = aggregateStepSignals(stepsGrouped.get(s.id) ?? []);
    const activityCount = activityCountByScript.get(s.id) ?? 0;
    const cycle_count = cycleCountByScript.get(s.id) ?? 0;
    const last_execution_id = last?.id ?? null;
    const { bucket, hints } = computeScriptReadiness({
      script: s,
      stepAgg,
      activityCount,
      executionCount: execution_count,
      cycleCount: cycle_count,
      evidenceExecutionIds,
      latestExecutionId: last_execution_id,
    });
    return {
      ...s,
      step_count: stepCountByScript.get(s.id) ?? 0,
      last_result: last?.result ?? null,
      last_executed_at: last?.executed_at ?? null,
      execution_count,
      failed_execution_count: counts?.failed ?? 0,
      last_executed_by_display: last ? profileMap.get(last.executed_by) ?? null : null,
      last_execution_id,
      readiness_bucket: bucket,
      coverage_hints: hints,
      cycle_count,
      linked_work_items_count: computeLinkedWorkCount(s),
    };
  });
}

export async function listTestScriptsForProject(projectId: string): Promise<TestScriptsListResponse> {
  const [
    { data: scripts, error: sErr },
    { data: cycleIdRows },
    { count: executionsTotal, error: execCountErr },
    { count: failedRunsTotal },
    { count: openDefects },
  ] = await Promise.all([
    supabaseAdmin.from("test_scripts").select("*").eq("project_id", projectId).order("updated_at", { ascending: false }),
    supabaseAdmin.from("test_cycles").select("id").eq("project_id", projectId).is("deleted_at", null),
    supabaseAdmin.from("test_executions").select("*", { count: "exact", head: true }).eq("project_id", projectId),
    supabaseAdmin.from("test_executions").select("*", { count: "exact", head: true }).eq("project_id", projectId).eq("result", "failed"),
    supabaseAdmin
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId)
      .in("status", ["open", "in_progress", "pending"]),
  ]);
  if (sErr) throw new Error(sErr.message);
  if (execCountErr) throw new Error(execCountErr.message);

  const cycles_total = cycleIdRows?.length ?? 0;
  const cycleIds = (cycleIdRows ?? []).map((r) => (r as { id: string }).id);

  const list = (scripts ?? []) as TestScriptRow[];
  if (list.length === 0) {
    return {
      scripts: [],
      stats: {
        total: 0,
        ready: 0,
        failedLastCount: 0,
        lastExecutionAt: null,
        cycles_total,
        scripts_in_cycles_distinct: 0,
        executions_total: executionsTotal ?? 0,
        failed_runs_total: failedRunsTotal ?? 0,
        open_defects: openDefects ?? 0,
        coverage_pct: 0,
        readiness: { not_ready: 0, partially_ready: 0, ready: 0, strong: 0 },
        never_executed: 0,
        not_in_cycle: 0,
        no_traceability: 0,
        no_evidence_on_latest: 0,
      },
    };
  }

  let cycleMembership: { test_script_id: string }[] = [];
  if (cycleIds.length > 0) {
    const { data: mem, error: mErr } = await supabaseAdmin
      .from("test_cycle_scripts")
      .select("test_script_id")
      .in("test_cycle_id", cycleIds);
    if (mErr) throw new Error(mErr.message);
    cycleMembership = (mem ?? []) as { test_script_id: string }[];
  }
  const scriptsInCyclesSet = new Set<string>();
  for (const row of cycleMembership) {
    scriptsInCyclesSet.add(row.test_script_id);
  }
  const scripts_in_cycles_distinct = scriptsInCyclesSet.size;

  const enriched = await enrichTestScriptsWithListFields(projectId, list);

  let lastExecutionAt: string | null = null;
  let failedLastCount = 0;
  for (const s of enriched) {
    if (s.last_executed_at) {
      if (!lastExecutionAt || s.last_executed_at > lastExecutionAt) lastExecutionAt = s.last_executed_at;
    }
    if (s.last_result === "failed") failedLastCount += 1;
  }

  const readinessAgg = { not_ready: 0, partially_ready: 0, ready: 0, strong: 0 };
  let never_executed = 0;
  let not_in_cycle = 0;
  let no_traceability = 0;
  let no_evidence_on_latest = 0;
  let executedAtLeastOnce = 0;

  for (const s of enriched) {
    readinessAgg[s.readiness_bucket as keyof typeof readinessAgg] += 1;
    if (s.execution_count === 0) never_executed += 1;
    else executedAtLeastOnce += 1;
    if (s.cycle_count === 0) not_in_cycle += 1;
    if (s.linked_work_items_count === 0) no_traceability += 1;
    if (s.coverage_hints.includes("no_evidence")) no_evidence_on_latest += 1;
  }

  const ready = list.filter((x) => x.status === "ready_for_test" || x.status === "approved").length;
  const total = list.length;
  const coverage_pct =
    total > 0 ? Math.min(100, Math.round((executedAtLeastOnce / total) * 100)) : 0;

  return {
    scripts: enriched,
    stats: {
      total,
      ready,
      failedLastCount,
      lastExecutionAt,
      cycles_total,
      scripts_in_cycles_distinct,
      executions_total: executionsTotal ?? 0,
      failed_runs_total: failedRunsTotal ?? 0,
      open_defects: openDefects ?? 0,
      coverage_pct,
      readiness: readinessAgg,
      never_executed,
      not_in_cycle,
      no_traceability,
      no_evidence_on_latest,
    },
  };
}

export type CreateTestScriptStepInput = {
  instruction: string;
  expected_result?: string | null;
  step_name?: string | null;
  optional_flag?: boolean;
  transaction_or_app?: string | null;
  business_role?: string | null;
  test_data_notes?: string | null;
};

/** Flat activity row for PATCH replace (no nested steps). */
export type TestScriptActivityInput = {
  id?: string;
  scenario_name?: string | null;
  activity_title: string;
  activity_target_name?: string | null;
  activity_target_url?: string | null;
  business_role?: string | null;
  activity_order: number;
};

/** Nested activities + steps for create / import. */
export type CreateTestScriptActivityNestedInput = TestScriptActivityInput & {
  steps: CreateTestScriptStepInput[];
};

export type CreateTestScriptInput = {
  title: string;
  objective?: string | null;
  module?: string | null;
  test_type?: string | null;
  priority?: string | null;
  status?: string | null;
  preconditions?: string | null;
  test_data?: string | null;
  business_conditions?: string | null;
  reference_notes?: string | null;
  expected_result?: string | null;
  scenario_path?: string | null;
  source_document_name?: string | null;
  source_language?: string | null;
  scope_item_code?: string | null;
  business_roles?: unknown;
  source_import_type?: string | null;
  related_task_id?: string | null;
  related_ticket_id?: string | null;
  related_knowledge_page_id?: string | null;
  /** ALM-style groups; when non-empty, nested steps are used and top-level `steps` is ignored. */
  activities?: CreateTestScriptActivityNestedInput[];
  steps?: CreateTestScriptStepInput[];
};

export async function createTestScript(
  projectId: string,
  createdBy: string,
  input: CreateTestScriptInput
): Promise<TestScriptWithSteps> {
  const title = (input.title ?? "").trim();
  if (!title) throw new Error("title is required");

  let related_task_id = optionalRelatedUuid(input.related_task_id ?? null);
  let related_ticket_id = optionalRelatedUuid(input.related_ticket_id ?? null);
  const related_knowledge_page_id = optionalRelatedUuid(input.related_knowledge_page_id ?? null);

  if (related_task_id && !(await validateTaskInProject(related_task_id, projectId))) {
    throw new Error("related_task_id is not in this project");
  }
  if (related_ticket_id && !(await validateTicketInProject(related_ticket_id, projectId))) {
    throw new Error("related_ticket_id is not in this project");
  }
  if (
    related_knowledge_page_id &&
    !(await validateKnowledgePageInProject(related_knowledge_page_id, projectId))
  ) {
    throw new Error("related_knowledge_page_id is not in this project");
  }

  const insertRow = {
    project_id: projectId,
    title,
    objective: input.objective?.trim() || null,
    module: normalizeModule(input.module),
    test_type: asTestType(input.test_type),
    priority: asPriorityStored(input.priority),
    status: asStatus(input.status),
    preconditions: input.preconditions?.trim() || null,
    test_data: input.test_data?.trim() || null,
    business_conditions: input.business_conditions?.trim() || null,
    reference_notes: input.reference_notes?.trim() || null,
    expected_result: input.expected_result?.trim() || null,
    scenario_path: input.scenario_path?.trim() || null,
    source_document_name: input.source_document_name?.trim() || null,
    source_language: input.source_language?.trim() || null,
    scope_item_code: input.scope_item_code?.trim() || null,
    business_roles: normalizeBusinessRoles(input.business_roles),
    source_import_type: asSourceImportType(input.source_import_type),
    related_task_id,
    related_ticket_id,
    related_knowledge_page_id,
    created_by: createdBy,
  };

  const { data: script, error: insErr } = await supabaseAdmin
    .from("test_scripts")
    .insert(insertRow)
    .select("*")
    .single();
  if (insErr) throw new Error(insErr.message);
  const row = script as TestScriptRow;

  const activitiesIn = input.activities?.filter((a) => (a.steps?.length ?? 0) > 0) ?? [];
  if (activitiesIn.length > 0) {
    const sorted = [...activitiesIn].sort((a, b) => a.activity_order - b.activity_order);
    let stepOrder = 0;
    for (const act of sorted) {
      const aid = activityIdOrNew(act.id);
      const activityOrder =
        typeof act.activity_order === "number" && Number.isFinite(act.activity_order)
          ? Math.floor(act.activity_order)
          : 0;
      const { error: actErr } = await supabaseAdmin.from("test_script_activities").insert({
        id: aid,
        test_script_id: row.id,
        scenario_name: act.scenario_name?.trim() || null,
        activity_title: (act.activity_title ?? "").trim() || "Activity",
        activity_target_name: act.activity_target_name?.trim() || null,
        activity_target_url: act.activity_target_url?.trim() || null,
        business_role: act.business_role?.trim() || null,
        activity_order: activityOrder,
        metadata: {},
      });
      if (actErr) throw new Error(actErr.message);
      const stepsIn = act.steps ?? [];
      if (stepsIn.length > 0) {
        const stepRows = stepsIn.map((st) => {
          const r = {
            test_script_id: row.id,
            activity_id: aid,
            step_order: stepOrder++,
            instruction: (st.instruction ?? "").trim() || "—",
            expected_result: st.expected_result?.trim() || null,
            step_name: st.step_name?.trim() || null,
            optional_flag: Boolean(st.optional_flag),
            transaction_or_app: st.transaction_or_app?.trim() || null,
            business_role: st.business_role?.trim() || null,
            test_data_notes: st.test_data_notes?.trim() || null,
          };
          return r;
        });
        const { error: stepErr } = await supabaseAdmin.from("test_script_steps").insert(stepRows);
        if (stepErr) throw new Error(stepErr.message);
      }
    }
  } else {
    const stepsIn = input.steps ?? [];
    if (stepsIn.length > 0) {
      const stepRows = stepsIn.map((st, i) => ({
        test_script_id: row.id,
        activity_id: null as string | null,
        step_order: i,
        instruction: (st.instruction ?? "").trim() || "—",
        expected_result: st.expected_result?.trim() || null,
        step_name: st.step_name?.trim() || null,
        optional_flag: Boolean(st.optional_flag),
        transaction_or_app: st.transaction_or_app?.trim() || null,
        business_role: st.business_role?.trim() || null,
        test_data_notes: st.test_data_notes?.trim() || null,
      }));
      const { error: stepErr } = await supabaseAdmin.from("test_script_steps").insert(stepRows);
      if (stepErr) throw new Error(stepErr.message);
    }
  }

  return getTestScript(projectId, row.id);
}

export async function getTestScript(projectId: string, scriptId: string): Promise<TestScriptWithSteps> {
  const script = await assertScriptProject(scriptId, projectId);
  if (!script) throw new Error("Test script not found");

  const { data: activities, error: aErr } = await supabaseAdmin
    .from("test_script_activities")
    .select("*")
    .eq("test_script_id", scriptId)
    .order("activity_order", { ascending: true });
  if (aErr) throw new Error(aErr.message);

  const { data: steps, error } = await supabaseAdmin
    .from("test_script_steps")
    .select("*")
    .eq("test_script_id", scriptId)
    .order("step_order", { ascending: true });
  if (error) throw new Error(error.message);

  return {
    ...script,
    activities: (activities ?? []) as TestScriptActivityRow[],
    steps: (steps ?? []) as TestScriptStepRow[],
  };
}

async function buildExecutionSummary(
  projectId: string,
  scriptId: string
): Promise<TestScriptExecutionSummary> {
  const { data: execs, error } = await supabaseAdmin
    .from("test_executions")
    .select("id, result, executed_at, executed_by, defect_ticket_id")
    .eq("project_id", projectId)
    .eq("test_script_id", scriptId)
    .order("executed_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  const list = execs ?? [];
  if (list.length === 0) {
    return {
      total_runs: 0,
      failed_runs: 0,
      defect_linked_count: 0,
      last_result: null,
      last_executed_at: null,
      last_executed_by_display: null,
      last_execution_id: null,
    };
  }
  const first = list[0] as {
    id: string;
    result: string;
    executed_at: string;
    executed_by: string;
    defect_ticket_id: string | null;
  };
  let failed = 0;
  let defectLinked = 0;
  for (const row of list) {
    const r = row as { result: string; defect_ticket_id: string | null };
    if (r.result === "failed") failed += 1;
    if (r.defect_ticket_id) defectLinked += 1;
  }
  const prof = await profileDisplayByIds([first.executed_by]);
  return {
    total_runs: list.length,
    failed_runs: failed,
    defect_linked_count: defectLinked,
    last_result: asResult(first.result),
    last_executed_at: first.executed_at,
    last_executed_by_display: prof.get(first.executed_by) ?? null,
    last_execution_id: first.id,
  };
}

async function buildTraceabilityLinked(
  projectId: string,
  script: TestScriptRow
): Promise<TestScriptWithViewerContext["traceability_linked"]> {
  let task: LinkedTraceabilityItem | null = null;
  let ticket: LinkedTraceabilityItem | null = null;
  let knowledge_page: LinkedTraceabilityItem | null = null;

  if (script.related_task_id) {
    const { data } = await supabaseAdmin
      .from("project_tasks")
      .select("id, title, status, priority, due_date, assignee_profile_id")
      .eq("id", script.related_task_id)
      .eq("project_id", projectId)
      .maybeSingle();
    if (data) {
      const row = data as {
        id: string;
        title: string;
        status: string;
        priority: string;
        due_date: string | null;
        assignee_profile_id: string | null;
      };
      const assigneeMap = row.assignee_profile_id
        ? await profileDisplayByIds([row.assignee_profile_id])
        : new Map<string, string>();
      const due = row.due_date
        ? new Date(row.due_date).toLocaleDateString(undefined, { dateStyle: "short" })
        : null;
      task = {
        id: row.id,
        title: row.title,
        badge: row.status,
        meta: [assigneeMap.get(row.assignee_profile_id ?? "") ?? null, due].filter(Boolean).join(" · ") || null,
      };
    }
  }

  if (script.related_ticket_id) {
    const { data } = await supabaseAdmin
      .from("tickets")
      .select("id, title, status, priority, assigned_to")
      .eq("id", script.related_ticket_id)
      .eq("project_id", projectId)
      .maybeSingle();
    if (data) {
      const row = data as {
        id: string;
        title: string;
        status: string;
        priority: string;
        assigned_to: string | null;
      };
      const assigneeMap = row.assigned_to ? await profileDisplayByIds([row.assigned_to]) : new Map<string, string>();
      ticket = {
        id: row.id,
        title: row.title,
        badge: row.status,
        meta: [row.priority, assigneeMap.get(row.assigned_to ?? "") ?? null].filter(Boolean).join(" · ") || null,
      };
    }
  }

  if (script.related_knowledge_page_id) {
    const { data: page } = await supabaseAdmin
      .from("knowledge_pages")
      .select("id, title, page_type, space_id")
      .eq("id", script.related_knowledge_page_id)
      .maybeSingle();
    if (page) {
      const row = page as { id: string; title: string; page_type: string; space_id: string };
      const { data: sp } = await supabaseAdmin
        .from("knowledge_spaces")
        .select("name, project_id")
        .eq("id", row.space_id)
        .maybeSingle();
      const space = sp as { name: string; project_id: string | null } | null;
      if (space?.project_id === projectId) {
        knowledge_page = {
          id: row.id,
          title: row.title,
          badge: row.page_type.replace(/_/g, " "),
          meta: space.name ?? null,
        };
      }
    }
  }

  return { task, ticket, knowledge_page };
}

async function listCyclesContainingScript(
  projectId: string,
  scriptId: string
): Promise<{ id: string; name: string }[]> {
  const { data: cycles, error: cErr } = await supabaseAdmin
    .from("test_cycles")
    .select("id")
    .eq("project_id", projectId)
    .is("deleted_at", null);
  if (cErr) throw new Error(cErr.message);
  const cids = (cycles ?? []).map((r) => (r as { id: string }).id);
  if (cids.length === 0) return [];
  const { data: mem, error: mErr } = await supabaseAdmin
    .from("test_cycle_scripts")
    .select("test_cycle_id")
    .eq("test_script_id", scriptId)
    .in("test_cycle_id", cids);
  if (mErr) throw new Error(mErr.message);
  const memberCycleIds = new Set((mem ?? []).map((r) => (r as { test_cycle_id: string }).test_cycle_id));
  if (memberCycleIds.size === 0) return [];
  const { data: names, error: nErr } = await supabaseAdmin
    .from("test_cycles")
    .select("id, name")
    .in("id", Array.from(memberCycleIds))
    .is("deleted_at", null);
  if (nErr) throw new Error(nErr.message);
  return (names ?? []).map((r) => ({ id: (r as { id: string }).id, name: (r as { name: string }).name }));
}

export async function getTestScriptWithViewerContext(
  projectId: string,
  scriptId: string
): Promise<TestScriptWithViewerContext> {
  const base = await getTestScript(projectId, scriptId);
  const [execution_summary, traceability_linked, cycles_for_script] = await Promise.all([
    buildExecutionSummary(projectId, scriptId),
    buildTraceabilityLinked(projectId, base),
    listCyclesContainingScript(projectId, scriptId),
  ]);
  const stepAgg = aggregateStepSignals(base.steps);
  const activityCount = base.activities.length;
  const executionCount = execution_summary.total_runs;
  const cycleCount = cycles_for_script.length;
  let evidenceExecutionIds = new Set<string>();
  if (execution_summary.last_execution_id) {
    const { data: evRows, error: evErr } = await supabaseAdmin
      .from("test_execution_evidence")
      .select("execution_id")
      .eq("project_id", projectId)
      .eq("execution_id", execution_summary.last_execution_id);
    if (evErr) throw new Error(evErr.message);
    for (const e of evRows ?? []) {
      evidenceExecutionIds.add((e as { execution_id: string }).execution_id);
    }
  }
  const { bucket, hints } = computeScriptReadiness({
    script: base,
    stepAgg,
    activityCount,
    executionCount,
    cycleCount,
    evidenceExecutionIds,
    latestExecutionId: execution_summary.last_execution_id,
  });
  return {
    ...base,
    traceability_linked,
    execution_summary,
    cycles_for_script,
    readiness_bucket: bucket,
    coverage_hints: hints,
  };
}

export async function searchTestingTraceability(
  projectId: string,
  kind: "task" | "ticket" | "page",
  query: string,
  limit = 20
): Promise<TraceabilitySearchHit[]> {
  const lim = Math.min(Math.max(limit, 1), 40);
  const q = sanitizeIlikeFragment(query);
  const pat = q ? `%${q}%` : null;

  if (kind === "task") {
    let qb = supabaseAdmin
      .from("project_tasks")
      .select("id, title, status, priority, due_date, assignee_profile_id")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(lim);
    if (pat) {
      qb = qb.or(`title.ilike.${pat},description.ilike.${pat}`);
    }
    const { data, error } = await qb;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as {
      id: string;
      title: string;
      status: string;
      priority: string;
      due_date: string | null;
      assignee_profile_id: string | null;
    }[];
    const assignees = rows.map((r) => r.assignee_profile_id).filter((x): x is string => !!x);
    const amap = await profileDisplayByIds(assignees);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      subtitle: r.status,
      meta: [
        r.priority,
        r.due_date
          ? new Date(r.due_date).toLocaleDateString(undefined, { dateStyle: "short" })
          : null,
        r.assignee_profile_id ? amap.get(r.assignee_profile_id) : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    }));
  }

  if (kind === "ticket") {
    let qb = supabaseAdmin
      .from("tickets")
      .select("id, title, status, priority, assigned_to")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(lim);
    if (pat) {
      qb = qb.or(`title.ilike.${pat},description.ilike.${pat}`);
    }
    const { data, error } = await qb;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as {
      id: string;
      title: string;
      status: string;
      priority: string;
      assigned_to: string | null;
    }[];
    const assignees = rows.map((r) => r.assigned_to).filter((x): x is string => !!x);
    const amap = await profileDisplayByIds(assignees);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      subtitle: `${r.priority} · ${r.status}`,
      meta: r.assigned_to ? amap.get(r.assigned_to) ?? null : null,
    }));
  }

  const { data: spaces, error: sErr } = await supabaseAdmin
    .from("knowledge_spaces")
    .select("id")
    .eq("project_id", projectId);
  if (sErr) throw new Error(sErr.message);
  const spaceIds = (spaces ?? []).map((s: { id: string }) => s.id);
  if (spaceIds.length === 0) return [];

  let qb = supabaseAdmin
    .from("knowledge_pages")
    .select("id, title, page_type, space_id")
    .in("space_id", spaceIds)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(lim);
  if (pat) {
    qb = qb.ilike("title", pat);
  }
  const { data: pages, error: pErr } = await qb;
  if (pErr) throw new Error(pErr.message);
  const prow = (pages ?? []) as { id: string; title: string; page_type: string; space_id: string }[];
  const { data: spaceRows } = await supabaseAdmin
    .from("knowledge_spaces")
    .select("id, name")
    .in("id", Array.from(new Set(prow.map((p) => p.space_id))));
  const nameBySpace = new Map((spaceRows ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
  return prow.map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.page_type.replace(/_/g, " "),
    meta: nameBySpace.get(r.space_id) ?? null,
  }));
}

export type UpdateTestScriptInput = Partial<{
  title: string;
  objective: string | null;
  module: string | null;
  test_type: string | null;
  priority: string | null;
  status: string | null;
  preconditions: string | null;
  test_data: string | null;
  expected_result: string | null;
  business_conditions: string | null;
  reference_notes: string | null;
  scenario_path: string | null;
  source_document_name: string | null;
  source_language: string | null;
  scope_item_code: string | null;
  business_roles: unknown;
  source_import_type: string | null;
  related_task_id: string | null;
  related_ticket_id: string | null;
  related_knowledge_page_id: string | null;
}>;

export type StepPatch = {
  id?: string | null;
  step_order: number;
  activity_id?: string | null;
  instruction: string;
  expected_result?: string | null;
  step_name?: string | null;
  optional_flag?: boolean;
  transaction_or_app?: string | null;
  business_role?: string | null;
  test_data_notes?: string | null;
};

async function replaceTestScriptActivities(
  scriptId: string,
  activities: TestScriptActivityInput[]
): Promise<void> {
  const { error: nErr } = await supabaseAdmin
    .from("test_script_steps")
    .update({ activity_id: null })
    .eq("test_script_id", scriptId);
  if (nErr) throw new Error(nErr.message);

  const { error: dErr } = await supabaseAdmin.from("test_script_activities").delete().eq("test_script_id", scriptId);
  if (dErr) throw new Error(dErr.message);

  const sorted = [...activities].sort((a, b) => a.activity_order - b.activity_order);
  for (const act of sorted) {
    const aid = activityIdOrNew(act.id);
    const { error: iErr } = await supabaseAdmin.from("test_script_activities").insert({
      id: aid,
      test_script_id: scriptId,
      scenario_name: act.scenario_name?.trim() || null,
      activity_title: (act.activity_title ?? "").trim() || "Activity",
      activity_target_name: act.activity_target_name?.trim() || null,
      activity_target_url: act.activity_target_url?.trim() || null,
      business_role: act.business_role?.trim() || null,
      activity_order:
        typeof act.activity_order === "number" && Number.isFinite(act.activity_order)
          ? Math.floor(act.activity_order)
          : 0,
      metadata: {},
    });
    if (iErr) throw new Error(iErr.message);
  }
}

export async function updateTestScript(
  projectId: string,
  scriptId: string,
  patch: UpdateTestScriptInput,
  steps?: StepPatch[] | null,
  activitiesReplace?: TestScriptActivityInput[] | null
): Promise<TestScriptWithSteps> {
  const existing = await assertScriptProject(scriptId, projectId);
  if (!existing) throw new Error("Test script not found");

  const updates: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) throw new Error("title cannot be empty");
    updates.title = t;
  }
  if (patch.objective !== undefined) updates.objective = patch.objective?.trim() || null;
  if (patch.module !== undefined) updates.module = normalizeModule(patch.module);
  if (patch.test_type !== undefined) updates.test_type = asTestType(patch.test_type);
  if (patch.priority !== undefined) updates.priority = asPriorityStored(patch.priority);
  if (patch.status !== undefined) updates.status = asStatus(patch.status);
  if (patch.preconditions !== undefined) updates.preconditions = patch.preconditions?.trim() || null;
  if (patch.test_data !== undefined) updates.test_data = patch.test_data?.trim() || null;
  if (patch.expected_result !== undefined) updates.expected_result = patch.expected_result?.trim() || null;
  if (patch.business_conditions !== undefined) {
    updates.business_conditions = patch.business_conditions?.trim() || null;
  }
  if (patch.reference_notes !== undefined) {
    updates.reference_notes = patch.reference_notes?.trim() || null;
  }
  if (patch.scenario_path !== undefined) updates.scenario_path = patch.scenario_path?.trim() || null;
  if (patch.source_document_name !== undefined) {
    updates.source_document_name = patch.source_document_name?.trim() || null;
  }
  if (patch.source_language !== undefined) updates.source_language = patch.source_language?.trim() || null;
  if (patch.scope_item_code !== undefined) updates.scope_item_code = patch.scope_item_code?.trim() || null;
  if (patch.business_roles !== undefined) {
    updates.business_roles = normalizeBusinessRoles(patch.business_roles);
  }
  if (patch.source_import_type !== undefined) {
    updates.source_import_type = asSourceImportType(patch.source_import_type);
  }

  if (patch.related_task_id !== undefined) {
    const tid = optionalRelatedUuid(patch.related_task_id ?? null);
    if (tid && !(await validateTaskInProject(tid, projectId))) {
      throw new Error("related_task_id is not in this project");
    }
    updates.related_task_id = tid;
  }
  if (patch.related_ticket_id !== undefined) {
    const tid = optionalRelatedUuid(patch.related_ticket_id ?? null);
    if (tid && !(await validateTicketInProject(tid, projectId))) {
      throw new Error("related_ticket_id is not in this project");
    }
    updates.related_ticket_id = tid;
  }
  if (patch.related_knowledge_page_id !== undefined) {
    const kid = optionalRelatedUuid(patch.related_knowledge_page_id ?? null);
    if (kid && !(await validateKnowledgePageInProject(kid, projectId))) {
      throw new Error("related_knowledge_page_id is not in this project");
    }
    updates.related_knowledge_page_id = kid;
  }

  if (Object.keys(updates).length > 0) {
    const { error: uErr } = await supabaseAdmin.from("test_scripts").update(updates).eq("id", scriptId);
    if (uErr) throw new Error(uErr.message);
  }

  if (activitiesReplace !== undefined && activitiesReplace !== null) {
    await replaceTestScriptActivities(scriptId, activitiesReplace);
  }

  if (steps != null) {
    const { data: currentSteps, error: csErr } = await supabaseAdmin
      .from("test_script_steps")
      .select("id")
      .eq("test_script_id", scriptId);
    if (csErr) throw new Error(csErr.message);
    const existingIds = new Set((currentSteps ?? []).map((r: { id: string }) => r.id));
    const incomingIds = new Set(
      steps.map((s) => s.id).filter((id): id is string => typeof id === "string" && id.length > 0)
    );
    const toDelete = Array.from(existingIds).filter((id) => !incomingIds.has(id));
    if (toDelete.length > 0) {
      const { error: dErr } = await supabaseAdmin.from("test_script_steps").delete().in("id", toDelete);
      if (dErr) throw new Error(dErr.message);
    }

    const sorted = [...steps].sort((a, b) => a.step_order - b.step_order);
    for (let i = 0; i < sorted.length; i++) {
      const st = sorted[i];
      const instruction = (st.instruction ?? "").trim() || "—";
      const expected_result = st.expected_result?.trim() || null;
      const step_order = i;
      const step_name = st.step_name?.trim() || null;
      const optional_flag = Boolean(st.optional_flag);
      const transaction_or_app = st.transaction_or_app?.trim() || null;
      const business_role = st.business_role?.trim() || null;
      const test_data_notes = st.test_data_notes?.trim() || null;
      let resolvedActivityId: string | null | undefined = undefined;
      if (st.activity_id !== undefined) {
        resolvedActivityId =
          st.activity_id && String(st.activity_id).trim() ? String(st.activity_id).trim() : null;
      }
      if (st.id && existingIds.has(st.id)) {
        const rowUp: Record<string, unknown> = {
          step_order,
          instruction,
          expected_result,
          step_name,
          optional_flag,
          transaction_or_app,
          business_role,
          test_data_notes,
        };
        if (resolvedActivityId !== undefined) rowUp.activity_id = resolvedActivityId;
        const { error: upErr } = await supabaseAdmin.from("test_script_steps").update(rowUp).eq("id", st.id);
        if (upErr) throw new Error(upErr.message);
      } else {
        const { error: inErr } = await supabaseAdmin.from("test_script_steps").insert({
          test_script_id: scriptId,
          activity_id: resolvedActivityId === undefined ? null : resolvedActivityId,
          step_order,
          instruction,
          expected_result,
          step_name,
          optional_flag,
          transaction_or_app,
          business_role,
          test_data_notes,
        });
        if (inErr) throw new Error(inErr.message);
      }
    }
  }

  return getTestScript(projectId, scriptId);
}

export async function deleteTestScript(projectId: string, scriptId: string): Promise<void> {
  const ok = await assertScriptProject(scriptId, projectId);
  if (!ok) throw new Error("Test script not found");
  const { error } = await supabaseAdmin.from("test_scripts").delete().eq("id", scriptId);
  if (error) throw new Error(error.message);
}

export async function listExecutionsForScript(
  projectId: string,
  scriptId: string,
  limit = 50
): Promise<TestExecutionRow[]> {
  const ok = await assertScriptProject(scriptId, projectId);
  if (!ok) throw new Error("Test script not found");
  const { data, error } = await supabaseAdmin
    .from("test_executions")
    .select("*")
    .eq("test_script_id", scriptId)
    .eq("project_id", projectId)
    .order("executed_at", { ascending: false })
    .limit(Math.min(limit, 100));
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as TestExecutionRow[];
  const profMap = await profileDisplayByIds(rows.map((r) => r.executed_by));
  return rows.map((r) => ({
    ...normalizeExecutionRow(r as unknown as Record<string, unknown>),
    executed_by_display: profMap.get(r.executed_by) ?? null,
  }));
}

export async function patchTestExecutionDefectTicket(
  projectId: string,
  executionId: string,
  defectTicketId: string
): Promise<TestExecutionRow> {
  const { data: ex, error: exErr } = await supabaseAdmin
    .from("test_executions")
    .select("id, project_id, test_script_id")
    .eq("id", executionId)
    .maybeSingle();
  if (exErr) throw new Error(exErr.message);
  if (!ex || (ex as { project_id: string }).project_id !== projectId) {
    throw new Error("Execution not found");
  }
  if (!(await validateTicketInProject(defectTicketId, projectId))) {
    throw new Error("defect_ticket_id is not in this project");
  }
  const { data: updated, error: uErr } = await supabaseAdmin
    .from("test_executions")
    .update({ defect_ticket_id: defectTicketId })
    .eq("id", executionId)
    .eq("project_id", projectId)
    .select("*")
    .single();
  if (uErr) throw new Error(uErr.message);
  return normalizeExecutionRow(updated as unknown as Record<string, unknown>);
}

export type CreateExecutionInput = {
  result: string;
  actual_result?: string | null;
  evidence_notes?: string | null;
  defect_ticket_id?: string | null;
  test_cycle_id?: string | null;
  step_outcomes?: unknown;
};

function parseStepOutcomes(raw: unknown): TestExecutionStepOutcome[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const out: TestExecutionStepOutcome[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const sid = typeof o.step_id === "string" && CLIENT_UUID_RE.test(o.step_id.trim()) ? o.step_id.trim() : null;
    const res = typeof o.result === "string" ? o.result.toLowerCase() : "";
    if (!sid || !["passed", "failed", "blocked", "skipped"].includes(res)) continue;
    out.push({
      step_id: sid,
      result: res as TestExecutionStepOutcome["result"],
      note: typeof o.note === "string" ? o.note : null,
    });
  }
  return out.length > 0 ? out : null;
}

async function assertCycleInProject(cycleId: string, projectId: string): Promise<TestCycleRow | null> {
  const { data, error } = await supabaseAdmin
    .from("test_cycles")
    .select("*")
    .eq("id", cycleId)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as TestCycleRow | null;
}

async function assertScriptInCycle(scriptId: string, cycleId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("test_cycle_scripts")
    .select("id")
    .eq("test_cycle_id", cycleId)
    .eq("test_script_id", scriptId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

export async function createTestExecution(
  projectId: string,
  scriptId: string,
  executedBy: string,
  input: CreateExecutionInput
): Promise<TestExecutionRow> {
  const script = await assertScriptProject(scriptId, projectId);
  if (!script) throw new Error("Test script not found");

  let defect_ticket_id = input.defect_ticket_id?.trim() || null;
  if (defect_ticket_id && !(await validateTicketInProject(defect_ticket_id, projectId))) {
    throw new Error("defect_ticket_id is not in this project");
  }

  let test_cycle_id = optionalRelatedUuid(input.test_cycle_id ?? null);
  if (test_cycle_id) {
    const cyc = await assertCycleInProject(test_cycle_id, projectId);
    if (!cyc) throw new Error("test_cycle_id is not valid for this project");
    const inCycle = await assertScriptInCycle(scriptId, test_cycle_id);
    if (!inCycle) throw new Error("Script is not assigned to this test cycle");
  } else {
    test_cycle_id = null;
  }

  const step_outcomes = parseStepOutcomes(input.step_outcomes);

  const row = {
    test_script_id: scriptId,
    project_id: projectId,
    executed_by: executedBy,
    result: asResult(input.result),
    actual_result: input.actual_result?.trim() || null,
    evidence_notes: input.evidence_notes?.trim() || null,
    defect_ticket_id,
    test_cycle_id,
    step_outcomes,
  };

  const { data, error } = await supabaseAdmin.from("test_executions").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return normalizeExecutionRow(data);
}

function normalizeExecutionRow(data: Record<string, unknown>): TestExecutionRow {
  const r = data as TestExecutionRow;
  return {
    ...r,
    test_cycle_id: r.test_cycle_id ?? null,
    step_outcomes: Array.isArray(r.step_outcomes) ? (r.step_outcomes as TestExecutionStepOutcome[]) : null,
  };
}

export async function listTestCyclesForProject(projectId: string): Promise<TestCycleListItem[]> {
  const { data: cycles, error: cErr } = await supabaseAdmin
    .from("test_cycles")
    .select("*")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });
  if (cErr) throw new Error(cErr.message);
  const list = (cycles ?? []) as TestCycleRow[];
  if (list.length === 0) return [];

  const cycleIds = list.map((c) => c.id);
  const { data: members, error: mErr } = await supabaseAdmin
    .from("test_cycle_scripts")
    .select("test_cycle_id, test_script_id")
    .in("test_cycle_id", cycleIds);
  if (mErr) throw new Error(mErr.message);
  const membersByCycle = new Map<string, string[]>();
  for (const row of members ?? []) {
    const r = row as { test_cycle_id: string; test_script_id: string };
    const arr = membersByCycle.get(r.test_cycle_id) ?? [];
    arr.push(r.test_script_id);
    membersByCycle.set(r.test_cycle_id, arr);
  }

  const { data: execs, error: eErr } = await supabaseAdmin
    .from("test_executions")
    .select("test_cycle_id, test_script_id, result, defect_ticket_id, executed_at")
    .eq("project_id", projectId)
    .in("test_cycle_id", cycleIds)
    .order("executed_at", { ascending: false });
  if (eErr) throw new Error(eErr.message);

  type Latest = { result: TestExecutionResult; defect_ticket_id: string | null };
  const latestByCycleScript = new Map<string, Latest>();
  for (const row of execs ?? []) {
    const r = row as {
      test_cycle_id: string;
      test_script_id: string;
      result: string;
      defect_ticket_id: string | null;
    };
    const k = `${r.test_cycle_id}:${r.test_script_id}`;
    if (!latestByCycleScript.has(k)) {
      latestByCycleScript.set(k, {
        result: asResult(r.result),
        defect_ticket_id: r.defect_ticket_id,
      });
    }
  }

  const ownerIds = list.map((c) => c.owner_profile_id).filter((x): x is string => !!x);
  const ownerMap = await profileDisplayByIds(ownerIds);

  return list.map((c) => {
    const scriptIds = membersByCycle.get(c.id) ?? [];
    let passed = 0;
    let failed = 0;
    let blocked = 0;
    let not_run = 0;
    let executed = 0;
    const defectIds = new Set<string>();
    for (const sid of scriptIds) {
      const hit = latestByCycleScript.get(`${c.id}:${sid}`);
      if (!hit) {
        not_run += 1;
        continue;
      }
      executed += 1;
      if (hit.result === "passed") passed += 1;
      else if (hit.result === "failed") failed += 1;
      else if (hit.result === "blocked") blocked += 1;
      else not_run += 1;
      if (hit.defect_ticket_id) defectIds.add(hit.defect_ticket_id);
    }
    return {
      ...c,
      script_count: scriptIds.length,
      passed,
      failed,
      blocked,
      not_run,
      executed,
      open_defects: defectIds.size,
      owner_display: c.owner_profile_id ? ownerMap.get(c.owner_profile_id) ?? null : null,
    };
  });
}

export async function getTestingControlSummary(projectId: string): Promise<TestingControlSummaryResponse> {
  const [listData, cycles] = await Promise.all([
    listTestScriptsForProject(projectId),
    listTestCyclesForProject(projectId),
  ]);
  return { stats: listData.stats, cycles };
}

export async function getTestCycleDetail(projectId: string, cycleId: string): Promise<TestCycleDetailResponse> {
  const cyc = await assertCycleInProject(cycleId, projectId);
  if (!cyc) throw new Error("Test cycle not found");

  const { data: memRows, error: mErr } = await supabaseAdmin
    .from("test_cycle_scripts")
    .select("*")
    .eq("test_cycle_id", cycleId);
  if (mErr) throw new Error(mErr.message);
  const members = (memRows ?? []) as TestCycleScriptMember[];
  if (members.length === 0) {
    const ownerMap = cyc.owner_profile_id ? await profileDisplayByIds([cyc.owner_profile_id]) : new Map();
    return {
      cycle: { ...cyc, owner_display: cyc.owner_profile_id ? ownerMap.get(cyc.owner_profile_id) ?? null : null },
      scripts: [],
      kpis: {
        scripts: 0,
        executed: 0,
        passed: 0,
        failed: 0,
        blocked: 0,
        not_run: 0,
        open_defects: 0,
        evidence_coverage_pct: 0,
      },
    };
  }

  const scriptIds = members.map((m) => m.test_script_id);
  const { data: scriptRows, error: sErr } = await supabaseAdmin
    .from("test_scripts")
    .select("*")
    .eq("project_id", projectId)
    .in("id", scriptIds);
  if (sErr) throw new Error(sErr.message);
  const scriptById = new Map((scriptRows as TestScriptRow[]).map((s) => [s.id, s]));
  const orderedScripts = scriptIds.map((id) => scriptById.get(id)).filter((x): x is TestScriptRow => !!x);

  const enrichedList = await enrichTestScriptsWithListFields(projectId, orderedScripts);
  const enrichedById = new Map(enrichedList.map((s) => [s.id, s]));

  const { data: execs, error: eErr } = await supabaseAdmin
    .from("test_executions")
    .select("id, test_script_id, result, defect_ticket_id, executed_at")
    .eq("project_id", projectId)
    .eq("test_cycle_id", cycleId)
    .order("executed_at", { ascending: false });
  if (eErr) throw new Error(eErr.message);

  const latestByScript = new Map<
    string,
    { id: string; result: TestExecutionResult; executed_at: string; defect_ticket_id: string | null }
  >();
  const defectCountByScript = new Map<string, Set<string>>();
  const defectIdsInCycle = new Set<string>();
  for (const row of execs ?? []) {
    const r = row as {
      id: string;
      test_script_id: string;
      result: string;
      defect_ticket_id: string | null;
      executed_at: string;
    };
    if (!latestByScript.has(r.test_script_id)) {
      latestByScript.set(r.test_script_id, {
        id: r.id,
        result: asResult(r.result),
        executed_at: r.executed_at,
        defect_ticket_id: r.defect_ticket_id,
      });
    }
    if (r.defect_ticket_id) {
      defectIdsInCycle.add(r.defect_ticket_id);
      const set = defectCountByScript.get(r.test_script_id) ?? new Set<string>();
      set.add(r.defect_ticket_id);
      defectCountByScript.set(r.test_script_id, set);
    }
  }

  const latestExecIds = Array.from(latestByScript.values()).map((x) => x.id);
  let evidenceByExecution = new Map<string, number>();
  if (latestExecIds.length > 0) {
    const { data: evRows, error: evErr } = await supabaseAdmin
      .from("test_execution_evidence")
      .select("execution_id")
      .eq("project_id", projectId)
      .in("execution_id", latestExecIds);
    if (evErr) throw new Error(evErr.message);
    for (const e of evRows ?? []) {
      const exId = (e as { execution_id: string }).execution_id;
      evidenceByExecution.set(exId, (evidenceByExecution.get(exId) ?? 0) + 1);
    }
  }

  const assigneeIds = members.map((m) => m.assignee_profile_id).filter((x): x is string => !!x);
  const assigneeMap = await profileDisplayByIds(assigneeIds);
  const ownerMap = cyc.owner_profile_id ? await profileDisplayByIds([cyc.owner_profile_id]) : new Map();

  let kp = {
    scripts: 0,
    executed: 0,
    passed: 0,
    failed: 0,
    blocked: 0,
    not_run: 0,
    open_defects: defectIdsInCycle.size,
  };
  const scripts: TestCycleDetailResponse["scripts"] = [];

  for (const m of members) {
    const base = enrichedById.get(m.test_script_id);
    if (!base) continue;
    const latest = latestByScript.get(m.test_script_id);
    const defects = defectCountByScript.get(m.test_script_id);
    const defect_count_cycle = defects?.size ?? 0;
    const evidence_count_latest_cycle = latest ? evidenceByExecution.get(latest.id) ?? 0 : 0;

    kp.scripts += 1;
    if (!latest) kp.not_run += 1;
    else {
      kp.executed += 1;
      if (latest.result === "passed") kp.passed += 1;
      else if (latest.result === "failed") kp.failed += 1;
      else if (latest.result === "blocked") kp.blocked += 1;
      else kp.not_run += 1;
    }

    scripts.push({
      ...base,
      cycle_membership_id: m.id,
      assignee_profile_id: m.assignee_profile_id,
      member_priority: m.priority,
      status_override: m.status_override,
      member_notes: m.notes,
      member_created_at: m.created_at,
      latest_cycle_result: latest?.result ?? null,
      latest_cycle_executed_at: latest?.executed_at ?? null,
      latest_cycle_execution_id: latest?.id ?? null,
      defect_count_cycle,
      evidence_count_latest_cycle,
      assignee_display: m.assignee_profile_id ? assigneeMap.get(m.assignee_profile_id) ?? null : null,
    });
  }

  const withEvidence = scripts.filter((s) => s.evidence_count_latest_cycle > 0).length;
  const evidence_coverage_pct =
    kp.scripts > 0 ? Math.min(100, Math.round((withEvidence / kp.scripts) * 100)) : 0;

  return {
    cycle: { ...cyc, owner_display: cyc.owner_profile_id ? ownerMap.get(cyc.owner_profile_id) ?? null : null },
    scripts,
    kpis: {
      ...kp,
      evidence_coverage_pct,
    },
  };
}

export type CreateTestCycleInput = {
  name: string;
  description?: string | null;
  status?: string | null;
  owner_profile_id?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  goal?: string | null;
  scope_summary?: string | null;
};

export async function createTestCycle(
  projectId: string,
  createdBy: string,
  input: CreateTestCycleInput
): Promise<TestCycleRow> {
  const name = (input.name ?? "").trim();
  if (!name) throw new Error("name is required");
  const row = {
    project_id: projectId,
    name,
    description: input.description?.trim() || null,
    status: asCycleStatus(input.status),
    owner_profile_id: optionalRelatedUuid(input.owner_profile_id ?? null),
    planned_start_date: input.planned_start_date?.trim() || null,
    planned_end_date: input.planned_end_date?.trim() || null,
    goal: input.goal?.trim() || null,
    scope_summary: input.scope_summary?.trim() || null,
    created_by: createdBy,
  };
  const { data, error } = await supabaseAdmin.from("test_cycles").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data as TestCycleRow;
}

export type UpdateTestCycleInput = Partial<{
  name: string;
  description: string | null;
  status: string;
  owner_profile_id: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  goal: string | null;
  scope_summary: string | null;
}>;

export async function updateTestCycle(
  projectId: string,
  cycleId: string,
  patch: UpdateTestCycleInput
): Promise<TestCycleRow> {
  const cyc = await assertCycleInProject(cycleId, projectId);
  if (!cyc) throw new Error("Test cycle not found");

  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) updates.name = (patch.name ?? "").trim() || cyc.name;
  if (patch.description !== undefined) updates.description = patch.description?.trim() || null;
  if (patch.status !== undefined) updates.status = asCycleStatus(patch.status);
  if (patch.owner_profile_id !== undefined) {
    updates.owner_profile_id = optionalRelatedUuid(patch.owner_profile_id);
  }
  if (patch.planned_start_date !== undefined) updates.planned_start_date = patch.planned_start_date?.trim() || null;
  if (patch.planned_end_date !== undefined) updates.planned_end_date = patch.planned_end_date?.trim() || null;
  if (patch.actual_start_at !== undefined) updates.actual_start_at = patch.actual_start_at?.trim() || null;
  if (patch.actual_end_at !== undefined) updates.actual_end_at = patch.actual_end_at?.trim() || null;
  if (patch.goal !== undefined) updates.goal = patch.goal?.trim() || null;
  if (patch.scope_summary !== undefined) updates.scope_summary = patch.scope_summary?.trim() || null;

  const { data, error } = await supabaseAdmin
    .from("test_cycles")
    .update(updates)
    .eq("id", cycleId)
    .eq("project_id", projectId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as TestCycleRow;
}

export async function archiveTestCycle(projectId: string, cycleId: string): Promise<void> {
  const cyc = await assertCycleInProject(cycleId, projectId);
  if (!cyc) throw new Error("Test cycle not found");
  const { error } = await supabaseAdmin
    .from("test_cycles")
    .update({ status: "archived" })
    .eq("id", cycleId)
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
}

export async function addScriptsToCycle(
  projectId: string,
  cycleId: string,
  scriptIds: string[]
): Promise<void> {
  const cyc = await assertCycleInProject(cycleId, projectId);
  if (!cyc) throw new Error("Test cycle not found");
  const ids = Array.from(new Set(scriptIds.filter((x) => CLIENT_UUID_RE.test(x))));
  if (ids.length === 0) return;
  for (const sid of ids) {
    const ok = await assertScriptProject(sid, projectId);
    if (!ok) throw new Error(`Script ${sid} not in project`);
  }
  const rows = ids.map((test_script_id) => ({ test_cycle_id: cycleId, test_script_id }));
  const { error } = await supabaseAdmin.from("test_cycle_scripts").upsert(rows, {
    onConflict: "test_cycle_id,test_script_id",
    ignoreDuplicates: true,
  });
  if (error) throw new Error(error.message);
}

export async function removeScriptFromCycle(
  projectId: string,
  cycleId: string,
  scriptId: string
): Promise<void> {
  const cyc = await assertCycleInProject(cycleId, projectId);
  if (!cyc) throw new Error("Test cycle not found");
  const { error } = await supabaseAdmin
    .from("test_cycle_scripts")
    .delete()
    .eq("test_cycle_id", cycleId)
    .eq("test_script_id", scriptId);
  if (error) throw new Error(error.message);
}

export async function patchCycleScriptMember(
  projectId: string,
  cycleId: string,
  scriptId: string,
  patch: { assignee_profile_id?: string | null; priority?: string | null; notes?: string | null; status_override?: string | null }
): Promise<TestCycleScriptMember> {
  const cyc = await assertCycleInProject(cycleId, projectId);
  if (!cyc) throw new Error("Test cycle not found");
  const updates: Record<string, unknown> = {};
  if (patch.assignee_profile_id !== undefined) {
    updates.assignee_profile_id = optionalRelatedUuid(patch.assignee_profile_id);
  }
  if (patch.priority !== undefined) updates.priority = patch.priority?.trim() || null;
  if (patch.notes !== undefined) updates.notes = patch.notes?.trim() || null;
  if (patch.status_override !== undefined) updates.status_override = patch.status_override?.trim() || null;
  const { data, error } = await supabaseAdmin
    .from("test_cycle_scripts")
    .update(updates)
    .eq("test_cycle_id", cycleId)
    .eq("test_script_id", scriptId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as TestCycleScriptMember;
}

export async function listEvidenceForExecution(
  projectId: string,
  executionId: string
): Promise<TestExecutionEvidenceRow[]> {
  const { data: ex, error: xErr } = await supabaseAdmin
    .from("test_executions")
    .select("id, project_id")
    .eq("id", executionId)
    .maybeSingle();
  if (xErr) throw new Error(xErr.message);
  if (!ex || (ex as { project_id: string }).project_id !== projectId) {
    throw new Error("Execution not found");
  }
  const { data, error } = await supabaseAdmin
    .from("test_execution_evidence")
    .select("*")
    .eq("execution_id", executionId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as TestExecutionEvidenceRow[];
}

export type CreateEvidenceInput = {
  type: string;
  title?: string | null;
  description?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  sap_reference?: string | null;
  external_url?: string | null;
};

export async function createTestExecutionEvidence(
  projectId: string,
  executionId: string,
  createdBy: string,
  input: CreateEvidenceInput
): Promise<TestExecutionEvidenceRow> {
  const { data: ex, error: xErr } = await supabaseAdmin
    .from("test_executions")
    .select("id, project_id")
    .eq("id", executionId)
    .maybeSingle();
  if (xErr) throw new Error(xErr.message);
  if (!ex || (ex as { project_id: string }).project_id !== projectId) {
    throw new Error("Execution not found");
  }
  const ty = (input.type ?? "").toLowerCase();
  if (!EVIDENCE_TYPES.has(ty)) throw new Error("Invalid evidence type");

  const row = {
    execution_id: executionId,
    project_id: projectId,
    type: ty,
    title: input.title?.trim() || null,
    description: input.description?.trim() || null,
    file_path: input.file_path?.trim() || null,
    file_name: input.file_name?.trim() || null,
    mime_type: input.mime_type?.trim() || null,
    sap_reference: input.sap_reference?.trim() || null,
    external_url: input.external_url?.trim() || null,
    created_by: createdBy,
  };
  const { data, error } = await supabaseAdmin.from("test_execution_evidence").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data as TestExecutionEvidenceRow;
}
