"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { getProjectPhases, type ProjectPhase } from "@/lib/services/projectPhaseService";
import { Plus, Pencil, Save, Trash2, ListTodo, User, Search } from "lucide-react";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";

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

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "planned", label: "Pendiente" },
  { value: "in_progress", label: "En progreso" },
  { value: "blocked", label: "Bloqueada" },
  { value: "done", label: "Finalizada" },
];

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
];

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

function AssigneeCell({ profileId, profilesMap }: { profileId: string | null; profilesMap: Map<string, Profile> }) {
  if (!profileId) {
    return (
      <span className="flex items-center gap-2 text-slate-500">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700/80 text-slate-500">
          <User className="h-3.5 w-3.5" />
        </span>
        Sin asignar
      </span>
    );
  }
  const p = profilesMap.get(profileId);
  const label = p ? (p.full_name || p.email || profileId) : profileId.slice(0, 8);
  const initial = (label.trim() || "?").charAt(0).toUpperCase();
  return (
    <span className="flex items-center gap-2 text-slate-300">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-600 text-slate-200 text-[10px] font-medium">
        {initial}
      </span>
      <span className="truncate max-w-[120px]" title={label}>{label}</span>
    </span>
  );
}

function ActivityStatusBadge({ status, isOverdue }: { status: string | null; isOverdue?: boolean }) {
  const s = (status ?? "planned").toLowerCase();
  if (isOverdue && s !== "done") {
    return (
      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium bg-amber-500/20 text-amber-300">
        Overdue
      </span>
    );
  }
  const styles: Record<string, string> = {
    planned: "bg-slate-700 text-slate-300",
    in_progress: "bg-indigo-500/20 text-indigo-300",
    blocked: "bg-rose-500/20 text-rose-300",
    done: "bg-emerald-500/20 text-emerald-300",
  };
  const labels: Record<string, string> = {
    planned: "Planned",
    in_progress: "In Progress",
    blocked: "Blocked",
    done: "Completed",
  };
  const style = styles[s] ?? "bg-slate-700/60 text-slate-400";
  const label = labels[s] ?? (status ?? "—");
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${style}`}>
      {label}
    </span>
  );
}

export default function ProjectActivitiesPageContent() {
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
  const [profilesLoading, setProfilesLoading] = useState(false);

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
      setErrorMsg("No se pudieron cargar los datos.");
    } finally {
      setLoading(false);
      setProfilesLoading(false);
    }
  }, [projectId]);

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
        const ownerName = a.owner_profile_id ? (getProfileName(a.owner_profile_id) ?? "").toLowerCase() : "";
        return name.includes(q) || desc.includes(q) || ownerName.includes(q);
      });
    }
    return list;
  }, [activities, selectedPhaseId, statusFilter, searchQuery, currentUserProfileId, profiles]);

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

  const getPhaseName = (phaseId: string) => phases.find((p) => p.id === phaseId)?.name ?? "—";

  const getProfileName = (id: string | null) => {
    if (!id) return "Sin asignar";
    const p = profiles.find((prof) => prof.id === id);
    return p?.full_name || p?.email || "Sin asignar";
  };

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
      <div className="w-full min-w-0 bg-slate-950">
        <p className="text-sm text-slate-400">No se ha encontrado el identificador del proyecto.</p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6 bg-slate-950">
        {showCreandoBanner && (
          <div className="rounded-xl border border-slate-600/80 bg-slate-800/60 px-3 py-2 text-xs text-slate-400 transition-opacity duration-300">
            Creando...
          </div>
        )}
        {errorMsg && (
          <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-5 py-3 text-sm text-red-200">
            {errorMsg}
          </div>
        )}

        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-100 sm:text-2xl">Actividades</h1>
            <p className="mt-0.5 text-sm text-slate-500">Plan de trabajo estructurado por fases SAP Activate.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0 pt-2 sm:pt-0">
            <select
              value={selectedPhaseId}
              onChange={(e) => setSelectedPhaseId(e.target.value as string | "all")}
              className="rounded-xl border border-slate-600/80 bg-slate-800/80 px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
            >
              <option value="all">Todas las fases</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              disabled={phases.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4 shrink-0" />
              Nueva actividad
            </button>
          </div>
        </header>

        {!loading && activities.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
              <p className="text-xs uppercase tracking-wider text-slate-400">Open</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">{summary.open}</p>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
              <p className="text-xs uppercase tracking-wider text-slate-400">In Progress</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">{summary.inProgress}</p>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
              <p className="text-xs uppercase tracking-wider text-slate-400">Blocked</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">{summary.blocked}</p>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
              <p className="text-xs uppercase tracking-wider text-slate-400">Overdue</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">{summary.overdue}</p>
            </div>
          </div>
        )}

        {!loading && activities.length > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              {(
                [
                  { key: "all" as StatusFilterKind, label: "All" },
                  { key: "planned" as StatusFilterKind, label: "Planned" },
                  { key: "in_progress" as StatusFilterKind, label: "In Progress" },
                  { key: "blocked" as StatusFilterKind, label: "Blocked" },
                  { key: "done" as StatusFilterKind, label: "Completed" },
                  { key: "overdue" as StatusFilterKind, label: "Overdue" },
                  { key: "assigned_to_me" as StatusFilterKind, label: "Assigned to me" },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors duration-150 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0 ${
                    statusFilter === key
                      ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                      : "border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="w-full sm:w-auto sm:min-w-[200px]">
              <label className="relative block">
                <span className="sr-only">Search activities</span>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                <input
                  type="search"
                  placeholder="Search activities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-500/50 min-w-0"
                />
              </label>
            </div>
          </div>
        )}

        <section className="w-full min-w-0 rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden">
          <div className="border-b border-slate-700/60 px-6 py-4 bg-slate-800/50">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Listado de actividades</h2>
            <p className="mt-0.5 text-sm text-slate-400">Actividades por fase. Edita y enlaza con tareas.</p>
          </div>
          <div className="p-5 min-w-0">
            {loading ? (
              <TableSkeleton rows={6} colCount={7} />
            ) : activities.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/30 py-16 px-6 flex flex-col items-center justify-center min-h-[200px] text-center">
                <p className="text-base font-medium text-slate-200">No hay actividades en este proyecto</p>
                <p className="mt-1.5 text-sm text-slate-500 max-w-sm">Puedes crear actividades para organizar el trabajo y vincular tareas del proyecto.</p>
                <button
                  type="button"
                  onClick={() => phases.length > 0 && setIsCreating(true)}
                  disabled={phases.length === 0}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  Crear primera actividad
                </button>
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/30 py-12 px-6 flex flex-col items-center justify-center min-h-[160px] text-center">
                {selectedPhaseId !== "all" ? (
                  <>
                    <p className="text-sm font-medium text-slate-300">No hay actividades en esta fase.</p>
                    <p className="mt-1 text-xs text-slate-500">Cambia de fase o crea una nueva actividad.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-slate-300">No hay actividades que coincidan con los filtros</p>
                    <p className="mt-1 text-xs text-slate-500">Prueba otro filtro o búsqueda.</p>
                  </>
                )}
              </div>
            ) : (
              <div className="w-full min-w-0 overflow-x-auto rounded-lg [scrollbar-width:thin] [scrollbar-color:#475569_#1e293b] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:rounded [&::-webkit-scrollbar-track]:bg-slate-800/80 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-thumb:hover]:bg-slate-500">
                <table className="w-full text-left text-sm min-w-[640px]">
                  <thead className="sticky top-0 z-10 bg-slate-800/95 backdrop-blur border-b border-slate-700/60">
                    <tr>
                      <th className="px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-[100px] min-w-[100px] align-middle whitespace-nowrap">Fase</th>
                      <th className="px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-[180px] min-w-[180px] align-middle">Actividad</th>
                      <th className="px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-[140px] min-w-[140px] align-middle">Responsable</th>
                      <th className="px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-[110px] min-w-[110px] align-middle">Estado</th>
                      <th className="px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-[100px] min-w-[100px] align-middle whitespace-nowrap">Inicio</th>
                      <th className="px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-[100px] min-w-[100px] align-middle whitespace-nowrap">Fin</th>
                      <th className="px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-[44px] min-w-[44px] align-middle">%</th>
                      <th className="px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-[72px] min-w-[72px] align-middle">Riesgo</th>
                      <th className="px-3 py-3.5 pl-3 pr-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-[180px] min-w-[180px] max-w-[180px] align-middle text-right whitespace-nowrap">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {filteredActivities.map((activity) => (
                      <ActivityRow
                        key={activity.id}
                        activity={activity}
                        phaseName={getPhaseName(activity.phase_id)}
                        profiles={profiles}
                        profilesMap={profilesMap}
                        riskLevel={riskByActivity[activity.id]}
                        onUpdate={updateActivity}
                        saving={savingId === activity.id}
                        onEdit={() => setEditingActivity(activity)}
                        onDelete={() => setDeleteConfirmId(activity.id)}
                        onViewTasks={handleViewTasks}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => !deletingId && setDeleteConfirmId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="activity-delete-title"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-xl ring-1 ring-slate-700/50"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Escape") !deletingId && setDeleteConfirmId(null); }}
          >
            <p id="activity-delete-title" className="text-sm text-slate-300">
              ¿Seguro que deseas eliminar esta actividad? Las tareas asociadas seguirán existiendo pero quedarán sin vínculo.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                disabled={!!deletingId}
                className="rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = deleteConfirmId;
                  if (id) deleteActivity(id);
                }}
                disabled={!!deletingId}
                className="rounded-xl bg-red-600/90 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0"
              >
                {deletingId ? "Eliminando…" : "Sí, eliminar"}
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
  profiles: Profile[];
  profilesMap: Map<string, Profile>;
  riskLevel?: string | null;
  onUpdate: (id: string, payload: Partial<ProjectActivity>) => Promise<void>;
  saving: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onViewTasks: (activityId: string) => void;
};

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
}: ActivityRowProps) {
  const [startDate, setStartDate] = useState(activity.start_date ?? "");
  const [dueDate, setDueDate] = useState(activity.due_date ?? "");

  const displayProgress = activity.derived_progress_pct ?? activity.progress_pct ?? 0;
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = !!(activity.due_date && activity.due_date < today && (activity.status ?? "planned") !== "done");

  useEffect(() => {
    setStartDate(activity.start_date ?? "");
    setDueDate(activity.due_date ?? "");
  }, [activity.id, activity.start_date, activity.due_date]);

  const handleSave = () => {
    onUpdate(activity.id, {
      start_date: startDate.trim() || null,
      due_date: dueDate.trim() || null,
    });
  };

  const dateInputClass =
    "w-full max-w-[100px] min-w-0 rounded-lg border border-slate-600/80 bg-slate-800/80 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-colors";
  const actionBtnClass =
    "inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-600 bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 hover:text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0";

  return (
    <tr className="hover:bg-slate-800/50 transition-colors duration-150">
      <td className="px-3 py-3.5 text-slate-300 align-middle whitespace-nowrap">{phaseName}</td>
      <td className="px-3 py-3.5 align-middle min-w-0 max-w-[180px]">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-slate-100 truncate" title={activity.name}>{activity.name}</span>
          {activity.description && (
            <span className="text-xs text-slate-400 line-clamp-1">{activity.description}</span>
          )}
        </div>
      </td>
      <td className="px-3 py-3.5 align-middle">
        <AssigneeCell profileId={activity.owner_profile_id} profilesMap={profilesMap} />
      </td>
      <td className="px-3 py-3.5 align-middle">
        <ActivityStatusBadge status={activity.status} isOverdue={isOverdue} />
      </td>
      <td className="px-3 py-3.5 align-middle">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={dateInputClass} />
      </td>
      <td className="px-3 py-3.5 align-middle">
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={dateInputClass} />
      </td>
      <td className="px-3 py-3.5 align-middle">
        <span className="text-slate-300 tabular-nums whitespace-nowrap" title="Progreso derivado de tareas (hechas / total)">
          {displayProgress}%
        </span>
      </td>
      <td className="px-3 py-3.5 align-middle">
        {riskLevel == null || riskLevel === "" ? (
          <span className="text-slate-500 text-[11px]">—</span>
        ) : (
          <span
            className={
              riskLevel === "HIGH"
                ? "inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium bg-red-500/20 text-red-400"
                : riskLevel === "MEDIUM"
                  ? "inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium bg-amber-500/20 text-amber-400"
                  : "inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium bg-emerald-500/20 text-emerald-400"
            }
          >
            {riskLevel === "HIGH" ? "Alto" : riskLevel === "MEDIUM" ? "Medio" : "Bajo"}
          </span>
        )}
      </td>
      <td className="px-3 py-3.5 align-middle text-right w-[180px] min-w-[180px] max-w-[180px]">
        <div className="flex items-center gap-1.5 justify-end whitespace-nowrap">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`${actionBtnClass} ${saving ? "text-indigo-400/70" : "text-indigo-300 hover:text-indigo-200 hover:border-indigo-500/50 hover:bg-indigo-500/10"}`}
            title="Save changes"
          >
            <Save className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className={actionBtnClass}
            aria-label="Edit activity"
            title="Edit activity"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewTasks(activity.id)}
            className={actionBtnClass}
            title="Manage tasks"
          >
            <ListTodo className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className={`${actionBtnClass} text-red-400 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40`}
            aria-label="Delete activity"
            title="Delete activity"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
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
  const isEdit = !!activity;
  const formContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEdit) return;
    const el = formContainerRef.current?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "input, select, textarea"
    );
    if (el) {
      const t = setTimeout(() => el.focus(), 50);
      return () => clearTimeout(t);
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
  }, [selectedPhase?.id, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!projectId) {
      setError("No se pudo identificar el proyecto.");
      return;
    }
    if (!phaseId || !String(phaseId).trim()) {
      setError("Selecciona una fase para la actividad.");
      return;
    }
    if (!title || !title.trim()) {
      setError("La actividad necesita un título.");
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
          setError(err.message || "No se pudo actualizar la actividad.");
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
        setError(insertError.message || "No se pudo crear la actividad.");
        return;
      }
      onSaved();
    } catch (err) {
      console.error("Error creating activity (JS)", err);
      setError("Ocurrió un error inesperado al crear la actividad.");
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    "mt-1 w-full rounded-xl border border-slate-600/80 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onClose}
    >
      <div
        ref={formContainerRef}
        className="w-full max-w-lg rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-xl ring-1 ring-slate-700/50"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-100">
          {isEdit ? "Editar actividad" : "Nueva actividad"}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <p className="mt-2 rounded-lg bg-red-950/50 border border-red-800/50 px-3 py-2 text-sm text-red-200">{error}</p>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500">Fase *</label>
            <select
              value={phaseId}
              onChange={(e) => setPhaseId(e.target.value)}
              required
              className={fieldClass}
            >
              <option value="">Selecciona una fase</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Título *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={fieldClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Responsable</label>
            <select
              className={fieldClass}
              value={ownerProfileId ?? ""}
              onChange={(e) => setOwnerProfileId(e.target.value || null)}
            >
              <option value="">Sin asignar</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.email || p.id}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500">Estado</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={fieldClass}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">Prioridad</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={fieldClass}>
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500">Inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">Fin</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Progreso (%)</label>
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
              className="rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50"
            >
              {saving ? (isEdit ? "Guardando…" : "Creando…") : isEdit ? "Guardar cambios" : "Crear actividad"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
