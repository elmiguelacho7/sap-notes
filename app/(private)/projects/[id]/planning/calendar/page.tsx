"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { ChevronLeft, Calendar } from "lucide-react";
import { RiskByPhaseStackedBar, type RiskByPhaseRow } from "@/components/charts/RiskByPhaseStackedBar";
import { PhaseDurationBar, type PhaseDurationRow } from "@/components/charts/PhaseDurationBar";
import ProjectGanttPro from "@/app/components/ProjectGanttPro";
import { Skeleton } from "@/components/ui/Skeleton";

type ProjectPhase = {
  id: string;
  project_id: string;
  phase_key: string | null;
  name: string;
  sort_order: number;
  start_date: string | null;
  end_date: string | null;
};

type ProjectActivity = {
  id: string;
  project_id: string;
  phase_id: string | null;
  name: string;
  status: string | null;
  start_date: string | null;
  due_date: string | null;
};

function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  return new Date(dateStr + "T00:00:00");
}

function formatDate(dateStr: string | null, localeTag: string, noDateLabel: string): string {
  if (!dateStr) return noDateLabel;
  return new Date(dateStr + "T00:00:00").toLocaleDateString(localeTag, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getTimelineBounds(
  phases: ProjectPhase[],
  activities: ProjectActivity[]
): { min: Date; max: Date } | null {
  const timestamps: number[] = [];
  for (const p of phases) {
    const s = parseDate(p.start_date);
    const e = parseDate(p.end_date);
    if (s) timestamps.push(s.getTime());
    if (e) timestamps.push(e.getTime());
  }
  for (const a of activities) {
    const s = parseDate(a.start_date);
    const d = parseDate(a.due_date);
    if (s) timestamps.push(s.getTime());
    if (d) timestamps.push(d.getTime());
  }
  if (timestamps.length === 0) return null;
  return {
    min: new Date(Math.min(...timestamps)),
    max: new Date(Math.max(...timestamps)),
  };
}

export default function ProjectPlanningCalendarPage() {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const params = useParams();
  const projectId = (params?.id ?? "") as string;

  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /** activity_id -> risk_level from activity_risk_metrics view */
  const [riskByActivityId, setRiskByActivityId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);

    (async () => {
      try {
        const [phasesRes, activitiesRes] = await Promise.all([
          supabase
            .from("project_phases")
            .select("*")
            .eq("project_id", projectId)
            .order("sort_order", { ascending: true }),
          supabase
            .from("project_activities")
            .select("id, project_id, phase_id, name, status, start_date, due_date")
            .eq("project_id", projectId)
            .order("start_date", { ascending: true, nullsFirst: true }),
        ]);

        if (cancelled) return;

        if (phasesRes.error) {
          handleSupabaseError("project_phases", phasesRes.error);
          setErrorMsg(t("errors.loadFailed"));
          setPhases([]);
          setActivities([]);
          setRiskByActivityId({});
          return;
        }
        if (activitiesRes.error) {
          handleSupabaseError("project_activities", activitiesRes.error);
          setErrorMsg(t("errors.loadFailed"));
          setPhases([]);
          setActivities([]);
          setRiskByActivityId({});
          return;
        }

        setPhases((phasesRes.data ?? []) as ProjectPhase[]);
        const activitiesList = (activitiesRes.data ?? []) as ProjectActivity[];
        setActivities(activitiesList);

        const activityIds = activitiesList.map((a) => a.id);
        if (activityIds.length > 0) {
          const riskRes = await supabase
            .from("activity_risk_metrics")
            .select("activity_id, risk_level")
            .in("activity_id", activityIds);
          if (!riskRes.error && riskRes.data?.length) {
            const byId: Record<string, string> = {};
            for (const row of riskRes.data as { activity_id: string; risk_level: string }[]) {
              byId[row.activity_id] = row.risk_level;
            }
            setRiskByActivityId(byId);
          } else {
            setRiskByActivityId({});
          }
        } else {
          setRiskByActivityId({});
        }
      } catch {
        if (!cancelled) {
          setErrorMsg(t("errors.loadFailed"));
          setPhases([]);
          setActivities([]);
          setRiskByActivityId({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, t]);

  const bounds = useMemo(
    () => getTimelineBounds(phases, activities),
    [phases, activities]
  );

  const activitiesByPhase = useMemo(() => {
    const map = new Map<string, ProjectActivity[]>();
    for (const act of activities) {
      const key = act.phase_id ?? "unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(act);
    }
    return map;
  }, [activities]);

  /** Risk counts per phase (for chart). Uses existing riskByActivityId. */
  const riskByPhaseRows = useMemo((): RiskByPhaseRow[] => {
    return phases.map((phase) => {
      const phaseActivities = activitiesByPhase.get(phase.id) ?? [];
      let high = 0;
      let medium = 0;
      let low = 0;
      for (const a of phaseActivities) {
        const level = riskByActivityId[a.id];
        if (level === "HIGH") high++;
        else if (level === "MEDIUM") medium++;
        else if (level === "LOW") low++;
      }
      return { name: phase.name, high, medium, low };
    });
  }, [phases, activitiesByPhase, riskByActivityId]);

  /** Phase duration in days (for chart). Uses phase start_date/end_date. */
  const phaseDurationRows = useMemo((): PhaseDurationRow[] => {
    const dayMs = 24 * 60 * 60 * 1000;
    return phases
      .filter((p) => p.start_date && p.end_date)
      .map((phase) => {
        const start = new Date(phase.start_date! + "T00:00:00").getTime();
        const end = new Date(phase.end_date! + "T00:00:00").getTime();
        const days = Math.max(0, Math.round((end - start) / dayMs) + 1);
        return { name: phase.name, days };
      });
  }, [phases]);

  const ganttProjectStart = bounds
    ? bounds.min.toISOString().slice(0, 10)
    : phases[0]?.start_date ?? new Date().toISOString().slice(0, 10);
  const ganttProjectEnd = bounds
    ? bounds.max.toISOString().slice(0, 10)
    : phases[phases.length - 1]?.end_date ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  if (!projectId) {
    return (
      <div className="space-y-6">
          <p className="text-sm text-slate-600">
            {t("errors.missingProjectId")}
          </p>
      </div>
    );
  }

  return (
      <div className="space-y-6">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("actions.backToProject")}
        </Link>

        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {t("page.title")}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {t("page.subtitle")}
            </p>
          </div>
          {bounds && (
            <span className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500 shrink-0">
              {formatDate(bounds.min.toISOString().slice(0, 10), localeTag, t("dates.noDate"))} {t("emDash")}{" "}
              {formatDate(bounds.max.toISOString().slice(0, 10), localeTag, t("dates.noDate"))}
            </span>
          )}
        </header>

        {loading && (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/50">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("sections.calendar")}</h2>
            </div>
            <div className="p-5 space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-64 w-full" />
            </div>
          </section>
        )}

        {errorMsg && (
          <section className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
            {errorMsg}
          </section>
        )}

        {!loading && !errorMsg && phases.length === 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/50">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("sections.calendar")}</h2>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-600">
                {t("states.noPhases")}
              </p>
              <Link
                href={`/projects/${projectId}/planning`}
                className="mt-4 inline-flex rounded-xl rb-btn-primary px-4 py-2 text-sm font-medium"
              >
                {t("actions.goToProjectPhases")}
              </Link>
            </div>
          </section>
        )}

        {!loading && !errorMsg && phases.length > 0 && (
          <>
            <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/50">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {t("sections.riskByPhase")}
                  </h2>
                </div>
                <div className="p-5">
                  <RiskByPhaseStackedBar rows={riskByPhaseRows} />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/50">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {t("sections.phaseDurationDays")}
                  </h2>
                </div>
                <div className="p-5">
                  <PhaseDurationBar rows={phaseDurationRows} />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgb(var(--rb-brand-surface))] text-[rgb(var(--rb-brand-primary-active))] shrink-0 ring-1 ring-[rgb(var(--rb-brand-primary))]/20">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {t("sections.projectTimeline")}
                  </h2>
                </div>
              </div>

              <div className="p-5">
                <ProjectGanttPro
                  phases={phases.map((p) => ({
                    id: p.id,
                    name: p.name,
                    start_date: p.start_date,
                    end_date: p.end_date,
                    sort_order: p.sort_order ?? 0,
                    phase_key: p.phase_key ?? null,
                  }))}
                  activities={activities.map((a) => ({
                    id: a.id,
                    phase_id: a.phase_id,
                    name: a.name,
                    start_date: a.start_date,
                    due_date: a.due_date,
                    status: a.status ?? undefined,
                    priority: undefined,
                  }))}
                  projectStart={ganttProjectStart}
                  projectEnd={ganttProjectEnd}
                  title={t("sections.projectTimeline")}
                  showLegend={true}
                  height={420}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/50">
                <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {t("sections.activitiesByPhase")}
                </h2>
              </div>
              <div className="p-5 space-y-6">
              {activities.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {t("states.noActivities")}
                </p>
              ) : (
                <>
                  {phases.map((phase) => {
                    const phaseActivities = activitiesByPhase.get(phase.id) ?? [];
                    if (phaseActivities.length === 0) return null;
                    const highCount = phaseActivities.filter(
                      (a) => riskByActivityId[a.id] === "HIGH"
                    ).length;
                    const medCount = phaseActivities.filter(
                      (a) => riskByActivityId[a.id] === "MEDIUM"
                    ).length;
                    const lowCount = phaseActivities.filter(
                      (a) => riskByActivityId[a.id] === "LOW"
                    ).length;
                    return (
                      <div key={phase.id} className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-slate-800">
                            {phase.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2">
                            {highCount > 0 && (
                              <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                                {t("risk.highShort", { count: highCount })}
                              </span>
                            )}
                            {medCount > 0 && (
                              <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                {t("risk.mediumShort", { count: medCount })}
                              </span>
                            )}
                            {lowCount > 0 && (
                              <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                {t("risk.lowShort", { count: lowCount })}
                              </span>
                            )}
                            {highCount === 0 && medCount === 0 && lowCount === 0 && (
                              <span className="text-[11px] text-slate-400">{t("emDash")}</span>
                            )}
                            <span className="text-[11px] text-slate-500">
                              {formatDate(phase.start_date, localeTag, t("dates.noDate"))} {t("emDash")} {formatDate(phase.end_date, localeTag, t("dates.noDate"))}
                            </span>
                          </div>
                        </div>
                        <ul className="space-y-2">
                          {phaseActivities.map((act) => {
                            const riskLevel = riskByActivityId[act.id];
                            return (
                              <li
                                key={act.id}
                                className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-2.5 text-xs text-slate-700"
                              >
                                <div className="min-w-0 flex-1">
                                  <span className="font-medium text-slate-800">
                                    {act.name}
                                  </span>
                                  {act.status && (
                                    <span className="mt-0.5 block text-[11px] text-slate-500">
                                      {t("labels.status")}: {act.status}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 shrink-0 text-right">
                                  {riskLevel ? (
                                    <span
                                      className={
                                        riskLevel === "HIGH"
                                          ? "inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700"
                                          : riskLevel === "MEDIUM"
                                            ? "inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                                            : "inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                                      }
                                    >
                                      {riskLevel === "HIGH"
                                        ? t("risk.high")
                                        : riskLevel === "MEDIUM"
                                          ? t("risk.medium")
                                          : t("risk.low")}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-slate-400">{t("emDash")}</span>
                                  )}
                                  <div className="text-[11px] text-slate-500 tabular-nums">
                                    <div>{formatDate(act.start_date, localeTag, t("dates.noDate"))}</div>
                                    <div>{t("labels.toArrow")} {formatDate(act.due_date, localeTag, t("dates.noDate"))}</div>
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                  {(activitiesByPhase.get("unassigned")?.length ?? 0) > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-slate-800">
                        {t("sections.unassignedPhase")}
                      </h3>
                      <ul className="space-y-2">
                        {activitiesByPhase.get("unassigned")!.map((act) => {
                          const riskLevel = riskByActivityId[act.id];
                          return (
                            <li
                              key={act.id}
                              className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-2.5 text-xs text-slate-700"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="font-medium text-slate-800">
                                  {act.name}
                                </span>
                                {act.status && (
                                  <span className="mt-0.5 block text-[11px] text-slate-500">
                                    {t("labels.status")}: {act.status}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 shrink-0 text-right">
                                {riskLevel ? (
                                  <span
                                    className={
                                      riskLevel === "HIGH"
                                        ? "inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700"
                                        : riskLevel === "MEDIUM"
                                          ? "inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                                          : "inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                                    }
                                  >
                                    {riskLevel === "HIGH"
                                      ? t("risk.high")
                                      : riskLevel === "MEDIUM"
                                        ? t("risk.medium")
                                        : t("risk.low")}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-400">{t("emDash")}</span>
                                )}
                                <div className="text-[11px] text-slate-500 tabular-nums">
                                  <div>{formatDate(act.start_date, localeTag, t("dates.noDate"))}</div>
                                  <div>{t("labels.toArrow")} {formatDate(act.due_date, localeTag, t("dates.noDate"))}</div>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </>
              )}

              <div className="pt-5 border-t border-slate-100">
                <Link
                  href={`/projects/${projectId}/planning`}
                  className="inline-flex rounded-xl rb-btn-primary px-4 py-2 text-sm font-medium"
                >
                  {t("actions.goToProjectPhases")}
                </Link>
              </div>
              </div>
            </section>
          </>
        )}
      </div>
  );
}
