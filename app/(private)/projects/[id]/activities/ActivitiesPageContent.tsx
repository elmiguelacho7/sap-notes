"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { getProjectPhases, type ProjectPhase } from "@/lib/services/projectPhaseService";
import { Plus, Pencil, Save, Trash2, ListTodo, Search, MoreHorizontal } from "lucide-react";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";
import { AssigneeCell } from "@/components/AssigneeCell";
import { ModuleKpiCard, ModuleKpiRow } from "@/components/layout/module";
import {
  PROJECT_WORKSPACE_PAGE,
  PROJECT_WORKSPACE_HERO,
  PROJECT_WORKSPACE_TOOLBAR,
  PROJECT_WORKSPACE_SEARCH_INPUT,
  PROJECT_WORKSPACE_FILTER_PILL,
  PROJECT_WORKSPACE_FILTER_PILL_ACTIVE,
  PROJECT_WORKSPACE_EMPTY,
  PROJECT_WORKSPACE_PANEL_HEADER,
  PROJECT_WORKSPACE_TABLE_HEAD_ROW,
  PROJECT_WORKSPACE_TABLE_BODY,
  PROJECT_WORKSPACE_TABLE_ROW,
  PROJECT_WORKSPACE_CARD_FRAME,
} from "@/lib/projectWorkspaceUi";

type StatusFilterKind = "all" | "planned" | "in_progress" | "blocked" | "done" | "overdue" | "assigned_to_me";

// Types aligned with DB: project_activities uses name, due_date; status/priority are text
// NOTE: In the future, each activity will spawn one or more tasks. The tasks table will include
// activity_id (FK to project_activities.id), so tasks can be displayed under the global "Tareas" section.
type Project = {
  id: string;
  name: string;
  description: string | null;
};

type ProjectActivity = {
  id: string;
  project_id: string;
  phase_id: string;
  name: string;
  description: string | null;
  owner_profile_id: string | null;
  status: string | null;
  priority: string | null;
  start_date: string | null;
  due_date: string | null;
  progress_pct: number | null;
  derived_progress_pct?: number; // computed from project_tasks: (done / total) * 100
  created_at: string;
  updated_at: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

function ActivityStatusBadge({ status, isOverdue }: { status: string | null; isOverdue?: boolean }) {
  const t = useTranslations("activities");
  const s = (status ?? "planned").toLowerCase();
  if (isOverdue && s !== "done") {
    return (
      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-inset ring-amber-200/80">
        {t("status.overdue")}
      </span>
    );
  }
  const styles: Record<string, string> = {
    planned: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/90",
    in_progress:
      "bg-[rgb(var(--rb-brand-surface))] text-[rgb(var(--rb-brand-primary-active))] ring-1 ring-inset ring-[rgb(var(--rb-brand-primary))]/18",
    blocked: "bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-200/80",
    done: "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200/80",
  };
  const labels: Record<string, string> = {
    planned: t("status.planned"),
    in_progress: t("status.in_progress"),
    blocked: t("status.blocked"),
    done: t("status.done"),
  };
  const style = styles[s] ?? "border-slate-200/90 bg-slate-100 text-slate-600";
  const label = labels[s] ?? (status ?? t("emDash"));
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${style}`}
    >
      {label}
    </span>
  );
}

function ActivityPriorityBadge({ priority }: { priority: string | null }) {
  const t = useTranslations("activities");
  const p = (priority ?? "medium").toLowerCase();
  const tone =
    p === "high"
      ? "bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-200/80"
      : p === "low"
        ? "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/90"
        : "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200/80";
  const labels: Record<string, string> = {
    low: t("priority.low"),
    medium: t("priority.medium"),
    high: t("priority.high"),
  };
  const label = labels[p] ?? t("priority.medium");
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${tone}`}
    >
      {label}
    </span>
  );
}

export default function ProjectActivitiesPageContent() {
  const t = useTranslations("activities");
  const locale = useLocale();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const projectId = (params?.id ?? "") as string;

  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedPhaseId, setSelectedPhaseId] = useState<string | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilterKind>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ProjectActivity | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [, setProfilesLoading] = useState(false);

  /** activity_id -> risk_level (LOW | MEDIUM | HIGH) from activity_risk_metrics view */
  const [riskByActivity, setRiskByActivity] = useState<Record<string, string>>({});

  /** Banner "Creando..." when opened via ?new=1 */
  const [showCreandoBanner, setShowCreandoBanner] = useState(false);

  useEffect(() => {
    if (searchParams?.get("new") === "1" && pathname) {
      setIsCreating(true);
      setShowCreandoBanner(true);
      router.replace(pathname);
      const t = setTimeout(() => setShowCreandoBanner(false), 2000);
      return () => clearTimeout(t);
    }
  }, [searchParams, pathname, router]);

  useEffect(() => {
    if (!isCreating) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsCreating(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isCreating]);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setErrorMsg(null);
    setProfilesLoading(true);
    try {
      const [
        projectRes,
        phasesList,
        activitiesRes,
        tasksRes,
        profilesRes,
      ] = await Promise.all([
        supabase
          .from("projects")
          .select("id, name, description")
          .eq("id", projectId)
          .single(),
        getProjectPhases(projectId),
        supabase
          .from("project_activities")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: true }),
        supabase
          .from("project_tasks")
          .select("id, activity_id, status")
          .eq("project_id", projectId),
        supabase.from("profiles").select("id, full_name, email"),
      ]);

      if (projectRes.error) {
        handleSupabaseError("projects", projectRes.error);
        setProject(null);
      } else {
        setProject(projectRes.data as Project);
      }

      setPhases(phasesList ?? []);

      if (activitiesRes.error) {
        setActivities([]);
        setRiskByActivity({});
      } else {
        const activitiesList = (activitiesRes.data ?? []) as ProjectActivity[];
        const tasks = (tasksRes.data ?? []) as {
          id: string;
          activity_id: string | null;
          status: string;
        }[];

        const grouped: Record<string, { total: number; done: number }> = {};
        for (const task of tasks) {
          if (!task.activity_id) continue;
          if (!grouped[task.activity_id]) {
            grouped[task.activity_id] = { total: 0, done: 0 };
          }
          grouped[task.activity_id].total += 1;
          if (task.status === "done") {
            grouped[task.activity_id].done += 1;
          }
        }

        const progressByActivity: Record<string, number> = {};
        for (const [activityId, stats] of Object.entries(grouped)) {
          progressByActivity[activityId] =
            stats.total === 0
              ? 0
              : Math.round((stats.done / stats.total) * 100);
        }

        const activitiesWithProgress = activitiesList.map((a) => ({
          ...a,
          derived_progress_pct: progressByActivity[a.id] ?? 0,
        }));
        setActivities(activitiesWithProgress);

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
            setRiskByActivity(byId);
          } else {
            setRiskByActivity({});
          }
        } else {
          setRiskByActivity({});
        }
      }

      if (profilesRes.error) {
        console.error("Error loading profiles", profilesRes.error);
        setProfiles([]);
      } else {
        setProfiles((profilesRes.data ?? []) as Profile[]);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) setCurrentUserProfileId(session.user.id);
      else setCurrentUserProfileId(null);
    } catch {
      setErrorMsg(t("errors.loadData"));
    } finally {
      setLoading(false);
      setProfilesLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const phaseId = searchParams?.get("phaseId");
    if (phaseId && phases.some((p) => p.id === phaseId)) {
      setSelectedPhaseId(phaseId);
    }
  }, [searchParams, phases]);

  const profilesMap = useMemo(() => {
    const map = new Map<string, Profile>();
    profiles.forEach((p) => map.set(p.id, p));
    return map;
  }, [profiles]);

  const filteredActivities = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let list = activities;
    if (selectedPhaseId !== "all") list = list.filter((a) => a.phase_id === selectedPhaseId);
    if (statusFilter !== "all") {
      if (statusFilter === "overdue") {
        list = list.filter((a) => a.due_date && a.due_date < today && (a.status ?? "planned") !== "done");
      } else if (statusFilter === "assigned_to_me") {
        list = list.filter((a) => currentUserProfileId && a.owner_profile_id === currentUserProfileId);
      } else {
        list = list.filter((a) => (a.status ?? "planned") === statusFilter);
      }
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        const name = (a.name ?? "").toLowerCase();
        const desc = (a.description ?? "").toLowerCase();
        const prof = a.owner_profile_id ? profilesMap.get(a.owner_profile_id) : null;
        const ownerName = (prof?.full_name || prof?.email || "").toLowerCase();
        return name.includes(q) || desc.includes(q) || ownerName.includes(q);
      });
    }
    return list;
  }, [
    activities,
    selectedPhaseId,
    statusFilter,
    searchQuery,
    currentUserProfileId,
    profilesMap,
  ]);

  const summary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let open = 0;
    let inProgress = 0;
    let blocked = 0;
    let overdue = 0;
    activities.forEach((a) => {
      const s = a.status ?? "planned";
      if (s !== "done") open += 1;
      if (s === "in_progress") inProgress += 1;
      if (s === "blocked") blocked += 1;
      if (a.due_date && a.due_date < today && s !== "done") overdue += 1;
    });
    return { open, inProgress, blocked, overdue };
  }, [activities]);

  const getPhaseName = (phaseId: string) => phases.find((p) => p.id === phaseId)?.name ?? t("emDash");

  const formatListDate = useCallback(
    (iso: string) =>
      new Date(iso).toLocaleDateString(localeTag, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    [localeTag]
  );

  const updateActivity = async (activityId: string, payload: Partial<ProjectActivity>) => {
    setSavingId(activityId);
    const { error } = await supabase
      .from("project_activities")
      .update(payload)
      .eq("id", activityId);
    setSavingId(null);
    if (error) {
      console.error("Error updating activity", error);
      return;
    }
    setActivities((prev) =>
      prev.map((a) => (a.id === activityId ? { ...a, ...payload } : a))
    );
  };

  const deleteActivity = async (activityId: string) => {
    setDeletingId(activityId);
    const { error } = await supabase
      .from("project_activities")
      .delete()
      .eq("id", activityId);
    setDeleteConfirmId(null);
    setDeletingId(null);
    if (error) {
      console.error("Error deleting activity", error);
      return;
    }
    setActivities((prev) => prev.filter((a) => a.id !== activityId));
  };

  const handleViewTasks = (activityId: string) => {
    router.push(`/projects/${projectId}/tasks?activity=${activityId}`);
  };

  if (!projectId) {
    return (
      <div className={PROJECT_WORKSPACE_PAGE}>
        <p className="text-sm text-slate-500">{t("errors.missingProjectId")}</p>
      </div>
    );
  }

  const selectedPhaseSummary =
    selectedPhaseId !== "all" ? phases.find((p) => p.id === selectedPhaseId)?.name ?? null : null;

  return (
    <div className={PROJECT_WORKSPACE_PAGE}>
      {showCreandoBanner && (
        <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 px-3 py-2 text-xs font-medium text-slate-600 transition-opacity duration-300">
          {t("banner.creating")}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      <div className={`${PROJECT_WORKSPACE_HERO} space-y-4`}>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{t("page.eyebrow")}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.65rem]">{t("page.title")}</h1>
          <p className="mt-1 text-sm text-slate-600 leading-relaxed">
            {t("page.subtitle")}
          </p>
          {project?.name ? (
            <p className="mt-2 text-xs font-medium text-slate-500">{t("page.projectMeta", { name: project.name })}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-4 border-t border-slate-200/80 pt-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2 sm:max-w-md">
            <label htmlFor="activities-phase-filter" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {t("phaseFilter.label")}
            </label>
            <select
              id="activities-phase-filter"
              value={selectedPhaseId}
              onChange={(e) => setSelectedPhaseId(e.target.value as string | "all")}
              className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/25 focus:border-[rgb(var(--rb-brand-primary))]/30"
            >
              <option value="all">{t("phaseFilter.all")}</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {selectedPhaseSummary ? (
              <p className="text-xs text-slate-600">
                {t("phaseFilter.showing")}{" "}
                <span className="font-medium text-slate-800">{selectedPhaseSummary}</span>
              </p>
            ) : (
              <p className="text-xs text-slate-600">{t("phaseFilter.contextAll")}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            disabled={phases.length === 0}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl rb-btn-primary px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden />
            {t("page.createCta")}
          </button>
        </div>
      </div>

      {!loading && activities.length > 0 && (
        <ModuleKpiRow>
          <ModuleKpiCard tone="light" label={t("kpi.open")} value={summary.open} />
          <ModuleKpiCard tone="light" label={t("kpi.inProgress")} value={summary.inProgress} />
          <ModuleKpiCard
            tone="light"
            label={t("kpi.blocked")}
            value={summary.blocked}
            className={summary.blocked > 0 ? "border-amber-200/90 bg-amber-50/50 ring-1 ring-amber-100" : ""}
            valueClassName={summary.blocked > 0 ? "!text-amber-900" : ""}
          />
          <ModuleKpiCard
            tone="light"
            label={t("kpi.overdue")}
            value={summary.overdue}
            className={summary.overdue > 0 ? "border-rose-200/90 bg-rose-50/50 ring-rose-100" : ""}
            valueClassName={summary.overdue > 0 ? "!text-rose-900" : ""}
          />
        </ModuleKpiRow>
      )}

      {!loading && activities.length > 0 && (
        <div className={PROJECT_WORKSPACE_TOOLBAR}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {(
                [
                  { key: "all" as StatusFilterKind, label: t("filters.all") },
                  { key: "planned" as StatusFilterKind, label: t("filters.planned") },
                  { key: "in_progress" as StatusFilterKind, label: t("filters.inProgress") },
                  { key: "blocked" as StatusFilterKind, label: t("filters.blocked") },
                  { key: "done" as StatusFilterKind, label: t("filters.done") },
                  { key: "overdue" as StatusFilterKind, label: t("filters.overdue") },
                  { key: "assigned_to_me" as StatusFilterKind, label: t("filters.assignedToMe") },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={
                    statusFilter === key ? PROJECT_WORKSPACE_FILTER_PILL_ACTIVE : PROJECT_WORKSPACE_FILTER_PILL
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="w-full min-w-0 sm:w-64 sm:shrink-0">
              <label className="relative block">
                <span className="sr-only">{t("filters.searchAria")}</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder={t("filters.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={PROJECT_WORKSPACE_SEARCH_INPUT}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      <section className={`w-full min-w-0 overflow-hidden ${PROJECT_WORKSPACE_CARD_FRAME}`}>
        <div className={PROJECT_WORKSPACE_PANEL_HEADER}>
          <h2 className="text-sm font-semibold text-slate-900">{t("section.title")}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {t("section.description")}
          </p>
        </div>
        <div className="min-w-0 p-4 sm:p-5">
          {loading ? (
            <TableSkeleton rows={6} colCount={9} />
          ) : activities.length === 0 ? (
            <div className={`${PROJECT_WORKSPACE_EMPTY} min-h-[200px]`}>
              <p className="text-base font-semibold tracking-tight text-slate-900">
                {t("empty.none.title")}
              </p>
              <p className="mt-2 max-w-md text-sm text-slate-600 leading-relaxed">
                {t("empty.none.description")}
              </p>
              <button
                type="button"
                onClick={() => phases.length > 0 && setIsCreating(true)}
                disabled={phases.length === 0}
                className="mt-6 inline-flex items-center gap-2 rounded-xl rb-btn-primary px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35"
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                {t("empty.none.createFirst")}
              </button>
              {phases.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">
                  {t("empty.none.noPhasesHint")}
                </p>
              ) : null}
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className={`${PROJECT_WORKSPACE_EMPTY} min-h-[160px] py-10`}>
              {selectedPhaseId !== "all" ? (
                <>
                  <p className="text-sm font-semibold tracking-tight text-slate-800">{t("empty.byPhase.title")}</p>
                  <p className="mt-2 max-w-md text-sm text-slate-600 leading-relaxed">
                    {t("empty.byPhase.description")}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold tracking-tight text-slate-800">{t("empty.filtered.title")}</p>
                  <p className="mt-2 max-w-md text-sm text-slate-600 leading-relaxed">
                    {t("empty.filtered.description")}
                  </p>
                </>
              )}
            </div>
          ) : (
              <>
                {/* Mobile: stacked cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filteredActivities.map((activity) => {
                    const today = new Date().toISOString().slice(0, 10);
                    const isOverdue = !!(activity.due_date && activity.due_date < today && (activity.status ?? "planned") !== "done");
                    const displayProgress = activity.derived_progress_pct ?? activity.progress_pct ?? 0;
                    const riskLevel = riskByActivity[activity.id];
                    return (
                      <div
                        key={activity.id}
                        className="rounded-lg px-3 py-4 transition-colors hover:bg-slate-50/90"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="inline-flex max-w-full rounded-md border border-slate-200/90 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              {getPhaseName(activity.phase_id)}
                            </span>
                            <p className="mt-2 font-semibold leading-snug text-slate-900 line-clamp-2">
                              {activity.name}
                            </p>
                            {activity.description ? (
                              <p className="mt-1 text-xs text-slate-600 line-clamp-2">{activity.description}</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <ActivityStatusBadge status={activity.status} isOverdue={isOverdue} />
                          <ActivityPriorityBadge priority={activity.priority} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <div className="text-slate-400">
                            <AssigneeCell profileId={activity.owner_profile_id} profilesMap={profilesMap} />
                          </div>
                          <span className="tabular-nums text-slate-400">{t("mobile.progress", { value: displayProgress })}</span>
                          {riskLevel != null && riskLevel !== "" ? (
                            <span
                              className={
                                riskLevel === "HIGH"
                                  ? "inline-flex rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-900 ring-1 ring-inset ring-rose-200/80"
                                  : riskLevel === "MEDIUM"
                                    ? "inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-inset ring-amber-200/80"
                                    : "inline-flex rounded-md bg-[rgb(var(--rb-brand-surface))] px-2 py-0.5 text-[11px] font-medium text-[rgb(var(--rb-brand-primary-active))] ring-1 ring-inset ring-[rgb(var(--rb-brand-primary))]/18"
                              }
                            >
                              {riskLevel === "HIGH" ? t("risk.high") : riskLevel === "MEDIUM" ? t("risk.medium") : t("risk.low")}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-[11px] text-slate-500">
                          {activity.start_date || activity.due_date ? (
                            <>
                              {activity.start_date ? `${t("dates.start")} ${formatListDate(activity.start_date)}` : null}
                              {activity.start_date && activity.due_date ? " · " : null}
                              {activity.due_date ? `${t("dates.end")} ${formatListDate(activity.due_date)}` : null}
                            </>
                          ) : (
                            t("dates.none")
                          )}
                        </p>
                        <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3">
                          <button
                            type="button"
                            onClick={() => setEditingActivity(activity)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200/90 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/25 focus-visible:ring-offset-0"
                            aria-label={t("actions.editActivity")}
                            title={t("actions.editActivity")}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleViewTasks(activity.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200/90 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/25 focus-visible:ring-offset-0"
                            aria-label={t("actions.viewProjectTasks")}
                            title={t("actions.viewTasks")}
                          >
                            <ListTodo className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(activity.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200/90 bg-white text-red-600 shadow-sm hover:border-red-200 hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 focus-visible:ring-offset-0"
                            aria-label={t("actions.deleteActivity")}
                            title={t("actions.deleteActivity")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Desktop: table */}
                <div className="hidden md:block w-full min-w-0 overflow-x-auto rounded-xl [scrollbar-width:thin] [scrollbar-color:#cbd5e1_#f1f5f9] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:rounded [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/90 [&::-webkit-scrollbar-thumb:hover]:bg-slate-400">
                  <table className="w-full min-w-[900px] text-left text-sm md:table">
                    <thead className={`sticky top-0 z-10 ${PROJECT_WORKSPACE_TABLE_HEAD_ROW} backdrop-blur-sm bg-slate-50/95`}>
                      <tr>
                        <th className="w-[112px] min-w-[112px] whitespace-nowrap px-3 py-3.5 align-middle text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {t("table.phase")}
                        </th>
                        <th className="min-w-[168px] px-3 py-3.5 align-middle text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {t("table.activity")}
                        </th>
                        <th className="w-[132px] min-w-[132px] px-3 py-3.5 align-middle text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {t("table.owner")}
                        </th>
                        <th className="w-[118px] min-w-[118px] px-3 py-3.5 align-middle text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {t("table.status")}
                        </th>
                        <th className="w-[76px] min-w-[76px] px-3 py-3.5 align-middle text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {t("table.priority")}
                        </th>
                        <th className="w-[104px] min-w-[104px] whitespace-nowrap px-3 py-3.5 align-middle text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {t("table.start")}
                        </th>
                        <th className="w-[104px] min-w-[104px] whitespace-nowrap px-3 py-3.5 align-middle text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {t("table.end")}
                        </th>
                        <th className="w-[48px] min-w-[48px] px-3 py-3.5 align-middle text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          %
                        </th>
                        <th className="w-[76px] min-w-[76px] px-3 py-3.5 align-middle text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {t("table.risk")}
                        </th>
                        <th className="w-[120px] min-w-[120px] whitespace-nowrap px-3 py-3.5 pr-4 text-right align-middle text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {t("table.actions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className={PROJECT_WORKSPACE_TABLE_BODY}>
                      {filteredActivities.map((activity) => (
                        <ActivityRow
                          key={`${activity.id}-${activity.start_date ?? ""}-${activity.due_date ?? ""}`}
                          activity={activity}
                          phaseName={getPhaseName(activity.phase_id)}
                          profilesMap={profilesMap}
                          riskLevel={riskByActivity[activity.id]}
                          onUpdate={updateActivity}
                          saving={savingId === activity.id}
                          onEdit={() => setEditingActivity(activity)}
                          onDelete={() => setDeleteConfirmId(activity.id)}
                          onViewTasks={handleViewTasks}
                          t={t}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>

      {(isCreating || editingActivity) && (
        <ActivityFormModal
          projectId={projectId}
          phases={phases}
          profiles={profiles}
          activity={editingActivity}
          initialPhaseId={selectedPhaseId !== "all" ? selectedPhaseId : undefined}
          onClose={() => {
            setIsCreating(false);
            setEditingActivity(null);
          }}
          onSaved={() => {
            setIsCreating(false);
            setEditingActivity(null);
            loadData();
          }}
        />
      )}

      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => !deletingId && setDeleteConfirmId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="activity-delete-title"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl ring-1 ring-slate-100"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !deletingId) setDeleteConfirmId(null);
            }}
          >
            <p id="activity-delete-title" className="text-sm text-slate-700">
              {t("delete.confirmBody")}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                disabled={!!deletingId}
                className="rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/25"
              >
                {t("delete.cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = deleteConfirmId;
                  if (id) deleteActivity(id);
                }}
                disabled={!!deletingId}
                className="rounded-xl bg-red-600/90 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/25 focus-visible:ring-offset-2"
              >
                {deletingId ? t("delete.deleting") : t("delete.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type ActivityRowProps = {
  activity: ProjectActivity;
  phaseName: string;
  profilesMap: Map<string, Profile>;
  riskLevel?: string | null;
  onUpdate: (id: string, payload: Partial<ProjectActivity>) => Promise<void>;
  saving: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onViewTasks: (activityId: string) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
};

const ACTIVITY_ROW_MENU_WIDTH_PX = 176;

function ActivityRow({
  activity,
  phaseName,
  profilesMap,
  riskLevel,
  onUpdate,
  saving,
  onEdit,
  onDelete,
  onViewTasks,
  t,
}: ActivityRowProps) {
  const [startDate, setStartDate] = useState(activity.start_date ?? "");
  const [dueDate, setDueDate] = useState(activity.due_date ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);

  const displayProgress = activity.derived_progress_pct ?? activity.progress_pct ?? 0;
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = !!(activity.due_date && activity.due_date < today && (activity.status ?? "planned") !== "done");

  const updateMenuPosition = useCallback(() => {
    const el = menuTriggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 8;
    let left = r.right - ACTIVITY_ROW_MENU_WIDTH_PX;
    left = Math.max(pad, Math.min(left, window.innerWidth - ACTIVITY_ROW_MENU_WIDTH_PX - pad));
    setMenuPosition({ top: r.bottom + 4, left });
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) return;
    updateMenuPosition();
  }, [menuOpen, updateMenuPosition]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      const targetNode = e.target as Node;
      if (menuTriggerRef.current?.contains(targetNode)) return;
      if (menuPanelRef.current?.contains(targetNode)) return;
      setMenuOpen(false);
    };
    const onScroll = () => setMenuOpen(false);
    const onResize = () => updateMenuPosition();
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [menuOpen, updateMenuPosition]);

  const handleSave = () => {
    onUpdate(activity.id, {
      start_date: startDate.trim() || null,
      due_date: dueDate.trim() || null,
    });
  };

  const closeMenu = () => setMenuOpen(false);

  const menuItemClass =
    "block w-full px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none";

  const dateInputClass =
    "w-full max-w-[104px] min-w-0 rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-xs text-slate-800 shadow-sm focus:border-[rgb(var(--rb-brand-primary))]/35 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/20 transition-colors";

  const menuPortal =
    menuOpen && menuPosition && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuPanelRef}
            className="fixed z-[200] rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg ring-1 ring-slate-100"
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              width: ACTIVITY_ROW_MENU_WIDTH_PX,
            }}
            role="menu"
            aria-label={t("row.menu.actionsLabel")}
          >
            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={() => {
                onEdit();
                closeMenu();
              }}
            >
              {t("row.menu.edit")}
            </button>
            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={() => {
                onViewTasks(activity.id);
                closeMenu();
              }}
            >
              {t("row.menu.viewTasks")}
            </button>
            <button
              type="button"
              role="menuitem"
              className={`${menuItemClass} text-red-600 hover:bg-red-50 focus-visible:bg-red-50`}
              onClick={() => {
                onDelete();
                closeMenu();
              }}
            >
              {t("row.menu.delete")}
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <tr className={PROJECT_WORKSPACE_TABLE_ROW}>
      <td className="whitespace-nowrap px-3 py-4 align-middle">
        <span className="inline-flex max-w-[7.5rem] truncate rounded-md border border-slate-200/90 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {phaseName}
        </span>
      </td>
      <td className="max-w-[200px] min-w-0 px-3 py-4 align-middle">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium text-slate-900" title={activity.name}>
            {activity.name}
          </span>
          {activity.description ? (
            <span className="line-clamp-1 text-xs text-slate-600">{activity.description}</span>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-4 align-middle">
        <AssigneeCell profileId={activity.owner_profile_id} profilesMap={profilesMap} tone="light" />
      </td>
      <td className="px-3 py-4 align-middle">
        <ActivityStatusBadge status={activity.status} isOverdue={isOverdue} />
      </td>
      <td className="px-3 py-4 align-middle">
        <ActivityPriorityBadge priority={activity.priority} />
      </td>
      <td className="px-3 py-4 align-middle">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={dateInputClass} />
      </td>
      <td className="px-3 py-4 align-middle">
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={dateInputClass} />
      </td>
      <td className="px-3 py-4 align-middle">
        <span
          className="whitespace-nowrap tabular-nums text-sm text-slate-600"
          title={t("row.progressTitle")}
        >
          {displayProgress}%
        </span>
      </td>
      <td className="px-3 py-4 align-middle">
        {riskLevel == null || riskLevel === "" ? (
          <span className="text-[11px] text-slate-500">{t("emDash")}</span>
        ) : (
          <span
            className={
              riskLevel === "HIGH"
                ? "inline-flex rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-900 ring-1 ring-inset ring-rose-200/80"
                : riskLevel === "MEDIUM"
                  ? "inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-inset ring-amber-200/80"
                  : "inline-flex rounded-md bg-[rgb(var(--rb-brand-surface))] px-2 py-0.5 text-[11px] font-medium text-[rgb(var(--rb-brand-primary-active))] ring-1 ring-inset ring-[rgb(var(--rb-brand-primary))]/18"
            }
          >
            {riskLevel === "HIGH" ? t("risk.high") : riskLevel === "MEDIUM" ? t("risk.medium") : t("risk.low")}
          </span>
        )}
      </td>
      <td className="px-3 py-4 align-middle text-right">
        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[rgb(var(--rb-brand-primary))]/30 bg-[rgb(var(--rb-brand-primary))] text-white shadow-sm ring-1 ring-[rgb(var(--rb-brand-primary))]/20 transition-colors hover:bg-[rgb(var(--rb-brand-primary-hover))] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t("row.saveDates")}
            title={t("row.saveDates")}
          >
            <Save className="h-4 w-4" />
          </button>
          <button
            ref={menuTriggerRef}
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className={
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/25 focus-visible:ring-offset-0 " +
              (menuOpen
                ? "border-slate-300 bg-slate-100 text-slate-800"
                : "border-slate-200/90 bg-white")
            }
            aria-label={t("row.moreActions")}
            title={t("row.moreActions")}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {menuPortal}
      </td>
    </tr>
  );
}

type ActivityFormModalProps = {
  projectId: string;
  phases: ProjectPhase[];
  profiles: Profile[];
  activity: ProjectActivity | null;
  initialPhaseId?: string;
  onClose: () => void;
  onSaved: () => void;
};

function ActivityFormModal({
  projectId,
  phases,
  profiles,
  activity,
  initialPhaseId,
  onClose,
  onSaved,
}: ActivityFormModalProps) {
  const t = useTranslations("activities");
  const isEdit = !!activity;
  const statusOptions = useMemo(
    () => [
      { value: "planned", label: t("status.planned") },
      { value: "in_progress", label: t("status.in_progress") },
      { value: "blocked", label: t("status.blocked") },
      { value: "done", label: t("status.done") },
    ],
    [t]
  );
  const priorityOptions = useMemo(
    () => [
      { value: "low", label: t("priority.low") },
      { value: "medium", label: t("priority.medium") },
      { value: "high", label: t("priority.high") },
    ],
    [t]
  );
  const formContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEdit) return;
    const el = formContainerRef.current?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "input, select, textarea"
    );
    if (el) {
      const focusTimeout = setTimeout(() => el.focus(), 50);
      return () => clearTimeout(focusTimeout);
    }
  }, [isEdit]);
  const [phaseId, setPhaseId] = useState(activity?.phase_id ?? initialPhaseId ?? "");
  const [title, setTitle] = useState(activity?.name ?? "");
  const [description, setDescription] = useState(activity?.description ?? "");
  const [ownerProfileId, setOwnerProfileId] = useState<string | null>(activity?.owner_profile_id ?? null);
  const [status, setStatus] = useState(activity?.status ?? "planned");
  const [priority, setPriority] = useState(activity?.priority ?? "medium");
  const [startDate, setStartDate] = useState(activity?.start_date ?? "");
  const [endDate, setEndDate] = useState(activity?.due_date ?? "");
  const [progressPct, setProgressPct] = useState(String(activity?.progress_pct ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPhase = phases.find((p) => p.id === phaseId);

  useEffect(() => {
    if (!isEdit && selectedPhase?.start_date) setStartDate(selectedPhase.start_date);
    if (!isEdit && selectedPhase?.end_date) setEndDate(selectedPhase.end_date);
  }, [selectedPhase?.id, selectedPhase?.start_date, selectedPhase?.end_date, isEdit]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!projectId) {
      setError(t("modal.errors.missingProject"));
      return;
    }
    if (!phaseId || !String(phaseId).trim()) {
      setError(t("modal.errors.phaseRequired"));
      return;
    }
    if (!title || !title.trim()) {
      setError(t("modal.errors.titleRequired"));
      return;
    }

    setSaving(true);
    const pct = parseInt(progressPct, 10);
    const numPct = Number.isNaN(pct) ? null : Math.min(100, Math.max(0, pct));

    try {
      if (isEdit && activity) {
        const { error: err } = await supabase
          .from("project_activities")
          .update({
            phase_id: phaseId,
            name: title.trim(),
            description: description.trim() || null,
            owner_profile_id: ownerProfileId || null,
            status,
            priority,
            start_date: startDate.trim() || null,
            due_date: endDate.trim() || null,
            progress_pct: numPct,
          })
          .eq("id", activity.id);
        if (err) {
          console.error("Error updating activity (Supabase)", err);
          setError(err.message || t("modal.errors.updateFailed"));
          return;
        }
        onSaved();
        return;
      }

      const payload = {
        project_id: projectId,
        phase_id: phaseId,
        name: title.trim(),
        description: description.trim() || null,
        owner_profile_id: ownerProfileId || null,
        status: status || "planned",
        priority: priority || "medium",
        start_date: startDate.trim() || null,
        due_date: endDate.trim() || null,
        progress_pct:
          typeof numPct === "number" ? Math.min(100, Math.max(0, numPct)) : 0,
      };

      const { error: insertError } = await supabase
        .from("project_activities")
        .insert([payload])
        .select()
        .single();

      if (insertError) {
        console.error("Error creating activity (Supabase)", insertError);
        setError(insertError.message || t("modal.errors.createFailed"));
        return;
      }
      onSaved();
    } catch (err) {
      console.error("Error creating activity (JS)", err);
      setError(t("modal.errors.unexpected"));
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    "mt-1 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/25 focus:border-[rgb(var(--rb-brand-primary))]/30";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        ref={formContainerRef}
        className="w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl ring-1 ring-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">
          {isEdit ? t("modal.titleEdit") : t("modal.titleCreate")}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <p className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">{error}</p>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600">{t("modal.fields.phaseRequired")}</label>
            <select
              value={phaseId}
              onChange={(e) => setPhaseId(e.target.value)}
              required
              className={fieldClass}
            >
              <option value="">{t("modal.fields.selectPhase")}</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">{t("modal.fields.titleRequired")}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={fieldClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">{t("modal.fields.description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">{t("modal.fields.owner")}</label>
            <select
              className={fieldClass}
              value={ownerProfileId ?? ""}
              onChange={(e) => setOwnerProfileId(e.target.value || null)}
            >
              <option value="">{t("modal.fields.unassigned")}</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.email || p.id}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600">{t("modal.fields.status")}</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={fieldClass}>
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">{t("modal.fields.priority")}</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={fieldClass}>
                {priorityOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600">{t("modal.fields.start")}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">{t("modal.fields.end")}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">{t("modal.fields.progress")}</label>
            <input
              type="number"
              min={0}
              max={100}
              value={progressPct}
              onChange={(e) => setProgressPct(e.target.value)}
              className={`${fieldClass} w-24`}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t("modal.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl rb-btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50 shadow-sm"
            >
              {saving ? (isEdit ? t("modal.savingEdit") : t("modal.savingCreate")) : isEdit ? t("modal.saveChanges") : t("modal.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
