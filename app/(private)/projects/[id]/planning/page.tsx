"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import {
  getProjectPhases,
  updateProjectPhase,
  type ProjectPhase,
} from "@/lib/services/projectPhaseService";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ProjectPlanningGantt } from "@/components/projects/ProjectPlanningGantt";

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

export default function ProjectPlanningPage() {
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
        if (!cancelled) setErrorMsg("No se pudieron cargar los datos.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, loadProject, loadPhases]);

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
          ? "Planificación guardada y fechas del proyecto actualizadas."
          : "Planificación guardada correctamente."
      );
      setTimeout(() => setSaveAllMessage(null), 3000);
    } catch {
      setSaveAllMessage("Error al guardar la planificación. Inténtalo de nuevo.");
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
        alert("No se pudieron crear las fases. Comprueba que tienes permiso o inténtalo más tarde.");
        return;
      }
      await loadPhases();
    } catch (err) {
      console.error("Error generating default phases", err);
      alert("Se produjo un error al generar las fases. Inténtalo de nuevo.");
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
        setErrorMsg(json.error === "missing_dates" ? "Indica fechas de inicio y fin en el proyecto." : json.error);
      }
    } catch (err) {
      console.error("Generate activate plan error", err);
      setErrorMsg("No se pudo generar el plan.");
    } finally {
      setGeneratingPlan(false);
    }
  };

  if (!projectId) {
    return (
      <div className="w-full min-w-0 bg-slate-950">
        <p className="text-sm text-slate-400">No se ha encontrado el identificador del proyecto.</p>
      </div>
    );
  }

  const { minStartDate, maxEndDate } = getMinMaxDates(phases);
  const currentPhase = getCurrentPhase(phases);
  const totalDurationDays =
    minStartDate && maxEndDate ? getDurationDays(minStartDate, maxEndDate) : null;
  const projectDateRange =
    minStartDate && maxEndDate
      ? `${new Date(minStartDate).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })} – ${new Date(maxEndDate).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}`
      : null;

  const ganttProjectStart = minStartDate ?? project?.start_date ?? new Date().toISOString().slice(0, 10);
  const ganttProjectEnd = maxEndDate ?? project?.planned_end_date ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return (
    <div className="w-full min-w-0 space-y-8 bg-slate-950">
        {/* Planning header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-100 sm:text-2xl">Planificación del proyecto</h1>
            <p className="mt-0.5 text-sm text-slate-500">Estructura del proyecto basada en SAP Activate.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0 pt-2 sm:pt-0">
            {phases.length > 0 ? (
              <span className="inline-flex items-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-emerald-400">
                Plan configurado
              </span>
            ) : (
              <span className="inline-flex items-center rounded-lg border border-slate-600/80 bg-slate-800/60 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Plan pendiente
              </span>
            )}
            {projectDateRange && (
              <span className="inline-flex items-center rounded-lg border border-slate-600/80 bg-slate-800/60 px-3 py-1.5 text-[11px] font-medium text-slate-300">
                {projectDateRange}
              </span>
            )}
          </div>
        </header>

        {/* Planning summary block */}
        {phases.length > 0 && (
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 sm:p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">Resumen</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Fase actual</p>
                <p className="mt-0.5 text-sm font-medium text-slate-200">{currentPhase?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Inicio previsto</p>
                <p className="mt-0.5 text-sm font-medium text-slate-300">{minStartDate ? new Date(minStartDate).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—"}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Fin previsto</p>
                <p className="mt-0.5 text-sm font-medium text-slate-300">{maxEndDate ? new Date(maxEndDate).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—"}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Duración</p>
                <p className="mt-0.5 text-sm font-medium text-slate-300">{totalDurationDays != null ? `${totalDurationDays} días` : "—"}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Fases</p>
                <p className="mt-0.5 text-sm font-medium text-slate-300">{phases.length}</p>
              </div>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-5 py-3 text-sm text-red-200">
            {errorMsg}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading phases…</p>
        ) : phases.length === 0 ? (
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-6 md:p-8">
            <h2 className="text-lg font-semibold text-slate-100">Aún no hay fases de planificación</h2>
            <p className="mt-1 text-sm text-slate-500">
              Genera solo las fases SAP Activate o el plan completo (fases, actividades, tareas) cuando el proyecto tenga fechas de inicio y fin.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {project?.start_date && project?.planned_end_date && (
                <button
                  type="button"
                  onClick={generateActivatePlanFromTemplate}
                  disabled={generatingPlan}
                  className="inline-flex items-center justify-center rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
                >
                  {generatingPlan ? "Generando…" : "Generar plan desde plantilla"}
                </button>
              )}
              <button
                type="button"
                onClick={generateDefaultPhases}
                disabled={generatingPhases}
                className="inline-flex items-center justify-center rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors duration-150 disabled:opacity-50"
              >
                {generatingPhases ? "Generando…" : "Generar solo fases"}
              </button>
              <Link
                href={`/projects/${projectId}`}
                className="inline-flex items-center justify-center rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors duration-150"
              >
                Volver al proyecto
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Timeline hero — scrollable, no overflow */}
            <section className="w-full min-w-0 overflow-x-auto">
              <ProjectPlanningGantt
                phases={phases}
                projectStart={ganttProjectStart}
                projectEnd={ganttProjectEnd}
                height={420}
              />
            </section>

            {/* Phase editor — structured card */}
            <section className="w-full min-w-0">
              <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden">
                <div className="border-b border-slate-700/60 px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-medium text-slate-200">Editor de fases</h2>
                    <p className="mt-0.5 text-xs text-slate-400">Edita nombres y fechas. Los cambios se reflejan en el timeline.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {saveAllMessage && (
                      <span
                        className={
                          saveAllMessage.startsWith("Error")
                            ? "text-xs text-rose-400"
                            : "text-xs text-emerald-400"
                        }
                      >
                        {saveAllMessage}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveAll}
                      disabled={savingAll}
                      className="inline-flex items-center justify-center rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
                    >
                      {savingAll ? "Guardando…" : "Guardar planificación"}
                    </button>
                  </div>
                </div>
                <div className="min-w-0 overflow-x-auto">
                  <table className="w-full text-left min-w-[540px]">
                    <thead className="bg-slate-800/50 border-b border-slate-700/50">
                      <tr>
                        <th className="px-4 sm:px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-20 whitespace-nowrap">Orden</th>
                        <th className="px-4 sm:px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 min-w-[200px]">Fase</th>
                        <th className="px-4 sm:px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-40">Inicio</th>
                        <th className="px-4 sm:px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-40">Fin</th>
                        <th className="px-4 sm:px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40">
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
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
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
    "w-full rounded-xl border border-slate-600/80 bg-slate-800/80 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-colors";
  const dateInputClass =
    "w-full rounded-xl border border-slate-500 bg-slate-800/80 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 transition-colors";

  return (
    <tr className="hover:bg-slate-800/50 transition-colors duration-150">
      <td className="px-4 sm:px-5 py-3 align-middle whitespace-nowrap">
        <div className="flex items-center gap-2">
          <div className="inline-flex flex-col rounded-lg border border-slate-600/50 bg-slate-800/40 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => onMove(index, "up")}
              disabled={index === 0}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-700/60 hover:text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors duration-150"
              aria-label="Move up"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onMove(index, "down")}
              disabled={index === total - 1}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-700/60 hover:text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors duration-150"
              aria-label="Move down"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="text-xs font-medium text-slate-500 tabular-nums">{phase.sort_order}</span>
        </div>
      </td>
      <td className="px-4 sm:px-5 py-3 align-middle">
        <input
          type="text"
          value={name}
          onChange={(e) => onPhaseNameChange(phase.id, e.target.value)}
          className={`${textInputClass} max-w-[220px]`}
          placeholder="Nombre de fase"
        />
      </td>
      <td className="px-4 sm:px-5 py-3 align-middle">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onPhaseDateChange(phase.id, "start_date", e.target.value)}
          className={dateInputClass}
        />
      </td>
      <td className="px-4 sm:px-5 py-3 align-middle">
        <input
          type="date"
          value={endDate}
          onChange={(e) => onPhaseDateChange(phase.id, "end_date", e.target.value)}
          className={dateInputClass}
        />
      </td>
      <td className="px-4 sm:px-5 py-3 align-middle text-right w-24">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg border border-indigo-500/50 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-200 hover:bg-indigo-500/20 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "…" : "Guardar"}
        </button>
      </td>
    </tr>
  );
}
