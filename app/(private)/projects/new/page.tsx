"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { createDefaultPhasesForProject } from "@/lib/services/projectPhaseService";
import { INDUSTRY_OPTIONS, ACCOUNT_TIER_OPTIONS } from "@/lib/constants/clientOptions";
import { getAllCountryOptions, getStateOptions, getCountryDisplayName } from "@/lib/countryStateCity";
import {
  FORM_FOOTER_ACTIONS_CLASS,
  FORM_PAGE_BLOCK_CLASS,
  FORM_PAGE_SHELL_CLASS,
  FORM_PAGE_SUBTITLE_CLASS,
  FORM_PAGE_TITLE_BLOCK_CLASS,
  FORM_PAGE_TITLE_CLASS,
  FORM_SECTION_DIVIDER_CLASS,
  FORM_SECTION_HELPER_CLASS,
  FORM_SECTION_TITLE_CLASS,
} from "@/components/layout/formPageClasses";

type Client = {
  id: string;
  name: string;
  display_name?: string | null;
  country: string | null;
  industry?: string | null;
  account_tier?: string | null;
  sap_relevance_summary?: string | null;
};

type Module = {
  id: string;
  code: string;
  name: string;
};

const ENVIRONMENT_OPTIONS = [
  { label: "S/4HANA Public Cloud", value: "cloud_public" },
  { label: "S/4HANA On-Premise", value: "on_premise" },
];

const STATUS_OPTIONS = [
  { label: "Planned", value: "planned" },
  { label: "In progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Archived", value: "archived" },
];

export default function NewProjectPage() {
  const router = useRouter();

  // Datos básicos
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Contexto SAP
  const [environmentType, setEnvironmentType] = useState("cloud_public");
  const [sapVersion, setSapVersion] = useState("");
  const [startDate, setStartDate] = useState("");
  const [plannedEndDate, setPlannedEndDate] = useState("");
  const [status, setStatus] = useState("planned");

  // Cliente
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<string>("");

  // Módulos
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);

  // Control UI
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [planWarning, setPlanWarning] = useState<string | null>(null);

  // Modal crear cliente rápido
  const [createClientModalOpen, setCreateClientModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientIndustry, setNewClientIndustry] = useState("");
  const [newClientCountry, setNewClientCountry] = useState("");
  const [newClientRegion, setNewClientRegion] = useState("");
  const [newClientAccountTier, setNewClientAccountTier] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);
  const [createClientError, setCreateClientError] = useState<string | null>(null);

  // Access guard: only users with create_project may use this page
  const [createAllowed, setCreateAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setCreateAllowed(false);
        return;
      }
      const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      if (cancelled) return;
      const data = await res.json().catch(() => ({}));
      const perms = (data as { permissions?: { createProject?: boolean } }).permissions;
      setCreateAllowed(perms?.createProject ?? false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (createAllowed === false) {
      router.replace("/projects");
    }
  }, [createAllowed, router]);

  // ==========================
  // CARGA DE CLIENTES Y MÓDULOS
  // ==========================
  const loadClients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, display_name, country, industry, account_tier, sap_relevance_summary")
        .order("name", { ascending: true });
      if (error) {
        handleSupabaseError("clients", error);
        setClients([]);
      } else {
        setClients((data ?? []) as Client[]);
      }
    } catch (err) {
      handleSupabaseError("projects/new loadClients", err);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [{ data: clientData, error: clientError }, { data: moduleData, error: moduleError }] =
          await Promise.all([
            supabase
              .from("clients")
              .select("id, name, display_name, country, industry")
              .order("name", { ascending: true }),
            supabase
              .from("modules")
              .select("id, code, name")
              .order("code", { ascending: true }),
          ]);

        if (clientError) {
          handleSupabaseError("clients", clientError);
          setClients([]);
        } else {
          setClients((clientData ?? []) as Client[]);
        }

        if (moduleError) {
          handleSupabaseError("modules", moduleError);
          setModules([]);
        } else {
          setModules(moduleData ?? []);
        }
      } catch (err) {
        handleSupabaseError("projects/new loadData", err);
      }
    };

    loadData();
  }, []);

  // ==========================
  // HANDLERS
  // ==========================
  const toggleModuleSelection = (moduleId: string) => {
    setSelectedModuleIds((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const handleCreateClient = async (e: FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || creatingClient) return;
    setCreatingClient(true);
    setCreateClientError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const body: Record<string, unknown> = { name: newClientName.trim() };
      if (newClientIndustry.trim()) body.industry = newClientIndustry.trim();
      if (newClientCountry.trim()) body.country = newClientCountry.trim();
      if (newClientAccountTier.trim()) body.account_tier = newClientAccountTier.trim();
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        client?: { id: string; name: string; display_name?: string | null; country?: string | null; industry?: string | null; account_tier?: string | null; sap_relevance_summary?: string | null };
      };
      if (!res.ok) {
        setCreateClientError(data.error ?? "Could not create the client.");
        return;
      }
      if (data.client) {
        const c = data.client;
        setNewClientName("");
        setNewClientIndustry("");
        setNewClientCountry("");
        setNewClientRegion("");
        setNewClientAccountTier("");
        setCreateClientModalOpen(false);
        setClients((prev) =>
          [...prev, { id: c.id, name: c.name, display_name: c.display_name ?? null, country: c.country ?? null, industry: c.industry ?? null, account_tier: c.account_tier ?? null, sap_relevance_summary: c.sap_relevance_summary ?? null }].sort((a, b) => (a.display_name || a.name).localeCompare(b.display_name || b.name))
        );
        setClientId(c.id);
      }
    } catch {
      setCreateClientError("Connection error. Please try again.");
    } finally {
      setCreatingClient(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validaciones básicas
    if (!name.trim()) {
      setErrorMsg("Project name is required.");
      return;
    }

    if (!environmentType) {
      setErrorMsg("Please specify the SAP environment type.");
      return;
    }

    setSaving(true);
    setPlanWarning(null);

    const safeStatus = status || "planned";
    const safeEnvironmentType = environmentType || "cloud_public";

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        client_id: clientId || null,
        environment_type: safeEnvironmentType,
        status: safeStatus,
        start_date: startDate || null,
        planned_end_date: plannedEndDate || null,
      };

      // 1) Create project via API (enforces create_project permission)
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const createRes = await fetch("/api/projects", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const createData = (await createRes.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
        quota?: { quotaKey?: string; current?: number; limit?: number | null };
      };

      if (!createRes.ok || !createData.id) {
        if (createRes.status === 403) {
          setErrorMsg("You don't have permission to create projects.");
        } else if (createRes.status === 409 && createData.quota?.limit != null) {
          setErrorMsg(
            `You’ve reached the maximum number of allowed projects (${createData.quota.current ?? 0} / ${createData.quota.limit}).`
          );
        } else {
          setErrorMsg(
            createData.error ??
              "Could not create the project. Review the form details or contact support."
          );
        }
        setSaving(false);
        return;
      }

      const projectId = createData.id;

      // 2) Phases + activities + tasks: if project has dates, use SAP Activate plan generator; otherwise create phases only
      let planFailed = false;
      if (startDate && plannedEndDate) {
        try {
          const { data: session } = await supabase.auth.getSession();
          const token = session?.session?.access_token;
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (token) headers.Authorization = `Bearer ${token}`;
          const planRes = await fetch(`/api/projects/${projectId}/generate-activate-plan`, {
            method: "POST",
            headers,
          });
          const planJson = (await planRes.json().catch(() => ({}))) as {
            ok?: boolean;
            skipped?: boolean;
            error?: string;
            message?: string;
          };
          if (!planRes.ok || planJson.error) {
            planFailed = true;
            setPlanWarning(
              planJson.message ??
                planJson.error ??
                "Could not generate the activity plan."
            );
          }
        } catch (planErr) {
          console.warn("Plan generation error", planErr);
          planFailed = true;
          setPlanWarning("Could not generate the activity plan.");
        }
      } else {
        await createDefaultPhasesForProject(projectId);
      }

      // 3) Insertar módulos relacionados (si hay)
      if (selectedModuleIds.length > 0) {
        const projectModulesPayload = selectedModuleIds.map((moduleId) => ({
          project_id: projectId,
          module_id: moduleId,
        }));

        const { error: projectModulesError } = await supabase
          .from("project_modules")
          .insert(projectModulesPayload);

        if (projectModulesError) {
          handleSupabaseError("project_modules insert", projectModulesError);
        }
      }

      // 5) Redirigir: al proyecto si hay fechas (para ver plan), o al listado
      if (startDate && plannedEndDate) {
        router.push(planFailed ? `/projects/${projectId}?planGenerated=false` : `/projects/${projectId}`);
      } else {
        router.push("/projects");
      }
    } catch (err) {
      handleSupabaseError("projects new submit", err);
      setErrorMsg("An unexpected error occurred.");
      setSaving(false);
    }
  };

  // ==========================
  // RENDER
  // ==========================
  if (createAllowed === null) {
    return (
      <div className="w-full min-w-0 bg-[rgb(var(--rb-shell-bg))]">
        <div className={FORM_PAGE_SHELL_CLASS}>
          <div className={FORM_PAGE_BLOCK_CLASS}>
          <p className="text-sm text-[rgb(var(--rb-text-secondary))]">Checking permissions…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 bg-[rgb(var(--rb-shell-bg))]">
      <div className={FORM_PAGE_SHELL_CLASS}>
        <div className={FORM_PAGE_BLOCK_CLASS}>
        {/* HEADER */}
        <header className="mb-8">
          <div className={FORM_PAGE_TITLE_BLOCK_CLASS}>
            <h1 className={FORM_PAGE_TITLE_CLASS}>New project</h1>
            <p className={FORM_PAGE_SUBTITLE_CLASS}>
            Define the key details of your SAP project. This information powers the dashboard,
            notes, and the AI assistant context.
            </p>
          </div>
        </header>

        {/* CARD PRINCIPAL */}
        <div className="bg-[rgb(var(--rb-surface))] rounded-2xl shadow-md border border-[rgb(var(--rb-surface-border))]/70 p-6 space-y-7">
          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mb-2">
              {errorMsg}
            </div>
          )}
          {planWarning && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 mb-2">
              {planWarning}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-7">
            {/* DATOS BÁSICOS */}
            <section className="space-y-4">
              <h2 className={FORM_SECTION_TITLE_CLASS}>Basic information</h2>
              <p className={FORM_SECTION_HELPER_CLASS}>Project name, client, and a brief overview.</p>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[rgb(var(--rb-text-secondary))]">
                    Project name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. S/4HANA Public Cloud implementation · TP entities"
                    className="w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[rgb(var(--rb-text-secondary))]">
                    Client
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className="flex-1 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/30"
                    >
                      <option value="">No client assigned yet</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.display_name || client.name}
                          {client.country ? ` · ${getCountryDisplayName(client.country)}` : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setCreateClientError(null);
                        setNewClientName("");
                        setCreateClientModalOpen(true);
                      }}
                      className="rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] px-3 py-2.5 text-sm font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface))]/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--rb-shell-bg))] focus:border-[rgb(var(--rb-brand-primary))]/30"
                    >
                      Create client
                    </button>
                  </div>
                  <p className="text-[11px] text-[rgb(var(--rb-text-secondary))]">
                    If this is an internal project or not defined yet, you can leave it blank.
                  </p>
                  {clientId && (() => {
                    const client = clients.find((c) => c.id === clientId);
                    if (!client) return null;
                    return (
                      <div className="mt-3 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-3))]/40 p-3 text-sm">
                        <p className="font-medium text-[rgb(var(--rb-text-primary))]">{client.display_name || client.name}</p>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[rgb(var(--rb-text-secondary))]">
                          {client.country && <span>Country: {getCountryDisplayName(client.country)}</span>}
                          {client.industry && <span>Industry: {client.industry}</span>}
                          {client.account_tier && <span>Tier: {client.account_tier}</span>}
                        </div>
                        {client.sap_relevance_summary && (
                          <p className="mt-2 text-xs text-[rgb(var(--rb-text-secondary))] line-clamp-2">{client.sap_relevance_summary}</p>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[rgb(var(--rb-text-secondary))]">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Briefly describe the functional scope, modules involved, and the main goal."
                    className="w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/30 resize-none"
                  />
                </div>
              </div>
            </section>

            {/* CONTEXTO SAP */}
            <section className={`space-y-4 ${FORM_SECTION_DIVIDER_CLASS}`}>
              <h2 className={FORM_SECTION_TITLE_CLASS}>SAP context</h2>
              <p className={FORM_SECTION_HELPER_CLASS}>
                Technical basics of the environment where the project will run.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[rgb(var(--rb-text-secondary))]">
                    Environment type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={environmentType}
                    onChange={(e) => setEnvironmentType(e.target.value)}
                    className="w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2.5 text-sm shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/30"
                  >
                    {ENVIRONMENT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[rgb(var(--rb-text-secondary))]">
                    SAP version / release
                  </label>
                  <input
                    type="text"
                    value={sapVersion}
                    onChange={(e) => setSapVersion(e.target.value)}
                    placeholder="e.g. S/4HANA 2023 FPS01 · Public Cloud 2408"
                    className="w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/30"
                  />
                  <p className="text-[11px] text-[rgb(var(--rb-text-secondary))]">
                    Helps distinguish ECC vs S/4, Public Cloud releases, and more.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[rgb(var(--rb-text-secondary))]">
                    Planned start date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[rgb(var(--rb-text-secondary))]">
                    Planned end date
                  </label>
                  <input
                    type="date"
                    value={plannedEndDate}
                    onChange={(e) => setPlannedEndDate(e.target.value)}
                    className="w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/30"
                  />
                  <p className="text-[11px] text-[rgb(var(--rb-text-secondary))]">
                    If you provide both dates, we’ll generate an initial SAP Activate activity plan.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[rgb(var(--rb-text-secondary))]">
                    Project status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2.5 text-sm shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/30"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* MÓDULOS RELACIONADOS */}
            <section className={`space-y-4 ${FORM_SECTION_DIVIDER_CLASS}`}>
              <h2 className={FORM_SECTION_TITLE_CLASS}>Related modules</h2>
              <p className={FORM_SECTION_HELPER_CLASS}>
                Select the SAP modules included in this project scope. This will be used in the dashboard,
                summaries, and AI context.
              </p>

              {modules.length === 0 ? (
                <p className="text-xs text-[rgb(var(--rb-text-secondary))]">
                  No modules are configured yet in the <code>modules</code> table.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-2">
                  {modules.map((m) => {
                    const checked = selectedModuleIds.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs cursor-pointer transition-[border-color,background-color,transform,box-shadow] duration-150 hover:shadow-sm hover:-translate-y-[1px]
                          ${
                            checked
                              ? "border-[rgb(var(--rb-brand-primary))]/35 bg-[rgb(var(--rb-brand-primary))]/10 text-[rgb(var(--rb-brand-primary))]"
                              : "border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/50 text-[rgb(var(--rb-text-primary))] hover:border-[rgb(var(--rb-brand-primary-hover))]/60"
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleModuleSelection(m.id)}
                          className="h-3.5 w-3.5 rounded border-[rgb(var(--rb-surface-border))]/70 text-[rgb(var(--rb-brand-primary))] focus:ring-[rgb(var(--rb-brand-ring))]/35"
                        />
                        <span className="truncate">
                          <span className="font-medium">{m.code}</span>
                          {m.name ? ` · ${m.name}` : ""}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              <p className="text-[11px] text-[rgb(var(--rb-text-secondary))]">
                You can add or remove modules later from the project page if you expand the scope.
              </p>
            </section>

            {/* ACCIONES */}
            <div className={FORM_FOOTER_ACTIONS_CLASS}>
              <button
                type="button"
                onClick={() => router.push("/projects")}
                className="inline-flex items-center rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] px-4 py-2.5 text-sm font-medium text-[rgb(var(--rb-text-secondary))] transition-colors hover:bg-[rgb(var(--rb-surface))]/80"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[rgb(var(--rb-brand-primary-hover))] active:bg-[rgb(var(--rb-brand-primary-active))] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/40"
              >
                {saving ? "Saving..." : "Create project"}
              </button>
            </div>
          </form>
        </div>

        {/* Modal Crear cliente rápido */}
        {createClientModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => !creatingClient && setCreateClientModalOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-[rgb(var(--rb-text-primary))] mb-1">
                Create client
              </h3>
              <p className="text-xs text-[rgb(var(--rb-text-muted))] mb-4">
                You can add more client details later in the Clients section.
              </p>
              <form onSubmit={handleCreateClient} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[rgb(var(--rb-text-secondary))] mb-1">
                    Client name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] px-3 py-2.5 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/35 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={creatingClient}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[rgb(var(--rb-text-secondary))] mb-1">
                    Industry
                  </label>
                  <select
                    value={newClientIndustry}
                    onChange={(e) => setNewClientIndustry(e.target.value)}
                    className="w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] px-3 py-2.5 text-sm shadow-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/35 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={creatingClient}
                  >
                    {INDUSTRY_OPTIONS.map((o) => (
                      <option key={o.value || "_"} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[rgb(var(--rb-text-secondary))] mb-1">
                    Country
                  </label>
                  <select
                    value={newClientCountry}
                    onChange={(e) => { setNewClientCountry(e.target.value); setNewClientRegion(""); }}
                    className="w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] px-3 py-2.5 text-sm shadow-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/35 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={creatingClient}
                  >
                    <option value="">—</option>
                    {getAllCountryOptions().map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[rgb(var(--rb-text-secondary))] mb-1">
                    Region / State
                  </label>
                  <select
                    value={newClientRegion}
                    onChange={(e) => setNewClientRegion(e.target.value)}
                    className="w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] px-3 py-2.5 text-sm shadow-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/35 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={creatingClient}
                  >
                    <option value="">—</option>
                    {getStateOptions(newClientCountry).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[rgb(var(--rb-text-secondary))] mb-1">
                    Tier
                  </label>
                  <select
                    value={newClientAccountTier}
                    onChange={(e) => setNewClientAccountTier(e.target.value)}
                    className="w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] px-3 py-2.5 text-sm shadow-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/35 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={creatingClient}
                  >
                    {ACCOUNT_TIER_OPTIONS.map((o) => (
                      <option key={o.value || "_"} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                {createClientError && (
                  <p className="text-sm text-red-600">{createClientError}</p>
                )}
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => !creatingClient && setCreateClientModalOpen(false)}
                    className="rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] px-4 py-2.5 text-sm font-medium text-[rgb(var(--rb-text-secondary))] transition-colors hover:bg-[rgb(var(--rb-surface))]/80"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newClientName.trim() || creatingClient}
                    className="rounded-xl bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[rgb(var(--rb-brand-primary-hover))] active:bg-[rgb(var(--rb-brand-primary-active))] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/40"
                  >
                    {creatingClient ? "Creating…" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}