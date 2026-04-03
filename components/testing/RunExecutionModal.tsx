"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

export type RunExecutionModalProps = {
  projectId: string;
  scriptId: string;
  scriptTitle: string;
  open: boolean;
  onClose: () => void;
  onRecorded: () => void;
};

const inputClass =
  "w-full min-h-10 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/28 focus:border-[rgb(var(--rb-brand-primary))]/30";
const labelClass = "mb-1 block text-xs font-medium text-slate-500";

export function RunExecutionModal({
  projectId,
  scriptId,
  scriptTitle,
  open,
  onClose,
  onRecorded,
}: RunExecutionModalProps) {
  const t = useTranslations("testing");
  const [result, setResult] = useState<string>("passed");
  const [actualResult, setActualResult] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [defectTicketId, setDefectTicketId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setResult("passed");
    setActualResult("");
    setEvidenceNotes("");
    setDefectTicketId("");
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  if (!open) return null;

  const ticketHref = `/projects/${projectId}/tickets/new?title=${encodeURIComponent(`Defect: ${scriptTitle}`)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/testing/scripts/${scriptId}/executions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          result,
          actual_result: actualResult.trim() || null,
          evidence_notes: evidenceNotes.trim() || null,
          defect_ticket_id: defectTicketId.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Request failed");
        return;
      }
      reset();
      onRecorded();
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-slate-900/45 backdrop-blur-[2px]" onClick={handleClose} aria-hidden />
      <div
        className="fixed left-1/2 top-1/2 z-[70] w-[min(100%,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xl ring-1 ring-slate-100"
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">{t("run.title")}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label={t("run.cancel")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelClass}>{t("run.result")}</label>
            <select value={result} onChange={(e) => setResult(e.target.value)} className={inputClass}>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="blocked">Blocked</option>
              <option value="not_run">Not run</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{t("run.actualResult")}</label>
            <textarea
              value={actualResult}
              onChange={(e) => setActualResult(e.target.value)}
              rows={3}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t("run.evidenceNotes")}</label>
            <textarea
              value={evidenceNotes}
              onChange={(e) => setEvidenceNotes(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t("run.defectTicketId")}</label>
            <input
              type="text"
              value={defectTicketId}
              onChange={(e) => setDefectTicketId(e.target.value)}
              className={inputClass}
              placeholder="UUID"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-xl bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95 disabled:opacity-50"
            >
              {submitting ? "…" : t("run.submit")}
            </button>
            <Link
              href={ticketHref}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t("run.createTicket")}
            </Link>
            <button type="button" onClick={handleClose} className="text-sm font-medium text-slate-500 hover:text-slate-800">
              {t("run.cancel")}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
