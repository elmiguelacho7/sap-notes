"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { TestCycleRow } from "@/lib/types/testing";

export type TestCycleDrawerProps = {
  projectId: string;
  cycleId: string | null;
  open: boolean;
  canEdit: boolean;
  onClose: () => void;
  onSaved: (cycle: TestCycleRow) => void;
};

const inputClass =
  "w-full min-h-10 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/28 focus:border-[rgb(var(--rb-brand-primary))]/30";
const labelClass = "mb-1 block text-xs font-semibold text-slate-600";

export function TestCycleDrawer({ projectId, cycleId, open, canEdit, onClose, onSaved }: TestCycleDrawerProps) {
  const t = useTranslations("testing");
  const isEdit = !!cycleId;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("draft");
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
  const [goal, setGoal] = useState("");
  const [scopeSummary, setScopeSummary] = useState("");

  const reset = useCallback(() => {
    setName("");
    setDescription("");
    setStatus("draft");
    setPlannedStart("");
    setPlannedEnd("");
    setGoal("");
    setScopeSummary("");
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (!cycleId) {
      reset();
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/testing/cycles/${cycleId}`, { credentials: "include" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Load failed");
        const row = (json as { cycle?: TestCycleRow }).cycle ?? (json as TestCycleRow);
        setName(row.name ?? "");
        setDescription(row.description ?? "");
        setStatus(row.status ?? "draft");
        setPlannedStart(row.planned_start_date ?? "");
        setPlannedEnd(row.planned_end_date ?? "");
        setGoal(row.goal ?? "");
        setScopeSummary(row.scope_summary ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, cycleId, projectId, reset]);

  const title = useMemo(() => (isEdit ? t("cycle.editTitle") : t("cycle.newTitle")), [isEdit, t]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        status,
        planned_start_date: plannedStart.trim() || null,
        planned_end_date: plannedEnd.trim() || null,
        goal: goal.trim() || null,
        scope_summary: scopeSummary.trim() || null,
      };
      const res = await fetch(
        cycleId ? `/api/projects/${projectId}/testing/cycles/${cycleId}` : `/api/projects/${projectId}/testing/cycles`,
        {
          method: cycleId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : t("cycle.saveFailed"));
        return;
      }
      const saved = json as TestCycleRow;
      onSaved(saved);
      reset();
      onClose();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : t("cycle.saveFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-slate-900/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        className="fixed left-1/2 top-1/2 z-[70] w-[min(100%,32rem)] max-h-[min(100vh-2rem,44rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xl ring-1 ring-slate-100"
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{t("cycle.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label={t("drawer.closeAria")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelClass}>{t("cycle.fields.name")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} disabled={!canEdit} />
          </div>
          <div>
            <label className={labelClass}>{t("cycle.fields.description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
              rows={2}
              disabled={!canEdit}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass}>{t("cycle.fields.status")}</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass} disabled={!canEdit}>
                <option value="draft">{t("cycle.status.draft")}</option>
                <option value="ready">{t("cycle.status.ready")}</option>
                <option value="in_progress">{t("cycle.status.in_progress")}</option>
                <option value="blocked">{t("cycle.status.blocked")}</option>
                <option value="completed">{t("cycle.status.completed")}</option>
                <option value="archived">{t("cycle.status.archived")}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("cycle.fields.plannedStart")}</label>
              <input
                type="date"
                value={plannedStart}
                onChange={(e) => setPlannedStart(e.target.value)}
                className={inputClass}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className={labelClass}>{t("cycle.fields.plannedEnd")}</label>
              <input
                type="date"
                value={plannedEnd}
                onChange={(e) => setPlannedEnd(e.target.value)}
                className={inputClass}
                disabled={!canEdit}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t("cycle.fields.goal")}</label>
            <textarea value={goal} onChange={(e) => setGoal(e.target.value)} className={inputClass} rows={2} disabled={!canEdit} />
          </div>
          <div>
            <label className={labelClass}>{t("cycle.fields.scopeSummary")}</label>
            <textarea
              value={scopeSummary}
              onChange={(e) => setScopeSummary(e.target.value)}
              className={inputClass}
              rows={2}
              disabled={!canEdit}
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={!canEdit || loading}
              className="inline-flex items-center justify-center rounded-xl bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95 disabled:opacity-50"
            >
              {loading ? "…" : t("drawer.save")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              {t("drawer.cancel") ?? t("run.cancel")}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

