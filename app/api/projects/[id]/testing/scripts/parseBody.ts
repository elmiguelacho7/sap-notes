import type {
  CreateTestScriptActivityNestedInput,
  CreateTestScriptInput,
  CreateTestScriptStepInput,
  StepPatch,
  TestScriptActivityInput,
  UpdateTestScriptInput,
} from "@/lib/services/testingService";

function parseStepCreate(o: Record<string, unknown>): CreateTestScriptStepInput {
  return {
    instruction: typeof o.instruction === "string" ? o.instruction : "",
    expected_result: typeof o.expected_result === "string" ? o.expected_result : null,
    step_name: typeof o.step_name === "string" ? o.step_name : null,
    optional_flag: o.optional_flag === true,
    transaction_or_app: typeof o.transaction_or_app === "string" ? o.transaction_or_app : null,
    business_role: typeof o.business_role === "string" ? o.business_role : null,
    test_data_notes: typeof o.test_data_notes === "string" ? o.test_data_notes : null,
  };
}

function parseActivityFlat(o: Record<string, unknown>): TestScriptActivityInput {
  return {
    id: typeof o.id === "string" ? o.id : undefined,
    scenario_name: typeof o.scenario_name === "string" ? o.scenario_name : null,
    activity_title: typeof o.activity_title === "string" ? o.activity_title : "",
    activity_target_name: typeof o.activity_target_name === "string" ? o.activity_target_name : null,
    activity_target_url: typeof o.activity_target_url === "string" ? o.activity_target_url : null,
    business_role: typeof o.business_role === "string" ? o.business_role : null,
    activity_order: typeof o.activity_order === "number" ? o.activity_order : 0,
  };
}

function parseActivityNested(o: Record<string, unknown>): CreateTestScriptActivityNestedInput {
  const flat = parseActivityFlat(o);
  const stepsRaw = o.steps;
  const steps = Array.isArray(stepsRaw)
    ? stepsRaw.map((s) => parseStepCreate(s as Record<string, unknown>))
    : [];
  return { ...flat, steps };
}

function parseStepPatch(o: Record<string, unknown>, i: number): StepPatch {
  const patch: StepPatch = {
    id: typeof o.id === "string" ? o.id : null,
    step_order: typeof o.step_order === "number" ? o.step_order : i,
    instruction: typeof o.instruction === "string" ? o.instruction : "",
    expected_result: typeof o.expected_result === "string" ? o.expected_result : null,
    step_name: typeof o.step_name === "string" ? o.step_name : null,
    optional_flag: o.optional_flag === true,
    transaction_or_app: typeof o.transaction_or_app === "string" ? o.transaction_or_app : null,
    business_role: typeof o.business_role === "string" ? o.business_role : null,
    test_data_notes: typeof o.test_data_notes === "string" ? o.test_data_notes : null,
  };
  if ("activity_id" in o) {
    patch.activity_id =
      typeof o.activity_id === "string" && o.activity_id.trim()
        ? o.activity_id.trim()
        : null;
  }
  return patch;
}

export function parseBusinessRolesField(v: unknown): unknown | undefined {
  if (v === undefined || v === null) return undefined;
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    return v
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

export function buildCreateInput(body: Record<string, unknown>): CreateTestScriptInput {
  const activitiesRaw = body.activities;
  const activitiesNested =
    Array.isArray(activitiesRaw) && activitiesRaw.length > 0
      ? activitiesRaw.map((a) => parseActivityNested(a as Record<string, unknown>))
      : undefined;

  const stepsRaw = body.steps;
  const steps =
    Array.isArray(stepsRaw) && (!activitiesNested || activitiesNested.length === 0)
      ? stepsRaw.map((s) => parseStepCreate(s as Record<string, unknown>))
      : undefined;

  return {
    title: typeof body.title === "string" ? body.title : "",
    objective: typeof body.objective === "string" ? body.objective : null,
    module: typeof body.module === "string" ? body.module : null,
    test_type: typeof body.test_type === "string" ? body.test_type : null,
    priority: typeof body.priority === "string" ? body.priority : null,
    status: typeof body.status === "string" ? body.status : null,
    preconditions: typeof body.preconditions === "string" ? body.preconditions : null,
    test_data: typeof body.test_data === "string" ? body.test_data : null,
    business_conditions: typeof body.business_conditions === "string" ? body.business_conditions : null,
    expected_result: typeof body.expected_result === "string" ? body.expected_result : null,
    scenario_path: typeof body.scenario_path === "string" ? body.scenario_path : null,
    source_document_name: typeof body.source_document_name === "string" ? body.source_document_name : null,
    source_language: typeof body.source_language === "string" ? body.source_language : null,
    scope_item_code: typeof body.scope_item_code === "string" ? body.scope_item_code : null,
    business_roles: parseBusinessRolesField(body.business_roles),
    source_import_type: typeof body.source_import_type === "string" ? body.source_import_type : null,
    related_task_id: typeof body.related_task_id === "string" ? body.related_task_id : null,
    related_ticket_id: typeof body.related_ticket_id === "string" ? body.related_ticket_id : null,
    related_knowledge_page_id:
      typeof body.related_knowledge_page_id === "string" ? body.related_knowledge_page_id : null,
    activities: activitiesNested && activitiesNested.length > 0 ? activitiesNested : undefined,
    steps,
  };
}

export function parsePatchAndSteps(body: Record<string, unknown>): {
  patch: UpdateTestScriptInput;
  steps: StepPatch[] | null;
  activitiesReplace: TestScriptActivityInput[] | undefined;
} {
  const patch: UpdateTestScriptInput = {};
  if (typeof body.title === "string") patch.title = body.title;
  if ("objective" in body) patch.objective = typeof body.objective === "string" ? body.objective : null;
  if ("module" in body) patch.module = typeof body.module === "string" ? body.module : null;
  if (typeof body.test_type === "string") patch.test_type = body.test_type;
  if ("priority" in body) patch.priority = typeof body.priority === "string" ? body.priority : null;
  if (typeof body.status === "string") patch.status = body.status;
  if ("preconditions" in body) {
    patch.preconditions = typeof body.preconditions === "string" ? body.preconditions : null;
  }
  if ("test_data" in body) patch.test_data = typeof body.test_data === "string" ? body.test_data : null;
  if ("business_conditions" in body) {
    patch.business_conditions =
      typeof body.business_conditions === "string" ? body.business_conditions : null;
  }
  if ("expected_result" in body) {
    patch.expected_result = typeof body.expected_result === "string" ? body.expected_result : null;
  }
  if ("scenario_path" in body) {
    patch.scenario_path = typeof body.scenario_path === "string" ? body.scenario_path : null;
  }
  if ("source_document_name" in body) {
    patch.source_document_name =
      typeof body.source_document_name === "string" ? body.source_document_name : null;
  }
  if ("source_language" in body) {
    patch.source_language = typeof body.source_language === "string" ? body.source_language : null;
  }
  if ("scope_item_code" in body) {
    patch.scope_item_code = typeof body.scope_item_code === "string" ? body.scope_item_code : null;
  }
  if ("business_roles" in body) {
    if (body.business_roles === null) patch.business_roles = [];
    else {
      const br = parseBusinessRolesField(body.business_roles);
      if (br !== undefined) patch.business_roles = br;
    }
  }
  if ("source_import_type" in body) {
    patch.source_import_type =
      typeof body.source_import_type === "string" ? body.source_import_type : null;
  }
  if ("related_task_id" in body) {
    patch.related_task_id = typeof body.related_task_id === "string" ? body.related_task_id : null;
  }
  if ("related_ticket_id" in body) {
    patch.related_ticket_id = typeof body.related_ticket_id === "string" ? body.related_ticket_id : null;
  }
  if ("related_knowledge_page_id" in body) {
    patch.related_knowledge_page_id =
      typeof body.related_knowledge_page_id === "string" ? body.related_knowledge_page_id : null;
  }

  let steps: StepPatch[] | null = null;
  if (Array.isArray(body.steps)) {
    steps = body.steps.map((s, i) => parseStepPatch(s as Record<string, unknown>, i));
  }

  let activitiesReplace: TestScriptActivityInput[] | undefined;
  if ("activities" in body) {
    if (body.activities === null) {
      activitiesReplace = [];
    } else if (Array.isArray(body.activities)) {
      activitiesReplace = body.activities.map((a) => parseActivityFlat(a as Record<string, unknown>));
    }
  }

  return { patch, steps, activitiesReplace };
}
