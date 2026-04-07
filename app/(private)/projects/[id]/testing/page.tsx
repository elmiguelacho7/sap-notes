"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarPlus, Download, FileUp, LayoutTemplate, Search } from "lucide-react";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";
import { SapScriptImportModal } from "@/components/testing/SapScriptImportModal";
import { TestScriptCardActions } from "@/components/testing/TestScriptCardActions";
import { TestScriptDrawer } from "@/components/testing/TestScriptDrawer";
import { TestCycleDrawer } from "@/components/testing/TestCycleDrawer";
import { labelForSapTestModule } from "@/lib/testing/sapModuleCatalog";
import type { TestCycleListItem, TestScriptListItem, TestScriptsListResponse } from "@/lib/types/testing";
import {
  PROJECT_WORKSPACE_PAGE,
  PROJECT_WORKSPACE_HERO,
  PROJECT_WORKSPACE_TOOLBAR,
  PROJECT_WORKSPACE_CARD,
  PROJECT_WORKSPACE_EMPTY,
  PROJECT_WORKSPACE_SEARCH_INPUT,
  PROJECT_WORKSPACE_FIELD,
} from "@/lib/projectWorkspaceUi";

function lastResultBadgeClass(result: string | null): string {
  if (!result) return "rb-badge-neutral";
  if (result === "passed") return "rb-badge-success";
  if (result === "failed") return "rb-badge-error";
  if (result === "blocked") return "rb-badge-warning";
  return "rb-badge-neutral";
}

function formatShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function readinessBadge(bucket: string): { cls: string; label: string } {
  if (bucket === "strong") return { cls: "rb-badge-success", label: "Strong" };
  if (bucket === "ready") return { cls: "rb-badge-success", label: "Ready" };
  if (bucket === "partially_ready") return { cls: "rb-badge-warning", label: "Partial" };
  return { cls: "rb-badge-neutral", label: "Not ready" };
}

export default function ProjectTestingPage() {
  const t = useTranslations("testing");
  const params = useParams<{ id: string }>();
  const projectId = (params?.id ?? "") as string;

  const [data, setData] = useState<TestScriptsListResponse | null>(null);
  const [cycles, setCycles] = useState<TestCycleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [importModal, setImportModal] = useState<null | "sap" | "structured">(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editScriptId, setEditScriptId] = useState<string | null>(null);
  const [cycleCreateOpen, setCycleCreateOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [scriptsRes, cyclesRes, permRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/testing/scripts`, { credentials: "include" }),
        fetch(`/api/projects/${projectId}/testing/cycles`, { credentials: "include" }),
        fetch(`/api/projects/${projectId}/permissions`, { credentials: "include" }),
      ]);
      const permData = await permRes.json().catch(() => ({}));
      setCanEdit(permRes.ok && permData.canEdit === true);

      const json = await scriptsRes.json().catch(() => ({}));
      if (!scriptsRes.ok) {
        setError(typeof json.error === "string" ? json.error : t("page.errorLoad"));
        setData(null);
        setCycles([]);
        return;
      }
      setData(json as TestScriptsListResponse);

      const cJson = await cyclesRes.json().catch(() => ({}));
      if (cyclesRes.ok && Array.isArray(cJson.cycles)) {
        setCycles(cJson.cycles as TestCycleListItem[]);
      } else {
        setCycles([]);
      }
    } catch {
      setError(t("page.errorLoad"));
      setData(null);
      setCycles([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const showToast = useCallback((message: string, variant: "success" | "error") => {
    setToast({ message, variant });
  }, []);

  const onScriptDeleted = useCallback(
    (scriptId: string) => {
      setData((d) => {
        if (!d) return d;
        return {
          ...d,
          scripts: d.scripts.filter((s) => s.id !== scriptId),
          stats: { ...d.stats, total: Math.max(0, d.stats.total - 1) },
        };
      });
      void load();
    },
    [load]
  );

  const filtered = useMemo(() => {
    const scripts = data?.scripts ?? [];
    const q = search.trim().toLowerCase();
    return scripts.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (!q) return true;
      const modLabel = labelForSapTestModule(s.module);
      return (
        (s.title ?? "").toLowerCase().includes(q) ||
        (s.module ?? "").toLowerCase().includes(q) ||
        modLabel.toLowerCase().includes(q) ||
        (s.objective ?? "").toLowerCase().includes(q)
      );
    });
  }, [data?.scripts, search, statusFilter]);

  const stats = data?.stats;

  const openCreate = () => {
    setCreateOpen(true);
  };

  const resultLabel = (r: string | null) => {
    if (!r) return t("list.neverRun");
    if (r === "passed") return t("result.passed");
    if (r === "failed") return t("result.failed");
    if (r === "blocked") return t("result.blocked");
    return t("result.not_run");
  };

  const typeLabel = (ty: string) => {
    if (ty === "sit") return t("type.sit");
    if (ty === "regression") return t("type.regression");
    return t("type.uat");
  };

  const statusLabel = (st: string) => {
    if (st === "ready") return t("status.ready_for_test");
    if (st === "ready_for_test") return t("status.ready_for_test");
    if (st === "in_review") return t("status.in_review");
    if (st === "approved") return t("status.approved");
    if (st === "obsolete") return t("status.obsolete");
    if (st === "archived") return t("status.archived");
    return t("status.draft");
  };

  const cycleStatusLabel = (st: string) => {
    if (st === "ready") return t("cycle.status.ready");
    if (st === "in_progress") return t("cycle.status.in_progress");
    if (st === "blocked") return t("cycle.status.blocked");
    if (st === "completed") return t("cycle.status.completed");
    if (st === "archived") return t("cycle.status.archived");
    return t("cycle.status.draft");
  };

  return (
    <div className={PROJECT_WORKSPACE_PAGE}>
      <ProjectPageHeader
        title={t("page.titleControl")}
        subtitle={t("page.subtitleControl")}
        secondaryActionSlot={
          canEdit ? (
            <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
              <a
                href={`/api/projects/${projectId}/testing/template`}
                download
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35"
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden />
                {t("page.downloadTemplate")}
              </a>
              <button
                type="button"
                onClick={() => setImportModal("structured")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-3 py-2.5 text-sm font-medium text-emerald-950 shadow-sm transition-colors hover:bg-emerald-100/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35"
              >
                <LayoutTemplate className="h-4 w-4 shrink-0" aria-hidden />
                <span>{t("page.importStructured")}</span>
                <span className="rounded-full bg-emerald-600/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                  {t("page.recommendedBadge")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setImportModal("sap")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35"
              >
                <FileUp className="h-4 w-4 shrink-0" aria-hidden />
                {t("page.importSap")}
              </button>
              <button
                type="button"
                onClick={() => setCycleCreateOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35"
              >
                <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden />
                {t("cycle.new")}
              </button>
            </div>
          ) : undefined
        }
        primaryActionLabel={canEdit ? t("page.newScript") : undefined}
        primaryActionOnClick={canEdit ? () => setCreateOpen(true) : undefined}
      />

      <div className={`${PROJECT_WORKSPACE_HERO} grid gap-4 sm:grid-cols-2 lg:grid-cols-4`}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("kpi.total")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{stats?.total ?? 0}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("kpi.ready")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{stats?.ready ?? 0}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("kpi.cycles")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{stats?.cycles_total ?? cycles.length ?? 0}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("kpi.scriptsInCycles")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{stats?.scripts_in_cycles_distinct ?? 0}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("kpi.executions")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{stats?.executions_total ?? 0}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("kpi.failedRuns")}</p>
          <p className="mt-1 text-2xl font-semibold text-red-700">{stats?.failed_runs_total ?? 0}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("kpi.openDefects")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{stats?.open_defects ?? 0}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("kpi.coverage")}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{stats?.coverage_pct ?? 0}%</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className={`${PROJECT_WORKSPACE_CARD} lg:col-span-2`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("cycle.sectionTitle")}</p>
              <p className="mt-0.5 text-sm text-slate-600">{t("cycle.sectionHint")}</p>
            </div>
            {canEdit ? (
              <button
                type="button"
                onClick={() => setCycleCreateOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[rgb(var(--rb-brand-primary))] px-3 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
              >
                <CalendarPlus className="h-4 w-4" aria-hidden />
                {t("cycle.new")}
              </button>
            ) : null}
          </div>
          {cycles.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">{t("cycle.empty")}</p>
          ) : (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {cycles.slice(0, 6).map((c) => {
                const total = c.script_count || 0;
                const done = c.passed + c.failed + c.blocked;
                const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
                return (
                  <li key={c.id} className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/projects/${projectId}/testing/cycles/${c.id}`}
                          className="block font-semibold text-slate-900 hover:underline"
                        >
                          {c.name}
                        </Link>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {cycleStatusLabel(c.status)} · {t("cycle.scriptsCount", { count: total })}
                          {c.owner_display ? ` · ${c.owner_display}` : ""}
                        </p>
                      </div>
                      <span className="rb-badge-neutral rounded-full px-2 py-1 text-[10px] font-semibold">
                        {pct}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-[rgb(var(--rb-brand-primary))]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
                      <span className="rb-badge-success rounded-full px-2 py-0.5 font-semibold">
                        {t("result.passed")}: {c.passed}
                      </span>
                      <span className="rb-badge-error rounded-full px-2 py-0.5 font-semibold">
                        {t("result.failed")}: {c.failed}
                      </span>
                      <span className="rb-badge-warning rounded-full px-2 py-0.5 font-semibold">
                        {t("result.blocked")}: {c.blocked}
                      </span>
                      {c.open_defects > 0 ? (
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 font-semibold">
                          {t("cycle.openDefectsShort", { count: c.open_defects })}
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className={PROJECT_WORKSPACE_CARD}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("insights.title")}</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li className="flex items-center justify-between gap-3">
              <span className="text-slate-600">{t("insights.neverExecuted")}</span>
              <span className="font-semibold text-slate-900">{stats?.never_executed ?? 0}</span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-slate-600">{t("insights.notInCycle")}</span>
              <span className="font-semibold text-slate-900">{stats?.not_in_cycle ?? 0}</span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-slate-600">{t("insights.noTraceability")}</span>
              <span className="font-semibold text-slate-900">{stats?.no_traceability ?? 0}</span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-slate-600">{t("insights.noEvidenceLatest")}</span>
              <span className="font-semibold text-slate-900">{stats?.no_evidence_on_latest ?? 0}</span>
            </li>
          </ul>
        </div>
      </div>

      <div className={`${PROJECT_WORKSPACE_TOOLBAR} flex flex-col gap-3 sm:flex-row sm:items-center`}>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("page.searchPlaceholder")}
            className={`${PROJECT_WORKSPACE_SEARCH_INPUT} pl-9`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={`${PROJECT_WORKSPACE_FIELD} sm:w-44`}
          aria-label={t("page.filterStatus")}
        >
          <option value="">{t("page.allStatuses")}</option>
          <option value="draft">{t("status.draft")}</option>
          <option value="ready_for_test">{t("status.ready_for_test")}</option>
          <option value="in_review">{t("status.in_review")}</option>
          <option value="approved">{t("status.approved")}</option>
          <option value="obsolete">{t("status.obsolete")}</option>
          <option value="archived">{t("status.archived")}</option>
        </select>
      </div>

      {loading ? (
        <div className={`${PROJECT_WORKSPACE_CARD} text-sm text-slate-500`}>{t("page.loading")}</div>
      ) : error ? (
        <div className={`${PROJECT_WORKSPACE_CARD} text-sm text-red-600`}>{error}</div>
      ) : filtered.length === 0 ? (
        <div className={PROJECT_WORKSPACE_EMPTY}>
          <p className="text-sm text-slate-600">{t("page.empty")}</p>
          {canEdit && (
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 rounded-xl bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white"
            >
              {t("page.newScript")}
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((s: TestScriptListItem) => (
            <li key={s.id}>
              <div
                className={`${PROJECT_WORKSPACE_CARD} flex flex-wrap items-stretch gap-3 transition-colors hover:border-slate-300/90`}
              >
                <Link
                  href={`/projects/${projectId}/testing/${s.id}`}
                  className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/25 focus-visible:ring-offset-2 rounded-xl"
                >
                  <p className="font-semibold text-slate-900">{s.title}</p>
                  {s.objective && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{s.objective}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium">
                      {typeLabel(s.test_type)}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                      {statusLabel(s.status)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${readinessBadge(s.readiness_bucket).cls}`}>
                      {t("readiness.label")}: {t(`readiness.${s.readiness_bucket}`)}
                    </span>
                    {s.module && (
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                        {labelForSapTestModule(s.module)}
                      </span>
                    )}
                    <span>
                      {t("list.steps", { count: s.step_count })} · {t("list.updated")}{" "}
                      {formatShort(s.updated_at)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    {s.execution_count > 0 ? (
                      <>
                        <span className="font-medium text-slate-700">
                          {t("list.runCount", { count: s.execution_count })}
                        </span>
                        {s.failed_execution_count > 0 ? (
                          <span className="text-red-600">
                            {" "}
                            · {t("list.failedCount", { count: s.failed_execution_count })}
                          </span>
                        ) : null}
                        {s.last_executed_by_display ? (
                          <span className="text-slate-400"> · {s.last_executed_by_display}</span>
                        ) : null}
                      </>
                    ) : (
                      <span>{t("list.neverRunDetail")}</span>
                    )}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                      {t("list.cycleCount", { count: s.cycle_count })}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                      {t("list.linkedCount", { count: s.linked_work_items_count })}
                    </span>
                    {Array.isArray(s.coverage_hints) && s.coverage_hints.slice(0, 3).map((h) => (
                      <span
                        key={h}
                        className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600"
                      >
                        {t(`hint.${h}`)}
                      </span>
                    ))}
                  </div>
                </Link>
                <div className="flex shrink-0 flex-col items-end justify-between gap-2 sm:flex-row sm:items-start">
                  <TestScriptCardActions
                    projectId={projectId}
                    script={s}
                    canEdit={canEdit}
                    detailHref={`/projects/${projectId}/testing/${s.id}`}
                    onEdit={() => setEditScriptId(s.id)}
                    onDeleted={onScriptDeleted}
                    onToast={showToast}
                  />
                  <div className="flex flex-col items-end gap-1 sm:items-end">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${lastResultBadgeClass(s.last_result)}`}
                    >
                      {s.last_result
                        ? `${t("list.lastRunShort")}: ${resultLabel(s.last_result)}`
                        : resultLabel(s.last_result)}
                    </span>
                    {s.last_executed_at && (
                      <span className="text-[11px] text-slate-500">
                        {formatShort(s.last_executed_at)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TestScriptDrawer
        projectId={projectId}
        scriptId={null}
        open={createOpen}
        canEdit={canEdit}
        onClose={() => setCreateOpen(false)}
        onSaved={() => {
          setCreateOpen(false);
          void load();
        }}
      />

      <TestScriptDrawer
        projectId={projectId}
        scriptId={editScriptId}
        open={editScriptId !== null}
        canEdit={canEdit}
        onClose={() => setEditScriptId(null)}
        onSaved={() => {
          setEditScriptId(null);
          void load();
        }}
      />

      {toast ? (
        <div
          className={`fixed bottom-6 left-1/2 z-40 max-w-md -translate-x-1/2 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ring-1 ${
            toast.variant === "success"
              ? "border-emerald-200/90 bg-emerald-50/95 text-emerald-950 ring-emerald-100"
              : "border-red-200/90 bg-red-50/95 text-red-950 ring-red-100"
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      ) : null}

      <SapScriptImportModal
        projectId={projectId}
        variant="structured"
        open={importModal === "structured"}
        onClose={() => setImportModal(null)}
        onSaved={() => {
          setImportModal(null);
          void load();
        }}
      />
      <SapScriptImportModal
        projectId={projectId}
        variant="sap"
        open={importModal === "sap"}
        onClose={() => setImportModal(null)}
        onSaved={() => {
          setImportModal(null);
          void load();
        }}
      />

      <TestCycleDrawer
        projectId={projectId}
        cycleId={null}
        open={cycleCreateOpen}
        canEdit={canEdit}
        onClose={() => setCycleCreateOpen(false)}
        onSaved={() => {
          setCycleCreateOpen(false);
          void load();
        }}
      />
    </div>
  );
}
