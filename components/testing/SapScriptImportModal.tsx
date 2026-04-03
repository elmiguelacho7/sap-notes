"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { FileUp, X, Plus, Trash2, ArrowLeft, AlertTriangle } from "lucide-react";
import type { SapImportedScriptDraft } from "@/lib/testing/sapScriptImport/types";
import { SAP_TEST_MODULE_OPTIONS } from "@/lib/testing/sapModuleCatalog";

const inputClass =
  "w-full min-h-10 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35";
const textareaClass =
  "w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35";
const labelClass = "mb-1 block text-xs font-medium text-[rgb(var(--rb-text-muted))]";

type ReviewStep = {
  step_order: number;
  step_name: string;
  instruction: string;
  expected_result: string;
  optional_flag: boolean;
  transaction_or_app: string;
  business_role: string;
  test_data_notes: string;
};

function draftToReviewSteps(d: SapImportedScriptDraft): ReviewStep[] {
  if (d.steps.length === 0) {
    return [
      {
        step_order: 1,
        step_name: "",
        instruction: "",
        expected_result: "",
        optional_flag: false,
        transaction_or_app: "",
        business_role: "",
        test_data_notes: "",
      },
    ];
  }
  return d.steps.map((s, i) => ({
    step_order: s.step_order || i + 1,
    step_name: s.step_name ?? "",
    instruction: s.instruction,
    expected_result: s.expected_result ?? "",
    optional_flag: Boolean(s.optional_flag),
    transaction_or_app: s.transaction_or_app ?? "",
    business_role: s.business_role ?? "",
    test_data_notes: s.test_data_notes ?? "",
  }));
}

export type SapScriptImportModalProps = {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function SapScriptImportModal({ projectId, open, onClose, onSaved }: SapScriptImportModalProps) {
  const t = useTranslations("testing");
  const [phase, setPhase] = useState<"pick" | "review">("pick");
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sourceImportType, setSourceImportType] = useState<"sap_docx" | "sap_xlsx">("sap_docx");

  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [module, setModule] = useState("");
  const [testType, setTestType] = useState("uat");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("draft");
  const [preconditions, setPreconditions] = useState("");
  const [testData, setTestData] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [scenarioPath, setScenarioPath] = useState("");
  const [scopeItemCode, setScopeItemCode] = useState("");
  const [sourceDocumentName, setSourceDocumentName] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("");
  const [businessRolesText, setBusinessRolesText] = useState("");
  const [steps, setSteps] = useState<ReviewStep[]>([]);

  const reset = useCallback(() => {
    setPhase("pick");
    setFile(null);
    setParsing(false);
    setSaving(false);
    setError(null);
    setWarnings([]);
    setTitle("");
    setObjective("");
    setModule("");
    setTestType("uat");
    setPriority("medium");
    setStatus("draft");
    setPreconditions("");
    setTestData("");
    setExpectedResult("");
    setScenarioPath("");
    setScopeItemCode("");
    setSourceDocumentName("");
    setSourceLanguage("");
    setBusinessRolesText("");
    setSteps([]);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const applyDraft = useCallback((d: SapImportedScriptDraft) => {
    setTitle(d.title);
    setObjective(d.objective);
    setModule(d.module ?? "");
    setTestType(d.test_type);
    setPriority(d.priority);
    setStatus(d.status);
    setPreconditions(d.preconditions);
    setTestData(d.test_data);
    setExpectedResult(d.expected_result);
    setScenarioPath(d.scenario_path);
    setScopeItemCode(d.scope_item_code);
    setSourceDocumentName(d.source_document_name);
    setSourceLanguage(d.source_language);
    setBusinessRolesText((d.business_roles ?? []).join("\n"));
    setSourceImportType(d.source_import_type === "sap_xlsx" ? "sap_xlsx" : "sap_docx");
    setSteps(draftToReviewSteps(d));
  }, []);

  const parseFile = async () => {
    if (!file) {
      setError(t("import.selectFile"));
      return;
    }
    setParsing(true);
    setError(null);
    setWarnings([]);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/projects/${projectId}/testing/import/parse`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : t("import.parseFailed"));
      }
      const draft = data.draft as SapImportedScriptDraft;
      const w = Array.isArray(data.warnings) ? (data.warnings as string[]) : [];
      applyDraft(draft);
      setWarnings(w);
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("import.parseFailed"));
    } finally {
      setParsing(false);
    }
  };

  const saveDraft = async () => {
    setSaving(true);
    setError(null);
    const roles = businessRolesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const stepsPayload = steps
      .filter((s) => s.instruction.trim())
      .map((s, i) => ({
        instruction: s.instruction.trim(),
        expected_result: s.expected_result.trim() || null,
        step_name: s.step_name.trim() || null,
        optional_flag: s.optional_flag,
        transaction_or_app: s.transaction_or_app.trim() || null,
        business_role: s.business_role.trim() || null,
        test_data_notes: s.test_data_notes.trim() || null,
        step_order: i,
      }));
    try {
      const res = await fetch(`/api/projects/${projectId}/testing/scripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim() || t("import.untitled"),
          objective: objective.trim() || null,
          module: module.trim() || null,
          test_type: testType,
          priority: priority.trim() || null,
          status,
          preconditions: preconditions.trim() || null,
          test_data: testData.trim() || null,
          expected_result: expectedResult.trim() || null,
          scenario_path: scenarioPath.trim() || null,
          scope_item_code: scopeItemCode.trim() || null,
          source_document_name: sourceDocumentName.trim() || null,
          source_language: sourceLanguage.trim() || null,
          business_roles: roles,
          source_import_type: sourceImportType,
          steps: stepsPayload,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : t("import.saveFailed"));
      }
      onSaved();
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("import.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const addStep = () =>
    setSteps((prev) => [
      ...prev,
      {
        step_order: prev.length + 1,
        step_name: "",
        instruction: "",
        expected_result: "",
        optional_flag: false,
        transaction_or_app: "",
        business_role: "",
        test_data_notes: "",
      },
    ]);

  const removeStep = (i: number) => setSteps((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-slate-900/45 backdrop-blur-[2px]"
        onClick={handleClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-labelledby="sap-import-title"
        className="fixed left-1/2 top-1/2 z-[70] flex max-h-[min(90vh,840px)] w-[min(96vw,640px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[rgb(var(--rb-surface-border))]/80 bg-[rgb(var(--rb-surface))] shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[rgb(var(--rb-surface-border))]/70 px-4 py-3">
          <h2 id="sap-import-title" className="text-lg font-semibold text-[rgb(var(--rb-text-primary))]">
            {phase === "pick" ? t("import.title") : t("import.reviewTitle")}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-[rgb(var(--rb-text-muted))] hover:bg-[rgb(var(--rb-surface-2))]/60"
            aria-label={t("drawer.closeAria")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {phase === "pick" ? (
            <div className="space-y-4">
              <p className="text-sm text-[rgb(var(--rb-text-muted))]">{t("import.hint")}</p>
              <div>
                <label className={labelClass}>{t("import.file")}</label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[rgb(var(--rb-surface-border))]/80 bg-[rgb(var(--rb-surface-2))]/40 px-3 py-2 text-sm font-medium text-[rgb(var(--rb-text-primary))] hover:bg-[rgb(var(--rb-surface-2))]/70">
                    <FileUp className="h-4 w-4" />
                    {t("import.choose")}
                    <input
                      type="file"
                      accept=".docx,.xlsx,.xls,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setFile(f);
                        setError(null);
                      }}
                    />
                  </label>
                  {file && <span className="text-sm text-[rgb(var(--rb-text-muted))]">{file.name}</span>}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {warnings.length > 0 && (
                <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-sm text-amber-900">
                  <p className="mb-1 flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {t("import.warnings")}
                  </p>
                  <ul className="list-inside list-disc space-y-0.5 text-amber-900/90">
                    {warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <label className={labelClass}>{t("drawer.title")}</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t("drawer.objective")}</label>
                <textarea
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  rows={3}
                  className={textareaClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>{t("drawer.module")}</label>
                  <select value={module} onChange={(e) => setModule(e.target.value)} className={inputClass}>
                    {SAP_TEST_MODULE_OPTIONS.map((o) => (
                      <option key={o.value || "empty"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{t("drawer.testType")}</label>
                  <select value={testType} onChange={(e) => setTestType(e.target.value)} className={inputClass}>
                    <option value="uat">{t("type.uat")}</option>
                    <option value="sit">{t("type.sit")}</option>
                    <option value="regression">{t("type.regression")}</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{t("drawer.priority")}</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}>
                    <option value="low">{t("priority.low")}</option>
                    <option value="medium">{t("priority.medium")}</option>
                    <option value="high">{t("priority.high")}</option>
                    <option value="critical">{t("priority.critical")}</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{t("drawer.status")}</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
                    <option value="draft">{t("status.draft")}</option>
                    <option value="ready">{t("status.ready")}</option>
                    <option value="archived">{t("status.archived")}</option>
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
                />
              </div>
              <div>
                <label className={labelClass}>{t("drawer.testData")}</label>
                <textarea value={testData} onChange={(e) => setTestData(e.target.value)} rows={2} className={textareaClass} />
              </div>
              <div>
                <label className={labelClass}>{t("drawer.expectedResult")}</label>
                <textarea
                  value={expectedResult}
                  onChange={(e) => setExpectedResult(e.target.value)}
                  rows={2}
                  className={textareaClass}
                />
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("import.sourceSection")}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>{t("import.sourceType")}</label>
                    <select
                      value={sourceImportType}
                      onChange={(e) => setSourceImportType(e.target.value as "sap_docx" | "sap_xlsx")}
                      className={inputClass}
                    >
                      <option value="sap_docx">SAP (Word)</option>
                      <option value="sap_xlsx">SAP (Excel)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{t("import.scopeItem")}</label>
                    <input
                      type="text"
                      value={scopeItemCode}
                      onChange={(e) => setScopeItemCode(e.target.value)}
                      className={inputClass}
                      placeholder="e.g. 1P9"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>{t("import.scenarioPath")}</label>
                    <input
                      type="text"
                      value={scenarioPath}
                      onChange={(e) => setScenarioPath(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t("import.sourceDoc")}</label>
                    <input
                      type="text"
                      value={sourceDocumentName}
                      onChange={(e) => setSourceDocumentName(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t("import.sourceLang")}</label>
                    <input
                      type="text"
                      value={sourceLanguage}
                      onChange={(e) => setSourceLanguage(e.target.value)}
                      className={inputClass}
                      placeholder="EN / ES"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>{t("import.businessRoles")}</label>
                  <textarea
                    value={businessRolesText}
                    onChange={(e) => setBusinessRolesText(e.target.value)}
                    rows={3}
                    className={textareaClass}
                    placeholder={t("import.businessRolesPlaceholder")}
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className={labelClass}>{t("drawer.steps")}</span>
                  <button
                    type="button"
                    onClick={addStep}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("drawer.addStep")}
                  </button>
                </div>
                <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                  {steps.map((st, i) => (
                    <div key={i} className="rounded-xl border border-slate-200/90 bg-white p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-500">#{i + 1}</span>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-xs text-slate-600">
                            <input
                              type="checkbox"
                              checked={st.optional_flag}
                              onChange={(e) =>
                                setSteps((prev) =>
                                  prev.map((p, j) => (j === i ? { ...p, optional_flag: e.target.checked } : p))
                                )
                              }
                            />
                            {t("drawer.stepOptional")}
                          </label>
                          {steps.length > 1 && (
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
                      </div>
                      <label className={labelClass}>{t("drawer.stepName")}</label>
                      <input
                        type="text"
                        value={st.step_name}
                        onChange={(e) =>
                          setSteps((prev) => prev.map((p, j) => (j === i ? { ...p, step_name: e.target.value } : p)))
                        }
                        className={inputClass}
                      />
                      <label className={`${labelClass} mt-2`}>{t("drawer.stepInstruction")}</label>
                      <textarea
                        value={st.instruction}
                        onChange={(e) =>
                          setSteps((prev) => prev.map((p, j) => (j === i ? { ...p, instruction: e.target.value } : p)))
                        }
                        rows={2}
                        className={textareaClass}
                      />
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div>
                          <label className={labelClass}>{t("drawer.stepExpected")}</label>
                          <textarea
                            value={st.expected_result}
                            onChange={(e) =>
                              setSteps((prev) =>
                                prev.map((p, j) => (j === i ? { ...p, expected_result: e.target.value } : p))
                              )
                            }
                            rows={2}
                            className={textareaClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>{t("drawer.stepTransaction")}</label>
                          <input
                            type="text"
                            value={st.transaction_or_app}
                            onChange={(e) =>
                              setSteps((prev) =>
                                prev.map((p, j) => (j === i ? { ...p, transaction_or_app: e.target.value } : p))
                              )
                            }
                            className={inputClass}
                          />
                          <label className={`${labelClass} mt-2`}>{t("drawer.stepRole")}</label>
                          <input
                            type="text"
                            value={st.business_role}
                            onChange={(e) =>
                              setSteps((prev) =>
                                prev.map((p, j) => (j === i ? { ...p, business_role: e.target.value } : p))
                              )
                            }
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <label className={`${labelClass} mt-2`}>{t("drawer.stepDataNotes")}</label>
                      <textarea
                        value={st.test_data_notes}
                        onChange={(e) =>
                          setSteps((prev) =>
                            prev.map((p, j) => (j === i ? { ...p, test_data_notes: e.target.value } : p))
                          )
                        }
                        rows={1}
                        className={textareaClass}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] px-4 py-3">
          {phase === "review" ? (
            <button
              type="button"
              onClick={() => {
                setPhase("pick");
                setWarnings([]);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("import.back")}
            </button>
          ) : null}
          {phase === "pick" ? (
            <button
              type="button"
              disabled={parsing || !file}
              onClick={() => void parseFile()}
              className="inline-flex items-center justify-center rounded-xl bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {parsing ? t("import.parsing") : t("import.parse")}
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || !title.trim()}
              onClick={() => void saveDraft()}
              className="inline-flex items-center justify-center rounded-xl bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? t("drawer.saving") : t("import.saveDraft")}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
