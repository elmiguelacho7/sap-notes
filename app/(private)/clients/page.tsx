"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { ContentSkeleton } from "@/components/skeletons/ContentSkeleton";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";
import {
  INDUSTRY_OPTIONS,
  COMPANY_SIZE_OPTIONS,
  ACCOUNT_TIER_OPTIONS,
  OWNERSHIP_TYPE_OPTIONS,
  BUSINESS_MODEL_OPTIONS,
} from "@/lib/constants/clientOptions";
import {
  getAllCountryOptions,
  getStateOptions,
  resolveCountryOptionValue,
  resolveStateOptionValue,
  getCountryDisplayName,
} from "@/lib/countryStateCity";

async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Matches API response; extended fields optional for pre-migration compatibility. */
type ClientRow = {
  id: string;
  name: string;
  legal_name?: string | null;
  display_name?: string | null;
  tax_id?: string | null;
  website?: string | null;
  linkedin_url?: string | null;
  industry?: string | null;
  subindustry?: string | null;
  company_size_bucket?: string | null;
  employee_range?: string | null;
  annual_revenue_range?: string | null;
  country?: string | null;
  region?: string | null;
  preferred_language?: string | null;
  timezone?: string | null;
  parent_client_id?: string | null;
  account_group?: string | null;
  account_tier?: string | null;
  ownership_type?: string | null;
  business_model?: string | null;
  main_products_services?: string | null;
  sap_relevance_summary?: string | null;
  known_pain_points?: string | null;
  strategic_notes?: string | null;
  is_active?: boolean | null;
  created_at?: string;
  created_by?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
};

const EMPTY_FORM: Record<string, string | boolean> = {
  name: "",
  display_name: "",
  legal_name: "",
  tax_id: "",
  website: "",
  linkedin_url: "",
  industry: "",
  subindustry: "",
  company_size_bucket: "",
  employee_range: "",
  annual_revenue_range: "",
  country: "",
  region: "",
  preferred_language: "",
  timezone: "",
  parent_client_id: "",
  account_group: "",
  account_tier: "",
  ownership_type: "",
  business_model: "",
  main_products_services: "",
  sap_relevance_summary: "",
  known_pain_points: "",
  strategic_notes: "",
  is_active: true,
};

export default function ClientsPage() {
  const [loading, setLoading] = useState(true);
  const [appRole, setAppRole] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({ ...EMPTY_FORM });
  const [activeSection, setActiveSection] = useState<"form" | "contacts" | "systems">("form");
  const [clientsQuota, setClientsQuota] = useState<{ atLimit: boolean; current: number; limit: number | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) {
        setAppRole(null);
        setLoading(false);
        setClientsQuota(null);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("app_role")
        .eq("id", user.id)
        .single();
      if (cancelled) return;
      setAppRole((profile as { app_role?: string } | null)?.app_role ?? null);
    }
    checkAccess();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (appRole !== "superadmin" && appRole !== "admin") {
      setClientsQuota(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const headers = await getAdminAuthHeaders();
        const res = await fetch("/api/me", { headers });
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as { clientsQuota?: { atLimit: boolean; current: number; limit: number | null } };
        if (!cancelled) setClientsQuota(data.clientsQuota ?? null);
      } catch {
        if (!cancelled) setClientsQuota(null);
      }
    })();
    return () => { cancelled = true; };
  }, [appRole]);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch("/api/admin/clients", { headers });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = res.status === 403 ? "No tiene permiso para gestionar clientes." : (data.error ?? "Error al cargar los clientes.");
        setError(msg);
        setClients([]);
        return;
      }
      const data = (await res.json()) as { clients?: ClientRow[] };
      setClients(data.clients ?? []);
    } catch {
      setError("Error de conexión.");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (appRole === "superadmin" || appRole === "admin") void loadClients();
  }, [appRole, loadClients]);

  useEffect(() => {
    if (!editingId) {
      setForm({ ...EMPTY_FORM });
      setActiveSection("form");
      return;
    }
    const c = clients.find((x) => x.id === editingId);
    if (c) {
      setForm({
        name: c.name ?? "",
        display_name: c.display_name ?? "",
        legal_name: c.legal_name ?? "",
        tax_id: c.tax_id ?? "",
        website: c.website ?? "",
        linkedin_url: c.linkedin_url ?? "",
        industry: c.industry ?? "",
        subindustry: c.subindustry ?? "",
        company_size_bucket: c.company_size_bucket ?? "",
        employee_range: c.employee_range ?? "",
        annual_revenue_range: c.annual_revenue_range ?? "",
        country: c.country ?? "",
        region: c.region ?? "",
        preferred_language: c.preferred_language ?? "",
        timezone: c.timezone ?? "",
        parent_client_id: c.parent_client_id ?? "",
        account_group: c.account_group ?? "",
        account_tier: c.account_tier ?? "",
        ownership_type: c.ownership_type ?? "",
        business_model: c.business_model ?? "",
        main_products_services: c.main_products_services ?? "",
        sap_relevance_summary: c.sap_relevance_summary ?? "",
        known_pain_points: c.known_pain_points ?? "",
        strategic_notes: c.strategic_notes ?? "",
        is_active: c.is_active !== false,
      });
    } else {
      (async () => {
        const headers = await getAdminAuthHeaders();
        const res = await fetch(`/api/admin/clients/${editingId}`, { headers });
        if (!res.ok) return;
        const data = (await res.json()) as { client?: ClientRow };
        const x = data.client;
        if (x) {
          setForm({
            name: x.name ?? "",
            display_name: x.display_name ?? "",
            legal_name: x.legal_name ?? "",
            tax_id: x.tax_id ?? "",
            website: x.website ?? "",
            linkedin_url: x.linkedin_url ?? "",
            industry: x.industry ?? "",
            subindustry: x.subindustry ?? "",
            company_size_bucket: x.company_size_bucket ?? "",
            employee_range: x.employee_range ?? "",
            annual_revenue_range: x.annual_revenue_range ?? "",
            country: x.country ?? "",
            region: x.region ?? "",
            preferred_language: x.preferred_language ?? "",
            timezone: x.timezone ?? "",
            parent_client_id: x.parent_client_id ?? "",
            account_group: x.account_group ?? "",
            account_tier: x.account_tier ?? "",
            ownership_type: x.ownership_type ?? "",
            business_model: x.business_model ?? "",
            main_products_services: x.main_products_services ?? "",
            sap_relevance_summary: x.sap_relevance_summary ?? "",
            known_pain_points: x.known_pain_points ?? "",
            strategic_notes: x.strategic_notes ?? "",
            is_active: x.is_active !== false,
          });
        }
      })();
    }
  }, [editingId, clients]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = (form.name as string)?.trim() || (form.display_name as string)?.trim() || (form.legal_name as string)?.trim();
    if (!name || saving) return;
    setSaving(true);
    setFormError(null);
    setSuccessMessage(null);
    const headers = await getAdminAuthHeaders();
    (headers as Record<string, string>)["Content-Type"] = "application/json";
    const body: Record<string, unknown> = {
      name: (form.name as string) || name,
      display_name: (form.display_name as string) || null,
      legal_name: (form.legal_name as string) || null,
      tax_id: (form.tax_id as string) || null,
      website: (form.website as string) || null,
      linkedin_url: (form.linkedin_url as string) || null,
      industry: (form.industry as string) || null,
      subindustry: (form.subindustry as string) || null,
      company_size_bucket: (form.company_size_bucket as string) || null,
      employee_range: (form.employee_range as string) || null,
      annual_revenue_range: (form.annual_revenue_range as string) || null,
      country: (form.country as string) || null,
      region: (form.region as string) || null,
      preferred_language: (form.preferred_language as string) || null,
      timezone: (form.timezone as string) || null,
      parent_client_id: (form.parent_client_id as string) || null,
      account_group: (form.account_group as string) || null,
      account_tier: (form.account_tier as string) || null,
      ownership_type: (form.ownership_type as string) || null,
      business_model: (form.business_model as string) || null,
      main_products_services: (form.main_products_services as string) || null,
      sap_relevance_summary: (form.sap_relevance_summary as string) || null,
      known_pain_points: (form.known_pain_points as string) || null,
      strategic_notes: (form.strategic_notes as string) || null,
      is_active: form.is_active,
    };
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/clients/${editingId}`, { method: "PATCH", headers, body: JSON.stringify(body) });
        const data = (await res.json().catch(() => ({}))) as { error?: string; client?: ClientRow };
        if (!res.ok) {
          setFormError(data.error ?? "Error al actualizar el cliente.");
          return;
        }
        setClients((prev) => prev.map((c) => (c.id === editingId ? (data.client ?? c) : c)).sort((a, b) => (a.display_name || a.name).localeCompare(b.display_name || b.name)));
        setSuccessMessage("Cliente actualizado correctamente.");
        setEditingId(null);
      } else {
        const res = await fetch("/api/admin/clients", { method: "POST", headers, body: JSON.stringify(body) });
        const data = (await res.json().catch(() => ({}))) as { error?: string; client?: ClientRow; quota?: { quotaKey?: string; current?: number; limit?: number | null } };
        if (!res.ok) {
          if (res.status === 409 && data.quota?.limit != null) {
            setFormError(`Has alcanzado el máximo de clientes permitidos (${data.quota.current ?? 0} / ${data.quota.limit}).`);
          } else {
            setFormError(data.error ?? "Error al crear el cliente.");
          }
          return;
        }
        if (data.client) setClients((prev) => [...prev, data.client!].sort((a, b) => (a.display_name || a.name).localeCompare(b.display_name || b.name)));
        setSuccessMessage("Cliente creado correctamente.");
        const meRes = await fetch("/api/me", { headers });
        if (meRes.ok) {
          const meData = (await meRes.json()) as { clientsQuota?: { atLimit: boolean; current: number; limit: number | null } };
          setClientsQuota(meData.clientsQuota ?? null);
        }
        setForm({ ...EMPTY_FORM });
      }
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch {
      setFormError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  const canManage = appRole === "superadmin" || appRole === "admin";

  if (loading && appRole === null) {
    return (
      <PageShell wide={false}>
        <ContentSkeleton title lines={3} cards={4} />
      </PageShell>
    );
  }

  if (!canManage) {
    return (
      <PageShell wide={false}>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-12 text-center">
          <p className="text-sm font-medium text-slate-700">Acceso restringido</p>
          <p className="mt-1 text-sm text-slate-500">
            Solo administradores pueden gestionar clientes.
          </p>
        </div>
      </PageShell>
    );
  }

  const field = (key: string, label: string, placeholder = "") => (
    <div key={key} className="space-y-1">
      <label className="block text-xs text-slate-600">{label}</label>
      <input
        type="text"
        value={(form[key] as string) ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        disabled={saving}
      />
    </div>
  );

  return (
    <PageShell wide={false}>
      <div className="space-y-6">
        <PageHeader
          title="Clientes"
          description="Gestiona clientes para proyectos, reporting y contexto SAP. Crear y editar datos maestros."
        />

        {successMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {clientsQuota?.limit != null && clientsQuota.atLimit && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Has alcanzado el máximo de clientes permitidos ({clientsQuota.current} / {clientsQuota.limit}). No puedes crear más hasta que un administrador aumente el límite.
          </div>
        )}
        {clientsQuota?.limit != null && !clientsQuota.atLimit && clientsQuota.current >= clientsQuota.limit * 0.8 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Te acercas al límite de clientes ({clientsQuota.current} / {clientsQuota.limit}). Cuando lo alcances no podrás crear más hasta que un administrador aumente la cuota.
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/50 flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              {editingId ? `Editar cliente` : "Nuevo cliente"}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={() => { setEditingId(null); setForm({ ...EMPTY_FORM }); setActiveSection("form"); }}
                className="text-xs text-indigo-600 hover:underline"
              >
                Cancelar · Crear otro
              </button>
            )}
            {!editingId && clientsQuota?.limit != null && (
              <p className="w-full mt-2 text-sm text-slate-600">
                {clientsQuota.current} / {clientsQuota.limit} clientes usados
                {clientsQuota.atLimit && (
                  <span className="ml-1 font-medium text-amber-700">· Has alcanzado el máximo. No puedes crear más hasta que un administrador aumente el límite.</span>
                )}
              </p>
            )}
          </div>

          <div className="p-5">
            <div className="flex gap-1 mb-4 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setActiveSection("form")}
                className={`px-3 py-2 text-xs font-medium rounded-t-lg ${activeSection === "form" ? "bg-slate-100 text-slate-900 border border-b-0 border-slate-200" : "text-slate-500 hover:text-slate-700"}`}
              >
                Datos del cliente
              </button>
              <button
                type="button"
                onClick={() => setActiveSection("contacts")}
                className={`px-3 py-2 text-xs font-medium rounded-t-lg ${activeSection === "contacts" ? "bg-slate-100 text-slate-900 border border-b-0 border-slate-200" : "text-slate-500 hover:text-slate-700"}`}
              >
                Contactos
              </button>
              <button
                type="button"
                onClick={() => setActiveSection("systems")}
                className={`px-3 py-2 text-xs font-medium rounded-t-lg ${activeSection === "systems" ? "bg-slate-100 text-slate-900 border border-b-0 border-slate-200" : "text-slate-500 hover:text-slate-700"}`}
              >
                Sistemas
              </button>
            </div>

            {activeSection === "form" && (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Identidad</h3>
                    {field("name", "Nombre (obligatorio)", "Nombre o razón social")}
                    {field("display_name", "Nombre para mostrar", "Ej. Acme")}
                    {field("legal_name", "Razón social / legal")}
                    {field("tax_id", "CIF / NIF")}
                    {field("website", "Web")}
                    {field("linkedin_url", "LinkedIn")}
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Segmentación</h3>
                    <div className="space-y-1">
                      <label className="block text-xs text-slate-600">Industria</label>
                      <select
                        value={(form.industry as string) ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={saving}
                      >
                        {INDUSTRY_OPTIONS.map((o) => (
                          <option key={o.value || "_"} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    {field("subindustry", "Subindustria")}
                    <div className="space-y-1">
                      <label className="block text-xs text-slate-600">Tamaño empresa</label>
                      <select
                        value={(form.company_size_bucket as string) ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, company_size_bucket: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={saving}
                      >
                        {COMPANY_SIZE_OPTIONS.map((o) => (
                          <option key={o.value || "_"} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    {field("employee_range", "Rango empleados")}
                    {field("annual_revenue_range", "Facturación (rango)")}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Geografía</h3>
                    <div className="space-y-1">
                      <label className="block text-xs text-slate-600">País</label>
                      <select
                        value={resolveCountryOptionValue(form.country as string)}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((f) => ({ ...f, country: v, region: "" }));
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={saving}
                      >
                        <option value="">—</option>
                        {getAllCountryOptions().map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                        {(form.country as string)?.trim() && !getAllCountryOptions().some((o) => o.value === resolveCountryOptionValue(form.country as string)) && (
                          <option value={form.country as string}>{(form.country as string)} (actual)</option>
                        )}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs text-slate-600">Región / Estado</label>
                      <select
                        value={resolveStateOptionValue(form.country as string, form.region as string)}
                        onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={saving}
                      >
                        <option value="">—</option>
                        {getStateOptions((form.country as string) ?? "").map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                        {(form.region as string) && (form.country as string)?.length === 2 && !getStateOptions(form.country as string).some((o) => o.value === (form.region as string)) && (
                          <option value={form.region as string}>{(form.region as string)} (actual)</option>
                        )}
                      </select>
                    </div>
                    {field("preferred_language", "Idioma preferido")}
                    {field("timezone", "Zona horaria")}
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Estructura</h3>
                    <div className="space-y-1">
                      <label className="block text-xs text-slate-600">Cliente padre</label>
                      <select
                        value={(form.parent_client_id as string) ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, parent_client_id: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={saving}
                      >
                        <option value="">Ninguno</option>
                        {clients.filter((c) => c.id !== editingId).map((c) => (
                          <option key={c.id} value={c.id}>{c.display_name || c.name}</option>
                        ))}
                      </select>
                    </div>
                    {field("account_group", "Grupo de cuenta")}
                    <div className="space-y-1">
                      <label className="block text-xs text-slate-600">Tier</label>
                      <select
                        value={(form.account_tier as string) ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, account_tier: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={saving}
                      >
                        {ACCOUNT_TIER_OPTIONS.map((o) => (
                          <option key={o.value || "_"} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs text-slate-600">Tipo propiedad</label>
                      <select
                        value={(form.ownership_type as string) ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, ownership_type: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={saving}
                      >
                        {OWNERSHIP_TYPE_OPTIONS.map((o) => (
                          <option key={o.value || "_"} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs text-slate-600">Modelo negocio</label>
                      <select
                        value={(form.business_model as string) ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, business_model: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={saving}
                      >
                        {BUSINESS_MODEL_OPTIONS.map((o) => (
                          <option key={o.value || "_"} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    {field("main_products_services", "Productos / servicios principales")}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Contexto SAP</h3>
                  <textarea
                    value={(form.sap_relevance_summary as string) ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, sap_relevance_summary: e.target.value }))}
                    placeholder="Resumen de relevancia SAP, sistemas, roadmap…"
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={saving}
                  />
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Notas estratégicas</h3>
                  <textarea
                    value={(form.known_pain_points as string) ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, known_pain_points: e.target.value }))}
                    placeholder="Pain points conocidos"
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={saving}
                  />
                  <textarea
                    value={(form.strategic_notes as string) ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, strategic_notes: e.target.value }))}
                    placeholder="Notas internas estratégicas"
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={saving}
                  />
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.is_active === true}
                      onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                      disabled={saving}
                      className="rounded border-slate-300"
                    />
                    Activo
                  </label>
                  <button
                    type="submit"
                    disabled={saving || (!editingId && clientsQuota?.atLimit === true)}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear cliente"}
                  </button>
                </div>
                {formError && <p className="text-sm text-red-600">{formError}</p>}
              </form>
            )}

            {activeSection === "contacts" && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-700">Contactos del cliente</p>
                <p className="mt-1">Próximamente: gestión de contactos (client_contacts) desde esta vista.</p>
              </div>
            )}

            {activeSection === "systems" && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-700">Sistemas del cliente</p>
                <p className="mt-1">Próximamente: gestión de sistemas SAP (client_systems) desde esta vista.</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 bg-slate-50/50 flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Listado de clientes</h2>
            <button
              type="button"
              onClick={() => { setEditingId(null); setForm({ ...EMPTY_FORM }); setActiveSection("form"); }}
              className="text-sm text-indigo-600 hover:underline"
            >
              + Nuevo cliente
            </button>
          </div>
          <div className="p-5">
            {loading ? (
              <TableSkeleton rows={5} colCount={5} />
            ) : error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : clients.length === 0 ? (
              <p className="text-sm text-slate-500">Aún no hay clientes. Crea uno en el formulario de arriba.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      <th className="py-3 px-4">Nombre</th>
                      <th className="py-3 px-4">País</th>
                      <th className="py-3 px-4">Industria</th>
                      <th className="py-3 px-4">Tier</th>
                      <th className="py-3 px-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clients.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => setEditingId(c.id)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4 text-slate-900 font-medium">{c.display_name || c.name}</td>
                        <td className="py-3 px-4 text-slate-600">{getCountryDisplayName(c.country) || "—"}</td>
                        <td className="py-3 px-4 text-slate-600">{c.industry ?? "—"}</td>
                        <td className="py-3 px-4 text-slate-600">{c.account_tier ?? "—"}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${c.is_active !== false ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            {c.is_active !== false ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
