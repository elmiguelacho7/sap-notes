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
import { ChevronLeft, ChevronDown, ChevronUp } from "lucide-react";
import ProjectGanttPro from "@/app/components/ProjectGanttPro";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

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
      <PageShell>
        <p className="text-sm text-slate-600">No se ha encontrado el identificador del proyecto.</p>
      </PageShell>
    );
  }

  const { minStartDate, maxEndDate } = getMinMaxDates(phases);
  const projectDateRange =
    minStartDate && maxEndDate
      ? `${new Date(minStartDate).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })} – ${new Date(maxEndDate).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}`
      : null;

  const ganttProjectStart = minStartDate ?? project?.start_date ?? new Date().toISOString().slice(0, 10);
  const ganttProjectEnd = maxEndDate ?? project?.planned_end_date ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return (
    <PageShell>
      <Link
        href={`/projects/${projectId}`}
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-indigo-600"
      >
        <ChevronLeft className="h-4 w-4" />
        Volver al proyecto
      </Link>

      <PageHeader
        title={loading ? "Cargando…" : `${project?.name ?? "Proyecto"} · Planificación`}
        description="Define el orden y las fechas de las fases SAP Activate de este proyecto."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {phases.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                Plan generado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Plan pendiente
              </span>
            )}
            {projectDateRange && (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {projectDateRange}
              </span>
            )}
          </div>
        }
      />

      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando fases…</p>
      ) : phases.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Este proyecto no tiene fases de planificación</CardTitle>
            <p className="text-sm text-slate-600 mt-0.5">
              Puedes generar solo las fases o el plan completo (fases, actividades y tareas) si el proyecto tiene fechas.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {project?.start_date && project?.planned_end_date && (
                <Button
                  onClick={generateActivatePlanFromTemplate}
                  disabled={generatingPlan}
                >
                  {generatingPlan ? "Generando…" : "Generar plan desde plantilla"}
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={generateDefaultPhases}
                disabled={generatingPhases}
              >
                {generatingPhases ? "Generando…" : "Generar solo fases"}
              </Button>
              <Link href={`/projects/${projectId}`}>
                <Button variant="secondary">Ir al dashboard del proyecto</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-slate-200 bg-slate-50/50">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Plan visual
              </CardTitle>
              <p className="text-sm text-slate-600 mt-0.5">Vista rápida por fases</p>
            </CardHeader>
            <CardContent>
              <ProjectGanttPro
                phases={phases.map((p) => ({
                  id: p.id,
                  name: p.name,
                  start_date: p.start_date,
                  end_date: p.end_date,
                  sort_order: p.sort_order ?? 0,
                  phase_key: p.phase_key ?? null,
                }))}
                projectStart={ganttProjectStart}
                projectEnd={ganttProjectEnd}
                title="Vista rápida por fases"
                showLegend={false}
                height={280}
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-slate-200 bg-slate-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Fases del proyecto
                </CardTitle>
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
                  <Button
                    onClick={handleSaveAll}
                    disabled={savingAll}
                  >
                    {savingAll ? "Guardando…" : "Guardar planificación"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
            <div className="overflow-x-auto min-w-0">
              <table className="w-full text-left min-w-[520px]">
                <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 shadow-sm">
                  <tr>
                    <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 w-20 whitespace-nowrap">
                      Orden
                    </th>
                    <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 min-w-[180px]">
                      Nombre
                    </th>
                    <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 w-36">
                      Inicio
                    </th>
                    <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 w-36">
                      Fin
                    </th>
                    <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 w-24 text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>
              <tbody>
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
            </CardContent>
        </Card>
        </>
        )}
    </PageShell>
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

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
      <td className="px-4 py-2 align-middle">
        <div className="flex items-center gap-1">
          <div className="inline-flex flex-col rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => onMove(index, "up")}
              disabled={index === 0}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              aria-label="Subir"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onMove(index, "down")}
              disabled={index === total - 1}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              aria-label="Bajar"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="text-xs font-medium text-slate-600 tabular-nums">{phase.sort_order}</span>
        </div>
      </td>
      <td className="px-4 py-2 align-middle">
        <input
          type="text"
          value={name}
          onChange={(e) => onPhaseNameChange(phase.id, e.target.value)}
          className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </td>
      <td className="px-4 py-2 align-middle">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onPhaseDateChange(phase.id, "start_date", e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </td>
      <td className="px-4 py-2 align-middle">
        <input
          type="date"
          value={endDate}
          onChange={(e) => onPhaseDateChange(phase.id, "end_date", e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </td>
      <td className="px-4 py-2 align-middle text-right">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </td>
    </tr>
  );
}
