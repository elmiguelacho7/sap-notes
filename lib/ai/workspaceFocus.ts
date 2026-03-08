/**
 * Workspace Focus — weekly priorities and recommended actions for Sapito.
 * Uses platform/project metrics and optional project health; multitenant-safe (user-scoped).
 */

import { getUserProjectIds, getPlatformMetrics, getProjectMetrics } from "@/lib/metrics/platformMetrics";
import { analyzeProjectHealth } from "@/lib/ai/projectIntelligence";

// ==========================
// Types
// ==========================

export interface WeeklyFocusPriority {
  title: string;
  reason: string;
}

export interface WeeklyFocusResult {
  priorities: WeeklyFocusPriority[];
  reasons: string[];
  recommendedNextActions: string[];
}

// ==========================
// analyzeWeeklyFocus
// ==========================

/**
 * Analyzes the user's accessible workspace to produce weekly focus priorities.
 * - Global mode: pass only userId; all accessible projects are considered.
 * - Project mode: pass userId and projectId; current project is weighted first.
 */
export async function analyzeWeeklyFocus(
  userId: string,
  projectId?: string | null
): Promise<WeeklyFocusResult> {
  const priorities: WeeklyFocusPriority[] = [];
  const reasons: string[] = [];
  const recommendedNextActions: string[] = [];

  if (!userId?.trim()) {
    return {
      priorities: [{ title: "Inicia sesión", reason: "Se requiere sesión para ver prioridades del workspace." }],
      reasons: ["No user context."],
      recommendedNextActions: ["Inicia sesión para obtener prioridades."],
    };
  }

  const projectIds = await getUserProjectIds(userId);
  const platform = await getPlatformMetrics(userId);

  // Optionally bias: put current project first when in project mode
  const orderedProjectIds =
    projectId && projectIds.includes(projectId)
      ? [projectId, ...projectIds.filter((id) => id !== projectId)]
      : projectIds;

  let totalOverdue = 0;
  let totalHighPriorityTickets = 0;
  let totalOpenTickets = 0;
  let totalUpcoming = 0;
  const projectsAtRisk: { name: string; status: string }[] = [];

  for (const pid of orderedProjectIds) {
    const metrics = await getProjectMetrics(pid, userId);
    if (!metrics) continue;

    totalOverdue += metrics.overdueTasks;
    totalHighPriorityTickets += metrics.highPriorityTickets;
    totalOpenTickets += metrics.openTickets;
    totalUpcoming += metrics.upcomingActivities;

    const health = await analyzeProjectHealth(pid, userId);
    if (health.status === "risk" || health.status === "warning") {
      projectsAtRisk.push({
        name: metrics.projectName ?? pid.slice(0, 8),
        status: health.status,
      });
    }
  }

  // Build priorities (ordered by urgency)

  if (totalOverdue > 0) {
    const title =
      totalOverdue === 1
        ? "Tareas vencidas"
        : `${totalOverdue} tareas vencidas`;
    priorities.push({
      title,
      reason: `Hay ${totalOverdue} tarea(s) vencida(s) en tu workspace. Revisar y replanificar.`,
    });
    reasons.push(`${totalOverdue} overdue task(s) across projects.`);
    recommendedNextActions.push("Revisa las tareas vencidas y actualiza fechas o cierra las completadas.");
  }

  if (totalHighPriorityTickets > 0) {
    const title =
      totalHighPriorityTickets === 1
        ? "Ticket de alta prioridad"
        : `${totalHighPriorityTickets} tickets de alta prioridad`;
    priorities.push({
      title,
      reason: `${totalHighPriorityTickets} ticket(s) de alta prioridad abierto(s). Atender primero.`,
    });
    reasons.push(`${totalHighPriorityTickets} high-priority ticket(s) open.`);
    recommendedNextActions.push("Prioriza la resolución de tickets de alta prioridad.");
  }

  if (projectsAtRisk.length > 0) {
    const names = projectsAtRisk.map((p) => p.name).join(", ");
    priorities.push({
      title: `Proyectos que requieren atención (${projectsAtRisk.length})`,
      reason: `Estado en riesgo o advertencia: ${names}. Revisar salud del proyecto.`,
    });
    reasons.push(`Projects at risk/warning: ${names}.`);
    recommendedNextActions.push("Revisa el estado de los proyectos en riesgo y planifica acciones correctivas.");
  }

  if (totalOpenTickets > 0 && totalHighPriorityTickets === 0) {
    priorities.push({
      title: `${totalOpenTickets} tickets abiertos`,
      reason: `Tickets abiertos en el workspace. Revisar y cerrar o priorizar.`,
    });
    reasons.push(`${totalOpenTickets} open ticket(s).`);
    if (!recommendedNextActions.some((a) => a.includes("ticket"))) {
      recommendedNextActions.push("Revisa los tickets abiertos y asigna prioridades.");
    }
  }

  if (totalUpcoming > 0) {
    priorities.push({
      title: `Próximas actividades (${totalUpcoming})`,
      reason: `${totalUpcoming} actividad(es) próxima(s). Preparar y cumplir plazos.`,
    });
    reasons.push(`${totalUpcoming} upcoming activit(y/ies).`);
    recommendedNextActions.push("Revisa las actividades próximas y prepara lo necesario para cumplir plazos.");
  }

  // Low recent activity (notes today as a simple signal)
  if (platform.notes_today === 0 && projectIds.length > 0) {
    priorities.push({
      title: "Poca actividad reciente",
      reason: "No hay notas creadas hoy. Considera documentar avances o bloqueos.",
    });
    reasons.push("No notes created today.");
    recommendedNextActions.push("Documenta hoy avances o bloqueos en notas del proyecto.");
  }

  if (priorities.length === 0) {
    priorities.push({
      title: "Sin prioridades urgentes",
      reason: "No hay tareas vencidas, tickets de alta prioridad ni proyectos en riesgo detectados.",
    });
    reasons.push("No urgent priorities.");
    recommendedNextActions.push("Revisa el dashboard y las tareas de esta semana para mantener el ritmo.");
  }

  return {
    priorities,
    reasons,
    recommendedNextActions,
  };
}
