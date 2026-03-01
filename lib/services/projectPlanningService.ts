/**
 * SAP Activate–based project planning service.
 * Generates initial activities from activate_phases and activity_templates when a project is created.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ActivatePhase = {
  phase_key: string;
  name: string;
  sort_order: number;
  duration_percent: number;
};

export type ActivityTemplate = {
  id: string;
  activate_phase_key: string;
  name: string;
  type: string;
  module: string | null;
  default_duration_days: number;
  offset_percent_in_phase: number | null;
  is_active: boolean;
};

export type PhaseWindow = {
  phase_key: string;
  phase_start_date: string; // ISO date
  phase_end_date: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date.getTime() + days * MS_PER_DAY);
  return out;
}

/**
 * Compute phase date windows from project start/end and phase duration_percent.
 */
function computePhaseWindows(
  projectStart: Date,
  projectEnd: Date,
  phases: ActivatePhase[]
): PhaseWindow[] {
  const totalMs = projectEnd.getTime() - projectStart.getTime();
  if (totalMs <= 0) return [];

  const windows: PhaseWindow[] = [];
  let cursor = new Date(projectStart.getTime());

  for (const phase of phases) {
    const pct = Number(phase.duration_percent) / 100;
    const phaseMs = Math.round(totalMs * pct);
    const phaseEnd = new Date(cursor.getTime() + phaseMs);
    windows.push({
      phase_key: phase.phase_key,
      phase_start_date: toISODate(cursor),
      phase_end_date: toISODate(phaseEnd),
    });
    cursor = phaseEnd;
  }

  return windows;
}

/**
 * Compute planned_start_date and planned_end_date for a template within its phase window.
 * Uses offset_percent_in_phase (0–100) and default_duration_days; milestones get same start/end at offset.
 */
function computeTemplateDates(
  template: ActivityTemplate,
  window: PhaseWindow
): { planned_start_date: string; planned_end_date: string } {
  const start = new Date(window.phase_start_date);
  const end = new Date(window.phase_end_date);
  const phaseMs = end.getTime() - start.getTime();
  const offsetPct = template.offset_percent_in_phase != null
    ? Number(template.offset_percent_in_phase) / 100
    : 0;
  const taskStart = new Date(start.getTime() + Math.round(phaseMs * offsetPct));

  const durationDays = Math.max(0, template.default_duration_days ?? 0);
  let taskEnd = durationDays === 0
    ? new Date(taskStart.getTime())
    : addDays(taskStart, durationDays);

  // Clamp to phase window
  const phaseEndDate = new Date(window.phase_end_date);
  if (taskEnd > phaseEndDate) {
    taskEnd = new Date(phaseEndDate.getTime());
  }

  return {
    planned_start_date: toISODate(taskStart),
    planned_end_date: toISODate(taskEnd),
  };
}

/**
 * Generate initial SAP Activate plan for a project: insert tasks from activity_templates
 * with planned dates derived from phase duration_percent and template offset/duration.
 * Uses TODO status from task_statuses. Batches all inserts in a single call.
 */
export async function generateInitialActivatePlan(
  projectId: string,
  projectStartDate: string,
  projectEndDate: string
): Promise<{ created: number; error?: string }> {
  const start = new Date(projectStartDate);
  const end = new Date(projectEndDate);
  if (start.getTime() >= end.getTime()) {
    return { created: 0, error: "Project end date must be after start date." };
  }

  const [
    { data: phasesData, error: phasesError },
    { data: templatesData, error: templatesError },
    { data: statusData, error: statusError },
  ] = await Promise.all([
    supabaseAdmin
      .from("activate_phases")
      .select("phase_key, name, sort_order, duration_percent")
      .order("sort_order", { ascending: true }),
    supabaseAdmin
      .from("activity_templates")
      .select("id, activate_phase_key, name, type, module, default_duration_days, offset_percent_in_phase, is_active")
      .eq("is_active", true),
    supabaseAdmin
      .from("task_statuses")
      .select("id")
      .eq("code", "TODO")
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (phasesError) {
    console.error("generateInitialActivatePlan: phases error", phasesError);
    return { created: 0, error: "Could not load activate phases." };
  }
  if (templatesError) {
    console.error("generateInitialActivatePlan: templates error", templatesError);
    return { created: 0, error: "Could not load activity templates." };
  }
  if (statusError || !statusData?.id) {
    console.error("generateInitialActivatePlan: TODO status not found", statusError ?? statusData);
    return { created: 0, error: "Could not resolve TODO status for new tasks." };
  }

  const phases = (phasesData ?? []) as ActivatePhase[];
  const templates = (templatesData ?? []) as ActivityTemplate[];
  const todoStatusId = statusData.id as string;

  if (phases.length === 0 || templates.length === 0) {
    return { created: 0 };
  }

  const phaseWindows = computePhaseWindows(start, end, phases);
  const windowByPhase = new Map(phaseWindows.map((w) => [w.phase_key, w]));

  const rows: {
    project_id: string;
    title: string;
    description: string | null;
    priority: string;
    due_date: string | null;
    status_id: string;
    activate_phase_key: string;
    planned_start_date: string;
    planned_end_date: string;
    is_template_generated: boolean;
  }[] = [];

  for (const template of templates) {
    const window = windowByPhase.get(template.activate_phase_key);
    if (!window) continue;

    const { planned_start_date, planned_end_date } = computeTemplateDates(template, window);

    rows.push({
      project_id: projectId,
      title: template.name,
      description: null,
      priority: "medium",
      due_date: planned_end_date,
      status_id: todoStatusId,
      activate_phase_key: template.activate_phase_key,
      planned_start_date,
      planned_end_date,
      is_template_generated: true,
    });
  }

  if (rows.length === 0) {
    return { created: 0 };
  }

  const { error: insertError } = await supabaseAdmin.from("tasks").insert(rows);

  if (insertError) {
    console.error("generateInitialActivatePlan: insert error", insertError);
    return { created: 0, error: insertError.message };
  }

  return { created: rows.length };
}
