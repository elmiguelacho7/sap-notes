"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { TestScriptActivityRow, TestScriptStepRow, TestScriptWithSteps } from "@/lib/types/testing";
import { labelForSapTestModule } from "@/lib/testing/sapModuleCatalog";

function chipClass(tone: "neutral" | "brand" | "warn"): string {
  const base =
    "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-medium truncate";
  if (tone === "brand") return `${base} border-[rgb(var(--rb-brand-primary))]/25 bg-[rgb(var(--rb-brand-primary))]/8 text-[rgb(var(--rb-text-primary))]`;
  if (tone === "warn") return `${base} border-amber-200/90 bg-amber-50/90 text-amber-950`;
  return `${base} border-slate-200/90 bg-white text-slate-600`;
}

export type TestProcedureViewerProps = {
  script: TestScriptWithSteps;
};

export function TestProcedureViewer({ script }: TestProcedureViewerProps) {
  const t = useTranslations("testing");

  const { scenarioGroups, ungroupedSteps } = useMemo(() => {
    const activities = script.activities ?? [];
    const steps = script.steps ?? [];
    const byScenario = new Map<string, TestScriptActivityRow[]>();
    for (const a of activities) {
      const key = (a.scenario_name?.trim() || t("procedure.defaultScenario")) as string;
      if (!byScenario.has(key)) byScenario.set(key, []);
      byScenario.get(key)!.push(a);
    }
    for (const arr of Array.from(byScenario.values())) {
      arr.sort((x: TestScriptActivityRow, y: TestScriptActivityRow) => x.activity_order - y.activity_order);
    }
    const ungrouped = steps.filter((s) => !s.activity_id).sort((a, b) => a.step_order - b.step_order);
    return { scenarioGroups: byScenario, ungroupedSteps: ungrouped };
  }, [script.activities, script.steps, t]);

  const stepsByActivityId = useMemo(() => {
    const m = new Map<string, TestScriptStepRow[]>();
    for (const s of script.steps ?? []) {
      if (!s.activity_id) continue;
      if (!m.has(s.activity_id)) m.set(s.activity_id, []);
      m.get(s.activity_id)!.push(s);
    }
    for (const arr of Array.from(m.values())) {
      arr.sort((a: TestScriptStepRow, b: TestScriptStepRow) => a.step_order - b.step_order);
    }
    return m;
  }, [script.steps]);

  const hasHierarchy = (script.activities?.length ?? 0) > 0;

  if (!hasHierarchy && ungroupedSteps.length === 0) {
    return (
      <p className="text-sm text-[rgb(var(--rb-text-muted))]">{t("procedure.noSteps")}</p>
    );
  }

  return (
    <div className="space-y-6">
      {!hasHierarchy && ungroupedSteps.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("procedure.flatProcedure")}
          </h3>
          <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white p-3">
            {ungroupedSteps.map((st) => (
              <ActionRow key={st.id} step={st} />
            ))}
          </div>
        </section>
      )}

      {hasHierarchy &&
        Array.from(scenarioGroups.entries()).map(([scenario, acts]) => (
          <details
            key={scenario}
            open
            className="group rounded-xl border border-slate-200/80 bg-slate-50/40 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100/60">
              <span>{scenario}</span>
              <span className="text-xs font-normal text-slate-500">
                {acts.length} {t("procedure.activities")}
              </span>
            </summary>
            <div className="space-y-3 border-t border-slate-200/60 p-3 pt-3">
              {acts.map((act) => {
                const actSteps = stepsByActivityId.get(act.id) ?? [];
                return (
                  <article
                    key={act.id}
                    className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm"
                  >
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-slate-900">{act.activity_title}</h4>
                        {(act.activity_target_name || act.activity_target_url) && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            {act.activity_target_name}
                            {act.activity_target_name && act.activity_target_url ? " · " : ""}
                            {act.activity_target_url ? (
                              <span className="break-all text-[rgb(var(--rb-brand-primary-active))]">
                                {act.activity_target_url}
                              </span>
                            ) : null}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {act.business_role?.trim() ? (
                          <span className={chipClass("brand")}>{act.business_role}</span>
                        ) : null}
                      </div>
                    </div>
                    {actSteps.length === 0 ? (
                      <p className="text-xs text-slate-400">{t("procedure.noActions")}</p>
                    ) : (
                      <ul className="space-y-2 border-t border-slate-100 pt-2">
                        {actSteps.map((st) => (
                          <li key={st.id}>
                            <ActionRow step={st} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })}
            </div>
          </details>
        ))}

      {hasHierarchy && ungroupedSteps.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("procedure.ungrouped")}
          </h3>
          <div className="space-y-2 rounded-xl border border-dashed border-slate-200 bg-white p-3">
            {ungroupedSteps.map((st) => (
              <ActionRow key={st.id} step={st} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ActionRow({ step }: { step: TestScriptStepRow }) {
  const t = useTranslations("testing");
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {step.optional_flag ? <span className={chipClass("warn")}>{t("drawer.stepOptional")}</span> : null}
        {step.transaction_or_app?.trim() ? (
          <span className={chipClass("neutral")}>{step.transaction_or_app}</span>
        ) : null}
        {step.business_role?.trim() ? (
          <span className={chipClass("brand")}>{step.business_role}</span>
        ) : null}
      </div>
      {step.step_name?.trim() ? (
        <p className="mt-1 text-sm font-medium text-slate-800">{step.step_name}</p>
      ) : null}
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{step.instruction}</p>
      {step.expected_result?.trim() ? (
        <p className="mt-1.5 border-t border-slate-200/80 pt-1.5 text-xs text-slate-600">
          <span className="font-medium text-slate-500">{t("procedure.expected")}</span>{" "}
          {step.expected_result}
        </p>
      ) : null}
    </div>
  );
}

export function TestScriptHeaderSummary({ script }: { script: TestScriptWithSteps }) {
  const t = useTranslations("testing");
  const typeLabel = (ty: string) => {
    if (ty === "sit") return t("type.sit");
    if (ty === "regression") return t("type.regression");
    return t("type.uat");
  };
  const stLabel = (st: string) => {
    if (st === "ready") return t("status.ready");
    if (st === "archived") return t("status.archived");
    return t("status.draft");
  };
  const prLabel = (p: string | null) => {
    if (!p) return "—";
    if (p === "low") return t("priority.low");
    if (p === "medium") return t("priority.medium");
    if (p === "high") return t("priority.high");
    if (p === "critical") return t("priority.critical");
    return p;
  };
  const srcLabel = (s: string) => {
    if (s === "sap_docx") return t("source.sapDocx");
    if (s === "sap_xlsx") return t("source.sapXlsx");
    return t("source.manual");
  };

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <div>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{t("drawer.module")}</dt>
        <dd className="text-sm text-slate-900">{labelForSapTestModule(script.module) || "—"}</dd>
      </div>
      <div>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{t("drawer.priority")}</dt>
        <dd className="text-sm text-slate-900">{prLabel(script.priority)}</dd>
      </div>
      <div>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{t("drawer.testType")}</dt>
        <dd className="text-sm text-slate-900">{typeLabel(script.test_type)}</dd>
      </div>
      <div>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{t("drawer.status")}</dt>
        <dd className="text-sm text-slate-900">{stLabel(script.status)}</dd>
      </div>
      <div>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{t("import.scopeItem")}</dt>
        <dd className="text-sm text-slate-900">{script.scope_item_code?.trim() || "—"}</dd>
      </div>
      <div>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{t("drawer.sourceImportType")}</dt>
        <dd className="text-sm text-slate-900">{srcLabel(script.source_import_type)}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{t("import.sourceDoc")}</dt>
        <dd className="text-sm text-slate-900">{script.source_document_name?.trim() || "—"}</dd>
      </div>
      <div>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{t("import.sourceLang")}</dt>
        <dd className="text-sm text-slate-900">{script.source_language?.trim() || "—"}</dd>
      </div>
      <div>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{t("import.scenarioPath")}</dt>
        <dd className="text-sm text-slate-900">{script.scenario_path?.trim() || "—"}</dd>
      </div>
    </dl>
  );
}
