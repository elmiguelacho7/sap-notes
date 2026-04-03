import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  TestExecutionResult,
  TestExecutionRow,
  TestScriptListItem,
  TestScriptRow,
  TestScriptStatus,
  TestScriptsListResponse,
  TestScriptStepRow,
  TestScriptType,
  TestScriptWithSteps,
} from "@/lib/types/testing";

const TEST_TYPES = new Set<string>(["uat", "sit", "regression"]);
const STATUSES = new Set<string>(["draft", "ready", "archived"]);
const RESULTS = new Set<string>(["passed", "failed", "blocked", "not_run"]);

function asTestType(v: string | undefined | null): TestScriptType {
  const s = (v ?? "uat").toLowerCase();
  return TEST_TYPES.has(s) ? (s as TestScriptType) : "uat";
}

function asStatus(v: string | undefined | null): TestScriptStatus {
  const s = (v ?? "draft").toLowerCase();
  return STATUSES.has(s) ? (s as TestScriptStatus) : "draft";
}

function asResult(v: string | undefined | null): TestExecutionResult {
  const s = (v ?? "not_run").toLowerCase();
  return RESULTS.has(s) ? (s as TestExecutionResult) : "not_run";
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

export async function listTestScriptsForProject(projectId: string): Promise<TestScriptsListResponse> {
  const { data: scripts, error: sErr } = await supabaseAdmin
    .from("test_scripts")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });
  if (sErr) throw new Error(sErr.message);
  const list = (scripts ?? []) as TestScriptRow[];
  if (list.length === 0) {
    return {
      scripts: [],
      stats: { total: 0, ready: 0, failedLastCount: 0, lastExecutionAt: null },
    };
  }

  const ids = list.map((s) => s.id);
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

  const { data: execRows, error: eErr } = await supabaseAdmin
    .from("test_executions")
    .select("test_script_id, result, executed_at")
    .eq("project_id", projectId)
    .in("test_script_id", ids)
    .order("executed_at", { ascending: false });
  if (eErr) throw new Error(eErr.message);

  const lastByScript = new Map<string, { result: TestExecutionResult; executed_at: string }>();
  for (const row of execRows ?? []) {
    const r = row as { test_script_id: string; result: string; executed_at: string };
    if (!lastByScript.has(r.test_script_id)) {
      lastByScript.set(r.test_script_id, { result: asResult(r.result), executed_at: r.executed_at });
    }
  }

  let lastExecutionAt: string | null = null;
  let failedLastCount = 0;
  for (const s of list) {
    const last = lastByScript.get(s.id);
    if (last) {
      if (!lastExecutionAt || last.executed_at > lastExecutionAt) lastExecutionAt = last.executed_at;
      if (last.result === "failed") failedLastCount += 1;
    }
  }

  const enriched: TestScriptListItem[] = list.map((s) => {
    const last = lastByScript.get(s.id);
    return {
      ...s,
      step_count: stepCountByScript.get(s.id) ?? 0,
      last_result: last?.result ?? null,
      last_executed_at: last?.executed_at ?? null,
    };
  });

  const ready = list.filter((x) => x.status === "ready").length;

  return {
    scripts: enriched,
    stats: {
      total: list.length,
      ready,
      failedLastCount,
      lastExecutionAt,
    },
  };
}

export type CreateTestScriptInput = {
  title: string;
  objective?: string | null;
  module?: string | null;
  test_type?: string | null;
  priority?: string | null;
  status?: string | null;
  preconditions?: string | null;
  test_data?: string | null;
  expected_result?: string | null;
  related_task_id?: string | null;
  related_ticket_id?: string | null;
  related_knowledge_page_id?: string | null;
  steps?: { instruction: string; expected_result?: string | null }[];
};

export async function createTestScript(
  projectId: string,
  createdBy: string,
  input: CreateTestScriptInput
): Promise<TestScriptWithSteps> {
  const title = (input.title ?? "").trim();
  if (!title) throw new Error("title is required");

  let related_task_id = input.related_task_id?.trim() || null;
  let related_ticket_id = input.related_ticket_id?.trim() || null;
  const related_knowledge_page_id = input.related_knowledge_page_id?.trim() || null;

  if (related_task_id && !(await validateTaskInProject(related_task_id, projectId))) {
    throw new Error("related_task_id is not in this project");
  }
  if (related_ticket_id && !(await validateTicketInProject(related_ticket_id, projectId))) {
    throw new Error("related_ticket_id is not in this project");
  }

  const insertRow = {
    project_id: projectId,
    title,
    objective: input.objective?.trim() || null,
    module: input.module?.trim() || null,
    test_type: asTestType(input.test_type),
    priority: input.priority?.trim() || null,
    status: asStatus(input.status),
    preconditions: input.preconditions?.trim() || null,
    test_data: input.test_data?.trim() || null,
    expected_result: input.expected_result?.trim() || null,
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

  const stepsIn = input.steps ?? [];
  if (stepsIn.length > 0) {
    const stepRows = stepsIn.map((st, i) => ({
      test_script_id: row.id,
      step_order: i,
      instruction: (st.instruction ?? "").trim() || "—",
      expected_result: st.expected_result?.trim() || null,
    }));
    const { error: stepErr } = await supabaseAdmin.from("test_script_steps").insert(stepRows);
    if (stepErr) throw new Error(stepErr.message);
  }

  return getTestScript(projectId, row.id);
}

export async function getTestScript(projectId: string, scriptId: string): Promise<TestScriptWithSteps> {
  const script = await assertScriptProject(scriptId, projectId);
  if (!script) throw new Error("Test script not found");

  const { data: steps, error } = await supabaseAdmin
    .from("test_script_steps")
    .select("*")
    .eq("test_script_id", scriptId)
    .order("step_order", { ascending: true });
  if (error) throw new Error(error.message);

  return {
    ...script,
    steps: (steps ?? []) as TestScriptStepRow[],
  };
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
  related_task_id: string | null;
  related_ticket_id: string | null;
  related_knowledge_page_id: string | null;
}>;

export type StepPatch = {
  id?: string | null;
  step_order: number;
  instruction: string;
  expected_result?: string | null;
};

export async function updateTestScript(
  projectId: string,
  scriptId: string,
  patch: UpdateTestScriptInput,
  steps?: StepPatch[] | null
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
  if (patch.module !== undefined) updates.module = patch.module?.trim() || null;
  if (patch.test_type !== undefined) updates.test_type = asTestType(patch.test_type);
  if (patch.priority !== undefined) updates.priority = patch.priority?.trim() || null;
  if (patch.status !== undefined) updates.status = asStatus(patch.status);
  if (patch.preconditions !== undefined) updates.preconditions = patch.preconditions?.trim() || null;
  if (patch.test_data !== undefined) updates.test_data = patch.test_data?.trim() || null;
  if (patch.expected_result !== undefined) updates.expected_result = patch.expected_result?.trim() || null;

  if (patch.related_task_id !== undefined) {
    const tid = patch.related_task_id?.trim() || null;
    if (tid && !(await validateTaskInProject(tid, projectId))) {
      throw new Error("related_task_id is not in this project");
    }
    updates.related_task_id = tid;
  }
  if (patch.related_ticket_id !== undefined) {
    const tid = patch.related_ticket_id?.trim() || null;
    if (tid && !(await validateTicketInProject(tid, projectId))) {
      throw new Error("related_ticket_id is not in this project");
    }
    updates.related_ticket_id = tid;
  }
  if (patch.related_knowledge_page_id !== undefined) {
    updates.related_knowledge_page_id = patch.related_knowledge_page_id?.trim() || null;
  }

  if (Object.keys(updates).length > 0) {
    const { error: uErr } = await supabaseAdmin.from("test_scripts").update(updates).eq("id", scriptId);
    if (uErr) throw new Error(uErr.message);
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
      if (st.id && existingIds.has(st.id)) {
        const { error: upErr } = await supabaseAdmin
          .from("test_script_steps")
          .update({ step_order, instruction, expected_result })
          .eq("id", st.id);
        if (upErr) throw new Error(upErr.message);
      } else {
        const { error: inErr } = await supabaseAdmin.from("test_script_steps").insert({
          test_script_id: scriptId,
          step_order,
          instruction,
          expected_result,
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
  return (data ?? []) as TestExecutionRow[];
}

export type CreateExecutionInput = {
  result: string;
  actual_result?: string | null;
  evidence_notes?: string | null;
  defect_ticket_id?: string | null;
};

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

  const row = {
    test_script_id: scriptId,
    project_id: projectId,
    executed_by: executedBy,
    result: asResult(input.result),
    actual_result: input.actual_result?.trim() || null,
    evidence_notes: input.evidence_notes?.trim() || null,
    defect_ticket_id,
  };

  const { data, error } = await supabaseAdmin.from("test_executions").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data as TestExecutionRow;
}
