/**
 * SAP Activate Plan Generator (server-only).
 * Creates project_phases, project_activities, and project_tasks from template tables.
 * Idempotent: if project already has phases, skips.
 *
 * Schema mapping (actual column names):
 * - project_phases: project_id, phase_key (NOT NULL), name, sort_order, start_date, end_date
 * - project_activities: project_id, phase_id, name, description, status, priority, start_date, due_date
 * - project_tasks: project_id, activity_id, title (NOT NULL), description, status, priority, due_date
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";

const PHASE_WEIGHTS: Record<string, number> = {
  discover: 0.15,
  prepare: 0.1,
  explore: 0.25,
  realize: 0.3,
  deploy: 0.1,
  run: 0.1,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export type GenerateActivatePlanResult =
  | { ok: true; skipped: false; phasesCreated: number; activitiesCreated: number; tasksCreated: number }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

export async function generateActivatePlan(projectId: string): Promise<GenerateActivatePlanResult> {
  const { data: project, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("id, start_date, planned_end_date")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    return { ok: false, error: "Project not found." };
  }

  const startDate = (project as { start_date?: string | null }).start_date;
  const plannedEndDate = (project as { planned_end_date?: string | null }).planned_end_date;

  if (!startDate || !plannedEndDate) {
    return { ok: false, error: "missing_dates" };
  }

  const start = new Date(startDate + "T00:00:00");
  const end = new Date(plannedEndDate + "T00:00:00");
  if (start.getTime() >= end.getTime()) {
    return { ok: false, error: "End date must be after start date." };
  }

  const { data: existingPhases, error: existingError } = await supabaseAdmin
    .from("project_phases")
    .select("id")
    .eq("project_id", projectId)
    .limit(1);

  if (existingError) {
    return { ok: false, error: "Could not check existing phases." };
  }
  if (existingPhases && existingPhases.length > 0) {
    return { ok: true, skipped: true, reason: "phases_exist" };
  }

  const [
    { data: phaseTemplates, error: phaseErr },
    { data: activityTemplates, error: actErr },
    { data: taskTemplates, error: taskErr },
  ] = await Promise.all([
    supabaseAdmin
      .from("activate_phase_templates")
      .select("id, phase_key, name, sort_order")
      .order("sort_order", { ascending: true }),
    supabaseAdmin
      .from("activate_activity_templates")
      .select("id, phase_key, name, description, sort_order, default_status")
      .order("phase_key")
      .order("sort_order", { ascending: true }),
    supabaseAdmin
      .from("activate_task_templates")
      .select("id, activity_template_id, name, description, sort_order, offset_days")
      .order("activity_template_id")
      .order("sort_order", { ascending: true }),
  ]);

  if (phaseErr || !phaseTemplates?.length) {
    return { ok: false, error: "Could not load phase templates." };
  }
  if (actErr) {
    return { ok: false, error: "Could not load activity templates." };
  }
  if (taskErr) {
    return { ok: false, error: "Could not load task templates." };
  }

  const phases = phaseTemplates as { id: string; phase_key: string; name: string; sort_order: number }[];
  const activities = (activityTemplates ?? []) as {
    id: string;
    phase_key: string;
    name: string;
    description: string | null;
    sort_order: number;
    default_status: string | null;
  }[];
  const tasks = (taskTemplates ?? []) as {
    id: string;
    activity_template_id: string;
    name: string;
    description: string | null;
    sort_order: number;
    offset_days: number | null;
  }[];

  const totalMs = end.getTime() - start.getTime();
  const phaseWindows: { phase_key: string; start_date: string; end_date: string; order: number }[] = [];
  let cursor = start.getTime();
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    const weight = PHASE_WEIGHTS[p.phase_key] ?? 1 / phases.length;
    const phaseMs = Math.round(totalMs * weight);
    const phaseEnd = i === phases.length - 1 ? end.getTime() : cursor + phaseMs;
    phaseWindows.push({
      phase_key: p.phase_key,
      start_date: toISODate(new Date(cursor)),
      end_date: toISODate(new Date(phaseEnd)),
      order: p.sort_order,
    });
    cursor = phaseEnd;
  }

  const phaseInserts = phaseWindows.map((w, idx) => {
    const pt = phases[idx];
    return {
      project_id: projectId,
      phase_key: pt.phase_key,
      name: pt.name,
      sort_order: pt.sort_order,
      start_date: w.start_date,
      end_date: w.end_date,
    };
  });

  const { data: insertedPhases, error: insertPhasesError } = await supabaseAdmin
    .from("project_phases")
    .insert(phaseInserts)
    .select("id, phase_key");

  if (insertPhasesError) {
    console.error("generateActivatePlan: insert project_phases", insertPhasesError);
    return { ok: false, error: insertPhasesError.message };
  }

  const phaseIdByKey = new Map<string, string>();
  for (const row of insertedPhases as { id: string; phase_key: string }[]) {
    phaseIdByKey.set(row.phase_key, row.id);
  }

  const activityInserts: {
    project_id: string;
    phase_id: string;
    name: string;
    description: string | null;
    status: string;
    priority: string;
    start_date: string;
    due_date: string;
  }[] = [];
  const phaseActivityCount = new Map<string, number>();

  for (const act of activities) {
    const phaseId = phaseIdByKey.get(act.phase_key);
    if (!phaseId) continue;
    const window = phaseWindows.find((w) => w.phase_key === act.phase_key);
    if (!window) continue;

    const count = phaseActivityCount.get(act.phase_key) ?? 0;
    phaseActivityCount.set(act.phase_key, count + 1);
    const totalInPhase = activities.filter((a) => a.phase_key === act.phase_key).length;
    const start = new Date(window.start_date + "T00:00:00");
    const end = new Date(window.end_date + "T00:00:00");
    const phaseMs = end.getTime() - start.getTime();
    const step = totalInPhase > 1 ? phaseMs / totalInPhase : 0;
    const actStart = new Date(start.getTime() + Math.round(step * count));
    const actEnd = totalInPhase > 1
      ? new Date(start.getTime() + Math.round(step * (count + 1)))
      : new Date(end.getTime());

    activityInserts.push({
      project_id: projectId,
      phase_id: phaseId,
      name: act.name,
      description: act.description ?? null,
      status: act.default_status && ["planned", "in_progress", "blocked", "done"].includes(act.default_status)
        ? act.default_status
        : "planned",
      priority: "medium",
      start_date: toISODate(actStart),
      due_date: toISODate(actEnd),
    });
  }

  const { data: insertedActivities, error: insertActsError } = await supabaseAdmin
    .from("project_activities")
    .insert(activityInserts)
    .select("id");

  if (insertActsError) {
    console.error("generateActivatePlan: insert project_activities", insertActsError);
    return { ok: false, error: insertActsError.message };
  }

  const activityTemplateToProjectActivityId = new Map<string, string>();
  const insertedIds = (insertedActivities as { id: string }[]) ?? [];
  activities.forEach((act, idx) => {
    const id = insertedIds[idx]?.id;
    if (id) activityTemplateToProjectActivityId.set(act.id, id);
  });

  const taskInserts: {
    project_id: string;
    activity_id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    due_date: string | null;
  }[] = [];

  const activityTemplateToPhaseKey = new Map<string, string>();
  for (const a of activities) {
    activityTemplateToPhaseKey.set(a.id, a.phase_key);
  }

  for (const t of tasks) {
    const projectActivityId = activityTemplateToProjectActivityId.get(t.activity_template_id);
    if (!projectActivityId) continue;
    const phaseKey = activityTemplateToPhaseKey.get(t.activity_template_id);
    if (!phaseKey) continue;
    const window = phaseWindows.find((w) => w.phase_key === phaseKey);
    if (!window) continue;

    const phaseStart = new Date(window.start_date + "T00:00:00");
    const offsetDays = t.offset_days != null ? t.offset_days : 0;
    const dueDate = addDays(phaseStart, offsetDays);
    const dueISODate = toISODate(dueDate);
    const phaseEnd = new Date(window.end_date + "T00:00:00");
    const clampedDue = dueDate.getTime() > phaseEnd.getTime() ? window.end_date : dueISODate;

    taskInserts.push({
      project_id: projectId,
      activity_id: projectActivityId,
      title: t.name,
      description: t.description ?? null,
      status: "pending",
      priority: "medium",
      due_date: clampedDue,
    });
  }

  if (taskInserts.length > 0) {
    const { error: insertTasksError } = await supabaseAdmin
      .from("project_tasks")
      .insert(taskInserts);

    if (insertTasksError) {
      console.error("generateActivatePlan: insert project_tasks", insertTasksError);
      return { ok: false, error: insertTasksError.message };
    }
  }

  return {
    ok: true,
    skipped: false,
    phasesCreated: phaseInserts.length,
    activitiesCreated: activityInserts.length,
    tasksCreated: taskInserts.length,
  };
}
