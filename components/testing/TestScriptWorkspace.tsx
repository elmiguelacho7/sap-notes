"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import type { TestExecutionRow, TestScriptWithSteps } from "@/lib/types/testing";
import { TestScriptDrawer } from "@/components/testing/TestScriptDrawer";
import { TestProcedureViewer, TestScriptHeaderSummary } from "@/components/testing/TestProcedureViewer";
import { RunExecutionModal } from "@/components/testing/RunExecutionModal";
import {
  PROJECT_WORKSPACE_PAGE,
  PROJECT_WORKSPACE_CARD,
} from "@/lib/projectWorkspaceUi";

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
  const [tab, setTab] = useState<Tab>("procedure");
  const [script, setScript] = useState<TestScriptWithSteps | null>(null);
  const [executions, setExecutions] = useState<TestExecutionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);

  const load = useCallback(async () => {
    if (!projectId || !scriptId) return;
    setLoading(true);
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
      setScript(sData as TestScriptWithSteps);

      const eData = await eRes.json().catch(() => ({}));
      if (eRes.ok && Array.isArray(eData.executions)) {
        setExecutions(eData.executions as TestExecutionRow[]);
      } else {
        setExecutions([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("page.errorLoad"));
      setScript(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, scriptId, t]);

  useEffect(() => {
    void load();
  }, [load]);

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

  if (loading) {
    return (
      <div className={PROJECT_WORKSPACE_PAGE}>
        <p className="text-sm text-slate-500">{t("page.loading")}</p>
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

      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">{script.title}</h1>
        {script.objective?.trim() ? (
          <p className="mt-1 text-sm text-slate-600">{script.objective}</p>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-slate-200/80 bg-slate-50/80 p-1">
        {tabBtn("overview", t("detail.tabOverview"))}
        {tabBtn("procedure", t("detail.tabProcedure"))}
        {tabBtn("executions", t("detail.tabExecutions"))}
        {canEdit ? tabBtn("edit", t("detail.tabEdit")) : null}
      </div>

      {tab === "overview" && (
        <div className={`${PROJECT_WORKSPACE_CARD} space-y-6`}>
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
        <div className={PROJECT_WORKSPACE_CARD}>
          <TestProcedureViewer script={script} />
        </div>
      )}

      {tab === "executions" && (
        <div className={`${PROJECT_WORKSPACE_CARD} space-y-3`}>
          {canEdit && (
            <button
              type="button"
              onClick={() => setRunOpen(true)}
              className="rounded-xl bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white"
            >
              {t("drawer.run")}
            </button>
          )}
          {executions.length === 0 ? (
            <p className="text-sm text-slate-500">{t("drawer.noHistory")}</p>
          ) : (
            <ul className="space-y-2">
              {executions.map((ex) => (
                <li
                  key={ex.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
                >
                  <span className="font-medium capitalize">
                    {ex.result === "passed"
                      ? t("result.passed")
                      : ex.result === "failed"
                        ? t("result.failed")
                        : ex.result === "blocked"
                          ? t("result.blocked")
                          : t("result.not_run")}
                  </span>
                  <span className="text-xs text-slate-500">{formatWhen(ex.executed_at)}</span>
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
          open={runOpen}
          onClose={() => setRunOpen(false)}
          onRecorded={() => {
            void load();
            setRunOpen(false);
          }}
        />
      )}
    </div>
  );
}
