"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Play, Plus, Trash2 } from "lucide-react";
import type { TestCycleDetailResponse, TestCycleDetailScriptRow } from "@/lib/types/testing";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";
import { RunExecutionModal } from "@/components/testing/RunExecutionModal";
import { TestCycleDrawer } from "@/components/testing/TestCycleDrawer";
import {
  PROJECT_WORKSPACE_PAGE,
  PROJECT_WORKSPACE_CARD,
  PROJECT_WORKSPACE_HERO,
} from "@/lib/projectWorkspaceUi";

function formatShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function resultBadgeClass(result: string | null): string {
  if (!result) return "rb-badge-neutral";
  if (result === "passed") return "rb-badge-success";
  if (result === "failed") return "rb-badge-error";
  if (result === "blocked") return "rb-badge-warning";
  return "rb-badge-neutral";
}

export default function ProjectTestCycleDetailPage() {
  const t = useTranslations("testing");
  const params = useParams<{ id: string; cycleId: string }>();
  const projectId = (params?.id ?? "") as string;
  const cycleId = (params?.cycleId ?? "") as string;

  const [data, setData] = useState<TestCycleDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [runScript, setRunScript] = useState<TestCycleDetailScriptRow | null>(null);

  const load = useCallback(async () => {
    if (!projectId || !cycleId) return;
    setLoading(true);
    setError(null);
    try {
      const [cRes, pRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/testing/cycles/${cycleId}`, { credentials: "include" }),
        fetch(`/api/projects/${projectId}/permissions`, { credentials: "include" }),
      ]);
      const pData = await pRes.json().catch(() => ({}));
      setCanEdit(pRes.ok && pData.canEdit === true);
      const json = await cRes.json().catch(() => ({}));
      if (!cRes.ok) throw new Error(typeof json.error === "string" ? json.error : t("cycle.loadFailed"));
      setData(json as TestCycleDetailResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("cycle.loadFailed"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, cycleId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const cycle = data?.cycle;
  const scripts = data?.scripts ?? [];
  const k = data?.kpis;

  const cycleName = cycle?.name ?? t("cycle.titleFallback");

  const cycleLabel = useMemo(() => {
    const st = cycle?.status ?? "draft";
    if (st === "ready") return t("cycle.status.ready");
    if (st === "in_progress") return t("cycle.status.in_progress");
    if (st === "blocked") return t("cycle.status.blocked");
    if (st === "completed") return t("cycle.status.completed");
    if (st === "archived") return t("cycle.status.archived");
    return t("cycle.status.draft");
  }, [cycle?.status, t]);

  const removeFromCycle = async (scriptId: string) => {
    if (!canEdit) return;
    await fetch(`/api/projects/${projectId}/testing/cycles/${cycleId}/scripts/${scriptId}`, {
      method: "DELETE",
      credentials: "include",
    });
    void load();
  };

  const addScripts = async (scriptIds: string[]) => {
    if (!canEdit) return;
    const res = await fetch(`/api/projects/${projectId}/testing/cycles/${cycleId}/scripts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ script_ids: scriptIds }),
    });
    if (res.ok) {
      setAddOpen(false);
      void load();
    }
  };

  const [allScripts, setAllScripts] = useState<Array<{ id: string; title: string }>>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!addOpen) return;
    void (async () => {
      const res = await fetch(`/api/projects/${projectId}/testing/scripts`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const rows = Array.isArray(json.scripts) ? (json.scripts as Array<{ id: string; title: string }>) : [];
      setAllScripts(rows.map((r) => ({ id: r.id, title: r.title })));
      const inCycle = new Set((data?.scripts ?? []).map((s) => s.id));
      const init: Record<string, boolean> = {};
      for (const r of rows) init[r.id] = inCycle.has(r.id);
      setSelected(init);
    })();
  }, [addOpen, projectId, data?.scripts]);

  if (loading) {
    return (
      <div className={PROJECT_WORKSPACE_PAGE}>
        <p className="text-sm text-slate-500">{t("page.loading")}</p>
      </div>
    );
  }

  if (error || !data || !cycle) {
    return (
      <div className={PROJECT_WORKSPACE_PAGE}>
        <p className="text-sm text-red-600">{error ?? t("cycle.loadFailed")}</p>
        <Link
          href={`/projects/${projectId}/testing`}
          className="mt-4 inline-flex text-sm font-medium text-[rgb(var(--rb-brand-primary-active))]"
        >
          ← {t("detail.backToList")}
        </Link>
      </div>
    );
  }

  return (
    <div className={PROJECT_WORKSPACE_PAGE}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href={`/projects/${projectId}/testing`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("detail.backToList")}
        </Link>
      </div>

      <ProjectPageHeader
        title={cycleName}
        subtitle={`${cycleLabel}${cycle.owner_display ? ` · ${cycle.owner_display}` : ""}`}
        secondaryActionSlot={
          canEdit ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                {t("cycle.edit")}
              </button>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" aria-hidden />
                {t("cycle.addScripts")}
              </button>
            </div>
          ) : undefined
        }
      />

      <div className={`${PROJECT_WORKSPACE_HERO} grid gap-4 sm:grid-cols-2 lg:grid-cols-4`}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("cycle.kpi.scripts")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{k?.scripts ?? 0}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("cycle.kpi.executed")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{k?.executed ?? 0}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("cycle.kpi.passed")}</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{k?.passed ?? 0}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("cycle.kpi.failed")}</p>
          <p className="mt-1 text-2xl font-semibold text-red-700">{k?.failed ?? 0}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("cycle.kpi.blocked")}</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">{k?.blocked ?? 0}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("cycle.kpi.notRun")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{k?.not_run ?? 0}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("cycle.kpi.openDefects")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{k?.open_defects ?? 0}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("cycle.kpi.evidence")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{k?.evidence_coverage_pct ?? 0}%</p>
        </div>
      </div>

      <div className={PROJECT_WORKSPACE_CARD}>
        {scripts.length === 0 ? (
          <p className="text-sm text-slate-500">{t("cycle.emptyScripts")}</p>
        ) : (
          <ul className="space-y-2">
            {scripts.map((s) => (
              <li
                key={s.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-3 shadow-sm sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <Link
                    href={`/projects/${projectId}/testing/${s.id}`}
                    className="block font-semibold text-slate-900 hover:underline"
                  >
                    {s.title}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    {t("readiness.label")}: {t(`readiness.${s.readiness_bucket}`)} ·{" "}
                    {t("cycle.latest")}:{" "}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${resultBadgeClass(s.latest_cycle_result)}`}>
                      {s.latest_cycle_result ? t(`result.${s.latest_cycle_result}`) : t("executionSummary.neverRun")}
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {t("cycle.lastExecuted")}: {formatShort(s.latest_cycle_executed_at)} · {t("cycle.evidenceCount", { count: s.evidence_count_latest_cycle })} ·{" "}
                    {t("cycle.defectCount", { count: s.defect_count_cycle })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRunScript(s);
                      setRunOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-[rgb(var(--rb-brand-primary))] px-3 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
                  >
                    <Play className="h-4 w-4" aria-hidden />
                    {t("run.cta")}
                  </button>
                  {canEdit ? (
                    <button
                      type="button"
                    onClick={() => void removeFromCycle(s.id)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      {t("cycle.remove")}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {runScript ? (
        <RunExecutionModal
          projectId={projectId}
          scriptId={runScript.id}
          scriptTitle={runScript.title || "Test"}
          cyclesForScript={[{ id: cycleId, name: cycleName }]}
          defaultCycleId={cycleId}
          open={runOpen}
          onClose={() => {
            setRunOpen(false);
            setRunScript(null);
          }}
          onRecorded={() => {
            void load();
          }}
        />
      ) : null}

      <TestCycleDrawer
        projectId={projectId}
        cycleId={cycleId}
        open={editOpen}
        canEdit={canEdit}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          void load();
        }}
      />

      {addOpen ? (
        <>
          <div className="fixed inset-0 z-[60] bg-slate-900/45 backdrop-blur-[2px]" onClick={() => setAddOpen(false)} aria-hidden />
          <div
            className="fixed left-1/2 top-1/2 z-[70] w-[min(100%,34rem)] max-h-[min(100vh-2rem,46rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xl ring-1 ring-slate-100"
            role="dialog"
            aria-modal="true"
          >
            <h2 className="text-lg font-semibold text-slate-900">{t("cycle.addScriptsTitle")}</h2>
            <p className="mt-1 text-xs text-slate-500">{t("cycle.addScriptsHint")}</p>
            <div className="mt-4 space-y-2">
              {allScripts.map((s) => (
                <label key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-2">
                  <span className="min-w-0 truncate text-sm text-slate-800">{s.title}</span>
                  <input
                    type="checkbox"
                    checked={selected[s.id] === true}
                    onChange={(e) => setSelected((m) => ({ ...m, [s.id]: e.target.checked }))}
                    className="h-4 w-4"
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  const ids = Object.entries(selected)
                    .filter(([, v]) => v)
                    .map(([k2]) => k2);
                  void addScripts(ids);
                }}
                className="inline-flex items-center justify-center rounded-xl bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95"
              >
                {t("cycle.addSelected")}
              </button>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                {t("run.cancel")}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

