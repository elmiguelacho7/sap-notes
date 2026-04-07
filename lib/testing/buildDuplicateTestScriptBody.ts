import type { TestScriptWithSteps } from "@/lib/types/testing";

/**
 * Build POST /testing/scripts body to clone a script (new IDs for activities/steps on server).
 * Preserves hierarchical activities + steps; merges script-level ungrouped steps into an extra activity when needed.
 */
export function buildDuplicateTestScriptBody(
  script: TestScriptWithSteps,
  newTitle: string,
  ungroupedActivityTitle: string
): Record<string, unknown> {
  const br = script.business_roles;
  const base: Record<string, unknown> = {
    title: newTitle,
    objective: script.objective,
    module: script.module,
    test_type: script.test_type,
    priority: script.priority,
    status: "draft",
    preconditions: script.preconditions,
    test_data: script.test_data,
    business_conditions: script.business_conditions,
    reference_notes: script.reference_notes,
    expected_result: script.expected_result,
    scenario_path: script.scenario_path,
    source_document_name: script.source_document_name,
    source_language: script.source_language,
    scope_item_code: script.scope_item_code,
    source_import_type: script.source_import_type,
    related_task_id: null,
    related_ticket_id: null,
    related_knowledge_page_id: null,
  };
  if (Array.isArray(br)) base.business_roles = br;

  const activities = [...(script.activities ?? [])].sort((a, b) => a.activity_order - b.activity_order);
  const allSteps = script.steps ?? [];

  const stepPayload = (s: (typeof allSteps)[number]) => ({
    instruction: (s.instruction ?? "").trim() || "—",
    expected_result: s.expected_result?.trim() || null,
    step_name: s.step_name?.trim() || null,
    optional_flag: Boolean(s.optional_flag),
    transaction_or_app: s.transaction_or_app?.trim() || null,
    business_role: s.business_role?.trim() || null,
    test_data_notes: s.test_data_notes?.trim() || null,
  });

  const loose = allSteps
    .filter((s) => !s.activity_id)
    .sort((x, y) => x.step_order - y.step_order)
    .map(stepPayload);

  if (activities.length > 0) {
    const nested = activities
      .map((a) => ({
        scenario_name: a.scenario_name,
        activity_title: a.activity_title,
        activity_target_name: a.activity_target_name,
        activity_target_url: a.activity_target_url,
        business_role: a.business_role,
        activity_order: a.activity_order,
        steps: allSteps
          .filter((s) => s.activity_id === a.id)
          .sort((x, y) => x.step_order - y.step_order)
          .map(stepPayload),
      }))
      .filter((a) => a.steps.length > 0);

    if (loose.length > 0) {
      const maxOrder = activities.reduce((m, a) => Math.max(m, a.activity_order), -1);
      nested.push({
        scenario_name: null,
        activity_title: ungroupedActivityTitle,
        activity_target_name: null,
        activity_target_url: null,
        business_role: null,
        activity_order: maxOrder + 1,
        steps: loose,
      });
    }

    if (nested.length > 0) {
      base.activities = nested;
      return base;
    }
  }

  base.steps = loose.length > 0 ? loose : [];
  return base;
}
