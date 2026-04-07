"use client";

import { memo, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, Copy } from "lucide-react";
import type {
  TestExecutionResult,
  TestScriptActivityRow,
  TestScriptStepRow,
  TestScriptWithSteps,
} from "@/lib/types/testing";
import { labelForSapTestModule } from "@/lib/testing/sapModuleCatalog";
import {
  collectAppsUsedFromSteps,
  extractActionLabel,
  groupStepsByAppMerged,
  type GroupStepsMergeOptions,
  inferAppGroupLabel,
  isHeavyNarrativeBlock,
  isLikelySapTcode,
  mergeReferenceNotesForViewer,
  parseTestDataKeyValues,
  previewProcedureText,
  splitContextForDisplay,
  splitInstructionAndNotes,
  stripImportedLabelNoise,
} from "@/lib/testing/procedurePresentation";
import { PROJECT_WORKSPACE_BANNER_INFO } from "@/lib/projectWorkspaceUi";

const SHELL_OUTER = "mx-auto w-full max-w-[1440px] px-6 py-6 lg:px-8";
const SHELL_INNER = "mx-auto w-full max-w-6xl";

function chipClass(tone: "neutral" | "brand" | "warn"): string {
  const base =
    "inline-flex max-w-[min(100%,18rem)] items-center rounded-full border px-2 py-0.5 text-[11px] font-medium";
  if (tone === "brand")
    return `${base} border-[rgb(var(--rb-brand-primary))]/25 bg-[rgb(var(--rb-brand-primary))]/8 text-[rgb(var(--rb-text-primary))]`;
  if (tone === "warn") return `${base} border-amber-200/90 bg-amber-50/90 text-amber-950`;
  return `${base} border-slate-200/80 bg-white text-slate-600`;
}

const ctxCardClass =
  "rounded-2xl border border-slate-200/85 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100";

function navSlug(s: string): string {
  const x = s.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return x || "scenario";
}

function formatUpdated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function CopyMini({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  if (!text.trim()) return null;
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        });
      }}
      className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30"
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function ContextBlock({
  title,
  helper,
  body,
  emptyLabel,
}: {
  title: string;
  helper: string;
  body: string | null | undefined;
  emptyLabel: string;
}) {
  const t = useTranslations("testing");
  const text = body?.trim() ?? "";
  if (!text) {
    return (
      <div className={ctxCardClass}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">{helper}</p>
        <p className="mt-2 text-xs text-slate-400">{emptyLabel}</p>
      </div>
    );
  }
  const heavy = isHeavyNarrativeBlock(text);
  const { lines, preferList } = splitContextForDisplay(text);
  const { preview, full, truncated } = previewProcedureText(text, heavy ? 160 : 280);

  const listBody =
    preferList && lines.length >= 2 ? (
      <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-snug text-slate-700">
        {lines.slice(0, 12).map((line, i) => (
          <li key={i} className="pl-0.5 marker:text-slate-300">
            {line}
          </li>
        ))}
        {lines.length > 12 ? <li className="list-none text-xs text-slate-400">…</li> : null}
      </ul>
    ) : null;

  return (
    <div className={ctxCardClass}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{helper}</p>
      {listBody && !truncated && !heavy ? (
        listBody
      ) : truncated || heavy ? (
        <details className="mt-2 group">
          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <span className="line-clamp-3 whitespace-pre-wrap text-sm leading-snug text-slate-700">{preview}</span>
            <span className="mt-1 block text-xs font-medium text-[rgb(var(--rb-brand-primary-active))] group-open:hidden">
              {truncated || heavy ? t("procedure.showFull") : ""}
            </span>
          </summary>
          <div className="mt-2 border-t border-slate-100 pt-2 text-sm leading-snug text-slate-700">
            {preferList && lines.length >= 2 ? (
              <ul className="list-inside list-disc space-y-1">
                {lines.map((line, i) => (
                  <li key={i} className="whitespace-pre-wrap pl-0.5 marker:text-slate-300">
                    {line}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="whitespace-pre-wrap">{full}</p>
            )}
          </div>
        </details>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-snug text-slate-700">{full}</p>
      )}
    </div>
  );
}

function AppGroupHeader({
  label,
  generalLabel,
  t,
}: {
  label: string;
  generalLabel: string;
  t: (key: string) => string;
}) {
  const mono = isLikelySapTcode(label);
  const isGeneral = label === generalLabel;
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-slate-100/90 pb-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("procedure.appGroup")}</span>
      {mono ? (
        <code className="rounded-md border border-slate-200/90 bg-slate-50 px-2 py-0.5 font-mono text-xs font-semibold text-slate-800">
          {label}
        </code>
      ) : (
        <span
          className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${
            isGeneral ? "border border-dashed border-slate-200/90 bg-slate-50/80 text-slate-600" : "bg-slate-100/90 text-slate-800"
          }`}
        >
          {label}
        </span>
      )}
    </div>
  );
}

type StepRowContext = {
  projectId?: string;
  scriptTitle?: string;
  canEdit?: boolean;
  outcomes: Record<string, TestExecutionResult>;
  onOutcomeChange: (stepId: string, value: TestExecutionResult) => void;
};

function ExecutionStepRow({
  step,
  displayIndex,
  generalAppLabel,
  hideAppChip = false,
  stepFallback,
  stepCtx,
  compact = false,
}: {
  step: TestScriptStepRow;
  displayIndex: number;
  generalAppLabel: string;
  hideAppChip?: boolean;
  stepFallback: string;
  stepCtx?: StepRowContext;
  /** Lighter DOM / density for large scripts */
  compact?: boolean;
}) {
  const t = useTranslations("testing");
  const action = extractActionLabel(step, stepFallback);
  const split = splitInstructionAndNotes(step.instruction ?? "");
  const instrRaw = split.instruction;
  const stepNotesRaw = split.notes?.trim() ?? "";
  const expRaw = stripImportedLabelNoise(step.expected_result?.trim() ?? "");
  const dataRaw = step.test_data_notes?.trim() ?? "";

  const instrP = previewProcedureText(instrRaw, 200);
  const notesP = stepNotesRaw ? previewProcedureText(stepNotesRaw, 160) : { full: "", preview: "", truncated: false };
  const expP = expRaw ? previewProcedureText(expRaw, 160) : { full: "", preview: "", truncated: false };
  const dataP = dataRaw ? previewProcedureText(dataRaw, 120) : { full: "", preview: "", truncated: false };

  const appLabel = step.transaction_or_app?.trim() || inferAppGroupLabel(step, generalAppLabel);
  const showAppChip = !hideAppChip && appLabel && appLabel !== generalAppLabel;

  const hasInstr = !!instrP.full;
  const hasNotes = !!notesP.full;
  const hasExp = !!expP.full;
  const hasData = !!dataP.full;

  const copyInstrFull = [instrRaw, stepNotesRaw].filter(Boolean).join("\n\n");

  const outcome = stepCtx?.outcomes[step.id] ?? "not_run";
  const defectHref =
    stepCtx?.projectId && stepCtx.canEdit
      ? `/projects/${stepCtx.projectId}/tickets/new?title=${encodeURIComponent(
          `[Testing] ${(stepCtx.scriptTitle ?? "Script").slice(0, 80)} — step ${displayIndex}`
        )}`
      : null;

  if (compact) {
    const previewInstr = stripImportedLabelNoise(instrRaw);
    const needExpand =
      instrP.truncated ||
      expP.truncated ||
      notesP.truncated ||
      dataP.truncated ||
      hasNotes ||
      (hasData && dataP.full.length > 120);

    return (
      <div className="group/step flex gap-1 border-b border-slate-100 py-2 last:border-b-0">
        {stepCtx ? (
          <div
            className="flex w-[3.75rem] shrink-0 flex-col gap-0.5 border-r border-slate-100/80 pr-1"
            title={t("procedure.stepOutcomeHint")}
          >
            <label className="sr-only" htmlFor={`step-outcome-c-${step.id}`}>
              {t("procedure.stepOutcomeLabel")}
            </label>
            <select
              id={`step-outcome-c-${step.id}`}
              value={outcome}
              onChange={(e) => stepCtx.onOutcomeChange(step.id, e.target.value as TestExecutionResult)}
              className="w-full rounded border border-slate-200/80 bg-white px-0.5 py-0.5 text-[9px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[rgb(var(--rb-brand-ring))]/35"
            >
              <option value="not_run">{t("procedure.stepOutcomeNotRun")}</option>
              <option value="passed">{t("procedure.stepOutcomePassed")}</option>
              <option value="failed">{t("procedure.stepOutcomeFailed")}</option>
              <option value="blocked">{t("procedure.stepOutcomeBlocked")}</option>
            </select>
            {defectHref ? (
              <Link
                href={defectHref}
                className="text-center text-[8px] font-semibold uppercase tracking-wide text-[rgb(var(--rb-brand-primary-active))] hover:underline"
              >
                {t("procedure.stepNewDefect")}
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="w-5 shrink-0 border-r border-slate-100/80" aria-hidden />
        )}
        <div className="min-w-0 flex-1 pr-1">
          <div className="flex items-start gap-2">
            <span className="inline-flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded-md bg-[rgb(var(--rb-brand-primary))]/10 px-1.5 text-[11px] font-bold tabular-nums text-[rgb(var(--rb-text-primary))]">
              {displayIndex}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-snug text-slate-900">{action}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                {step.optional_flag ? <span className={chipClass("warn")}>{t("drawer.stepOptional")}</span> : null}
                {showAppChip ? <span className={chipClass("neutral")}>{appLabel}</span> : null}
                {step.business_role?.trim() && (step.business_role?.length ?? 0) <= 48 ? (
                  <span className={chipClass("brand")}>{step.business_role}</span>
                ) : null}
              </div>
              {hasInstr ? (
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-snug text-slate-600">
                  {previewInstr}
                </p>
              ) : null}
              {hasExp ? (
                <p className="mt-0.5 line-clamp-1 whitespace-pre-wrap text-[11px] text-slate-500">{expRaw}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-0.5 self-start opacity-0 transition-opacity group-hover/step:opacity-100">
              {hasInstr || hasNotes ? <CopyMini text={copyInstrFull} label={t("procedure.copyInstruction")} /> : null}
              {hasExp ? <CopyMini text={expRaw} label={t("procedure.copyExpected")} /> : null}
            </div>
          </div>
          {needExpand ? (
            <details className="mt-1.5 text-xs">
              <summary className="cursor-pointer font-medium text-[rgb(var(--rb-brand-primary-active))] [&::-webkit-details-marker]:hidden">
                {t("procedure.expandStepRow")}
              </summary>
              <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 text-slate-700">
                {hasInstr ? <p className="whitespace-pre-wrap text-xs">{instrP.full}</p> : null}
                {hasData ? <p className="whitespace-pre-wrap text-[11px] text-slate-600">{dataP.full}</p> : null}
                {hasExp ? <p className="whitespace-pre-wrap text-[11px] text-slate-600">{expP.full}</p> : null}
                {hasNotes ? <p className="whitespace-pre-wrap text-[11px] text-slate-500">{notesP.full}</p> : null}
              </div>
            </details>
          ) : null}
          {!hasInstr && !hasExp && !hasData && !hasNotes ? (
            <p className="mt-1 text-[11px] text-slate-400">{t("procedure.stepMinimalHint")}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="group/step flex gap-1 rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] ring-1 ring-slate-100 transition-colors hover:border-slate-300/90 hover:bg-slate-50/50 hover:shadow-sm">
      {stepCtx ? (
        <div
          className="flex w-[4.5rem] shrink-0 flex-col items-stretch gap-1 rounded-l-xl border-r border-slate-100/80 bg-slate-50/40 px-1 py-1.5"
          title={t("procedure.stepOutcomeHint")}
        >
          <label className="sr-only" htmlFor={`step-outcome-${step.id}`}>
            {t("procedure.stepOutcomeLabel")}
          </label>
          <select
            id={`step-outcome-${step.id}`}
            value={outcome}
            onChange={(e) => stepCtx.onOutcomeChange(step.id, e.target.value as TestExecutionResult)}
            className="w-full rounded-md border border-slate-200/80 bg-white px-1 py-1 text-[10px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[rgb(var(--rb-brand-ring))]/35"
          >
            <option value="not_run">{t("procedure.stepOutcomeNotRun")}</option>
            <option value="passed">{t("procedure.stepOutcomePassed")}</option>
            <option value="failed">{t("procedure.stepOutcomeFailed")}</option>
            <option value="blocked">{t("procedure.stepOutcomeBlocked")}</option>
          </select>
          {defectHref ? (
            <div className="mt-auto flex flex-col gap-0.5 border-t border-slate-200/60 pt-1">
              <Link
                href={defectHref}
                className="text-center text-[9px] font-semibold uppercase tracking-wide text-[rgb(var(--rb-brand-primary-active))] hover:underline"
              >
                {t("procedure.stepNewDefect")}
              </Link>
              <Link
                href={`/projects/${stepCtx.projectId}/tickets`}
                className="text-center text-[9px] text-slate-500 hover:text-slate-800 hover:underline"
              >
                {t("procedure.stepLinkTicket")}
              </Link>
            </div>
          ) : (
            <p className="mt-auto px-0.5 text-center text-[8px] leading-tight text-slate-400">
              {t("procedure.stepActionsHint")}
            </p>
          )}
        </div>
      ) : (
        <div
          className="w-7 shrink-0 rounded-l-xl border-r border-slate-100/80 bg-slate-50/30"
          aria-hidden
          title={t("procedure.futureExecutionSlot")}
        />
      )}
      <div className="min-w-0 flex-1 py-2 pr-2">
        <div className="flex flex-wrap items-start gap-2">
          <span className="inline-flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--rb-brand-primary))]/10 px-2 text-xs font-bold tabular-nums text-[rgb(var(--rb-text-primary))]">
            {displayIndex}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("procedure.action")}</p>
            <p className="text-[13px] font-semibold leading-snug text-slate-900">{action}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {step.optional_flag ? <span className={chipClass("warn")}>{t("drawer.stepOptional")}</span> : null}
              {showAppChip ? <span className={chipClass("neutral")}>{appLabel}</span> : null}
              {step.business_role?.trim() ? <span className={chipClass("brand")}>{step.business_role}</span> : null}
            </div>
          </div>
          <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover/step:opacity-100">
            {hasInstr || hasNotes ? <CopyMini text={copyInstrFull} label={t("procedure.copyInstruction")} /> : null}
            {hasExp ? <CopyMini text={expRaw} label={t("procedure.copyExpected")} /> : null}
          </div>
        </div>

        {hasInstr ? (
          <div className="mt-2 border-t border-slate-100/90 pt-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("procedure.instruction")}</p>
            {instrP.truncated ? (
              <details className="group/int">
                <summary className="mt-0.5 cursor-pointer list-none text-sm leading-snug text-slate-700 [&::-webkit-details-marker]:hidden">
                  <span className="line-clamp-2 whitespace-pre-wrap">{instrP.preview}</span>
                  <span className="mt-0.5 block text-xs font-medium text-[rgb(var(--rb-brand-primary-active))] group-open/int:hidden">
                    {t("procedure.showFull")}
                  </span>
                </summary>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{instrP.full}</p>
              </details>
            ) : (
              <p className="mt-0.5 whitespace-pre-wrap text-sm leading-snug text-slate-700">{instrP.full}</p>
            )}
          </div>
        ) : null}

        {hasData ? (
          <div className="mt-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("procedure.inputData")}</p>
            {dataP.truncated ? (
              <details className="group/da">
                <summary className="mt-0.5 cursor-pointer list-none text-xs text-slate-600 [&::-webkit-details-marker]:hidden">
                  <span className="line-clamp-1">{dataP.preview}</span>
                  <span className="text-[rgb(var(--rb-brand-primary-active))] group-open/da:hidden">
                    {" "}
                    {t("procedure.showFull")}
                  </span>
                </summary>
                <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{dataP.full}</p>
              </details>
            ) : (
              <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-600">{dataP.full}</p>
            )}
          </div>
        ) : null}

        {hasExp ? (
          <div className="mt-2 rounded-lg border border-slate-100/90 bg-slate-50/50 px-2 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("procedure.expectedResult")}</p>
            {expP.truncated ? (
              <details className="group/ex">
                <summary className="mt-0.5 cursor-pointer list-none text-xs text-slate-600 [&::-webkit-details-marker]:hidden">
                  <span className="line-clamp-2 whitespace-pre-wrap">{expP.preview}</span>
                  <span className="text-[rgb(var(--rb-brand-primary-active))] group-open/ex:hidden">
                    {" "}
                    {t("procedure.showFull")}
                  </span>
                </summary>
                <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{expP.full}</p>
              </details>
            ) : (
              <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-600">{expP.full}</p>
            )}
          </div>
        ) : null}

        {hasNotes ? (
          <div className="mt-2 border-t border-dashed border-slate-200/80 pt-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("procedure.stepNotes")}</p>
            {notesP.truncated ? (
              <details className="group/sn">
                <summary className="mt-0.5 cursor-pointer list-none text-xs text-slate-500 [&::-webkit-details-marker]:hidden">
                  <span className="line-clamp-2 whitespace-pre-wrap">{notesP.preview}</span>
                  <span className="text-[rgb(var(--rb-brand-primary-active))] group-open/sn:hidden">
                    {" "}
                    {t("procedure.showFull")}
                  </span>
                </summary>
                <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{notesP.full}</p>
              </details>
            ) : (
              <p className="mt-0.5 whitespace-pre-wrap text-xs leading-snug text-slate-500">{notesP.full}</p>
            )}
          </div>
        ) : null}

        {!hasInstr && !hasExp && !hasData && !hasNotes ? (
          <p className="mt-2 text-xs text-slate-400">{t("procedure.stepMinimalHint")}</p>
        ) : null}
      </div>
    </div>
  );
}

type TestingT = (key: string) => string;

function TestDataSetupBlock({
  script,
  steps,
  emptyLabel,
}: {
  script: TestScriptWithSteps;
  steps: TestScriptStepRow[];
  emptyLabel: string;
}) {
  const t = useTranslations("testing");
  const pairs = useMemo(
    () =>
      parseTestDataKeyValues(
        script.test_data,
        ...steps.flatMap((s) => [s.test_data_notes, s.instruction, s.expected_result])
      ),
    [script.test_data, steps]
  );

  if (pairs.length >= 1) {
    const collapseTable = pairs.length > 10 || (script.test_data?.trim().length ?? 0) > 900;
    const fullTable = (
      <div className="overflow-x-auto rounded-xl border border-slate-100/90">
        <table className="w-full min-w-[280px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-2 py-1.5 font-semibold text-slate-500">{t("procedure.dataField")}</th>
              <th className="px-2 py-1.5 font-semibold text-slate-500">{t("procedure.dataValue")}</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((row, i) => (
              <tr key={`${row.field}-${i}`} className="border-b border-slate-50 last:border-0">
                <td className="px-2 py-1.5 align-top font-medium text-slate-700">{row.field}</td>
                <td className="px-2 py-1.5 align-top text-slate-600">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

    return (
      <div className={ctxCardClass}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("drawer.testData")}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{t("procedure.testDataParsedHint")}</p>
        {collapseTable ? (
          <details className="mt-2">
            <summary className="cursor-pointer list-none text-xs font-medium text-[rgb(var(--rb-brand-primary-active))] [&::-webkit-details-marker]:hidden">
              {t("procedure.testDataExpand", { count: pairs.length })}
            </summary>
            <div className="mt-2 border-t border-slate-100 pt-2">{fullTable}</div>
          </details>
        ) : (
          <div className="mt-2">{fullTable}</div>
        )}
      </div>
    );
  }

  return (
    <ContextBlock
      title={t("drawer.testData")}
      helper={t("procedure.testDataFallbackHint")}
      body={script.test_data}
      emptyLabel={emptyLabel}
    />
  );
}

function ActivityCard({
  act,
  actSteps,
  generalAppLabel,
  t,
  stepFallback,
  stepCtx,
  groupOpts,
  compactSteps,
  collapseActivity,
}: {
  act: TestScriptActivityRow;
  actSteps: TestScriptStepRow[];
  generalAppLabel: string;
  t: TestingT;
  stepFallback: string;
  stepCtx?: StepRowContext;
  groupOpts?: GroupStepsMergeOptions;
  compactSteps?: boolean;
  collapseActivity?: boolean;
}) {
  const appGroups = useMemo(
    () => groupStepsByAppMerged(actSteps, generalAppLabel, groupOpts),
    [actSteps, generalAppLabel, groupOpts]
  );

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100/90 pb-3">
      <div className="min-w-0">
        <h4 className="text-[15px] font-semibold tracking-tight text-slate-900">{act.activity_title}</h4>
        {act.activity_target_name?.trim() ? (
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-600">{act.activity_target_name}</p>
        ) : null}
        <p className="mt-1 text-[11px] text-slate-400">
          {actSteps.length} {t("procedure.stepsLower")}
          {act.activity_target_url ? (
            <>
              {" · "}
              <span className="break-all text-[rgb(var(--rb-brand-primary-active))]">{act.activity_target_url}</span>
            </>
          ) : null}
        </p>
      </div>
      {act.business_role?.trim() ? (
        <div className="flex flex-col items-end gap-0.5 text-right">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t("procedure.activityRole")}</span>
          <span className={chipClass("brand")}>{act.business_role}</span>
        </div>
      ) : null}
    </div>
  );

  const flow = (
    <>
      {actSteps.length === 0 ? (
        <p className="text-xs text-slate-400">{t("procedure.noActions")}</p>
      ) : (
        <div className={compactSteps ? "space-y-3" : "space-y-4"}>
          {appGroups.map((g) => (
            <div key={g.label}>
              <AppGroupHeader label={g.label} generalLabel={generalAppLabel} t={t} />
              <ul className={compactSteps ? "divide-y divide-slate-100 rounded-lg border border-slate-100/90 bg-white/80" : "space-y-2.5"}>
                {g.steps.map((st) => (
                  <li key={st.id} className={compactSteps ? "px-0" : ""}>
                    <ExecutionStepRow
                      step={st}
                      displayIndex={st.step_order}
                      generalAppLabel={generalAppLabel}
                      hideAppChip={g.label !== generalAppLabel}
                      stepFallback={stepFallback}
                      stepCtx={stepCtx}
                      compact={compactSteps}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const shellClass =
    "rounded-2xl border border-slate-200/85 bg-gradient-to-b from-white to-slate-50/20 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100";

  if (collapseActivity) {
    return (
      <details
        id={`activity-${act.id}`}
        className={`group/act ${shellClass} overflow-hidden [&_summary::-webkit-details-marker]:hidden`}
      >
        <summary className="cursor-pointer list-none px-3.5 py-3 transition-colors hover:bg-slate-50/60">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[15px] font-semibold tracking-tight text-slate-900">{act.activity_title}</span>
              <span className="mt-0.5 block text-[11px] text-slate-400">
                {actSteps.length} {t("procedure.stepsLower")}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open/act:-rotate-180" aria-hidden />
          </div>
        </summary>
        <div className="space-y-3 border-t border-slate-100/90 px-3.5 pb-3.5 pt-3">
          {act.activity_target_name?.trim() ? (
            <p className="text-xs leading-snug text-slate-600">{act.activity_target_name}</p>
          ) : null}
          {act.activity_target_url ? (
            <p className="break-all text-xs text-[rgb(var(--rb-brand-primary-active))]">{act.activity_target_url}</p>
          ) : null}
          {act.business_role?.trim() ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t("procedure.activityRole")}</span>
              <span className={chipClass("brand")}>{act.business_role}</span>
            </div>
          ) : null}
          {flow}
        </div>
      </details>
    );
  }

  return (
    <article id={`activity-${act.id}`} className={`${shellClass} p-3.5`}>
      {header}
      {flow}
    </article>
  );
}

const ProcedureNavigator = memo(function ProcedureNavigator({
  scenarios,
  t,
}: {
  scenarios: {
    name: string;
    slug: string;
    activityCount: number;
    stepCount: number;
    activities: { id: string; title: string }[];
  }[];
  t: TestingT;
}) {
  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <nav
      className="sticky top-24 hidden max-h-[min(70vh,32rem)] w-52 shrink-0 overflow-y-auto rounded-2xl border border-slate-200/85 bg-white/90 p-3 text-xs shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 backdrop-blur-sm xl:block"
      aria-label={t("procedure.navigatorLabel")}
    >
      <p className="mb-2 font-semibold uppercase tracking-wide text-slate-500">{t("procedure.navigatorTitle")}</p>
      <ul className="space-y-2">
        {scenarios.map((s) => (
          <li key={s.slug}>
            <button
              type="button"
              onClick={() => scrollTo(`scenario-${s.slug}`)}
              className="w-full rounded-lg px-2 py-1.5 text-left text-slate-700 transition-colors hover:bg-slate-50"
            >
              <span className="line-clamp-2 font-medium">{s.name}</span>
              <span className="mt-0.5 block text-[10px] text-slate-400">
                {s.activityCount} {t("procedure.activities")} · {s.stepCount} {t("procedure.stepsLower")}
              </span>
            </button>
            {s.activities.length > 1 ? (
              <ul className="ml-2 mt-1 max-h-40 space-y-0.5 overflow-y-auto border-l border-slate-100 pl-2">
                {s.activities.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => scrollTo(`activity-${a.id}`)}
                      className="w-full truncate rounded px-1 py-0.5 text-left text-[11px] text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                      title={a.title}
                    >
                      {a.title}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  );
});

export type TestProcedureViewerProps = {
  script: TestScriptWithSteps;
  /** When set, step rows show lightweight outcome state and defect shortcuts (project Testing workspace). */
  projectId?: string;
  canEdit?: boolean;
};

export function TestProcedureViewer({ script, projectId, canEdit }: TestProcedureViewerProps) {
  const t = useTranslations("testing");
  const generalAppLabel = t("procedure.generalApp");
  const stepFallback = t("procedure.stepFallback");

  const [stepOutcomes, setStepOutcomes] = useState<Record<string, TestExecutionResult>>({});
  const onOutcomeChange = useCallback((stepId: string, value: TestExecutionResult) => {
    setStepOutcomes((prev) => ({ ...prev, [stepId]: value }));
  }, []);

  const stepCtx: StepRowContext | undefined =
    projectId != null && String(projectId).trim() !== ""
      ? {
          projectId: String(projectId).trim(),
          scriptTitle: script.title,
          canEdit: Boolean(canEdit),
          outcomes: stepOutcomes,
          onOutcomeChange,
        }
      : undefined;

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
  const roles = Array.isArray(script.business_roles) ? (script.business_roles as string[]).filter(Boolean) : [];
  const activityCount = script.activities?.length ?? 0;
  const stepCount = script.steps?.length ?? 0;
  const scenarioCount = scenarioGroups.size;
  const heavyProcedure = stepCount > 80 || activityCount > 12 || scenarioCount > 3;
  const compactSteps = heavyProcedure || stepCount > 36;
  const groupOpts = useMemo<GroupStepsMergeOptions>(
    () => ({
      aggressive:
        script.source_import_type === "sap_xlsx" ||
        script.source_import_type === "structured_template" ||
        stepCount > 40 ||
        heavyProcedure,
    }),
    [script.source_import_type, stepCount, heavyProcedure]
  );

  const ungroupedAppGroups = useMemo(
    () => groupStepsByAppMerged(ungroupedSteps, generalAppLabel, groupOpts),
    [ungroupedSteps, generalAppLabel, groupOpts]
  );

  const objective = script.objective?.trim() ?? "";
  const allSteps = script.steps ?? [];

  const appsUsed = useMemo(
    () => collectAppsUsedFromSteps(allSteps, generalAppLabel),
    [allSteps, generalAppLabel]
  );

  const mergedReference = useMemo(
    () =>
      mergeReferenceNotesForViewer({
        reference_notes: script.reference_notes,
        objective: script.objective,
        expected_result: script.expected_result,
        preconditions: script.preconditions,
        business_conditions: script.business_conditions,
        test_data: script.test_data,
      }),
    [
      script.reference_notes,
      script.objective,
      script.expected_result,
      script.preconditions,
      script.business_conditions,
      script.test_data,
    ]
  );

  const structuredSteps = allSteps.filter(
    (s) => (s.instruction ?? "").trim().length > 0 || (s.step_name ?? "").trim().length > 0
  );
  const anyExecutable = hasHierarchy || ungroupedSteps.length > 0 || structuredSteps.length > 0;

  const showWeakNotice =
    structuredSteps.length > 0 &&
    structuredSteps.length <= 3 &&
    (objective.length > 120 ||
      (script.business_conditions ?? "").trim().length > 80 ||
      (script.reference_notes ?? "").trim().length > 120);

  const navScenarios = useMemo(() => {
    if (!hasHierarchy) return [];
    return Array.from(scenarioGroups.entries()).map(([name, acts]) => {
      const slug = navSlug(name);
      let stepSum = 0;
      const activities = acts.map((a) => {
        const n = (stepsByActivityId.get(a.id) ?? []).length;
        stepSum += n;
        return { id: a.id, title: a.activity_title };
      });
      return {
        name,
        slug,
        activityCount: acts.length,
        stepCount: stepSum,
        activities,
      };
    });
  }, [hasHierarchy, scenarioGroups, stepsByActivityId]);

  const showNavigator =
    hasHierarchy &&
    (scenarioGroups.size >= 2 ||
      activityCount >= 4 ||
      stepCount > 14 ||
      (scenarioGroups.size === 1 && activityCount >= 3));

  const singleScenario = scenarioGroups.size === 1;

  const referencePreview = useMemo(() => {
    if (!mergedReference) return null;
    return previewProcedureText(mergedReference, 400);
  }, [mergedReference]);

  const mainFlow = (
    <div className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {t("procedure.summaryHeader")}
        </h2>
        <TestScriptHeaderSummary script={script} variant="compact" />
      </section>

      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {t("procedure.testSetup")}
        </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <ContextBlock
                title={t("drawer.preconditions")}
                helper={t("procedure.prerequisitesHelper")}
                body={script.preconditions}
                emptyLabel={t("procedure.none")}
              />
              <ContextBlock
                title={t("drawer.businessConditions")}
                helper={t("procedure.businessConditionsHelper")}
                body={script.business_conditions}
                emptyLabel={t("procedure.none")}
              />
            </div>
            <TestDataSetupBlock script={script} steps={allSteps} emptyLabel={t("procedure.none")} />
            <div className={ctxCardClass}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t("procedure.appsTransactionsUsed")}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">{t("procedure.appsTransactionsHint")}</p>
              {appsUsed.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {appsUsed.map((label, ai) =>
                    isLikelySapTcode(label) ? (
                      <code
                        key={`${label}-${ai}`}
                        className="rounded-md border border-slate-200/90 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-800"
                      >
                        {label}
                      </code>
                    ) : (
                      <span key={`${label}-${ai}`} className={chipClass("neutral")}>
                        {label}
                      </span>
                    )
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400">{t("procedure.none")}</p>
              )}
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {t("procedure.businessRolesSection")}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{t("procedure.businessRolesHelper")}</p>
              </div>
              {roles.length > 0 ? (
                <div className="flex max-w-full flex-wrap gap-2">
                  {roles.map((r) => (
                    <span key={r} className={chipClass("brand")}>
                      {r}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">{t("procedure.none")}</p>
              )}
            </div>
      </section>

      {mergedReference && referencePreview ? (
        <details
          open={false}
          className="rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/35 px-4 py-3 ring-1 ring-slate-100/80"
        >
          <summary className="cursor-pointer list-none text-sm font-medium text-slate-600 [&::-webkit-details-marker]:hidden">
            {t("procedure.referenceNotesTitle")}
          </summary>
          <p className="mt-1 text-xs text-slate-500">{t("procedure.referenceNotesHint")}</p>
          <div className="mt-3 border-t border-slate-200/60 pt-3 text-sm leading-relaxed text-slate-600">
            {referencePreview.truncated ? (
              <details className="group/rf">
                <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <p className="line-clamp-3 whitespace-pre-wrap text-slate-600">{referencePreview.preview}</p>
                  <span className="mt-1 block text-xs font-medium text-[rgb(var(--rb-brand-primary-active))] group-open/rf:hidden">
                    {t("procedure.showFull")}
                  </span>
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-slate-600">{referencePreview.full}</p>
              </details>
            ) : (
              <p className="whitespace-pre-wrap text-slate-600">{referencePreview.full}</p>
            )}
          </div>
        </details>
      ) : null}

      {anyExecutable ? (
        <section className="space-y-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {t("procedure.executionFlow")}
          </h2>

          {!hasHierarchy && ungroupedSteps.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-slate-600">{t("procedure.flatProcedure")}</p>
              <div className="rounded-2xl border border-slate-200/85 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 sm:p-4">
                {ungroupedAppGroups.map((g) => (
                  <div key={`flat-${g.label}`} className="mb-5 last:mb-0">
                    <AppGroupHeader label={g.label} generalLabel={generalAppLabel} t={t} />
                    <ul
                      className={
                        compactSteps
                          ? "divide-y divide-slate-100 rounded-lg border border-slate-100/90 bg-white/80"
                          : "space-y-2.5"
                      }
                    >
                      {g.steps.map((st) => (
                        <li key={st.id} className={compactSteps ? "px-0" : ""}>
                          <ExecutionStepRow
                            step={st}
                            displayIndex={st.step_order}
                            generalAppLabel={generalAppLabel}
                            hideAppChip={g.label !== generalAppLabel}
                            stepFallback={stepFallback}
                            stepCtx={stepCtx}
                            compact={compactSteps}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

            {hasHierarchy &&
              Array.from(scenarioGroups.entries()).map(([scenario, acts], idx) => {
                const slug = navSlug(scenario);
                const stepSum = acts.reduce((acc, a) => acc + (stepsByActivityId.get(a.id) ?? []).length, 0);
                return (
                  <details
                    key={scenario}
                    id={`scenario-${slug}`}
                    open={heavyProcedure ? idx === 0 : singleScenario || idx === 0}
                    className="group/sc scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200/85 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 [&_summary::-webkit-details-marker]:hidden"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-slate-100/90 bg-slate-50/50 px-4 py-3.5 transition-colors hover:bg-slate-50">
                      <div className="min-w-0">
                        <span className="text-sm font-semibold leading-snug text-slate-900">{scenario}</span>
                        <span className="mt-1 block text-[11px] font-medium tabular-nums text-slate-500">
                          {acts.length} {t("procedure.activities")} · {stepSum} {t("procedure.stepsLower")}
                        </span>
                      </div>
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open/sc:-rotate-180" aria-hidden />
                    </summary>
                    <div className="space-y-3 bg-slate-50/20 p-3.5">
                      {acts.map((act) => (
                        <ActivityCard
                          key={act.id}
                          act={act}
                          actSteps={stepsByActivityId.get(act.id) ?? []}
                          generalAppLabel={generalAppLabel}
                          t={t}
                          stepFallback={stepFallback}
                          stepCtx={stepCtx}
                          groupOpts={groupOpts}
                          compactSteps={compactSteps}
                          collapseActivity={heavyProcedure}
                        />
                      ))}
                    </div>
                  </details>
                );
              })}

            {hasHierarchy && ungroupedSteps.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {t("procedure.ungrouped")}
                </h3>
                <div className="rounded-2xl border border-dashed border-slate-200/90 bg-white p-3 ring-1 ring-slate-100/80 sm:p-4">
                  {ungroupedAppGroups.map((g) => (
                    <div key={`ug-${g.label}`} className="mb-5 last:mb-0">
                      <AppGroupHeader label={g.label} generalLabel={generalAppLabel} t={t} />
                      <ul
                        className={
                          compactSteps
                            ? "divide-y divide-slate-100 rounded-lg border border-slate-100/90 bg-white/80"
                            : "space-y-2.5"
                        }
                      >
                        {g.steps.map((st) => (
                          <li key={st.id} className={compactSteps ? "px-0" : ""}>
                            <ExecutionStepRow
                              step={st}
                              displayIndex={st.step_order}
                              generalAppLabel={generalAppLabel}
                              hideAppChip={g.label !== generalAppLabel}
                              stepFallback={stepFallback}
                              stepCtx={stepCtx}
                              compact={compactSteps}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </section>
      ) : null}

      {anyExecutable && showWeakNotice ? (
        <div className={PROJECT_WORKSPACE_BANNER_INFO}>{t("procedure.weakImportNotice")}</div>
      ) : null}

      {!anyExecutable ? (
        <div className="rounded-2xl border border-slate-200/85 bg-white p-5 text-center shadow-sm ring-1 ring-slate-100">
          <p className="text-sm font-medium text-slate-800">{t("procedure.noStepsTitle")}</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{t("procedure.noStepsHint")}</p>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">{t("procedure.noStepsContextHint")}</p>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className={SHELL_OUTER}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className={`min-w-0 flex-1 ${SHELL_INNER}`}>{mainFlow}</div>
        {showNavigator && navScenarios.length > 0 ? <ProcedureNavigator scenarios={navScenarios} t={t} /> : null}
      </div>
    </div>
  );
}

export type TestScriptHeaderSummaryProps = {
  script: TestScriptWithSteps;
  variant?: "detailed" | "compact";
};

export function TestScriptHeaderSummary({ script, variant = "detailed" }: TestScriptHeaderSummaryProps) {
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
    if (s === "structured_template") return t("source.structuredTemplate");
    return t("source.manual");
  };

  const activityCount = script.activities?.length ?? 0;
  const stepCount = script.steps?.length ?? 0;
  const objective = script.objective?.trim() ?? "";
  const shortObjective =
    objective.length > 0 && objective.length <= 120 && !isHeavyNarrativeBlock(objective) ? objective : "";

  if (variant === "compact") {
    return (
      <div className="rounded-2xl border border-slate-200/85 bg-gradient-to-br from-white via-white to-slate-50/30 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">{script.title}</h3>
            {shortObjective ? (
              <p className="mt-1 line-clamp-2 text-sm leading-snug text-slate-500">{shortObjective}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className={chipClass("neutral")}>{typeLabel(script.test_type)}</span>
            <span className={chipClass("neutral")}>{srcLabel(script.source_import_type)}</span>
            <span className={chipClass("brand")}>{stLabel(script.status)}</span>
            <span className={chipClass("neutral")}>{prLabel(script.priority)}</span>
          </div>
        </div>
        <dl className="mt-4 grid gap-2 border-t border-slate-100/90 pt-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t("procedure.metaUpdated")}</dt>
            <dd className="mt-0.5 font-medium text-slate-800">{formatUpdated(script.updated_at)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t("procedure.metaActivities")}</dt>
            <dd className="mt-0.5 font-medium text-slate-800">{activityCount}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t("procedure.metaSteps")}</dt>
            <dd className="mt-0.5 font-medium text-slate-800">{stepCount}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t("import.scopeItem")}</dt>
            <dd className="mt-0.5 truncate font-medium text-slate-800">{script.scope_item_code?.trim() || "—"}</dd>
          </div>
        </dl>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {script.module ? (
            <span className="rounded-md border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
              {labelForSapTestModule(script.module) || script.module}
            </span>
          ) : null}
          {script.scenario_path?.trim() ? (
            <span className="rounded-md border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
              {script.scenario_path.trim()}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

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
