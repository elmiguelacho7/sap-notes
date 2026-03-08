/**
 * Project Risk Radar — risk signals and recommendations for Sapito.
 * Reuses project metrics and project health; no database schema changes.
 */

import { getProjectMetrics } from "@/lib/metrics/platformMetrics";
import { analyzeProjectHealth } from "@/lib/ai/projectIntelligence";

// ==========================
// Types
// ==========================

export interface ProjectRiskSignal {
  label: string;
  value: number;
  severity: "low" | "medium" | "high";
  reason: string;
}

export interface ProjectRiskReport {
  level: "low" | "medium" | "high";
  summary: string;
  signals: ProjectRiskSignal[];
  recommendations: string[];
}

// ==========================
// analyzeProjectRisk
// ==========================

/**
 * Analyzes project risk using getProjectMetrics and analyzeProjectHealth.
 * Builds signals with severity rules and returns a structured risk report.
 */
export async function analyzeProjectRisk(
  projectId: string,
  userId: string
): Promise<ProjectRiskReport> {
  const signals: ProjectRiskSignal[] = [];
  const recommendations: string[] = [];

  const metrics = await getProjectMetrics(projectId, userId ?? null);
  if (!metrics) {
    return {
      level: "high",
      summary: "No access to project or project not found.",
      signals: [],
      recommendations: ["Verify project access and try again."],
    };
  }

  const health = await analyzeProjectHealth(projectId, userId);
  const overdueTasks = metrics.overdueTasks;
  const highPriorityTickets = metrics.highPriorityTickets;
  const openTickets = metrics.openTickets;
  const delayedPhases = health.signals.delayedPhases;
  const recentActivity = health.signals.recentActivity;

  // Severity rules
  if (overdueTasks >= 5) {
    signals.push({
      label: "Overdue tasks",
      value: overdueTasks,
      severity: "high",
      reason: `${overdueTasks} tasks are overdue.`,
    });
    recommendations.push("Review overdue tasks and reassign or reschedule them.");
  } else if (overdueTasks >= 2) {
    signals.push({
      label: "Overdue tasks",
      value: overdueTasks,
      severity: "medium",
      reason: `${overdueTasks} tasks are overdue.`,
    });
    recommendations.push("Review overdue tasks and reassign or reschedule them.");
  }

  if (highPriorityTickets >= 2) {
    signals.push({
      label: "High-priority tickets",
      value: highPriorityTickets,
      severity: "high",
      reason: `${highPriorityTickets} high-priority tickets open.`,
    });
    recommendations.push("Prioritize high-priority ticket resolution.");
  } else if (highPriorityTickets >= 1) {
    signals.push({
      label: "High-priority tickets",
      value: highPriorityTickets,
      severity: "medium",
      reason: `${highPriorityTickets} high-priority ticket(s) open.`,
    });
    recommendations.push("Prioritize high-priority ticket resolution.");
  }

  if (delayedPhases >= 1) {
    signals.push({
      label: "Delayed phases",
      value: delayedPhases,
      severity: "high",
      reason: `${delayedPhases} project phase(s) past end date.`,
    });
    recommendations.push("Review delayed project phases and update delivery expectations.");
  }

  if (openTickets >= 5) {
    signals.push({
      label: "Open tickets",
      value: openTickets,
      severity: "medium",
      reason: `${openTickets} open tickets.`,
    });
  }

  if (recentActivity === 0) {
    signals.push({
      label: "Low recent activity",
      value: 0,
      severity: "medium",
      reason: "No project activity in the last 7 days.",
    });
    recommendations.push("Confirm team activity and progress for the current week.");
  }

  // Overall level
  const hasHigh = signals.some((s) => s.severity === "high");
  const hasMedium = signals.some((s) => s.severity === "medium");
  const level: ProjectRiskReport["level"] = hasHigh ? "high" : hasMedium ? "medium" : "low";

  // Summary
  let summary: string;
  if (signals.length === 0) {
    summary = "This project shows low risk; no major warning signals detected.";
  } else {
    const reasons = signals.map((s) => s.label.toLowerCase()).join(" and ");
    summary = `This project shows ${level} risk due to ${reasons}.`;
  }

  return {
    level,
    summary,
    signals,
    recommendations: [...new Set(recommendations)],
  };
}
