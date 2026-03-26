"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";
import {
  INDUSTRY_OPTIONS,
  COMPANY_SIZE_OPTIONS,
  ACCOUNT_TIER_OPTIONS,
} from "@/lib/constants/clientOptions";
import { AppPageShell } from "@/components/ui/layout/AppPageShell";
import {
  getAllCountryOptions,
  resolveCountryOptionValue,
  getCountryDisplayName,
} from "@/lib/countryStateCity";

async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

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

function statusBadge(isActive: boolean | null | undefined) {
  if (isActive === false) {
    return (
      <span className="inline-flex rounded-md px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/80">
        Inactive
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-md px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-900 border border-emerald-200/80">
      Active
    </span>
  );
}

export default function ClientsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [appRole, setAppRole] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({ ...EMPTY_FORM });
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

  const filteredClients = searchQuery.trim()
    ? clients.filter(
        (c) =>
          (c.display_name ?? c.name).toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.industry ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (getCountryDisplayName(c.country) ?? "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : clients;

  const canManage = appRole === "superadmin" || appRole === "admin";

  if (loading && appRole === null) {
    return (
      <div className="bg-[rgb(var(--rb-shell-bg))] min-h-full">
        <AppPageShell>
          <div className="space-y-6">
            <div className="h-8 w-48 rounded-lg bg-slate-200/80 animate-pulse" />
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <TableSkeleton rows={5} colCount={6} />
            </div>
          </div>
        </AppPageShell>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="bg-[rgb(var(--rb-shell-bg))] min-h-full">
        <AppPageShell>
          <div className="rounded-xl border border-slate-200/90 bg-white px-5 py-12 text-center shadow-sm ring-1 ring-slate-100">
            <p className="text-sm font-semibold text-slate-900">Acceso restringido</p>
            <p className="mt-1 text-sm text-slate-600">
              Solo administradores pueden gestionar clientes.
            </p>
          </div>
        </AppPageShell>
      </div>
    );
  }

  return (
    <div className="bg-[rgb(var(--rb-shell-bg))] min-h-full">
      <AppPageShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Clients</h1>
            <p className="text-sm text-slate-600">
              Manage clients for projects, reporting, and SAP context.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setForm({ ...EMPTY_FORM });
              setFormError(null);
              setModalOpen(true);
            }}
            disabled={clientsQuota?.atLimit === true}
            className="inline-flex items-center justify-center gap-2 rounded-xl rb-btn-primary px-4 py-2.5 text-sm font-medium disabled:opacity-50 transition-colors duration-150 shrink-0"
          >
            <Plus className="size-4" />
            New Client
          </button>
        </div>

        {successMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {clientsQuota?.limit != null && clientsQuota.atLimit && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            You have reached the maximum number of clients ({clientsQuota.current} / {clientsQuota.limit}). An administrator must increase the limit to create more.
          </div>
        )}

        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" aria-hidden />
              <input
                type="search"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200/90 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30"
                aria-label="Search clients"
              />
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={5} colCount={6} />
          ) : error ? (
            <p className="text-sm text-red-700 py-4">{error}</p>
          ) : filteredClients.length === 0 ? (
            <p className="text-sm text-slate-600 py-8 text-center">
              {searchQuery.trim() ? "No clients match your search." : "No clients yet. Click New Client to create one."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200/90">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200/90 bg-slate-50/85 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Industry</th>
                    <th className="py-3 px-4">Country</th>
                    <th className="py-3 px-4">Projects</th>
                    <th className="py-3 px-4">Owner</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClients.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/clients/${c.id}`)}
                      className="hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
                    >
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {c.display_name || c.name}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{c.industry ?? "—"}</td>
                      <td className="py-3 px-4 text-slate-600">{getCountryDisplayName(c.country) ?? "—"}</td>
                      <td className="py-3 px-4 text-slate-500">—</td>
                      <td className="py-3 px-4 text-slate-500">—</td>
                      <td className="py-3 px-4">{statusBadge(c.is_active)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <NewClientModal
          form={form}
          setForm={setForm}
          clientsQuota={clientsQuota}
          saving={saving}
          formError={formError}
          onClose={() => {
            setModalOpen(false);
            setFormError(null);
          }}
          onSuccess={async () => {
            setModalOpen(false);
            setForm({ ...EMPTY_FORM });
            setSuccessMessage("Client created successfully.");
            setTimeout(() => setSuccessMessage(null), 4000);
            void loadClients();
            try {
              const headers = await getAdminAuthHeaders();
              const res = await fetch("/api/me", { headers });
              if (res.ok) {
                const d = (await res.json()) as { clientsQuota?: { atLimit: boolean; current: number; limit: number | null } };
                setClientsQuota(d.clientsQuota ?? null);
              }
            } catch { /* ignore */ }
          }}
          setSaving={setSaving}
          setFormError={setFormError}
        />
      )}
      </AppPageShell>
    </div>
  );
}

type NewClientModalProps = {
  form: Record<string, string | boolean>;
  setForm: React.Dispatch<React.SetStateAction<Record<string, string | boolean>>>;
  clientsQuota: { atLimit: boolean; current: number; limit: number | null } | null;
  saving: boolean;
  formError: string | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  setSaving: (v: boolean) => void;
  setFormError: (v: string | null) => void;
};

function NewClientModal({
  form,
  setForm,
  clientsQuota,
  saving,
  formError,
  onClose,
  onSuccess,
  setSaving,
  setFormError,
}: NewClientModalProps) {
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = (form.name as string)?.trim() || (form.display_name as string)?.trim() || (form.legal_name as string)?.trim();
    if (!name || saving) return;
    setSaving(true);
    setFormError(null);
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
      const res = await fetch("/api/admin/clients", { method: "POST", headers, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { error?: string; client?: ClientRow; quota?: { quotaKey?: string; current?: number; limit?: number | null } };
      if (!res.ok) {
        if (res.status === 409 && data.quota?.limit != null) {
          setFormError(`Maximum clients reached (${data.quota.current ?? 0} / ${data.quota.limit}).`);
        } else {
          setFormError(data.error ?? "Error creating client.");
        }
        return;
      }
      onSuccess();
    } catch {
      setFormError("Connection error.");
    } finally {
      setSaving(false);
    }
  };

  const field = (key: string, label: string, placeholder = "") => (
    <div key={key} className="space-y-1">
      <label className="block text-xs text-slate-400">{label}</label>
      <input
        type="text"
        value={(form[key] as string) ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/30"
        disabled={saving}
      />
    </div>
  );

  const inputClass = "w-full rounded-md border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/30 disabled:opacity-60";
  const labelClass = "block text-xs text-slate-600";
  const sectionTitle = "text-xs font-medium text-slate-600 uppercase tracking-wide mb-3";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="rounded-xl border border-slate-200/90 bg-white shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto ring-1 ring-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/90 bg-white px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">New Client</h2>
          <button type="button" onClick={onClose} className="p-1 text-slate-500 hover:text-slate-700 rounded transition-colors" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-6">
          {/* General */}
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-5 space-y-3">
            <h3 className={sectionTitle}>General</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {field("name", "Client name", "Required")}
              <div className="space-y-1">
                <label className={labelClass}>Industry</label>
                <select value={(form.industry as string) ?? ""} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} className={inputClass} disabled={saving}>
                  {INDUSTRY_OPTIONS.map((o) => <option key={o.value || "_"} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Type</label>
                <select value={(form.account_tier as string) ?? ""} onChange={(e) => setForm((f) => ({ ...f, account_tier: e.target.value }))} className={inputClass} disabled={saving}>
                  {ACCOUNT_TIER_OPTIONS.map((o) => <option key={o.value || "_"} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {field("website", "Website")}
              <div className="space-y-1">
                <label className={labelClass}>Country</label>
                <select
                  value={resolveCountryOptionValue(form.country as string)}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value, region: "" }))}
                  className={inputClass}
                  disabled={saving}
                >
                  <option value="">—</option>
                  {getAllCountryOptions().map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Business */}
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-5 space-y-3">
            <h3 className={sectionTitle}>Business</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelClass}>Company size</label>
                <select value={(form.company_size_bucket as string) ?? ""} onChange={(e) => setForm((f) => ({ ...f, company_size_bucket: e.target.value }))} className={inputClass} disabled={saving}>
                  {COMPANY_SIZE_OPTIONS.map((o) => <option key={o.value || "_"} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {field("annual_revenue_range", "Revenue")}
              {field("employee_range", "Employee range")}
              <div className="space-y-1">
                <label className={labelClass}>Account owner</label>
                <input type="text" placeholder="—" className={inputClass} disabled aria-readonly />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Priority</label>
                <input type="text" placeholder="—" className={inputClass} disabled aria-readonly />
              </div>
            </div>
          </div>

          {/* SAP Context */}
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-5 space-y-3">
            <h3 className={sectionTitle}>SAP Context</h3>
            <div className="space-y-1">
              <label className={labelClass}>SAP system / modules / landscape</label>
              <textarea
                value={(form.sap_relevance_summary as string) ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, sap_relevance_summary: e.target.value }))}
                placeholder="SAP relevance, systems, modules, landscape…"
                rows={3}
                className={inputClass}
                disabled={saving}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-5 space-y-3">
            <h3 className={sectionTitle}>Notes</h3>
            <div className="space-y-1">
              <label className={labelClass}>Client notes</label>
              <textarea
                value={(form.known_pain_points as string) ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, known_pain_points: e.target.value }))}
                placeholder="Pain points, client notes…"
                rows={2}
                className={inputClass}
                disabled={saving}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Internal notes</label>
              <textarea
                value={(form.strategic_notes as string) ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, strategic_notes: e.target.value }))}
                placeholder="Internal / strategic notes…"
                rows={2}
                className={inputClass}
                disabled={saving}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_active === true}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                disabled={saving}
                className="rounded border-slate-300 bg-white text-[rgb(var(--rb-brand-primary))] focus:ring-[rgb(var(--rb-brand-ring))]/30"
              />
              Active
            </label>
          </div>

          {formError && <p className="text-sm text-red-700">{formError}</p>}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors duration-150">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || clientsQuota?.atLimit === true}
              className="rounded-xl rb-btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors duration-150"
            >
              {saving ? "Creating…" : "Create client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
