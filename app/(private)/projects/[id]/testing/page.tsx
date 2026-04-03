"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";
import { TestScriptDrawer } from "@/components/testing/TestScriptDrawer";
import type { TestScriptListItem, TestScriptsListResponse } from "@/lib/types/testing";
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

export default function ProjectTestingPage() {
  const t = useTranslations("testing");
  const params = useParams<{ id: string }>();
  const projectId = (params?.id ?? "") as string;

  const [data, setData] = useState<TestScriptsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [scriptsRes, permRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/testing/scripts`, { credentials: "include" }),
        fetch(`/api/projects/${projectId}/permissions`, { credentials: "include" }),
      ]);
      const permData = await permRes.json().catch(() => ({}));
      setCanEdit(permRes.ok && permData.canEdit === true);

      const json = await scriptsRes.json().catch(() => ({}));
      if (!scriptsRes.ok) {
        setError(typeof json.error === "string" ? json.error : t("page.errorLoad"));
        setData(null);
        return;
      }
      setData(json as TestScriptsListResponse);
    } catch {
      setError(t("page.errorLoad"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const scripts = data?.scripts ?? [];
    const q = search.trim().toLowerCase();
    return scripts.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (s.title ?? "").toLowerCase().includes(q) ||
        (s.module ?? "").toLowerCase().includes(q) ||
        (s.objective ?? "").toLowerCase().includes(q)
      );
    });
  }, [data?.scripts, search, statusFilter]);

  const stats = data?.stats;

  const openCreate = () => {
    setSelectedScriptId(null);
    setDrawerOpen(true);
  };

  const openEdit = (id: string) => {
    setSelectedScriptId(id);
    setDrawerOpen(true);
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
    if (st === "ready") return t("status.ready");
    if (st === "archived") return t("status.archived");
    return t("status.draft");
  };

  return (
    <div className={PROJECT_WORKSPACE_PAGE}>
      <ProjectPageHeader
        title={t("page.title")}
        subtitle={t("page.subtitle")}
        primaryActionLabel={canEdit ? t("page.newScript") : undefined}
        primaryActionOnClick={canEdit ? openCreate : undefined}
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
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("kpi.failedLast")}</p>
          <p className="mt-1 text-2xl font-semibold text-red-700">{stats?.failedLastCount ?? 0}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("kpi.lastRun")}</p>
          <p className="mt-1 text-sm font-medium text-slate-800">{formatShort(stats?.lastExecutionAt)}</p>
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
          <option value="ready">{t("status.ready")}</option>
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
              <button
                type="button"
                onClick={() => openEdit(s.id)}
                className={`${PROJECT_WORKSPACE_CARD} w-full text-left transition-colors hover:border-slate-300/90`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{s.title}</p>
                    {s.objective && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{s.objective}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium">
                        {typeLabel(s.test_type)}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                        {statusLabel(s.status)}
                      </span>
                      {s.module && (
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">{s.module}</span>
                      )}
                      <span>
                        {t("list.steps", { count: s.step_count })} · {t("list.updated")}{" "}
                        {formatShort(s.updated_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${lastResultBadgeClass(s.last_result)}`}>
                      {resultLabel(s.last_result)}
                    </span>
                    {s.last_executed_at && (
                      <span className="text-[11px] text-slate-500">
                        {t("list.lastRun")}: {formatShort(s.last_executed_at)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <TestScriptDrawer
        projectId={projectId}
        scriptId={selectedScriptId}
        open={drawerOpen}
        canEdit={canEdit}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  );
}
