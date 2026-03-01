"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";
import {
  getProjectPhases,
  updateProjectPhase,
  type ProjectPhase,
} from "@/lib/services/projectPhaseService";
import { ChevronLeft, ChevronDown, ChevronUp, ListChecks } from "lucide-react";

type Project = {
  id: string;
  name: string;
  description: string | null;
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

export default function ProjectPlanningPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
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
  const [savingAll, setSavingAll] = useState(false);
  const [saveAllMessage, setSaveAllMessage] = useState<string | null>(null);

  const loadProject = useCallback(async () => {
    if (!projectId) return;
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, description")
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

  if (!projectId) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm text-slate-600">No se ha encontrado el identificador del proyecto.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="max-w-4xl mx-auto space-y-6">
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

        <ProjectPageHeader
          title={loading ? "Cargando…" : (project?.name ?? "Proyecto") + " · Planificación"}
          subtitle="Fases SAP Activate: edita nombres, orden y fechas."
        />

        <div className="mt-2 mb-4 border-b border-slate-200">
          <nav className="flex gap-4 text-xs">
            {[
              { key: "phases", label: "Fases del proyecto", href: `/projects/${projectId}/planning` },
              { key: "activities", label: "Actividades por fase", href: `/projects/${projectId}/activities` },
              { key: "calendar", label: "Calendario", href: null as string | null },
            ].map((tab) => {
              const isActive = tab.href != null && pathname != null && pathname.startsWith(tab.href);
              const baseClasses = "pb-2 border-b-2 -mb-px transition-colors";
              const activeClasses = "border-indigo-500 text-indigo-600 font-semibold";
              const inactiveClasses = "border-transparent text-slate-500 hover:text-slate-700";

              if (tab.href == null) {
                return (
                  <span
                    key={tab.key}
                    className={`${baseClasses} ${inactiveClasses} opacity-40 cursor-not-allowed`}
                  >
                    {tab.label}
                  </span>
                );
              }

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => router.push(tab.href)}
                  className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Cargando fases…</p>
        ) : phases.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Este proyecto no tiene fases de planificación
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Puedes generar automáticamente las fases SAP Activate.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={generateDefaultPhases}
                disabled={generatingPhases}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingPhases ? "Generando…" : "Generar fases SAP Activate"}
              </button>
              <Link
                href={`/projects/${projectId}`}
                className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
              >
                Ir al dashboard del proyecto
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50/80">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Fases del proyecto
              </p>
              <div className="flex items-center gap-3">
                {saveAllMessage && (
                  <span
                    className={
                      saveAllMessage.startsWith("Error")
                        ? "text-xs text-rose-600"
                        : "text-xs text-emerald-600"
                    }
                  >
                    {saveAllMessage}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={savingAll}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingAll ? "Guardando…" : "Guardar planificación"}
                </button>
              </div>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 w-20">
                    Orden
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 w-40">
                    Inicio
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 w-40">
                    Fin
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 w-28">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {phases.map((phase, index) => (
                  <PhaseRow
                    key={phase.id}
                    phase={phase}
                    projectId={projectId}
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
        )}
      </div>
    </main>
  );
}

function PhaseRow({
  phase,
  projectId,
  index,
  total,
  onMove,
  onSave,
  onPhaseDateChange,
  onPhaseNameChange,
  saving,
}: {
  phase: ProjectPhase;
  projectId: string;
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

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
      <td className="px-4 py-2">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onMove(index, "up")}
            disabled={index === 0}
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-40 disabled:pointer-events-none"
            aria-label="Subir"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(index, "down")}
            disabled={index === total - 1}
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-40 disabled:pointer-events-none"
            aria-label="Bajar"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <span className="ml-1 text-sm font-medium text-slate-500">{phase.sort_order}</span>
        </div>
      </td>
      <td className="px-4 py-2">
        <input
          type="text"
          value={name}
          onChange={(e) => onPhaseNameChange(phase.id, e.target.value)}
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onPhaseDateChange(phase.id, "start_date", e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="date"
          value={endDate}
          onChange={(e) => onPhaseDateChange(phase.id, "end_date", e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </td>
      <td className="px-4 py-2">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed w-fit"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <Link
            href={`/projects/${projectId}/activities?phaseId=${phase.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            <ListChecks className="h-3.5 w-3.5" />
            Ver actividades
          </Link>
        </div>
      </td>
    </tr>
  );
}
