"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";
import { useProjectWorkspace } from "@/components/projects/ProjectWorkspaceContext";
import type { ProjectMemoryRow } from "@/lib/services/projectService";

const MEMORY_TYPE_LABELS: Record<string, string> = {
  problem: "Problemas resueltos",
  solution: "Soluciones aplicadas",
  lesson: "Lecciones aprendidas",
  decision: "Decisiones tomadas",
  workaround: "Workarounds",
  configuration: "Conocimiento de configuración",
};

const SECTION_ORDER = ["problem", "solution", "workaround", "decision", "lesson", "configuration"];

const SAPITO_BRAIN_SUGGESTIONS = [
  "What problems have we solved in this project?",
  "What lessons should we remember from this project?",
  "What decisions have we made in this project?",
  "Summarize the most important project knowledge.",
];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function ProjectBrainPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";
  const { openProjectCopilotWithMessage } = useProjectWorkspace();

  const [memories, setMemories] = useState<ProjectMemoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadBrain = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/brain`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg((data as { error?: string }).error ?? "Error al cargar el Project Brain.");
        setMemories([]);
        return;
      }
      const list = (data as { memories?: ProjectMemoryRow[] }).memories ?? [];
      setMemories(list);
    } catch {
      setErrorMsg("Error de conexión.");
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadBrain();
  }, [loadBrain]);

  const grouped = useMemo(() => {
    const byType: Record<string, ProjectMemoryRow[]> = {};
    for (const m of memories) {
      const t = m.memory_type?.toLowerCase() ?? "solution";
      if (!byType[t]) byType[t] = [];
      byType[t].push(m);
    }
    const sections: { type: string; label: string; items: ProjectMemoryRow[] }[] = [];
    for (const type of SECTION_ORDER) {
      const items = byType[type] ?? [];
      if (items.length === 0) continue;
      sections.push({
        type,
        label: MEMORY_TYPE_LABELS[type] ?? type,
        items,
      });
    }
    const rest = Object.keys(byType).filter((k) => !SECTION_ORDER.includes(k));
    for (const type of rest) {
      sections.push({
        type,
        label: MEMORY_TYPE_LABELS[type] ?? type,
        items: byType[type] ?? [],
      });
    }
    return sections;
  }, [memories]);

  const stats = useMemo(() => {
    const norm = (m: ProjectMemoryRow) => (m.memory_type ?? "").toLowerCase();
    const problem = memories.filter((m) => norm(m) === "problem").length;
    const solution = memories.filter((m) => norm(m) === "solution").length;
    const lesson = memories.filter((m) => norm(m) === "lesson").length;
    const decision = memories.filter((m) => norm(m) === "decision").length;
    const workaround = memories.filter((m) => norm(m) === "workaround").length;
    const configuration = memories.filter((m) => norm(m) === "configuration").length;
    return {
      problem,
      solution,
      lesson,
      decision,
      workaround,
      configuration,
      total: memories.length,
    };
  }, [memories]);

  const lastUpdated = useMemo(() => {
    if (memories.length === 0) return null;
    const dates = memories.map((m) => m.created_at).filter(Boolean) as string[];
    if (dates.length === 0) return null;
    const latest = dates.reduce((a, b) => (a > b ? a : b));
    return formatShortDate(latest);
  }, [memories]);

  const insights = useMemo(() => {
    const lines: string[] = [];
    if (stats.problem > 0) {
      lines.push(
        stats.problem === 1
          ? "Se ha documentado al menos 1 problema resuelto en este proyecto."
          : `Se han documentado ${stats.problem} problemas resueltos en este proyecto.`
      );
    }
    if (stats.solution > 0) {
      lines.push("Ya existe memoria de soluciones aplicadas.");
    }
    if (stats.lesson > 0) {
      lines.push("Las lecciones aprendidas ya están quedando registradas.");
    }
    if (stats.decision > 0) {
      lines.push(
        stats.decision === 1
          ? "Hay al menos 1 decisión documentada."
          : `Hay ${stats.decision} decisiones documentadas.`
      );
    }
    if (stats.decision === 0 && stats.total > 0) {
      lines.push("Todavía no hay decisiones documentadas.");
    }
    if (stats.workaround > 0) {
      lines.push(`Se han registrado ${stats.workaround} workaround(s).`);
    }
    if (stats.configuration > 0) {
      lines.push("Hay conocimiento de configuración documentado.");
    }
    return lines.slice(0, 4);
  }, [stats]);

  if (!projectId) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-slate-600">Identificador de proyecto no válido.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProjectPageHeader
        variant="section"
        title="Project Brain"
        subtitle="Resumen del conocimiento aprendido por el proyecto a partir de las notas: problemas resueltos, soluciones aplicadas, lecciones y decisiones."
      />
      {!loading && lastUpdated && (
        <p className="text-xs text-slate-500 -mt-2">Última actualización: {lastUpdated}</p>
      )}

      {/* Ask Sapito quick actions */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3">
        <p className="text-xs font-medium text-slate-600 mb-2">Preguntar a Sapito</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Sugerencias de consulta">
          {SAPITO_BRAIN_SUGGESTIONS.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => openProjectCopilotWithMessage(text)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors"
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-6 py-10 text-sm text-slate-500">
          Cargando…
        </div>
      ) : memories.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-700">Aún no hay memoria en el Project Brain</p>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            El Project Brain se irá llenando automáticamente cuando documentes en las notas del proyecto problemas, soluciones, decisiones o lecciones aprendidas.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Crea notas en la pestaña Notas del proyecto para que el sistema extraiga y muestre aquí el conocimiento.
          </p>
          <p className="mt-3 text-xs text-slate-400">
            El Brain será más útil a medida que añadas más notas al proyecto.
          </p>
        </div>
      ) : (
        <>
          {/* Stats row: only chips for groups that exist */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 font-medium">
              {stats.total} {stats.total === 1 ? "conocimiento" : "conocimientos"}
            </span>
            {stats.problem > 0 && (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">
                {stats.problem} {stats.problem === 1 ? "problema" : "problemas"}
              </span>
            )}
            {stats.solution > 0 && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">
                {stats.solution} {stats.solution === 1 ? "solución" : "soluciones"}
              </span>
            )}
            {stats.lesson > 0 && (
              <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-800">
                {stats.lesson} {stats.lesson === 1 ? "lección" : "lecciones"}
              </span>
            )}
            {stats.decision > 0 && (
              <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-800">
                {stats.decision} {stats.decision === 1 ? "decisión" : "decisiones"}
              </span>
            )}
            {stats.workaround > 0 && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                {stats.workaround} workaround{stats.workaround !== 1 ? "s" : ""}
              </span>
            )}
            {stats.configuration > 0 && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                configuración
              </span>
            )}
          </div>

          {/* AI Insights: deterministic summary from counts/types */}
          {insights.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 shadow-sm px-4 py-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Insights del proyecto</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                {insights.map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {grouped.map((section) => (
            <section
              key={section.type}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
            >
              <h2 className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-800">
                {section.label}
              </h2>
              <ul className="divide-y divide-slate-100">
                {section.items.map((item) => (
                  <li key={item.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {item.title?.trim() && (
                          <p className="font-medium text-slate-900">{item.title}</p>
                        )}
                        <p className={`text-sm text-slate-600 ${item.title?.trim() ? "mt-0.5" : ""}`}>
                          {item.summary || "—"}
                        </p>
                        <p className="mt-1.5 text-xs text-slate-400">
                          {item.created_at ? formatDate(item.created_at) : ""}
                          {item.source_type ? (
                            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
                              {item.source_type}
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
