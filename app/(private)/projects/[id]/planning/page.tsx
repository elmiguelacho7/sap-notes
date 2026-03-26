"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import {
  getProjectPhases,
  updateProjectPhase,
  type ProjectPhase,
} from "@/lib/services/projectPhaseService";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ProjectPlanningGantt } from "@/components/projects/planning/ProjectPlanningGantt";
import {
  PROJECT_WORKSPACE_PAGE,
  PROJECT_WORKSPACE_HERO,
  PROJECT_WORKSPACE_SECTION_STACK,
  PROJECT_WORKSPACE_CARD_FRAME,
} from "@/lib/projectWorkspaceUi";

type Project = {
  id: string;
  name: string;
  description: string | null;
  start_date?: string | null;
  planned_end_date?: string | null;
};

function getMinMaxDates(phases: ProjectPhase[]): {
  minStartDate: string | null;
  maxEndDate: string | null;
} {
  const validStarts = phases.map((p) => p.start_date).filter(Boolean) as string[];
  const validEnds = phases.map((p) => p.end_date).filter(Boolean) as string[];

  if (validStarts.length === 0 || validEnds.length === 0) {
    return { minStartDate: null, maxEndDate: null };
  }

  const minStartDate = validStarts.reduce((min, current) =>
    current < min ? current : min
  );
  const maxEndDate = validEnds.reduce((max, current) =>
    current > max ? current : max
  );

  return { minStartDate, maxEndDate };
}

function getCurrentPhase(phases: ProjectPhase[]): ProjectPhase | null {
  const today = new Date().toISOString().slice(0, 10);
  const withDates = phases.filter((p) => p.start_date && p.end_date);
  for (const p of withDates) {
    if (today >= p.start_date! && today <= p.end_date!) return p;
  }
  return null;
}

function getDurationDays(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000)) + 1;
}

function formatPlanningDate(iso: string | null, localeTag: string, emDash: string): string {
  if (!iso) return emDash;
  try {
    return new Date(iso).toLocaleDateString(localeTag, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return emDash;
  }
}

function PlanningLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-4 rounded-2xl border border-slate-200/85 bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="h-8 max-w-md w-2/3 rounded-lg bg-slate-100" />
        <div className="h-4 max-w-sm w-1/2 rounded bg-slate-100/90" />
        <div className="flex flex-wrap gap-2 pt-1">
          <div className="h-7 w-28 rounded-lg bg-slate-100" />
          <div className="h-7 w-40 rounded-lg bg-slate-100/90" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200/85 bg-white p-4 shadow-sm ring-1 ring-slate-100/90"
          >
            <div className="h-3 w-20 rounded bg-slate-100" />
            <div className="mt-3 h-6 w-16 rounded bg-slate-100/90" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200/85 bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="h-52 w-full rounded-xl bg-slate-100/90" />
      </div>
      <div className="rounded-2xl border border-slate-200/85 bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="h-36 w-full rounded-xl bg-slate-100/90" />
      </div>
    </div>
  );
}

export default function ProjectPlanningPage() {
  const t = useTranslations("planning");
  const locale = useLocale();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const params = useParams();
  const projectId =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0]
        : "";

  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [generatingPhases, setGeneratingPhases] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [saveAllMessage, setSaveAllMessage] = useState<string | null>(null);
  const [saveAllError, setSaveAllError] = useState(false);

  const loadProject = useCallback(async () => {
    if (!projectId) return;
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, description, start_date, planned_end_date")
      .eq("id", projectId)
      .single();
    if (error) {
      handleSupabaseError("projects", error);
      setProject(null);
      return;
    }
    setProject(data as Project);
  }, [projectId]);

  const loadPhases = useCallback(async () => {
    if (!projectId) return [];
    const list = await getProjectPhases(projectId);
    setPhases(list);
    return list;
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    Promise.all([loadProject(), loadPhases()])
      .then(() => {
        if (!cancelled) setErrorMsg(null);
      })
      .catch(() => {
        if (!cancelled) setErrorMsg(t("errors.loadData"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, loadProject, loadPhases, t]);

  const handleSavePhase = async (
    phaseId: string,
    payload: { name?: string; sort_order?: number; start_date?: string | null; end_date?: string | null }
  ) => {
    if (!projectId) return;
    setSavingId(phaseId);
    const updated = await updateProjectPhase(projectId, phaseId, payload);
    setSavingId(null);
    if (updated) {
      setPhases((prev) =>
        prev.map((p) => (p.id === phaseId ? { ...p, ...updated } : p))
      );
    }
  };

  const movePhase = async (index: number, direction: "up" | "down") => {
    const newOrder = direction === "up" ? index - 1 : index + 1;
    if (newOrder < 0 || newOrder >= phases.length) return;
    const a = phases[index];
    const b = phases[newOrder];
    const aNewOrder = b.sort_order;
    const bNewOrder = a.sort_order;
    await Promise.all([
      updateProjectPhase(projectId!, a.id, { sort_order: aNewOrder }),
      updateProjectPhase(projectId!, b.id, { sort_order: bNewOrder }),
    ]);
    await loadPhases();
  };

  const handlePhaseDateChange = (phaseId: string, field: "start_date" | "end_date", value: string) => {
    setPhases((prev) => {
      const updated = prev.map((p) => ({ ...p }));
      const index = updated.findIndex((p) => p.id === phaseId);
      if (index === -1) return prev;

      updated[index] = { ...updated[index], [field]: value || null };

      // On every FIN (end_date) change: re-evaluate subsequent phases; only fill empty fields, never overwrite user dates
      if (field === "end_date" && value) {
        const currentEnd = new Date(value);
        for (let i = index + 1; i < updated.length; i++) {
          const nextPhase = updated[i];
          if (!nextPhase.start_date) {
            const nextStart = new Date(currentEnd);
            nextStart.setDate(nextStart.getDate() + 1);
            updated[i] = {
              ...nextPhase,
              start_date: nextStart.toISOString().slice(0, 10),
            };
          }
          if (!updated[i].end_date && updated[i].start_date) {
            const start = new Date(updated[i].start_date!);
            const end = new Date(start);
            end.setDate(end.getDate() + 7);
            updated[i] = {
              ...updated[i],
              end_date: end.toISOString().slice(0, 10),
            };
          }
          if (updated[i].end_date) {
            currentEnd.setTime(new Date(updated[i].end_date!).getTime());
          }
        }
      }
      return updated;
    });
  };

  const handlePhaseNameChange = (phaseId: string, value: string) => {
    setPhases((prev) =>
      prev.map((p) => (p.id === phaseId ? { ...p, name: value } : p))
    );
  };

  const handleSaveAll = async () => {
    setSavingAll(true);
    setSaveAllMessage(null);
    setSaveAllError(false);
    try {
      for (const phase of phases) {
        const { error } = await supabase
          .from("project_phases")
          .update({
            sort_order: phase.sort_order,
            name: phase.name,
            start_date: phase.start_date,
            end_date: phase.end_date,
          })
          .eq("id", phase.id);

        if (error) {
          console.error("Error saving phase", phase.id, error);
          throw error;
        }
      }

      const { minStartDate, maxEndDate } = getMinMaxDates(phases);
      if (minStartDate && maxEndDate && projectId) {
        const { error: projectError } = await supabase
          .from("projects")
          .update({
            start_date: minStartDate,
            planned_end_date: maxEndDate,
          })
          .eq("id", projectId);

        if (projectError) {
          console.error("Error updating project dates", projectError);
        }
      }

      setSaveAllMessage(
        minStartDate && maxEndDate
          ? t("save.successWithProjectDates")
          : t("save.success")
      );
      setSaveAllError(false);
      setTimeout(() => setSaveAllMessage(null), 3000);
    } catch {
      setSaveAllMessage(t("save.error"));
      setSaveAllError(true);
    } finally {
      setSavingAll(false);
    }
  };

  const generateDefaultPhases = async () => {
    if (!projectId) return;
    setGeneratingPhases(true);
    const defaultPhases = [
      { phase_key: "discover", name: "Discover", sort_order: 1 },
      { phase_key: "prepare", name: "Prepare", sort_order: 2 },
      { phase_key: "explore", name: "Explore", sort_order: 3 },
      { phase_key: "realize", name: "Realize", sort_order: 4 },
      { phase_key: "deploy", name: "Deploy", sort_order: 5 },
      { phase_key: "run", name: "Run", sort_order: 6 },
    ];
    const mappedPhases = defaultPhases.map((p) => ({
      project_id: projectId,
      phase_key: p.phase_key,
      name: p.name,
      sort_order: p.sort_order,
      start_date: null,
      end_date: null,
    }));
    try {
      const { error } = await supabase.from("project_phases").insert(mappedPhases);
      if (error) {
        console.error("Error generating default phases", error);
        alert(t("errors.createPhases"));
        return;
      }
      await loadPhases();
    } catch (err) {
      console.error("Error generating default phases", err);
      alert(t("errors.generatePhases"));
    } finally {
      setGeneratingPhases(false);
    }
  };

  const generateActivatePlanFromTemplate = async () => {
    if (!projectId || !project?.start_date || !project?.planned_end_date) return;
    setGeneratingPlan(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/projects/${projectId}/generate-activate-plan`, { method: "POST", headers });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; skipped?: boolean };
      if (json.ok && !json.skipped) {
        await loadPhases();
      } else if (json.error) {
        setErrorMsg(json.error === "missing_dates" ? t("errors.missingDates") : json.error);
      }
    } catch (err) {
      console.error("Generate activate plan error", err);
      setErrorMsg(t("errors.generatePlan"));
    } finally {
      setGeneratingPlan(false);
    }
  };

  if (!projectId) {
    return (
      <div className="w-full min-w-0">
        <p className="text-sm text-slate-600">{t("errors.missingProjectId")}</p>
      </div>
    );
  }

  const { minStartDate, maxEndDate } = getMinMaxDates(phases);
  const currentPhase = getCurrentPhase(phases);
  const totalDurationDays =
    minStartDate && maxEndDate ? getDurationDays(minStartDate, maxEndDate) : null;
  const projectDateRange =
    minStartDate && maxEndDate
      ? `${new Date(minStartDate).toLocaleDateString(localeTag, { day: "numeric", month: "short", year: "numeric" })} ${t("emDash")} ${new Date(maxEndDate).toLocaleDateString(localeTag, { day: "numeric", month: "short", year: "numeric" })}`
      : null;

  const ganttProjectStart = minStartDate ?? project?.start_date ?? new Date().toISOString().slice(0, 10);
  const ganttProjectEnd = maxEndDate ?? project?.planned_end_date ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const todayIso = new Date().toISOString().slice(0, 10);
  const completedPhases = phases.filter((p) => p.end_date && p.end_date < todayIso).length;
  const upcomingMilestones = phases.filter((p) => p.start_date && p.start_date >= todayIso).length;
  const delayedPhases = phases.filter((p) => p.end_date && p.end_date < todayIso && (currentPhase ? p.id !== currentPhase.id : true)).length;

  return (
    <div className={PROJECT_WORKSPACE_PAGE}>
      {errorMsg && (
        <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-5 py-3 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <PlanningLoadingSkeleton />
      ) : (
        <>
          <div className={`${PROJECT_WORKSPACE_HERO} space-y-5`}>
            <div className="min-w-0 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("page.eyebrow")}
              </p>
              <h1 className="text-2xl sm:text-[1.65rem] font-semibold tracking-tight text-slate-900">
                {t("page.title")}
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed max-w-3xl font-medium">
                {t("page.subtitle")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {phases.length > 0 ? (
                <span className="inline-flex items-center rounded-lg border border-emerald-200/90 bg-emerald-50/95 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-900">
                  {t("status.configured")}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-lg border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  {t("status.pending")}
                </span>
              )}
              {projectDateRange && (
                <span className="inline-flex items-center rounded-lg border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 tabular-nums shadow-sm">
                  {projectDateRange}
                </span>
              )}
              {currentPhase ? (
                <span className="inline-flex items-center rounded-lg border border-[rgb(var(--rb-brand-primary))]/25 bg-[rgb(var(--rb-brand-surface))] px-2.5 py-1 text-[11px] font-semibold text-[rgb(var(--rb-brand-primary-active))]">
                  Current phase: {currentPhase.name}
                </span>
              ) : null}
            </div>
          </div>

          {phases.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200/85 bg-white p-4 shadow-sm ring-1 ring-slate-100/90">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {t("kpi.plannedStart")}
                </p>
                <p className="mt-2 text-lg font-semibold tabular-nums tracking-tight text-slate-900">
                  {formatPlanningDate(minStartDate, localeTag, t("emDash"))}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/85 bg-white p-4 shadow-sm ring-1 ring-slate-100/90">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {t("kpi.plannedEnd")}
                </p>
                <p className="mt-2 text-lg font-semibold tabular-nums tracking-tight text-slate-900">
                  {formatPlanningDate(maxEndDate, localeTag, t("emDash"))}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/90 to-white p-4 shadow-sm ring-1 ring-emerald-100/80">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-900/70">
                  {t("kpi.duration")}
                </p>
                <p className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                  {totalDurationDays != null ? t("kpi.days", { count: totalDurationDays }) : t("emDash")}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/85 bg-white p-4 shadow-sm ring-1 ring-slate-100/90">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {t("kpi.phases")}
                </p>
                <p className="mt-2 text-lg font-semibold tabular-nums tracking-tight text-slate-900">{phases.length}</p>
              </div>
            </div>
          )}

          {phases.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Completed</p>
                <p className="mt-1.5 text-sm font-semibold text-slate-900 tabular-nums">{completedPhases}</p>
              </div>
              <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Upcoming milestones</p>
                <p className="mt-1.5 text-sm font-semibold text-slate-900 tabular-nums">{upcomingMilestones}</p>
              </div>
              <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Schedule risk</p>
                <p className="mt-1.5 text-sm font-semibold text-slate-900">
                  {delayedPhases > 0 ? `${delayedPhases} delayed phase${delayedPhases === 1 ? "" : "s"}` : "No schedule delays detected"}
                </p>
              </div>
            </div>
          )}

          {phases.length === 0 ? (
            <div className="space-y-5 rounded-2xl border border-slate-200/85 bg-white p-6 md:p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                  {t("empty.title")}
                </h2>
                <p className="max-w-2xl text-sm leading-relaxed text-slate-600 font-medium">
                  {t("empty.description")}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                {project?.start_date && project?.planned_end_date ? (
                  <button
                    type="button"
                    onClick={generateActivatePlanFromTemplate}
                    disabled={generatingPlan}
                    className="inline-flex items-center justify-center rounded-xl rb-btn-primary px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {generatingPlan ? t("actions.generating") : t("actions.generateFromTemplate")}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={generateDefaultPhases}
                  disabled={generatingPhases}
                  className={
                    project?.start_date && project?.planned_end_date
                      ? "inline-flex items-center justify-center rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                      : "inline-flex items-center justify-center rounded-xl rb-btn-primary px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                  }
                >
                  {generatingPhases ? t("actions.generating") : t("actions.generatePhasesOnly")}
                </button>
                <Link
                  href={`/projects/${projectId}`}
                  className="inline-flex items-center justify-center text-sm font-medium text-slate-500 underline-offset-4 transition-colors hover:text-slate-300"
                >
                  {t("actions.backToProject")}
                </Link>
              </div>
            </div>
          ) : (
            <>
              <section className={`w-full min-w-0 ${PROJECT_WORKSPACE_SECTION_STACK}`}>
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold tracking-tight text-slate-900">Timeline control</h2>
                  <p className="text-xs text-slate-500">Current phase is highlighted, and past/upcoming phases are visually separated.</p>
                </div>
                <ProjectPlanningGantt
                  phases={phases}
                  projectStart={ganttProjectStart}
                  projectEnd={ganttProjectEnd}
                  height={420}
                />
              </section>

              <section className="w-full min-w-0">
                <div className={`overflow-hidden ${PROJECT_WORKSPACE_CARD_FRAME}`}>
                  <div className="flex flex-col gap-4 border-b border-slate-200/90 bg-slate-50/60 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <h2 className="text-base font-semibold tracking-tight text-slate-900">{t("editor.title")}</h2>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        {t("editor.subtitle")}
                      </p>
                      <ul className="list-inside list-disc space-y-1 text-xs text-slate-600">
                        <li>
                          <span className="font-medium text-slate-700">{t("editor.saveAllLabel")}</span> {t("emDash")}{" "}
                          {t("editor.saveAllHelp")}
                        </li>
                        <li>
                          <span className="font-medium text-slate-700">{t("editor.rowSaveLabel")}</span>{" "}
                          {t("editor.rowSaveHelpPrefix")} {t("emDash")} {t("editor.rowSaveHelpSuffix")}
                        </li>
                      </ul>
                    </div>
                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                      {saveAllMessage && (
                        <span
                          className={
                            saveAllError
                              ? "text-right text-xs font-medium text-rose-700"
                              : "text-right text-xs font-medium text-emerald-800"
                          }
                        >
                          {saveAllMessage}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveAll}
                        disabled={savingAll}
                        className="inline-flex items-center justify-center rounded-xl rb-btn-primary px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        {savingAll ? t("save.saving") : t("save.saveAll")}
                      </button>
                    </div>
                  </div>
                  <div className="min-w-0 overflow-x-auto">
                    <table className="w-full min-w-[540px] text-left">
                      <thead className="border-b border-slate-200/90 bg-slate-50/90">
                        <tr>
                          <th className="w-20 whitespace-nowrap px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:px-5">
                            {t("table.order")}
                          </th>
                          <th className="min-w-[200px] px-4 py-3.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 sm:px-5">
                            {t("table.phase")}
                          </th>
                          <th className="w-40 px-4 py-3.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 sm:px-5">
                            {t("table.start")}
                          </th>
                          <th className="w-40 px-4 py-3.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 sm:px-5">
                            {t("table.end")}
                          </th>
                          <th className="w-24 px-4 py-3.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 sm:px-5">
                            {t("table.actions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {phases.map((phase, index) => (
                          <PhaseRow
                            key={phase.id}
                            phase={phase}
                            index={index}
                            total={phases.length}
                            onMove={movePhase}
                            onSave={handleSavePhase}
                            onPhaseDateChange={handlePhaseDateChange}
                            onPhaseNameChange={handlePhaseNameChange}
                            saving={savingId === phase.id}
                            t={t}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}

function PhaseRow({
  phase,
  index,
  total,
  onMove,
  onSave,
  onPhaseDateChange,
  onPhaseNameChange,
  saving,
  t,
}: {
  phase: ProjectPhase;
  index: number;
  total: number;
  onMove: (index: number, direction: "up" | "down") => void;
  onSave: (
    phaseId: string,
    p: { name?: string; sort_order?: number; start_date?: string | null; end_date?: string | null }
  ) => Promise<void>;
  onPhaseDateChange: (phaseId: string, field: "start_date" | "end_date", value: string) => void;
  onPhaseNameChange: (phaseId: string, value: string) => void;
  saving: boolean;
  t: (key: string) => string;
}) {
  const name = phase.name;
  const startDate = phase.start_date ?? "";
  const endDate = phase.end_date ?? "";

  const handleSave = () => {
    onSave(phase.id, {
      name: name.trim() || phase.name,
      start_date: startDate.trim() || null,
      end_date: endDate.trim() || null,
    });
  };

  const textInputClass =
    "w-full rounded-xl border border-slate-200/90 bg-white px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/40 transition-colors";
  const dateInputClass =
    "w-full rounded-xl border border-slate-200/90 bg-white px-2.5 py-2 text-sm text-slate-800 tabular-nums shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/30 focus:border-[rgb(var(--rb-brand-primary))]/35 transition-colors";

  return (
    <tr className="transition-colors duration-150 hover:bg-slate-50/90">
      <td className="whitespace-nowrap px-4 py-3.5 align-middle sm:px-5">
        <div className="flex items-center gap-1.5">
          <div className="inline-flex shrink-0 flex-col gap-px rounded-md border border-slate-200/90 bg-white p-px shadow-sm">
            <button
              type="button"
              onClick={() => onMove(index, "up")}
              disabled={index === 0}
              className="rounded p-0.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 disabled:pointer-events-none disabled:opacity-25"
              aria-label={t("row.moveUp")}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onMove(index, "down")}
              disabled={index === total - 1}
              className="rounded-md p-0.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 disabled:pointer-events-none disabled:opacity-25"
              aria-label={t("row.moveDown")}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="text-xs font-medium tabular-nums text-slate-500">{phase.sort_order}</span>
        </div>
      </td>
      <td className="px-4 py-3.5 align-middle sm:px-5">
        <input
          type="text"
          value={name}
          onChange={(e) => onPhaseNameChange(phase.id, e.target.value)}
          className={`${textInputClass} max-w-[220px]`}
          placeholder={t("row.phaseNamePlaceholder")}
        />
      </td>
      <td className="px-4 py-3.5 align-middle sm:px-5">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onPhaseDateChange(phase.id, "start_date", e.target.value)}
          className={dateInputClass}
        />
      </td>
      <td className="px-4 py-3.5 align-middle sm:px-5">
        <input
          type="date"
          value={endDate}
          onChange={(e) => onPhaseDateChange(phase.id, "end_date", e.target.value)}
          className={dateInputClass}
        />
      </td>
      <td className="w-24 px-4 py-3.5 text-right align-middle sm:px-5">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "…" : t("row.save")}
        </button>
      </td>
    </tr>
  );
}
