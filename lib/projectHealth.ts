export type ProjectHealthLevel = "healthy" | "watch" | "at_risk";

export type ProjectHealthResult = {
  level: ProjectHealthLevel;
  /** How many of the 4 segments are “on” (1–4). */
  segmentsFilled: number;
};

/** Subset of project list fields used for the display-only health heuristic. */
export type ProjectHealthInput = {
  status: string | null;
  planned_end_date: string | null;
  open_tickets_count: number;
  open_tasks_count: number;
};

function normalizedStatus(status: string | null): string {
  return (status ?? "").toLowerCase().trim();
}

function isTerminalStatus(s: string): boolean {
  return (
    s === "completed" ||
    s === "archived" ||
    s === "finalizado" ||
    s.includes("cerrado") ||
    s.includes("closed")
  );
}

/**
 * Display-only heuristic from fields already loaded on the projects list.
 * Not a guarantee of real project health—signals open work, schedule, and status.
 */
export function computeProjectHealth(project: ProjectHealthInput): ProjectHealthResult {
  const s = normalizedStatus(project.status);

  if (isTerminalStatus(s)) {
    return { level: "healthy", segmentsFilled: 4 };
  }

  if (s === "blocked" || s === "bloqueado") {
    return { level: "at_risk", segmentsFilled: 1 };
  }

  let score = 100;

  if (project.planned_end_date) {
    const end = new Date(project.planned_end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    if (end < today) {
      score -= 42;
    }
  }

  const tickets = project.open_tickets_count;
  if (tickets >= 8) score -= 38;
  else if (tickets >= 4) score -= 22;
  else if (tickets >= 2) score -= 10;

  const tasks = project.open_tasks_count;
  if (tasks >= 36) score -= 26;
  else if (tasks >= 18) score -= 14;
  else if (tasks >= 10) score -= 6;

  let level: ProjectHealthLevel;
  if (score >= 76) level = "healthy";
  else if (score >= 52) level = "watch";
  else level = "at_risk";

  const segmentsFilled =
    level === "healthy" ? 4 : level === "watch" ? 2 : 1;

  return { level, segmentsFilled };
}
