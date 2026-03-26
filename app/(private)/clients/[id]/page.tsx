"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, LayoutDashboard, FolderKanban, FileText, Brain, Activity } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { PageShell } from "@/components/layout/PageShell";
import { getCountryDisplayName } from "@/lib/countryStateCity";

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

type TabId = "overview" | "projects" | "notes" | "knowledge" | "activity";

async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : null;
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<ClientRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const loadClient = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(`/api/admin/clients/${id}`, { headers });
      if (!res.ok) {
        if (res.status === 404) setError("Client not found.");
        else setError("Failed to load client.");
        setClient(null);
        return;
      }
      const data = (await res.json()) as { client?: ClientRow };
      setClient(data.client ?? null);
    } catch {
      setError("Connection error.");
      setClient(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadClient();
  }, [loadClient]);

  if (!id) {
    return (
      <PageShell wide={false}>
        <div className="rounded-xl border border-slate-200/90 bg-white px-5 py-12 text-center shadow-sm ring-1 ring-slate-100">
          <p className="text-sm text-slate-600">Invalid client ID.</p>
          <Link href="/clients" className="mt-3 inline-block text-sm font-medium text-[rgb(var(--rb-brand-primary-active))] hover:text-[rgb(var(--rb-brand-primary-hover))]">
            Back to clients
          </Link>
        </div>
      </PageShell>
    );
  }

  if (loading && !client) {
    return (
      <PageShell wide={false}>
        <div className="space-y-6">
          <div className="h-8 w-64 rounded-lg bg-slate-200/80 animate-pulse" />
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="h-10 w-full rounded-lg bg-slate-100/90 animate-pulse mb-4" />
            <div className="space-y-3">
              <div className="h-4 w-full rounded bg-slate-100/90 animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-slate-100/90 animate-pulse" />
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  if (error || !client) {
    return (
      <PageShell wide={false}>
        <div className="rounded-xl border border-slate-200/90 bg-white px-5 py-12 text-center shadow-sm ring-1 ring-slate-100">
          <p className="text-sm font-semibold text-slate-900">{error ?? "Client not found."}</p>
          <button
            type="button"
            onClick={() => router.push("/clients")}
            className="mt-3 text-sm font-medium text-[rgb(var(--rb-brand-primary-active))] hover:text-[rgb(var(--rb-brand-primary-hover))]"
          >
            Back to clients
          </button>
        </div>
      </PageShell>
    );
  }

  const displayName = client.display_name || client.name;
  const tabClass = (tab: TabId) =>
    `inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
      activeTab === tab ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
    }`;

  return (
    <PageShell wide={false}>
      <div className="space-y-6">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to clients
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{displayName}</h1>
            <p className="text-sm text-slate-600">
              {client.industry ?? "—"} · {getCountryDisplayName(client.country) ?? "—"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200/90 bg-slate-50 p-1 ring-1 ring-slate-100">
          <button type="button" onClick={() => setActiveTab("overview")} className={tabClass("overview")}>
            <LayoutDashboard className="size-4" aria-hidden />
            Overview
          </button>
          <button type="button" onClick={() => setActiveTab("projects")} className={tabClass("projects")}>
            <FolderKanban className="size-4" aria-hidden />
            Projects
          </button>
          <button type="button" onClick={() => setActiveTab("notes")} className={tabClass("notes")}>
            <FileText className="size-4" aria-hidden />
            Notes
          </button>
          <button type="button" onClick={() => setActiveTab("knowledge")} className={tabClass("knowledge")}>
            <Brain className="size-4" aria-hidden />
            Knowledge
          </button>
          <button type="button" onClick={() => setActiveTab("activity")} className={tabClass("activity")}>
            <Activity className="size-4" aria-hidden />
            Activity
          </button>
        </div>

        <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
          {activeTab === "overview" && (
            <div className="space-y-4">
              <h2 className="text-sm font-medium text-slate-200">Overview</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-slate-500">Name</dt>
                  <dd className="text-slate-200">{client.name}</dd>
                </div>
                {client.display_name && (
                  <div>
                    <dt className="text-slate-500">Display name</dt>
                    <dd className="text-slate-200">{client.display_name}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-slate-500">Industry</dt>
                  <dd className="text-slate-200">{client.industry ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Country</dt>
                  <dd className="text-slate-200">{getCountryDisplayName(client.country) ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Website</dt>
                  <dd className="text-slate-200">{client.website ? <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">{client.website}</a> : "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Status</dt>
                  <dd className="text-slate-200">{client.is_active !== false ? "Active" : "Inactive"}</dd>
                </div>
              </dl>
              {client.sap_relevance_summary && (
                <div>
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">SAP context</h3>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{client.sap_relevance_summary}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "projects" && (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-500">Projects linked to this client will appear here.</p>
              <p className="text-xs text-slate-600 mt-1">Coming soon.</p>
            </div>
          )}

          {activeTab === "notes" && (
            <div className="space-y-4">
              <h2 className="text-sm font-medium text-slate-200">Notes</h2>
              {client.known_pain_points ? (
                <div>
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Client notes</h3>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{client.known_pain_points}</p>
                </div>
              ) : null}
              {client.strategic_notes ? (
                <div>
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Internal notes</h3>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{client.strategic_notes}</p>
                </div>
              ) : null}
              {!client.known_pain_points && !client.strategic_notes && (
                <p className="text-sm text-slate-500">No notes yet.</p>
              )}
            </div>
          )}

          {activeTab === "knowledge" && (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-500">Knowledge sources and pages for this client will appear here.</p>
              <p className="text-xs text-slate-600 mt-1">Coming soon.</p>
            </div>
          )}

          {activeTab === "activity" && (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-500">Recent activity for this client will appear here.</p>
              <p className="text-xs text-slate-600 mt-1">Coming soon.</p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
