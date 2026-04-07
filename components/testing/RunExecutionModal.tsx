"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import type { TestExecutionRow } from "@/lib/types/testing";
import { TraceabilityEntityPicker } from "@/components/testing/TraceabilityEntityPicker";

export type RunExecutionModalProps = {
  projectId: string;
  scriptId: string;
  scriptTitle: string;
  cyclesForScript?: { id: string; name: string }[];
  defaultCycleId?: string | null;
  open: boolean;
  onClose: () => void;
  onRecorded: (execution?: TestExecutionRow) => void;
};

const inputClass =
  "w-full min-h-10 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/28 focus:border-[rgb(var(--rb-brand-primary))]/30";
const labelClass = "mb-1 block text-xs font-semibold text-slate-600";

function buildDefectTicketHref(args: {
  projectId: string;
  scriptId: string;
  scriptTitle: string;
  executionId: string;
  actualResult: string;
  evidenceNotes: string;
  executedAtIso: string;
}): string {
  const title = `[Testing] ${args.scriptTitle.trim().slice(0, 120)} — failed execution`;
  const body = [
    `Source script: ${args.scriptTitle.trim()}`,
    `Script ID: ${args.scriptId}`,
    `Execution ID: ${args.executionId}`,
    `Recorded: ${args.executedAtIso}`,
    `Outcome: failed`,
    args.actualResult.trim() ? `Actual result / summary:\n${args.actualResult.trim()}` : null,
    args.evidenceNotes.trim() ? `Evidence / notes:\n${args.evidenceNotes.trim()}` : null,
    "",
    "After you create this ticket, it will be linked to the execution record automatically.",
  ]
    .filter(Boolean)
    .join("\n\n");
  const params = new URLSearchParams();
  params.set("title", title);
  params.set("description", body.slice(0, 3800));
  params.set("linkTestingExecution", args.executionId);
  params.set("linkTestingScriptId", args.scriptId);
  return `/projects/${args.projectId}/tickets/new?${params.toString()}`;
}

export function RunExecutionModal({
  projectId,
  scriptId,
  scriptTitle,
  cyclesForScript,
  defaultCycleId,
  open,
  onClose,
  onRecorded,
}: RunExecutionModalProps) {
  const t = useTranslations("testing");
  const [result, setResult] = useState<string>("passed");
  const [actualResult, setActualResult] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [cycleId, setCycleId] = useState<string>("");
  const [sapRef, setSapRef] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [defectTicketId, setDefectTicketId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRecorded, setLastRecorded] = useState<TestExecutionRow | null>(null);

  const reset = useCallback(() => {
    setResult("passed");
    setActualResult("");
    setEvidenceNotes("");
    setCycleId(defaultCycleId?.trim() ? String(defaultCycleId) : "");
    setSapRef("");
    setExternalUrl("");
    setQuickNote("");
    setFile(null);
    setDefectTicketId("");
    setError(null);
    setLastRecorded(null);
  }, [defaultCycleId]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const failedFollowupHref = useMemo(() => {
    if (!lastRecorded || lastRecorded.result !== "failed") return null;
    return buildDefectTicketHref({
      projectId,
      scriptId,
      scriptTitle,
      executionId: lastRecorded.id,
      actualResult,
      evidenceNotes,
      executedAtIso: lastRecorded.executed_at,
    });
  }, [lastRecorded, projectId, scriptId, scriptTitle, actualResult, evidenceNotes]);

  if (!open) return null;

  const isFailed = result === "failed";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setLastRecorded(null);
    try {
      const evidence_items: Array<Record<string, unknown>> = [];
      if (sapRef.trim()) {
        evidence_items.push({ type: "sap_document", title: t("evidence.sapRefTitle"), sap_reference: sapRef.trim() });
      }
      if (externalUrl.trim()) {
        evidence_items.push({ type: "link", title: t("evidence.linkTitle"), external_url: externalUrl.trim() });
      }
      if (quickNote.trim()) {
        evidence_items.push({ type: "note", title: t("evidence.noteTitle"), description: quickNote.trim() });
      }

      const res = await fetch(`/api/projects/${projectId}/testing/scripts/${scriptId}/executions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          result,
          actual_result: actualResult.trim() || null,
          evidence_notes: evidenceNotes.trim() || null,
          defect_ticket_id: defectTicketId.trim() || null,
          test_cycle_id: cycleId.trim() || null,
          evidence_items,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as TestExecutionRow & { error?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Request failed");
        return;
      }
      const execution = data as TestExecutionRow;

      if (file) {
        const fd = new FormData();
        fd.set("file", file);
        const up = await fetch(
          `/api/projects/${projectId}/testing/executions/${execution.id}/evidence/upload`,
          { method: "POST", credentials: "include", body: fd }
        );
        if (!up.ok) {
          const upJson = (await up.json().catch(() => ({}))) as { error?: string };
          setError(typeof upJson.error === "string" ? upJson.error : t("evidence.uploadFailed"));
          setLastRecorded(execution);
          onRecorded(execution);
          return;
        }
      }

      onRecorded(execution);
      if (execution.result === "failed") {
        setLastRecorded(execution);
      } else {
        reset();
        onClose();
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const finishAfterFailed = () => {
    reset();
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-slate-900/45 backdrop-blur-[2px]" onClick={handleClose} aria-hidden />
      <div
        className={`fixed left-1/2 top-1/2 z-[70] w-[min(100%,26rem)] max-h-[min(100vh-2rem,40rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-white p-5 shadow-xl ring-1 ring-slate-100 ${
          isFailed && !lastRecorded ? "border-red-200/90 ring-red-100/80" : "border-slate-200/90"
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t("run.title")}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{t("run.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label={t("run.cancel")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {lastRecorded?.result === "failed" && failedFollowupHref ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-3 text-sm text-amber-950">
              <p className="font-semibold">{t("run.recordedFailedTitle")}</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-900/90">{t("run.recordedFailedHint")}</p>
            </div>
            <Link
              href={failedFollowupHref}
              className="flex w-full items-center justify-center rounded-xl bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95"
            >
              {t("run.createDefectCta")}
            </Link>
            <p className="text-center text-[11px] text-slate-500">{t("run.defectAutoLinkHint")}</p>
            <button
              type="button"
              onClick={finishAfterFailed}
              className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t("run.doneClose")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {Array.isArray(cyclesForScript) && cyclesForScript.length > 0 ? (
              <div>
                <label className={labelClass} htmlFor="run-cycle">
                  {t("run.cycle")}
                </label>
                <p className="mb-1.5 text-[11px] text-slate-500">{t("run.cycleHelper")}</p>
                <select
                  id="run-cycle"
                  value={cycleId}
                  onChange={(e) => setCycleId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">{t("run.cycleNone")}</option>
                  {cyclesForScript.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              <label className={labelClass} htmlFor="run-result">
                {t("run.result")}
              </label>
              <p className="mb-1.5 text-[11px] text-slate-500">{t("run.resultHelper")}</p>
              <select
                id="run-result"
                value={result}
                onChange={(e) => setResult(e.target.value)}
                className={inputClass}
              >
                <option value="passed">{t("result.passed")}</option>
                <option value="failed">{t("result.failed")}</option>
                <option value="blocked">{t("result.blocked")}</option>
                <option value="not_run">{t("result.not_run")}</option>
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="run-actual">
                {t("run.actualResult")}
              </label>
              <p className="mb-1.5 text-[11px] text-slate-500">{t("run.actualResultHelper")}</p>
              <textarea
                id="run-actual"
                value={actualResult}
                onChange={(e) => setActualResult(e.target.value)}
                rows={3}
                className={inputClass}
                placeholder={t("run.actualResultPlaceholder")}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="run-evidence">
                {t("run.evidenceNotes")}
              </label>
              <p className="mb-1.5 text-[11px] text-slate-500">{t("run.evidenceHelper")}</p>
              <textarea
                id="run-evidence"
                value={evidenceNotes}
                onChange={(e) => setEvidenceNotes(e.target.value)}
                rows={2}
                className={inputClass}
                placeholder={t("run.evidencePlaceholder")}
              />
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("evidence.title")}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">{t("evidence.helper")}</p>
              <div className="mt-3 grid gap-3">
                <div>
                  <label className={labelClass} htmlFor="evidence-file">
                    {t("evidence.upload")}
                  </label>
                  <input
                    id="evidence-file"
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="evidence-sap">
                      {t("evidence.sapRef")}
                    </label>
                    <input
                      id="evidence-sap"
                      value={sapRef}
                      onChange={(e) => setSapRef(e.target.value)}
                      className={inputClass}
                      placeholder={t("evidence.sapRefPlaceholder")}
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="evidence-link">
                      {t("evidence.link")}
                    </label>
                    <input
                      id="evidence-link"
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value)}
                      className={inputClass}
                      placeholder={t("evidence.linkPlaceholder")}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor="evidence-note">
                    {t("evidence.note")}
                  </label>
                  <textarea
                    id="evidence-note"
                    value={quickNote}
                    onChange={(e) => setQuickNote(e.target.value)}
                    className={inputClass}
                    rows={2}
                    placeholder={t("evidence.notePlaceholder")}
                  />
                </div>
              </div>
            </div>
            <div>
              <label className={labelClass}>{t("run.defectTicketLabel")}</label>
              <p className="mb-1.5 text-[11px] text-slate-500">{t("run.defectTicketHelper")}</p>
              <TraceabilityEntityPicker
                projectId={projectId}
                kind="ticket"
                valueId={defectTicketId}
                onChangeId={setDefectTicketId}
                disabled={false}
                emptyHint={t("traceabilityPicker.noTicket")}
                resolvedPreview={null}
              />
            </div>
            {isFailed ? (
              <p className="rounded-lg border border-red-100 bg-red-50/80 px-3 py-2 text-xs text-red-900">{t("run.failedBanner")}</p>
            ) : null}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95 disabled:opacity-50 sm:flex-none"
              >
                {submitting ? "…" : t("run.submit")}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                {t("run.cancel")}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
