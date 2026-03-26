/**
 * Display-only heuristics for the project overview executive dashboard.
 * Uses counts and dates already loaded on the client — not authoritative risk analysis.
 */

export type ExecutiveSignalLevel = "good" | "watch" | "risk";

export type MemberLoadBand = "light" | "balanced" | "high" | "overloaded";

const TASK_W = 1;
const TICKET_W = 2;
const BLOCKED_W = 2;
const OVERDUE_W = 2;

export function memberLoadScore(input: {
  openTasks: number;
  openTickets: number;
  blockedItems: number;
  overdueItems: number;
}): number {
  return (
    input.openTasks * TASK_W +
    input.openTickets * TICKET_W +
    input.blockedItems * BLOCKED_W +
    input.overdueItems * OVERDUE_W
  );
}

export function memberLoadBand(score: number): MemberLoadBand {
  if (score <= 4) return "light";
  if (score <= 8) return "balanced";
  if (score <= 12) return "high";
  return "overloaded";
}

export function bandToLoadFraction(band: MemberLoadBand): number {
  if (band === "light") return 0.22;
  if (band === "balanced") return 0.45;
  if (band === "high") return 0.72;
  return 0.95;
}

/** Project health for executive strip (wording aligned with project cards). */
export function executiveProjectHealth(input: {
  openTickets: number;
  overdueTasks: number;
  blockedTasks: number;
  blockedActivities: number;
  plannedEndDate: string | null;
  projectStatus: string | null;
}): { labelKey: "healthy" | "watch" | "at_risk"; level: ExecutiveSignalLevel } {
  const s = (input.projectStatus ?? "").toLowerCase();
  if (s === "completed" || s === "archived") {
    return { labelKey: "healthy", level: "good" };
  }

  let score = 100;
  if (input.plannedEndDate) {
    const end = new Date(input.plannedEndDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    if (end < today) score -= 42;
  }
  if (input.openTickets >= 8) score -= 38;
  else if (input.openTickets >= 4) score -= 22;
  else if (input.openTickets >= 2) score -= 10;

  if (input.overdueTasks >= 6) score -= 28;
  else if (input.overdueTasks >= 2) score -= 16;
  else if (input.overdueTasks >= 1) score -= 8;

  if (input.blockedTasks >= 3) score -= 22;
  else if (input.blockedTasks >= 1) score -= 12;

  if (input.blockedActivities >= 2) score -= 14;
  else if (input.blockedActivities >= 1) score -= 8;

  if (score >= 76) return { labelKey: "healthy", level: "good" };
  if (score >= 52) return { labelKey: "watch", level: "watch" };
  return { labelKey: "at_risk", level: "risk" };
}

export function executiveDeliveryRisk(input: {
  overdueTasks: number;
  blockedTasks: number;
  blockedActivities: number;
  overdueTickets: number;
  highRiskActivities: number;
  mediumRiskActivities: number;
  daysToEnd: number | null;
}): { labelKey: "low" | "elevated" | "high"; level: ExecutiveSignalLevel } {
  const pressure =
    (input.overdueTasks >= 3 ? 3 : input.overdueTasks >= 1 ? 1 : 0) +
    (input.blockedTasks >= 1 ? 2 : 0) +
    (input.blockedActivities >= 1 ? 2 : 0) +
    (input.overdueTickets >= 1 ? 2 : 0) +
    (input.highRiskActivities >= 1 ? 3 : 0) +
    (input.mediumRiskActivities >= 2 ? 1 : 0) +
    (input.daysToEnd !== null && input.daysToEnd <= 7 && input.daysToEnd >= 0 ? 2 : 0);

  if (pressure >= 6) return { labelKey: "high", level: "risk" };
  if (pressure >= 2) return { labelKey: "elevated", level: "watch" };
  return { labelKey: "low", level: "good" };
}

export function daysUntilPlannedEnd(plannedEndDate: string | null): number | null {
  if (!plannedEndDate) return null;
  const end = new Date(plannedEndDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86400000);
}

export function executiveOpenIssuesLabel(openTickets: number, overdueTasks: number): string {
  const n = openTickets + overdueTasks;
  return String(n);
}

export type RiskBullet = { tone: ExecutiveSignalLevel; text: string };

/**
 * Maps already-derived executive levels into a single overview insight variant
 * (for display copy only — no new scoring).
 */
export function executiveInsightVariant(input: {
  healthLevel: ExecutiveSignalLevel;
  deliveryLevel: ExecutiveSignalLevel;
  worstLoadBand: MemberLoadBand;
  openIssues: number;
}): "progressing" | "pressure" | "at_risk" {
  if (input.healthLevel === "risk" || input.deliveryLevel === "risk") {
    return "at_risk";
  }
  if (
    input.healthLevel === "watch" ||
    input.deliveryLevel === "watch" ||
    input.worstLoadBand === "high" ||
    input.worstLoadBand === "overloaded" ||
    input.openIssues > 8
  ) {
    return "pressure";
  }
  return "progressing";
}

export function buildRiskBullets(input: {
  overdueTasks: number;
  blockedActivities: number;
  openTickets: number;
  overloadedMemberCount: number;
  daysToEnd: number | null;
  onTrack: boolean;
}): RiskBullet[] {
  const out: RiskBullet[] = [];
  if (input.overdueTasks > 0) {
    out.push({
      tone: "risk",
      text:
        input.overdueTasks === 1
          ? "1 overdue task needs attention"
          : `${input.overdueTasks} overdue tasks need attention`,
    });
  }
  if (input.blockedActivities > 0) {
    out.push({
      tone: "watch",
      text:
        input.blockedActivities === 1
          ? "1 activity is blocked"
          : `${input.blockedActivities} activities are blocked`,
    });
  }
  if (input.openTickets > 0) {
    out.push({
      tone: input.openTickets >= 5 ? "watch" : "good",
      text:
        input.openTickets === 1
          ? "1 open ticket remains unresolved"
          : `${input.openTickets} open tickets remain unresolved`,
    });
  }
  if (input.overloadedMemberCount > 0) {
    out.push({
      tone: "watch",
      text:
        input.overloadedMemberCount === 1
          ? "1 team member is near or over capacity"
          : `${input.overloadedMemberCount} team members are near or over capacity`,
    });
  }
  if (input.daysToEnd !== null && input.daysToEnd <= 14 && input.daysToEnd >= 0) {
    out.push({
      tone: input.daysToEnd <= 7 ? "watch" : "good",
      text:
        input.daysToEnd === 0
          ? "Plan target is today — confirm scope and commitments"
          : `About ${input.daysToEnd} days to plan target — watch delivery pace`,
    });
  }
  if (input.onTrack && out.length === 0) {
    out.push({
      tone: "good",
      text: "No major risk signals from tasks, tickets, or team load",
    });
  } else if (input.onTrack && out.length < 5) {
    out.push({
      tone: "good",
      text: "Planning window still looks workable — keep execution tight",
    });
  }
  return out.slice(0, 5);
}
