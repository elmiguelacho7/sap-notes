"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Play } from "lucide-react";
import type { TestExecutionRow, TestScriptWithViewerContext } from "@/lib/types/testing";
import { TestScriptDrawer } from "@/components/testing/TestScriptDrawer";
import { TestProcedureViewer, TestScriptHeaderSummary } from "@/components/testing/TestProcedureViewer";
import { RunExecutionModal } from "@/components/testing/RunExecutionModal";
import {
  PROJECT_WORKSPACE_PAGE,
  PROJECT_WORKSPACE_CARD,
} from "@/lib/projectWorkspaceUi";
import { isHeavyNarrativeBlock } from "@/lib/testing/procedurePresentation";

type Tab = "overview" | "procedure" | "executions" | "edit";

export type TestScriptWorkspaceProps = {
  projectId: string;
  scriptId: string;
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

export function TestScriptWorkspace({ projectId, scriptId }: TestScriptWorkspaceProps) {
  const t = useTranslations("testing");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("procedure");
  const [script, setScript] = useState<TestScriptWithViewerContext | null>(null);
  const [executions, setExecutions] = useState<TestExecutionRow[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);

  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!projectId || !scriptId) return;
    const first = !hasLoadedOnce.current;
    if (first) setInitialLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [sRes, eRes, pRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/testing/scripts/${scriptId}`, { credentials: "include" }),
        fetch(`/api/projects/${projectId}/testing/scripts/${scriptId}/executions?limit=40`, {
          credentials: "include",
        }),
        fetch(`/api/projects/${projectId}/permissions`, { credentials: "include" }),
      ]);
      const pData = await pRes.json().catch(() => ({}));
      setCanEdit(pRes.ok && pData.canEdit === true);

      const sData = await sRes.json().catch(() => ({}));
      if (!sRes.ok) {
        throw new Error(typeof sData.error === "string" ? sData.error : t("page.errorLoad"));
      }
      setScript(sData as TestScriptWithViewerContext);

      const eData = await eRes.json().catch(() => ({}));
      if (eRes.ok && Array.isArray(eData.executions)) {
        setExecutions(eData.executions as TestExecutionRow[]);
      } else {
        setExecutions([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("page.errorLoad"));
      if (first) setScript(null);
    } finally {
      hasLoadedOnce.current = true;
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [projectId, scriptId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams?.get("run") === "1") {
      setRunOpen(true);
      setTab("executions");
      router.replace(`/projects/${projectId}/testing/${scriptId}`, { scroll: false });
    }
  }, [searchParams, projectId, scriptId, router]);

  useEffect(() => {
    if (tab === "edit" && canEdit) {
      setDrawerOpen(true);
    }
  }, [tab, canEdit]);

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        tab === id
          ? "bg-[rgb(var(--rb-brand-primary))] text-white"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );

  if (initialLoading) {
    return (
      <div className={PROJECT_WORKSPACE_PAGE}>
        <div className="space-y-4">
          <div className="h-6 w-40 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-64 animate-pulse rounded bg-slate-100" />
          <div className={`${PROJECT_WORKSPACE_CARD} space-y-3`}>
            <div className="h-4 w-44 animate-pulse rounded bg-slate-100" />
            <div className="h-24 w-full animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !script) {
    return (
      <div className={PROJECT_WORKSPACE_PAGE}>
        <p className="text-sm text-red-600">{error ?? t("page.errorLoad")}</p>
        <Link
          href={`/projects/${projectId}/testing`}
          className="mt-4 inline-flex text-sm font-medium text-[rgb(var(--rb-brand-primary-active))]"
        >
          ← {t("detail.backToList")}
        </Link>
      </div>
    );
  }

  const ex = script.execution_summary;
  const tl = script.traceability_linked;

  const lastResultLabel =
    ex.last_result === "passed"
      ? t("result.passed")
      : ex.last_result === "failed"
        ? t("result.failed")
        : ex.last_result === "blocked"
          ? t("result.blocked")
          : ex.last_result === "not_run"
            ? t("result.not_run")
            : t("executionSummary.neverRun");

  const linkedRows = [
    {
      key: "task",
      label: t("linkedWork.task"),
      empty: t("linkedWork.noTask"),
      item: tl.task,
      href: tl.task ? `/projects/${projectId}/tasks?openTask=${tl.task.id}` : null,
    },
    {
      key: "ticket",
      label: t("linkedWork.ticket"),
      empty: t("linkedWork.noTicket"),
      item: tl.ticket,
      href: tl.ticket ? `/tickets/${tl.ticket.id}` : null,
    },
    {
      key: "page",
      label: t("linkedWork.knowledge"),
      empty: t("linkedWork.noKnowledge"),
      item: tl.knowledge_page,
      href: tl.knowledge_page ? `/knowledge/${tl.knowledge_page.id}` : null,
    },
  ] as const;

  const linkedWorkSection = (
    <section className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("linkedWork.title")}</h2>
      <ul className="mt-3 space-y-2">
        {linkedRows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-100 bg-white/90 px-3 py-2 text-sm">
            <span className="text-xs font-medium text-slate-500">{row.label}</span>
            {row.item && row.href ? (
              <Link href={row.href} className="max-w-[min(100%,20rem)] text-right">
                <span className="font-medium text-[rgb(var(--rb-brand-primary-active))] hover:underline">{row.item.title}</span>
                <span className="mt-0.5 flex flex-wrap justify-end gap-1">
                  {row.item.badge ? (
                    <span className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      {row.item.badge}
                    </span>
                  ) : null}
                </span>
                {row.item.meta ? <p className="text-[11px] text-slate-500">{row.item.meta}</p> : null}
              </Link>
            ) : (
              <span className="text-xs text-slate-400">{row.empty}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );

  const executionStrip = (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/85 bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <span>
          <span className="font-semibold text-slate-500">{t("executionSummary.last")}</span>{" "}
          <span className="font-medium text-slate-800">{lastResultLabel}</span>
        </span>
        <span>
          <span className="font-semibold text-slate-500">{t("executionSummary.when")}</span>{" "}
          {formatWhen(ex.last_executed_at)}
        </span>
        <span>
          <span className="font-semibold text-slate-500">{t("executionSummary.total")}</span> {ex.total_runs}
        </span>
        <span>
          <span className="font-semibold text-slate-500">{t("executionSummary.failed")}</span> {ex.failed_runs}
        </span>
        <span>
          <span className="font-semibold text-slate-500">{t("executionSummary.defects")}</span> {ex.defect_linked_count}
        </span>
        {ex.last_executed_by_display ? (
          <span>
            <span className="font-semibold text-slate-500">{t("executionSummary.by")}</span> {ex.last_executed_by_display}
          </span>
        ) : null}
      </div>
      {canEdit ? (
        <button
          type="button"
          onClick={() => {
            setTab("executions");
            setRunOpen(true);
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[rgb(var(--rb-brand-primary))] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
        >
          <Play className="h-4 w-4" aria-hidden />
          {t("run.cta")}
        </button>
      ) : null}
    </div>
  );

  return (
    <div className={PROJECT_WORKSPACE_PAGE}>
      {refreshing ? (
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[rgb(var(--rb-brand-primary))]" aria-hidden />
          {t("page.loading")}
        </div>
      ) : null}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href={`/projects/${projectId}/testing`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("detail.backToList")}
        </Link>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">{script.title}</h1>
          {(() => {
            const obj = script.objective?.trim() ?? "";
            if (!obj) return null;
            const long =
              obj.length > 160 || obj.split("\n").filter((l) => l.trim()).length > 5 || isHeavyNarrativeBlock(obj);
            if (tab === "overview" || !long) {
              return <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{obj}</p>;
            }
            return (
              <button
                type="button"
                onClick={() => setTab("overview")}
                className="mt-1 text-left text-sm text-[rgb(var(--rb-brand-primary-active))] hover:underline"
              >
                {t("detail.viewObjectiveOverview")}
              </button>
            );
          })()}
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setRunOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <Play className="h-4 w-4" aria-hidden />
            {t("run.cta")}
          </button>
        ) : null}
      </div>

      <div className="mb-3">{executionStrip}</div>

      <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-slate-200/80 bg-slate-50/80 p-1">
        {tabBtn("overview", t("detail.tabOverview"))}
        {tabBtn("procedure", t("detail.tabProcedure"))}
        {tabBtn("executions", t("detail.tabExecutions"))}
        {canEdit ? tabBtn("edit", t("detail.tabEdit")) : null}
      </div>

      {tab === "overview" && (
        <div className={`${PROJECT_WORKSPACE_CARD} space-y-6`}>
          {linkedWorkSection}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-800">{t("detail.headerSummary")}</h2>
            <TestScriptHeaderSummary script={script} />
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">{t("drawer.objective")}</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{script.objective?.trim() || "—"}</p>
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">{t("drawer.preconditions")}</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{script.preconditions?.trim() || "—"}</p>
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">{t("import.businessRoles")}</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {Array.isArray(script.business_roles) && script.business_roles.length
                ? (script.business_roles as string[]).join(", ")
                : "—"}
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">{t("drawer.testData")}</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{script.test_data?.trim() || "—"}</p>
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">{t("drawer.businessConditions")}</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {script.business_conditions?.trim() || "—"}
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-800">{t("drawer.expectedResult")}</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{script.expected_result?.trim() || "—"}</p>
          </section>
        </div>
      )}

      {tab === "procedure" && (
        <div className="space-y-4">
          {linkedWorkSection}
          <TestProcedureViewer script={script} projectId={projectId} canEdit={canEdit} />
        </div>
      )}

      {tab === "executions" && (
        <div className={`${PROJECT_WORKSPACE_CARD} space-y-4`}>
          {canEdit && (
            <button
              type="button"
              onClick={() => setRunOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white"
            >
              <Play className="h-4 w-4" aria-hidden />
              {t("run.cta")}
            </button>
          )}
          {executions.length === 0 ? (
            <p className="text-sm text-slate-500">{t("drawer.noHistory")}</p>
          ) : (
            <ul className="space-y-2">
              {executions.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium capitalize text-slate-800">
                      {row.result === "passed"
                        ? t("result.passed")
                        : row.result === "failed"
                          ? t("result.failed")
                          : row.result === "blocked"
                            ? t("result.blocked")
                            : t("result.not_run")}
                    </span>
                    {row.defect_ticket_id ? (
                      <Link
                        href={`/tickets/${row.defect_ticket_id}`}
                        className="text-xs font-medium text-[rgb(var(--rb-brand-primary-active))] hover:underline"
                      >
                        {t("executionRow.defectLinked")}
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-xs text-slate-500">
                    <span>{formatWhen(row.executed_at)}</span>
                    {row.executed_by_display ? <span>{row.executed_by_display}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "edit" && canEdit && (
        <p className="text-sm text-[rgb(var(--rb-text-muted))]">{t("detail.editHint")}</p>
      )}

      <TestScriptDrawer
        projectId={projectId}
        scriptId={scriptId}
        open={drawerOpen}
        canEdit={canEdit}
        onClose={() => {
          setDrawerOpen(false);
          if (tab === "edit") setTab("procedure");
        }}
        onSaved={() => {
          void load();
          setDrawerOpen(false);
          if (tab === "edit") setTab("procedure");
        }}
      />

      {canEdit && (
        <RunExecutionModal
          projectId={projectId}
          scriptId={scriptId}
          scriptTitle={script.title || "Test"}
          cyclesForScript={script.cycles_for_script}
          open={runOpen}
          onClose={() => setRunOpen(false)}
          onRecorded={() => {
            void load();
          }}
        />
      )}
    </div>
  );
}
