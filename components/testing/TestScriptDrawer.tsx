"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Plus, Trash2 } from "lucide-react";
import type { SourceImportType, TestExecutionRow, TestScriptWithViewerContext } from "@/lib/types/testing";
import { RunExecutionModal } from "@/components/testing/RunExecutionModal";
import { TraceabilityEntityPicker } from "@/components/testing/TraceabilityEntityPicker";
import { SAP_TEST_MODULE_OPTIONS } from "@/lib/testing/sapModuleCatalog";

type ActivityForm = {
  id: string;
  scenario_name: string;
  activity_title: string;
  activity_target_name: string;
  activity_target_url: string;
  business_role: string;
  activity_order: number;
};

type StepForm = {
  id?: string;
  activity_id: string;
  instruction: string;
  expected_result: string;
  step_name: string;
  optional_flag: boolean;
  transaction_or_app: string;
  business_role: string;
  test_data_notes: string;
};

const inputClass =
  "w-full min-h-10 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35";
const textareaClass =
  "w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35";
const labelClass = "mb-1 block text-xs font-medium text-[rgb(var(--rb-text-muted))]";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyStep(): StepForm {
  return {
    activity_id: "",
    instruction: "",
    expected_result: "",
    step_name: "",
    optional_flag: false,
    transaction_or_app: "",
    business_role: "",
    test_data_notes: "",
  };
}

function emptyActivity(order: number): ActivityForm {
  return {
    id: newId(),
    scenario_name: "",
    activity_title: "",
    activity_target_name: "",
    activity_target_url: "",
    business_role: "",
    activity_order: order,
  };
}

function formatBusinessRoles(br: unknown): string {
  if (Array.isArray(br)) {
    return br.filter((x): x is string => typeof x === "string").join("\n");
  }
  return "";
}

function asSourceImportType(v: unknown): SourceImportType {
  if (v === "sap_docx" || v === "sap_xlsx" || v === "manual" || v === "structured_template") return v;
  return "manual";
}

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
  const [businessConditions, setBusinessConditions] = useState("");
  const [referenceNotes, setReferenceNotes] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [scenarioPath, setScenarioPath] = useState("");
  const [scopeItemCode, setScopeItemCode] = useState("");
  const [sourceDocumentName, setSourceDocumentName] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("");
  const [businessRolesText, setBusinessRolesText] = useState("");
  const [sourceImportType, setSourceImportType] = useState<SourceImportType>("manual");
  const [relatedTaskId, setRelatedTaskId] = useState("");
  const [relatedTicketId, setRelatedTicketId] = useState("");
  const [relatedKnowledgePageId, setRelatedKnowledgePageId] = useState("");
  const [activities, setActivities] = useState<ActivityForm[]>([]);
  const [steps, setSteps] = useState<StepForm[]>([emptyStep()]);
  const [executions, setExecutions] = useState<TestExecutionRow[]>([]);
  const [loadedScript, setLoadedScript] = useState<TestScriptWithViewerContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runOpen, setRunOpen] = useState(false);
  const hadStructuredRef = useRef(false);

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
      const script = sData as TestScriptWithViewerContext;
      setLoadedScript(script);
      setTitle(script.title ?? "");
      setObjective(script.objective ?? "");
      setModule(script.module ?? "");
      setTestType(script.test_type ?? "uat");
      setPriority(script.priority ?? "");
      setStatus(script.status ?? "draft");
      setPreconditions(script.preconditions ?? "");
      setTestData(script.test_data ?? "");
      setBusinessConditions(script.business_conditions ?? "");
      setReferenceNotes(script.reference_notes ?? "");
      setExpectedResult(script.expected_result ?? "");
      setScenarioPath(script.scenario_path ?? "");
      setScopeItemCode(script.scope_item_code ?? "");
      setSourceDocumentName(script.source_document_name ?? "");
      setSourceLanguage(script.source_language ?? "");
      setBusinessRolesText(formatBusinessRoles(script.business_roles));
      setSourceImportType(asSourceImportType(script.source_import_type));
      setRelatedTaskId(script.related_task_id ?? "");
      setRelatedTicketId(script.related_ticket_id ?? "");
      setRelatedKnowledgePageId(script.related_knowledge_page_id ?? "");
      const grouped = (script.activities?.length ?? 0) > 0;
      hadStructuredRef.current = grouped;
      setActivities(
        grouped
          ? (script.activities ?? []).map((a) => ({
              id: a.id,
              scenario_name: a.scenario_name ?? "",
              activity_title: a.activity_title ?? "",
              activity_target_name: a.activity_target_name ?? "",
              activity_target_url: a.activity_target_url ?? "",
              business_role: a.business_role ?? "",
              activity_order: a.activity_order,
            }))
          : []
      );
      const st = (script.steps ?? []).map((x) => ({
        id: x.id,
        activity_id: x.activity_id ?? "",
        instruction: x.instruction ?? "",
        expected_result: x.expected_result ?? "",
        step_name: x.step_name ?? "",
        optional_flag: Boolean(x.optional_flag),
        transaction_or_app: x.transaction_or_app ?? "",
        business_role: x.business_role ?? "",
        test_data_notes: x.test_data_notes ?? "",
      }));
      setSteps(st.length > 0 ? st : [emptyStep()]);

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
      setBusinessConditions("");
      setReferenceNotes("");
      setExpectedResult("");
      setScenarioPath("");
      setScopeItemCode("");
      setSourceDocumentName("");
      setSourceLanguage("");
      setBusinessRolesText("");
      setSourceImportType("manual");
      setRelatedTaskId("");
      setRelatedTicketId("");
      setRelatedKnowledgePageId("");
      setLoadedScript(null);
      setActivities([]);
      hadStructuredRef.current = false;
      setSteps([emptyStep()]);
      setExecutions([]);
      setError(null);
      return;
    }
    void loadScript();
  }, [open, scriptId, loadScript]);

  const addStep = () => setSteps((s) => [...s, emptyStep()]);
  const removeStep = (i: number) => {
    if (!canEdit) return;
    if (steps.length <= 1) return;
    if (!confirm(t("drawer.confirmRemoveStep"))) return;
    setSteps((s) => (s.length <= 1 ? s : s.filter((_, j) => j !== i)));
  };

  const addActivity = () => {
    hadStructuredRef.current = true;
    setActivities((prev) => [...prev, emptyActivity(prev.length)]);
  };

  const removeActivity = (id: string) => {
    if (!canEdit) return;
    if (!confirm(t("drawer.confirmRemoveActivity"))) return;
    setActivities((prev) => prev.filter((a) => a.id !== id));
    setSteps((prev) =>
      prev.map((s) => (s.activity_id === id ? { ...s, activity_id: "" } : s))
    );
  };

  const buildPayload = () => {
    const roles = businessRolesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const shouldSyncActivities = activities.length > 0 || hadStructuredRef.current;

    const activitiesPayload = [...activities]
      .sort((a, b) => a.activity_order - b.activity_order)
      .map((a, idx) => ({
        id: a.id,
        scenario_name: a.scenario_name.trim() || null,
        activity_title: a.activity_title.trim() || "Activity",
        activity_target_name: a.activity_target_name.trim() || null,
        activity_target_url: a.activity_target_url.trim() || null,
        business_role: a.business_role.trim() || null,
        activity_order: idx,
      }));

    const stepsPayload = steps.map((st, i) => {
      const base: Record<string, unknown> = {
        id: st.id,
        step_order: i,
        instruction: st.instruction,
        expected_result: st.expected_result || null,
        step_name: st.step_name.trim() || null,
        optional_flag: st.optional_flag,
        transaction_or_app: st.transaction_or_app.trim() || null,
        business_role: st.business_role.trim() || null,
        test_data_notes: st.test_data_notes.trim() || null,
      };
      if (shouldSyncActivities) {
        base.activity_id = st.activity_id?.trim() || null;
      }
      return base;
    });

    return {
      title,
      objective: objective || null,
      module: module || null,
      test_type: testType,
      priority: priority || null,
      status,
      preconditions: preconditions || null,
      test_data: testData || null,
      business_conditions: businessConditions.trim() || null,
      reference_notes: referenceNotes.trim() || null,
      expected_result: expectedResult || null,
      scenario_path: scenarioPath.trim() || null,
      scope_item_code: scopeItemCode.trim() || null,
      source_document_name: sourceDocumentName.trim() || null,
      source_language: sourceLanguage.trim() || null,
      business_roles: roles,
      source_import_type: sourceImportType,
      related_task_id: relatedTaskId.trim() || null,
      related_ticket_id: relatedTicketId.trim() || null,
      related_knowledge_page_id: relatedKnowledgePageId.trim() || null,
      stepsPayload,
      activitiesPayload,
      shouldSyncActivities,
    };
  };

  const stepCreateShape = (st: StepForm) => ({
    instruction: st.instruction,
    expected_result: st.expected_result || null,
    step_name: st.step_name.trim() || null,
    optional_flag: st.optional_flag,
    transaction_or_app: st.transaction_or_app.trim() || null,
    business_role: st.business_role.trim() || null,
    test_data_notes: st.test_data_notes.trim() || null,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    const p = buildPayload();
    try {
      if (!scriptId) {
        const useNested =
          p.shouldSyncActivities &&
          p.activitiesPayload.length > 0 &&
          steps.some((s) => s.activity_id?.trim());

        let body: Record<string, unknown> = {
          title: p.title,
          objective: p.objective,
          module: p.module,
          test_type: p.test_type,
          priority: p.priority,
          status: p.status,
          preconditions: p.preconditions,
          test_data: p.test_data,
          business_conditions: p.business_conditions,
          reference_notes: p.reference_notes,
          expected_result: p.expected_result,
          scenario_path: p.scenario_path,
          scope_item_code: p.scope_item_code,
          source_document_name: p.source_document_name,
          source_language: p.source_language,
          business_roles: p.business_roles,
          source_import_type: p.source_import_type,
          related_task_id: p.related_task_id,
          related_ticket_id: p.related_ticket_id,
          related_knowledge_page_id: p.related_knowledge_page_id,
        };

        if (useNested) {
          const nested = p.activitiesPayload.map((act) => ({
            id: act.id,
            scenario_name: act.scenario_name,
            activity_title: act.activity_title,
            activity_target_name: act.activity_target_name,
            activity_target_url: act.activity_target_url,
            business_role: act.business_role,
            activity_order: act.activity_order,
            steps: steps.filter((s) => s.activity_id === act.id).map(stepCreateShape),
          }));
          const orphan = steps.filter((s) => !s.activity_id?.trim());
          if (orphan.length > 0) {
            const gid = newId();
            nested.push({
              id: gid,
              scenario_name: null,
              activity_title: "General",
              activity_target_name: null,
              activity_target_url: null,
              business_role: null,
              activity_order: nested.length,
              steps: orphan.map(stepCreateShape),
            });
          }
          body.activities = nested.filter((a) => a.steps.length > 0);
        } else {
          body.steps = steps.map(stepCreateShape);
        }

        const res = await fetch(`/api/projects/${projectId}/testing/scripts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Save failed");
      } else {
        const patchBody: Record<string, unknown> = {
          title: p.title,
          objective: p.objective,
          module: p.module,
          test_type: p.test_type,
          priority: p.priority,
          status: p.status,
          preconditions: p.preconditions,
          test_data: p.test_data,
          business_conditions: p.business_conditions,
          reference_notes: p.reference_notes,
          expected_result: p.expected_result,
          scenario_path: p.scenario_path,
          scope_item_code: p.scope_item_code,
          source_document_name: p.source_document_name,
          source_language: p.source_language,
          business_roles: p.business_roles,
          source_import_type: p.source_import_type,
          related_task_id: p.related_task_id,
          related_ticket_id: p.related_ticket_id,
          related_knowledge_page_id: p.related_knowledge_page_id,
          steps: p.stepsPayload,
        };
        if (p.shouldSyncActivities) {
          patchBody.activities = p.activitiesPayload;
        }
        const res = await fetch(`/api/projects/${projectId}/testing/scripts/${scriptId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(patchBody),
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
                    <select
                      value={module}
                      onChange={(e) => setModule(e.target.value)}
                      className={inputClass}
                      disabled={!canEdit}
                    >
                      {SAP_TEST_MODULE_OPTIONS.map((o) => (
                        <option key={o.value || "empty"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{t("drawer.testType")}</label>
                    <select
                      value={testType}
                      onChange={(e) => setTestType(e.target.value)}
                      className={inputClass}
                      disabled={!canEdit}
                    >
                      <option value="uat">{t("type.uat")}</option>
                      <option value="sit">{t("type.sit")}</option>
                      <option value="regression">{t("type.regression")}</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>{t("drawer.priority")}</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className={inputClass}
                      disabled={!canEdit}
                    >
                      <option value="">{t("priority.unset")}</option>
                      <option value="low">{t("priority.low")}</option>
                      <option value="medium">{t("priority.medium")}</option>
                      <option value="high">{t("priority.high")}</option>
                      <option value="critical">{t("priority.critical")}</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{t("drawer.status")}</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className={inputClass}
                      disabled={!canEdit}
                    >
                      <option value="draft">{t("status.draft")}</option>
                      <option value="ready_for_test">{t("status.ready_for_test")}</option>
                      <option value="in_review">{t("status.in_review")}</option>
                      <option value="approved">{t("status.approved")}</option>
                      <option value="obsolete">{t("status.obsolete")}</option>
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
                  <label className={labelClass}>{t("drawer.businessConditions")}</label>
                  <textarea
                    value={businessConditions}
                    onChange={(e) => setBusinessConditions(e.target.value)}
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
                <div>
                  <label className={labelClass}>{t("drawer.referenceNotes")}</label>
                  <p className="mb-1 text-[11px] text-[rgb(var(--rb-text-muted))]">{t("drawer.referenceNotesHint")}</p>
                  <textarea
                    value={referenceNotes}
                    onChange={(e) => setReferenceNotes(e.target.value)}
                    rows={3}
                    className={textareaClass}
                    disabled={!canEdit}
                  />
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("drawer.sourceSection")}
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={labelClass}>{t("drawer.sourceImportType")}</label>
                      <select
                        value={sourceImportType}
                        onChange={(e) => setSourceImportType(e.target.value as SourceImportType)}
                        className={inputClass}
                        disabled={!canEdit}
                      >
                        <option value="manual">{t("source.manual")}</option>
                        <option value="structured_template">{t("source.structuredTemplate")}</option>
                        <option value="sap_docx">{t("source.sapDocx")}</option>
                        <option value="sap_xlsx">{t("source.sapXlsx")}</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>{t("import.scenarioPath")}</label>
                      <input
                        type="text"
                        value={scenarioPath}
                        onChange={(e) => setScenarioPath(e.target.value)}
                        className={inputClass}
                        disabled={!canEdit}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t("import.scopeItem")}</label>
                      <input
                        type="text"
                        value={scopeItemCode}
                        onChange={(e) => setScopeItemCode(e.target.value)}
                        className={inputClass}
                        disabled={!canEdit}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t("import.sourceDoc")}</label>
                      <input
                        type="text"
                        value={sourceDocumentName}
                        onChange={(e) => setSourceDocumentName(e.target.value)}
                        className={inputClass}
                        disabled={!canEdit}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t("import.sourceLang")}</label>
                      <input
                        type="text"
                        value={sourceLanguage}
                        onChange={(e) => setSourceLanguage(e.target.value)}
                        className={inputClass}
                        disabled={!canEdit}
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
                      disabled={!canEdit}
                      placeholder={t("import.businessRolesPlaceholder")}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("drawer.traceability")}</p>
                  <div>
                    <label className={labelClass}>{t("drawer.relatedTask")}</label>
                    <TraceabilityEntityPicker
                      projectId={projectId}
                      kind="task"
                      valueId={relatedTaskId}
                      onChangeId={setRelatedTaskId}
                      disabled={!canEdit}
                      emptyHint={t("traceabilityPicker.noTask")}
                      resolvedPreview={
                        scriptId && relatedTaskId && loadedScript?.traceability_linked?.task
                          ? {
                              title: loadedScript.traceability_linked.task.title,
                              subtitle: loadedScript.traceability_linked.task.badge,
                              meta: loadedScript.traceability_linked.task.meta,
                            }
                          : null
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t("drawer.relatedTicket")}</label>
                    <TraceabilityEntityPicker
                      projectId={projectId}
                      kind="ticket"
                      valueId={relatedTicketId}
                      onChangeId={setRelatedTicketId}
                      disabled={!canEdit}
                      emptyHint={t("traceabilityPicker.noTicket")}
                      resolvedPreview={
                        scriptId && relatedTicketId && loadedScript?.traceability_linked?.ticket
                          ? {
                              title: loadedScript.traceability_linked.ticket.title,
                              subtitle: loadedScript.traceability_linked.ticket.badge,
                              meta: loadedScript.traceability_linked.ticket.meta,
                            }
                          : null
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t("drawer.relatedKnowledgePage")}</label>
                    <TraceabilityEntityPicker
                      projectId={projectId}
                      kind="page"
                      valueId={relatedKnowledgePageId}
                      onChangeId={setRelatedKnowledgePageId}
                      disabled={!canEdit}
                      emptyHint={t("traceabilityPicker.noPage")}
                      resolvedPreview={
                        scriptId && relatedKnowledgePageId && loadedScript?.traceability_linked?.knowledge_page
                          ? {
                              title: loadedScript.traceability_linked.knowledge_page.title,
                              subtitle: loadedScript.traceability_linked.knowledge_page.badge,
                              meta: loadedScript.traceability_linked.knowledge_page.meta,
                            }
                          : null
                      }
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("drawer.activityGroups")}
                    </p>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={addActivity}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t("drawer.addActivity")}
                      </button>
                    )}
                  </div>
                  {activities.length === 0 ? (
                    <p className="text-xs text-slate-500">{t("drawer.activityGroupsHint")}</p>
                  ) : (
                    <div className="space-y-2">
                      {activities.map((a, ai) => (
                        <div key={a.id} className="rounded-lg border border-slate-200 bg-white p-2 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-600">#{ai + 1}</span>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => removeActivity(a.id)}
                                className="text-slate-400 hover:text-red-600"
                                aria-label={t("drawer.removeActivity")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={a.scenario_name}
                            onChange={(e) =>
                              setActivities((prev) =>
                                prev.map((x) => (x.id === a.id ? { ...x, scenario_name: e.target.value } : x))
                              )
                            }
                            className={inputClass}
                            placeholder={t("import.scenarioPath")}
                            disabled={!canEdit}
                          />
                          <input
                            type="text"
                            value={a.activity_title}
                            onChange={(e) =>
                              setActivities((prev) =>
                                prev.map((x) => (x.id === a.id ? { ...x, activity_title: e.target.value } : x))
                              )
                            }
                            className={inputClass}
                            placeholder={t("drawer.activityTitle")}
                            disabled={!canEdit}
                          />
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <input
                              type="text"
                              value={a.activity_target_name}
                              onChange={(e) =>
                                setActivities((prev) =>
                                  prev.map((x) =>
                                    x.id === a.id ? { ...x, activity_target_name: e.target.value } : x
                                  )
                                )
                              }
                              className={inputClass}
                              placeholder={t("drawer.activityTargetName")}
                              disabled={!canEdit}
                            />
                            <input
                              type="text"
                              value={a.activity_target_url}
                              onChange={(e) =>
                                setActivities((prev) =>
                                  prev.map((x) =>
                                    x.id === a.id ? { ...x, activity_target_url: e.target.value } : x
                                  )
                                )
                              }
                              className={inputClass}
                              placeholder={t("drawer.activityTargetUrl")}
                              disabled={!canEdit}
                            />
                          </div>
                          <input
                            type="text"
                            value={a.business_role}
                            onChange={(e) =>
                              setActivities((prev) =>
                                prev.map((x) => (x.id === a.id ? { ...x, business_role: e.target.value } : x))
                              )
                            }
                            className={inputClass}
                            placeholder={t("drawer.stepRole")}
                            disabled={!canEdit}
                          />
                        </div>
                      ))}
                    </div>
                  )}
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
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-medium text-slate-500">#{i + 1}</span>
                          <div className="flex items-center gap-3">
                            {canEdit && (
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
                            )}
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
                        </div>
                        <label className={labelClass}>{t("drawer.stepName")}</label>
                        <input
                          type="text"
                          value={st.step_name}
                          onChange={(e) =>
                            setSteps((prev) =>
                              prev.map((p, j) => (j === i ? { ...p, step_name: e.target.value } : p))
                            )
                          }
                          className={inputClass}
                          disabled={!canEdit}
                        />
                        {activities.length > 0 && (
                          <div className="mt-2">
                            <label className={labelClass}>{t("drawer.stepActivity")}</label>
                            <select
                              value={st.activity_id}
                              onChange={(e) =>
                                setSteps((prev) =>
                                  prev.map((p, j) => (j === i ? { ...p, activity_id: e.target.value } : p))
                                )
                              }
                              className={inputClass}
                              disabled={!canEdit}
                            >
                              <option value="">{t("procedure.ungrouped")}</option>
                              {activities.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.activity_title.trim() || a.id.slice(0, 8)}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        <label className={`${labelClass} mt-2`}>{t("drawer.stepInstruction")}</label>
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
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                              disabled={!canEdit}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>{t("drawer.stepRole")}</label>
                            <input
                              type="text"
                              value={st.business_role}
                              onChange={(e) =>
                                setSteps((prev) =>
                                  prev.map((p, j) => (j === i ? { ...p, business_role: e.target.value } : p))
                                )
                              }
                              className={inputClass}
                              disabled={!canEdit}
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
          }}
        />
      )}
    </>
  );
}
