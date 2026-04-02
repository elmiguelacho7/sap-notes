"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";
import {
  PROJECT_WORKSPACE_PAGE,
  PROJECT_WORKSPACE_HERO,
  PROJECT_WORKSPACE_EMPTY,
  PROJECT_WORKSPACE_CARD_COMPACT,
  PROJECT_WORKSPACE_SECTION_STACK,
} from "@/lib/projectWorkspaceUi";
import { useProjectWorkspace } from "@/components/projects/ProjectWorkspaceContext";
import type { ProjectMemoryRow } from "@/lib/services/projectService";
import { supabase } from "@/lib/supabaseClient";

const SECTION_ORDER = ["problem", "solution", "workaround", "decision", "lesson", "configuration"];

function formatDate(iso: string, localeTag: string): string {
  try {
    return new Date(iso).toLocaleDateString(localeTag, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function formatShortDate(iso: string, localeTag: string): string {
  try {
    return new Date(iso).toLocaleDateString(localeTag, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function ProjectBrainPage() {
  const t = useTranslations("brain");
  const locale = useLocale();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";
  const { openProjectCopilotWithMessage } = useProjectWorkspace();

  const [memories, setMemories] = useState<ProjectMemoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [canUseProjectAI, setCanUseProjectAI] = useState(false);

  const memoryTypeLabels = useMemo(
    () => ({
      problem: t("groups.problem"),
      solution: t("groups.solution"),
      lesson: t("groups.lesson"),
      decision: t("groups.decision"),
      workaround: t("groups.workaround"),
      configuration: t("groups.configuration"),
    }),
    [t]
  );

  const sapitoBrainSuggestions = useMemo(
    () => [
      t("quickActions.problemSummary"),
      t("quickActions.lessonsSummary"),
      t("quickActions.decisionsSummary"),
      t("quickActions.knowledgeSummary"),
      t("quickActions.docsSummary"),
    ],
    [t]
  );

  const loadBrain = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/brain`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg((data as { error?: string }).error ?? t("errors.loadFailed"));
        setMemories([]);
        return;
      }
      const list = (data as { memories?: ProjectMemoryRow[] }).memories ?? [];
      setMemories(list);
    } catch {
      setErrorMsg(t("errors.connection"));
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

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
        label: memoryTypeLabels[type as keyof typeof memoryTypeLabels] ?? type,
        items,
      });
    }
    const rest = Object.keys(byType).filter((k) => !SECTION_ORDER.includes(k));
    for (const type of rest) {
      sections.push({
        type,
        label: memoryTypeLabels[type as keyof typeof memoryTypeLabels] ?? type,
        items: byType[type] ?? [],
      });
    }
    return sections;
  }, [memories, memoryTypeLabels]);

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
    return formatShortDate(latest, localeTag);
  }, [memories, localeTag]);

  const insights = useMemo(() => {
    const lines: string[] = [];
    if (stats.problem > 0) {
      lines.push(
        stats.problem === 1
          ? t("insights.problemOne")
          : t("insights.problemMany", { count: stats.problem })
      );
    }
    if (stats.solution > 0) {
      lines.push(t("insights.solution"));
    }
    if (stats.lesson > 0) {
      lines.push(t("insights.lesson"));
    }
    if (stats.decision > 0) {
      lines.push(
        stats.decision === 1
          ? t("insights.decisionOne")
          : t("insights.decisionMany", { count: stats.decision })
      );
    }
    if (stats.decision === 0 && stats.total > 0) {
      lines.push(t("insights.noDecision"));
    }
    if (stats.workaround > 0) {
      lines.push(t("insights.workaround", { count: stats.workaround }));
    }
    if (stats.configuration > 0) {
      lines.push(t("insights.configuration"));
    }
    return lines.slice(0, 4);
  }, [stats, t]);

  if (!projectId) {
    return (
      <div className={PROJECT_WORKSPACE_PAGE}>
        <p className="text-sm text-slate-500">{t("errors.invalidProjectId")}</p>
      </div>
    );
  }

  return (
    <div className={PROJECT_WORKSPACE_PAGE}>
      <div className={PROJECT_WORKSPACE_HERO}>
        <ProjectPageHeader
          variant="page"
          eyebrow={t("page.eyebrow")}
          title={t("page.title")}
          subtitle={t("page.subtitle")}
        />
      </div>
      {!loading && lastUpdated && (
        <p className="text-xs text-slate-500">{t("page.lastUpdated", { date: lastUpdated })}</p>
      )}

      {/* Ask Sapito quick actions (visible only if user can use project AI) */}
      {canUseProjectAI && (
          <div className={PROJECT_WORKSPACE_CARD_COMPACT}>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 mb-3">{t("page.askSapito")}</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("page.quickSuggestionsAria")}>
            {sapitoBrainSuggestions.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => openProjectCopilotWithMessage(text)}
                  className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-2 text-sm text-slate-700 hover:bg-white hover:border-slate-300 transition-colors duration-150 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/25"
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200/85 bg-white px-6 py-10 text-sm text-slate-500 shadow-sm ring-1 ring-slate-100">
          {t("states.loading")}
        </div>
      ) : memories.length === 0 ? (
        <div className={`${PROJECT_WORKSPACE_EMPTY} py-14`}>
          <p className="text-base font-semibold text-slate-900">{t("empty.title")}</p>
          <p className="mt-2 text-sm text-slate-600 max-w-lg leading-relaxed">
            {t("empty.description")}
          </p>
          <p className="mt-3 text-xs text-slate-500 max-w-md leading-relaxed">
            {t("empty.helper")}
          </p>
        </div>
      ) : (
        <div className={PROJECT_WORKSPACE_SECTION_STACK}>
          {/* Stats row: only chips for groups that exist */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-800 font-semibold ring-1 ring-slate-200/90">
              {t("chips.total", { count: stats.total })}
            </span>
            {stats.problem > 0 && (
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-900 font-medium ring-1 ring-amber-200/80">
                {t("chips.problem", { count: stats.problem })}
              </span>
            )}
            {stats.solution > 0 && (
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-900 font-medium ring-1 ring-emerald-200/80">
                {t("chips.solution", { count: stats.solution })}
              </span>
            )}
            {stats.lesson > 0 && (
              <span className="rounded-full bg-[rgb(var(--rb-brand-surface))] px-3 py-1.5 text-[rgb(var(--rb-brand-primary-active))] font-medium ring-1 ring-[rgb(var(--rb-brand-primary))]/18">
                {t("chips.lesson", { count: stats.lesson })}
              </span>
            )}
            {stats.decision > 0 && (
              <span className="rounded-full bg-violet-50 px-3 py-1.5 text-violet-900 font-medium ring-1 ring-violet-200/80">
                {t("chips.decision", { count: stats.decision })}
              </span>
            )}
            {stats.workaround > 0 && (
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 font-medium ring-1 ring-slate-200/90">
                {t("chips.workaround", { count: stats.workaround })}
              </span>
            )}
            {stats.configuration > 0 && (
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 font-medium ring-1 ring-slate-200/90">
                {t("chips.configuration")}
              </span>
            )}
          </div>

          {/* AI Insights */}
          {insights.length > 0 && (
            <div className="rounded-2xl border border-slate-200/85 bg-white px-4 sm:px-5 py-4 shadow-sm ring-1 ring-slate-100">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-2">{t("insights.title")}</h3>
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
              className="rounded-2xl border border-slate-200/85 bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100"
            >
              <h2 className="border-b border-slate-200/90 bg-slate-50/90 px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                {section.label}
              </h2>
              <ul className="divide-y divide-slate-100">
                {section.items.map((item) => (
                  <li key={item.id} className="px-5 py-4 hover:bg-slate-50/90 transition-colors duration-150 cursor-pointer">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {item.title?.trim() && (
                          <p className="font-medium text-slate-900">{item.title}</p>
                        )}
                        <p className={`text-sm text-slate-600 ${item.title?.trim() ? "mt-0.5" : ""}`}>
                          {item.summary || t("emDash")}
                        </p>
                        <p className="mt-1.5 text-xs text-slate-500">
                          {item.created_at ? formatDate(item.created_at, localeTag) : ""}
                          {item.source_type ? (
                            <span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600 ring-1 ring-slate-200/80">
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
        </div>
      )}
    </div>
  );
}
