"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";
import { getProjectPhases, type ProjectPhase } from "@/lib/services/projectPhaseService";
import { ChevronLeft, Plus, Pencil, Save } from "lucide-react";

// Types aligned with DB: project_activities uses name, due_date; status/priority are text
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

export default function ProjectActivitiesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = (params?.id ?? "") as string;

  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedPhaseId, setSelectedPhaseId] = useState<string | "all">("all");
  const [isCreating, setIsCreating] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ProjectActivity | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setErrorMsg(null);
    setProfilesLoading(true);
    try {
      const [projectRes, phasesList, activitiesRes, profilesRes] = await Promise.all([
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
      } else {
        setActivities((activitiesRes.data ?? []) as ProjectActivity[]);
      }

      if (profilesRes.error) {
        console.error("Error loading profiles", profilesRes.error);
        setProfiles([]);
      } else {
        setProfiles((profilesRes.data ?? []) as Profile[]);
      }
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

  // Pre-select phase from ?phaseId=
  useEffect(() => {
    const phaseId = searchParams?.get("phaseId");
    if (phaseId && phases.some((p) => p.id === phaseId)) {
      setSelectedPhaseId(phaseId);
    }
  }, [searchParams, phases]);

  const filteredActivities = useMemo(() => {
    if (selectedPhaseId === "all") return activities;
    return activities.filter((a) => a.phase_id === selectedPhaseId);
  }, [activities, selectedPhaseId]);

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

  if (!projectId) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <p className="text-sm text-slate-600">No se ha encontrado el identificador del proyecto.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto space-y-6">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-indigo-600"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver al proyecto
        </Link>

        {errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">
              Actividades del proyecto
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Plan de trabajo estructurado por fases SAP Activate.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedPhaseId}
              onChange={(e) => setSelectedPhaseId(e.target.value as string | "all")}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              Nueva actividad
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          {loading ? (
            <p className="text-sm text-slate-500">Cargando actividades…</p>
          ) : activities.length === 0 ? (
            <p className="text-sm text-slate-500">
              Este proyecto aún no tiene actividades. Crea la primera actividad para empezar el plan de trabajo.
            </p>
          ) : filteredActivities.length === 0 ? (
            <p className="text-sm text-slate-500">
              No hay actividades en la fase seleccionada.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="pb-3 pr-4">Fase</th>
                    <th className="pb-3 pr-4">Actividad</th>
                    <th className="pb-3 pr-4 w-28">Responsable</th>
                    <th className="pb-3 pr-4 w-36">Estado</th>
                    <th className="pb-3 pr-4 w-32">Inicio</th>
                    <th className="pb-3 pr-4 w-32">Fin</th>
                    <th className="pb-3 pr-4 w-24">% avance</th>
                    <th className="pb-3 w-28">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivities.map((activity) => (
                    <ActivityRow
                      key={activity.id}
                      activity={activity}
                      phaseName={getPhaseName(activity.phase_id)}
                      profiles={profiles}
                      onUpdate={updateActivity}
                      saving={savingId === activity.id}
                      onEdit={() => setEditingActivity(activity)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

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
    </main>
  );
}

type ActivityRowProps = {
  activity: ProjectActivity;
  phaseName: string;
  profiles: Profile[];
  onUpdate: (id: string, payload: Partial<ProjectActivity>) => Promise<void>;
  saving: boolean;
  onEdit: () => void;
};

function ActivityRow({ activity, phaseName, profiles, onUpdate, saving, onEdit }: ActivityRowProps) {
  const [status, setStatus] = useState(activity.status ?? "planned");
  const [ownerProfileId, setOwnerProfileId] = useState<string | null>(activity.owner_profile_id);
  const [startDate, setStartDate] = useState(activity.start_date ?? "");
  const [dueDate, setDueDate] = useState(activity.due_date ?? "");
  const [progressPct, setProgressPct] = useState(String(activity.progress_pct ?? 0));

  useEffect(() => {
    setStatus(activity.status ?? "planned");
    setOwnerProfileId(activity.owner_profile_id);
    setStartDate(activity.start_date ?? "");
    setDueDate(activity.due_date ?? "");
    setProgressPct(String(activity.progress_pct ?? 0));
  }, [activity.id, activity.status, activity.owner_profile_id, activity.start_date, activity.due_date, activity.progress_pct]);

  const handleSave = () => {
    const pct = parseInt(progressPct, 10);
    const numPct = Number.isNaN(pct) ? null : Math.min(100, Math.max(0, pct));
    onUpdate(activity.id, {
      status: status || null,
      owner_profile_id: ownerProfileId || null,
      start_date: startDate.trim() || null,
      due_date: dueDate.trim() || null,
      progress_pct: numPct,
    });
  };

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
      <td className="py-3 pr-4 text-slate-700">{phaseName}</td>
      <td className="py-3 pr-4 font-medium text-slate-900">{activity.name}</td>
      <td className="py-3 pr-4">
        <select
          className="w-full min-w-0 max-w-[140px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
      </td>
      <td className="py-3 pr-4">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="py-3 pr-4">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </td>
      <td className="py-3 pr-4">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </td>
      <td className="py-3 pr-4">
        <input
          type="number"
          min={0}
          max={100}
          value={progressPct}
          onChange={(e) => setProgressPct(e.target.value)}
          className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </td>
      <td className="py-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "…" : "Guardar"}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            aria-label="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
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

  // When phase changes (and we have phase dates), propose start/end for new activities
  useEffect(() => {
    if (!isEdit && selectedPhase?.start_date) setStartDate(selectedPhase.start_date);
    if (!isEdit && selectedPhase?.end_date) setEndDate(selectedPhase.end_date);
  }, [selectedPhase?.id, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!projectId) {
      setError("Falta el identificador del proyecto.");
      return;
    }
    if (!phaseId || !phaseId.trim()) {
      setError("Selecciona una fase.");
      return;
    }
    if (!title.trim()) {
      setError("El título es obligatorio.");
      return;
    }

    setSaving(true);
    const pct = parseInt(progressPct, 10);
    const numPct = Number.isNaN(pct) ? null : Math.min(100, Math.max(0, pct));

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
      setSaving(false);
      if (err) {
        setError(err.message);
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
      .insert([payload]);
    setSaving(false);

    if (insertError) {
      console.error("Error creating activity", insertError);
      setError("No se pudo crear la actividad. Revisa los datos e inténtalo de nuevo.");
      return;
    }
    onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">
          {isEdit ? "Editar actividad" : "Nueva actividad"}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500">Fase *</label>
            <select
              value={phaseId}
              onChange={(e) => setPhaseId(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Responsable</label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">Prioridad</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
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
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">Fin</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="mt-1 w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear actividad"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
