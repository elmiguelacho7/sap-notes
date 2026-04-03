"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Plus, Trash2 } from "lucide-react";
import type { TestExecutionRow, TestScriptWithSteps } from "@/lib/types/testing";
import { RunExecutionModal } from "@/components/testing/RunExecutionModal";

type StepForm = { id?: string; instruction: string; expected_result: string };

const inputClass =
  "w-full min-h-10 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35";
const textareaClass =
  "w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35";
const labelClass = "mb-1 block text-xs font-medium text-[rgb(var(--rb-text-muted))]";

export type TestScriptDrawerProps = {
  projectId: string;
  scriptId: string | null;
  open: boolean;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

export function TestScriptDrawer({
  projectId,
  scriptId,
  open,
  canEdit,
  onClose,
  onSaved,
}: TestScriptDrawerProps) {
  const t = useTranslations("testing");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [module, setModule] = useState("");
  const [testType, setTestType] = useState("uat");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("draft");
  const [preconditions, setPreconditions] = useState("");
  const [testData, setTestData] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [relatedTaskId, setRelatedTaskId] = useState("");
  const [relatedTicketId, setRelatedTicketId] = useState("");
  const [relatedKnowledgePageId, setRelatedKnowledgePageId] = useState("");
  const [steps, setSteps] = useState<StepForm[]>([{ instruction: "", expected_result: "" }]);
  const [executions, setExecutions] = useState<TestExecutionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [runOpen, setRunOpen] = useState(false);

  const loadScript = useCallback(async () => {
    if (!scriptId || !open) return;
    setLoading(true);
    setError(null);
    try {
      const [sRes, eRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/testing/scripts/${scriptId}`, { credentials: "include" }),
        fetch(`/api/projects/${projectId}/testing/scripts/${scriptId}/executions?limit=30`, {
          credentials: "include",
        }),
      ]);
      const sData = await sRes.json();
      if (!sRes.ok) throw new Error(sData.error ?? "Load failed");
      const script = sData as TestScriptWithSteps;
      setTitle(script.title ?? "");
      setObjective(script.objective ?? "");
      setModule(script.module ?? "");
      setTestType(script.test_type ?? "uat");
      setPriority(script.priority ?? "");
      setStatus(script.status ?? "draft");
      setPreconditions(script.preconditions ?? "");
      setTestData(script.test_data ?? "");
      setExpectedResult(script.expected_result ?? "");
      setRelatedTaskId(script.related_task_id ?? "");
      setRelatedTicketId(script.related_ticket_id ?? "");
      setRelatedKnowledgePageId(script.related_knowledge_page_id ?? "");
      const st = (script.steps ?? []).map((x) => ({
        id: x.id,
        instruction: x.instruction ?? "",
        expected_result: x.expected_result ?? "",
      }));
      setSteps(st.length > 0 ? st : [{ instruction: "", expected_result: "" }]);

      const eData = await eRes.json();
      if (eRes.ok && Array.isArray(eData.executions)) {
        setExecutions(eData.executions as TestExecutionRow[]);
      } else {
        setExecutions([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [open, projectId, scriptId]);

  useEffect(() => {
    if (!open) return;
    if (!scriptId) {
      setTitle("");
      setObjective("");
      setModule("");
      setTestType("uat");
      setPriority("");
      setStatus("draft");
      setPreconditions("");
      setTestData("");
      setExpectedResult("");
      setRelatedTaskId("");
      setRelatedTicketId("");
      setRelatedKnowledgePageId("");
      setSteps([{ instruction: "", expected_result: "" }]);
      setExecutions([]);
      setError(null);
      return;
    }
    void loadScript();
  }, [open, scriptId, loadScript]);

  const addStep = () => setSteps((s) => [...s, { instruction: "", expected_result: "" }]);
  const removeStep = (i: number) => setSteps((s) => (s.length <= 1 ? s : s.filter((_, j) => j !== i)));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    const stepsPayload = steps.map((st, i) => ({
      id: st.id,
      step_order: i,
      instruction: st.instruction,
      expected_result: st.expected_result || null,
    }));
    try {
      if (!scriptId) {
        const res = await fetch(`/api/projects/${projectId}/testing/scripts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title,
            objective: objective || null,
            module: module || null,
            test_type: testType,
            priority: priority || null,
            status,
            preconditions: preconditions || null,
            test_data: testData || null,
            expected_result: expectedResult || null,
            related_task_id: relatedTaskId.trim() || null,
            related_ticket_id: relatedTicketId.trim() || null,
            related_knowledge_page_id: relatedKnowledgePageId.trim() || null,
            steps: stepsPayload.map(({ instruction, expected_result }) => ({ instruction, expected_result })),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Save failed");
      } else {
        const res = await fetch(`/api/projects/${projectId}/testing/scripts/${scriptId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title,
            objective: objective || null,
            module: module || null,
            test_type: testType,
            priority: priority || null,
            status,
            preconditions: preconditions || null,
            test_data: testData || null,
            expected_result: expectedResult || null,
            related_task_id: relatedTaskId.trim() || null,
            related_ticket_id: relatedTicketId.trim() || null,
            related_knowledge_page_id: relatedKnowledgePageId.trim() || null,
            steps: stepsPayload,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Save failed");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!scriptId || !canEdit) return;
    if (!confirm(t("drawer.confirmDelete"))) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/testing/scripts/${scriptId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Delete failed");
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-xl flex-col border-l border-[rgb(var(--rb-surface-border))]/80 bg-[rgb(var(--rb-surface))] shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[rgb(var(--rb-surface-border))]/70 px-4 py-3">
          <h2 className="text-lg font-semibold text-[rgb(var(--rb-text-primary))]">
            {scriptId ? t("drawer.editTitle") : t("drawer.createTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[rgb(var(--rb-text-muted))] hover:bg-[rgb(var(--rb-surface-2))]/60"
            aria-label={t("drawer.closeAria")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {loading ? (
              <p className="text-sm text-[rgb(var(--rb-text-muted))]">…</p>
            ) : (
              <>
                <div>
                  <label className={labelClass}>{t("drawer.title")}</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={inputClass}
                    required
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t("drawer.objective")}</label>
                  <textarea
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    rows={2}
                    className={textareaClass}
                    disabled={!canEdit}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>{t("drawer.module")}</label>
                    <input
                      type="text"
                      value={module}
                      onChange={(e) => setModule(e.target.value)}
                      className={inputClass}
                      disabled={!canEdit}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t("drawer.testType")}</label>
                    <select
                      value={testType}
                      onChange={(e) => setTestType(e.target.value)}
                      className={inputClass}
                      disabled={!canEdit}
                    >
                      <option value="uat">UAT</option>
                      <option value="sit">SIT</option>
                      <option value="regression">Regression</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>{t("drawer.priority")}</label>
                    <input
                      type="text"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className={inputClass}
                      placeholder={t("drawer.priorityPlaceholder")}
                      disabled={!canEdit}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t("drawer.status")}</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className={inputClass}
                      disabled={!canEdit}
                    >
                      <option value="draft">Draft</option>
                      <option value="ready">Ready</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>{t("drawer.preconditions")}</label>
                  <textarea
                    value={preconditions}
                    onChange={(e) => setPreconditions(e.target.value)}
                    rows={2}
                    className={textareaClass}
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t("drawer.testData")}</label>
                  <textarea
                    value={testData}
                    onChange={(e) => setTestData(e.target.value)}
                    rows={2}
                    className={textareaClass}
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t("drawer.expectedResult")}</label>
                  <textarea
                    value={expectedResult}
                    onChange={(e) => setExpectedResult(e.target.value)}
                    rows={2}
                    className={textareaClass}
                    disabled={!canEdit}
                  />
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("drawer.traceability")}</p>
                  <div>
                    <label className={labelClass}>{t("drawer.relatedTaskId")}</label>
                    <input
                      type="text"
                      value={relatedTaskId}
                      onChange={(e) => setRelatedTaskId(e.target.value)}
                      className={inputClass}
                      disabled={!canEdit}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t("drawer.relatedTicketId")}</label>
                    <input
                      type="text"
                      value={relatedTicketId}
                      onChange={(e) => setRelatedTicketId(e.target.value)}
                      className={inputClass}
                      disabled={!canEdit}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t("drawer.relatedKnowledgePageId")}</label>
                    <input
                      type="text"
                      value={relatedKnowledgePageId}
                      onChange={(e) => setRelatedKnowledgePageId(e.target.value)}
                      className={inputClass}
                      disabled={!canEdit}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className={labelClass}>{t("drawer.steps")}</span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={addStep}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t("drawer.addStep")}
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {steps.map((st, i) => (
                      <div key={st.id ?? `new-${i}`} className="rounded-xl border border-slate-200/90 bg-white p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-500">#{i + 1}</span>
                          {canEdit && steps.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeStep(i)}
                              className="text-slate-400 hover:text-red-600"
                              aria-label={t("drawer.removeStep")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <label className={labelClass}>{t("drawer.stepInstruction")}</label>
                        <textarea
                          value={st.instruction}
                          onChange={(e) =>
                            setSteps((prev) =>
                              prev.map((p, j) => (j === i ? { ...p, instruction: e.target.value } : p))
                            )
                          }
                          rows={2}
                          className={textareaClass}
                          disabled={!canEdit}
                        />
                        <label className={`${labelClass} mt-2`}>{t("drawer.stepExpected")}</label>
                        <textarea
                          value={st.expected_result}
                          onChange={(e) =>
                            setSteps((prev) =>
                              prev.map((p, j) => (j === i ? { ...p, expected_result: e.target.value } : p))
                            )
                          }
                          rows={1}
                          className={textareaClass}
                          disabled={!canEdit}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {scriptId && (
                  <div className="border-t border-slate-200 pt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800">{t("drawer.history")}</span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => setRunOpen(true)}
                          className="text-sm font-medium text-[rgb(var(--rb-brand-primary-active))] hover:underline"
                        >
                          {t("drawer.run")}
                        </button>
                      )}
                    </div>
                    {executions.length === 0 ? (
                      <p className="text-sm text-slate-500">{t("drawer.noHistory")}</p>
                    ) : (
                      <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                        {executions.map((ex) => (
                          <li
                            key={ex.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5"
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
              </>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {canEdit && (
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] px-4 py-3">
              <button
                type="submit"
                disabled={saving || loading}
                className="inline-flex items-center justify-center rounded-xl bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? t("drawer.saving") : t("drawer.save")}
              </button>
              {scriptId && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {t("drawer.delete")}
                </button>
              )}
            </div>
          )}
        </form>
      </div>

      {scriptId && (
        <RunExecutionModal
          projectId={projectId}
          scriptId={scriptId}
          scriptTitle={title || "Test"}
          open={runOpen}
          onClose={() => setRunOpen(false)}
          onRecorded={() => {
            void loadScript();
            onSaved();
          }}
        />
      )}
    </>
  );
}
