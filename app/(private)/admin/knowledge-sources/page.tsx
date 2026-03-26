"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabaseClient";
import { AppPageShell } from "@/components/ui/layout/AppPageShell";
import { ChevronLeft, Cloud, FileText, Globe, Share2 } from "lucide-react";

type IntegrationOption = {
  id: string;
  provider: string;
  display_name: string;
  account_email: string | null;
  status: string;
  created_at: string;
};

async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

const CARD_CLASS =
  "rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100";
const BTN_PRIMARY =
  "inline-flex items-center justify-center rounded-xl rb-btn-primary px-4 py-2.5 text-sm font-medium disabled:opacity-60 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30 focus-visible:ring-offset-2";
const BTN_SECONDARY =
  "inline-flex items-center justify-center rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/25 focus-visible:ring-offset-2";

export default function AdminKnowledgeSourcesPage() {
  const t = useTranslations("admin.knowledgeSources");
  const [loading, setLoading] = useState(true);
  const [appRole, setAppRole] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationOption[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [googleConnectPending, setGoogleConnectPending] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled || !user) {
          setAppRole(null);
          setLoading(false);
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("app_role, is_active")
          .eq("id", user.id)
          .single();
        if (cancelled) return;
        const row = profile as { app_role?: string; is_active?: boolean } | null;
        if (!row || row.is_active !== true) {
          setAppRole(null);
          setLoading(false);
          return;
        }
        setAppRole((profile as { app_role?: string } | null)?.app_role ?? null);
      } catch {
        if (!cancelled) setAppRole(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void checkAccess();
    return () => { cancelled = true; };
  }, []);

  const loadIntegrations = useCallback(async () => {
    setIntegrationsLoading(true);
    setConnectError(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch("/api/integrations", { headers });
      const data = await res.json().catch(() => ({ integrations: [] })) as { integrations?: IntegrationOption[] };
      setIntegrations((data.integrations ?? []).filter((i) => i.provider === "google_drive"));
    } catch {
      setIntegrations([]);
    } finally {
      setIntegrationsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (appRole === "superadmin") void loadIntegrations();
  }, [appRole, loadIntegrations]);

  const handleConnectGoogleDrive = async () => {
    setGoogleConnectPending(true);
    setConnectError(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch("/api/integrations/google/connect?return_url=/admin/knowledge-sources", { headers });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) {
        setConnectError(data.error ?? t("errors.startGoogleConnect"));
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setConnectError("Respuesta inesperada del servidor.");
    } catch {
      setConnectError(t("errors.connection"));
    } finally {
      setGoogleConnectPending(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[rgb(var(--rb-shell-bg))] min-h-full">
        <AppPageShell>
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-slate-700">{t("loading")}</p>
          </div>
        </AppPageShell>
      </div>
    );
  }

  if (appRole !== "superadmin") {
    return (
      <div className="bg-[rgb(var(--rb-shell-bg))] min-h-full">
        <AppPageShell>
          <div className={CARD_CLASS}>
            <p className="text-sm font-semibold text-slate-900">{t("restricted")}</p>
            <p className="mt-1 text-sm text-slate-500">{t("restrictedBody")}</p>
            <Link href="/admin" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300">
              <ChevronLeft className="h-4 w-4" /> {t("backToAdmin")}
            </Link>
          </div>
        </AppPageShell>
      </div>
    );
  }

  const hasGoogleIntegration = integrations.length > 0;
  const googleIntegration = integrations[0];

  return (
    <div className="bg-[rgb(var(--rb-shell-bg))] min-h-full">
      <AppPageShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors duration-150"
          >
            <ChevronLeft className="h-4 w-4" /> Admin
          </Link>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
            Knowledge Sources
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Manage the external sources that feed Sapito, Knowledge, and Project Brain.
          </p>
        </div>

        {/* Sapito context */}
        <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 px-4 py-3 shadow-sm ring-1 ring-slate-100">
          <p className="text-xs text-slate-700">
            These sources are used by <span className="font-medium text-slate-900">Sapito</span>, the global{" "}
            <span className="font-medium text-slate-900">Knowledge</span> base, and{" "}
            <span className="font-medium text-slate-900">Project Brain</span> to provide context and answers. They are system-level integrations, not personal account connections.
          </p>
        </div>

        {/* Google Drive card */}
        <section className={CARD_CLASS}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-500 shadow-sm ring-1 ring-slate-100">
                  <Cloud className="h-5 w-5 text-slate-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Google Drive</h2>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Connect a Google account to use Drive folders or files as knowledge sources (global or per project).
                  </p>
                </div>
              </div>
              {connectError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {connectError}
                </div>
              )}
              {integrationsLoading ? (
                <p className="mt-3 text-sm text-slate-500">Loading…</p>
              ) : hasGoogleIntegration ? (
                <dl className="mt-3 space-y-1 text-sm">
                  <div>
                    <dt className="text-slate-500">Connected account</dt>
                    <dd className="text-slate-900">
                      {googleIntegration?.account_email ?? googleIntegration?.display_name ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Status</dt>
                    <dd className="text-slate-900">
                      {googleIntegration?.status === "active" ? "Active" : "Review"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Last sync</dt>
                    <dd className="text-slate-600">Per source in Admin</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Not connected</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleConnectGoogleDrive}
                disabled={googleConnectPending}
                className={BTN_PRIMARY}
              >
                {googleConnectPending ? "Redirecting…" : hasGoogleIntegration ? "Reconnect" : "Connect Google Drive"}
              </button>
              <button
                type="button"
                disabled
                title="Sync is available per source in Admin."
                className={BTN_SECONDARY}
              >
                Sync now
              </button>
              <Link href="/admin" className={BTN_SECONDARY}>
                Manage source list
              </Link>
            </div>
          </div>
        </section>

        {/* Future sources */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">More sources (coming soon)</h2>
          <div className="space-y-4">
            {[
              { name: "Notion", icon: FileText },
              { name: "Confluence", icon: Globe },
              { name: "SharePoint", icon: Share2 },
            ].map(({ name, icon: Icon }) => (
              <div key={name} className={CARD_CLASS}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-500 shadow-sm ring-1 ring-slate-100">
                      <Icon className="h-5 w-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{name}</p>
                      <p className="text-xs text-slate-600">Not connected</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled
                    className={BTN_SECONDARY}
                    title="Coming soon"
                  >
                    Connect
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      </AppPageShell>
    </div>
  );
}
