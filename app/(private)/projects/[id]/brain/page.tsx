"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";
import { useProjectWorkspace } from "@/components/projects/ProjectWorkspaceContext";
import type { ProjectMemoryRow } from "@/lib/services/projectService";
import { supabase } from "@/lib/supabaseClient";

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
  const [canUseProjectAI, setCanUseProjectAI] = useState(false);

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

  // Permission for project-level Sapito (use_project_ai)
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`/api/projects/${projectId}/permissions`, { headers });
        if (cancelled) return;
        const data = await res.json().catch(() => ({}));
        const perms = data as { canUseProjectAI?: boolean };
        setCanUseProjectAI(perms.canUseProjectAI ?? false);
      } catch {
        if (!cancelled) setCanUseProjectAI(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

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
      <div className="w-full min-w-0 space-y-6">
        <p className="text-sm text-slate-400">Identificador de proyecto no válido.</p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <ProjectPageHeader
        variant="section"
        dark
        title="Cerebro del proyecto"
        subtitle="Conocimiento extraído de las notas: problemas resueltos, soluciones aplicadas, lecciones y decisiones."
      />
      {!loading && lastUpdated && (
        <p className="text-xs text-slate-500 -mt-2">Última actualización: {lastUpdated}</p>
      )}

      {/* Ask Sapito quick actions (visible only if user can use project AI) */}
      {canUseProjectAI && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-3">Preguntar a Sapito</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Sugerencias de consulta">
            {SAPITO_BRAIN_SUGGESTIONS.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => openProjectCopilotWithMessage(text)}
                className="rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:border-slate-500 transition-colors duration-150"
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-6 py-10 text-sm text-slate-500">
          Cargando…
        </div>
      ) : memories.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/30 py-12 px-6 text-center">
          <p className="text-base font-medium text-slate-200">Aún no hay memoria en el Cerebro del proyecto</p>
          <p className="mt-1.5 text-sm text-slate-500 max-w-md mx-auto">
            Se irá llenando cuando documentes en las notas problemas, soluciones, decisiones o lecciones aprendidas.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Crea notas en la pestaña Notas del proyecto para que el sistema extraiga y muestre aquí el conocimiento.
          </p>
        </div>
      ) : (
        <>
          {/* Stats row: only chips for groups that exist */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-slate-700/60 px-3 py-1.5 text-slate-300 font-medium">
              {stats.total} {stats.total === 1 ? "conocimiento" : "conocimientos"}
            </span>
            {stats.problem > 0 && (
              <span className="rounded-full bg-amber-500/20 px-3 py-1.5 text-amber-400">
                {stats.problem} {stats.problem === 1 ? "problema" : "problemas"}
              </span>
            )}
            {stats.solution > 0 && (
              <span className="rounded-full bg-emerald-500/20 px-3 py-1.5 text-emerald-400">
                {stats.solution} {stats.solution === 1 ? "solución" : "soluciones"}
              </span>
            )}
            {stats.lesson > 0 && (
              <span className="rounded-full bg-indigo-500/20 px-3 py-1.5 text-indigo-300">
                {stats.lesson} {stats.lesson === 1 ? "lección" : "lecciones"}
              </span>
            )}
            {stats.decision > 0 && (
              <span className="rounded-full bg-violet-500/20 px-3 py-1.5 text-violet-300">
                {stats.decision} {stats.decision === 1 ? "decisión" : "decisiones"}
              </span>
            )}
            {stats.workaround > 0 && (
              <span className="rounded-full bg-slate-700/60 px-3 py-1.5 text-slate-400">
                {stats.workaround} workaround{stats.workaround !== 1 ? "s" : ""}
              </span>
            )}
            {stats.configuration > 0 && (
              <span className="rounded-full bg-slate-700/60 px-3 py-1.5 text-slate-400">
                configuración
              </span>
            )}
          </div>

          {/* AI Insights */}
          {insights.length > 0 && (
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 sm:px-5 py-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Insights del proyecto</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-slate-400">
                {insights.map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {grouped.map((section) => (
            <section
              key={section.type}
              className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden"
            >
              <h2 className="border-b border-slate-700/60 bg-slate-800/50 px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                {section.label}
              </h2>
              <ul className="divide-y divide-slate-700/40">
                {section.items.map((item) => (
                  <li key={item.id} className="px-5 py-4 hover:bg-slate-800/50 transition-colors duration-150 cursor-pointer">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {item.title?.trim() && (
                          <p className="font-medium text-slate-100">{item.title}</p>
                        )}
                        <p className={`text-sm text-slate-400 ${item.title?.trim() ? "mt-0.5" : ""}`}>
                          {item.summary || "—"}
                        </p>
                        <p className="mt-1.5 text-xs text-slate-500">
                          {item.created_at ? formatDate(item.created_at) : ""}
                          {item.source_type ? (
                            <span className="ml-2 rounded-md bg-slate-700/60 px-1.5 py-0.5 text-slate-400">
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
