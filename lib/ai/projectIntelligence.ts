/**
 * Project Intelligence — health analysis for Sapito.
 * Uses project metrics RPC and phase/activity data to produce a structured health report.
 */

import { getProjectMetrics } from "@/lib/metrics/platformMetrics";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ==========================
// Types
// ==========================

export interface ProjectHealthSignals {
  overdueTasks: number;
  openTickets: number;
  recentActivity: number;
  delayedPhases: number;
}

export interface ProjectHealthReport {
  score: number;
  status: "healthy" | "warning" | "risk";
  signals: ProjectHealthSignals;
  recommendations: string[];
}

// ==========================
// analyzeProjectHealth
// ==========================

/**
 * Analyzes project health for the given project and user.
 * Reuses get_project_metrics RPC for access check and core metrics;
 * fetches recent activity and delayed phases for signals.
 */
export async function analyzeProjectHealth(
  projectId: string,
  userId: string
): Promise<ProjectHealthReport> {
  const emptySignals: ProjectHealthSignals = {
    overdueTasks: 0,
    openTickets: 0,
    recentActivity: 0,
    delayedPhases: 0,
  };

  const metrics = await getProjectMetrics(projectId, userId ?? null);
  if (!metrics) {
    return {
      score: 0,
      status: "risk",
      signals: emptySignals,
      recommendations: ["No access to project."],
    };
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString();
  const todayIso = new Date().toISOString().slice(0, 10);

  const [recentActivityRes, delayedPhasesRes] = await Promise.all([
    supabaseAdmin
      .from("project_activities")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .gte("created_at", sevenDaysAgoIso),
    supabaseAdmin
      .from("project_phases")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .lt("end_date", todayIso)
      .not("end_date", "is", null),
  ]);

  const overdueTasks = metrics.overdueTasks;
  const openTickets = metrics.openTickets;
  const recentActivity = recentActivityRes.count ?? 0;
  const delayedPhases = delayedPhasesRes.count ?? 0;

  const signals: ProjectHealthSignals = {
    overdueTasks,
    openTickets,
    recentActivity,
    delayedPhases,
  };

  let score = 100;
  score -= overdueTasks * 5;
  score -= openTickets * 3;
  score -= delayedPhases * 10;
  score = Math.max(0, Math.min(100, Math.round(score)));

  let status: ProjectHealthReport["status"] = "risk";
  if (score > 80) status = "healthy";
  else if (score > 60) status = "warning";

  const recommendations: string[] = [];
  if (overdueTasks > 0) {
    recommendations.push("Review overdue tasks.");
  }
  if (openTickets > 0) {
    recommendations.push("Prioritize ticket resolution.");
  }
  if (delayedPhases > 0) {
    recommendations.push("Reevaluate current project phase timeline.");
  }

  return {
    score,
    status,
    signals,
    recommendations,
  };
}
