import { NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/serverAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteParams = { params: Promise<{ id: string }> };

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * GET /api/projects/[id]/activate-plan
 * Returns SAP Activate phases with computed date ranges and task counts for the project.
 * Requires auth.
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const { id: projectId } = await params;
    if (!projectId?.trim()) {
      return NextResponse.json(
        { error: "Se requiere el id del proyecto." },
        { status: 400 }
      );
    }

    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id, start_date, planned_end_date")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: "Proyecto no encontrado." },
        { status: 404 }
      );
    }

    const startDate = (project as { start_date?: string | null }).start_date;
    const plannedEndDate = (project as { planned_end_date?: string | null }).planned_end_date;

    if (!startDate || !plannedEndDate) {
      return NextResponse.json({
        phases: [],
        message: "El proyecto no tiene fechas de planificación.",
      });
    }

    const start = new Date(startDate);
    const end = new Date(plannedEndDate);
    if (start.getTime() >= end.getTime()) {
      return NextResponse.json({ phases: [] });
    }

    const [{ data: phasesData, error: phasesError }, { data: tasksData }] =
      await Promise.all([
        supabaseAdmin
          .from("activate_phases")
          .select("phase_key, name, sort_order, duration_percent")
          .order("sort_order", { ascending: true }),
        supabaseAdmin
          .from("tasks")
          .select("activate_phase_key, status_id")
          .eq("project_id", projectId)
          .not("activate_phase_key", "is", null),
      ]);

    if (phasesError) {
      return NextResponse.json(
        { error: "Error al cargar fases." },
        { status: 500 }
      );
    }

    const phases = (phasesData ?? []) as {
      phase_key: string;
      name: string;
      sort_order: number;
      duration_percent: number;
    }[];

    const totalMs = end.getTime() - start.getTime();
    const phaseWindows: { phase_key: string; name: string; sort_order: number; start_date: string; end_date: string }[] = [];
    let cursor = new Date(start.getTime());

    for (const p of phases) {
      const pct = Number(p.duration_percent) / 100;
      const phaseMs = Math.round(totalMs * pct);
      const phaseEnd = new Date(cursor.getTime() + phaseMs);
      phaseWindows.push({
        phase_key: p.phase_key,
        name: p.name,
        sort_order: p.sort_order,
        start_date: toISODate(cursor),
        end_date: toISODate(phaseEnd),
      });
      cursor = phaseEnd;
    }

    const { data: statusRows } = await supabaseAdmin
      .from("task_statuses")
      .select("id")
      .eq("code", "DONE")
      .eq("is_active", true);
    const doneId = (statusRows?.[0] as { id: string } | undefined)?.id;

    const tasks = (tasksData ?? []) as { activate_phase_key: string; status_id: string }[];
    const byPhase = new Map<string, { total: number; completed: number }>();
    for (const w of phaseWindows) {
      byPhase.set(w.phase_key, { total: 0, completed: 0 });
    }
    for (const t of tasks) {
      const cur = byPhase.get(t.activate_phase_key);
      if (cur) {
        cur.total += 1;
        if (doneId && t.status_id === doneId) cur.completed += 1;
      }
    }

    const phasesWithStats = phaseWindows.map((w) => {
      const stats = byPhase.get(w.phase_key) ?? { total: 0, completed: 0 };
      const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
      return {
        ...w,
        totalTasks: stats.total,
        completedTasks: stats.completed,
        completionPercent: pct,
      };
    });

    return NextResponse.json({
      phases: phasesWithStats,
      projectStart: startDate,
      projectEnd: plannedEndDate,
    });
  } catch (err) {
    console.error("activate-plan GET error", err);
    return NextResponse.json(
      { error: "Error al cargar el plan." },
      { status: 500 }
    );
  }
}
