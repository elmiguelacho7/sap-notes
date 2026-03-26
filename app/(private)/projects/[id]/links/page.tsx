"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";
import { ModuleContentCard } from "@/components/layout/module";
import { PROJECT_WORKSPACE_PAGE, PROJECT_WORKSPACE_HERO, PROJECT_WORKSPACE_EMPTY } from "@/lib/projectWorkspaceUi";
import { getSapitoProject } from "@/lib/agents/agentRegistry";

type ProjectLinkRow = {
  id: string;
  project_id?: string;
  name: string | null;
  url: string | null;
  link_type: string | null;
  created_at: string;
};

type ProjectSourceRow = {
  id: string;
  project_id: string;
  source_type: string;
  name: string;
  description: string | null;
  source_url: string | null;
  external_id: string | null;
  integration_id: string | null;
  sync_enabled: boolean;
  sync_mode: string;
  last_synced_at: string | null;
  last_sync_status: string;
  created_at: string;
  updated_at: string;
};

const LINK_TYPE_OPTIONS = [
  { value: "", label: "Seleccionar tipo" },
  { value: "Drive", label: "Drive" },
  { value: "SharePoint", label: "SharePoint" },
  { value: "Jira", label: "Jira" },
  { value: "Confluence", label: "Confluence" },
  { value: "SAP", label: "SAP" },
  { value: "Otro", label: "Otro" },
];

const SOURCE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "google_drive_folder", label: "Carpeta de Google Drive" },
  { value: "google_drive_file", label: "Archivo de Google Drive" },
  { value: "sap_help", label: "SAP Help Portal" },
  { value: "official_web", label: "Official SAP web" },
  { value: "sharepoint_library", label: "Biblioteca SharePoint" },
  { value: "confluence_space", label: "Espacio Confluence" },
  { value: "jira_project", label: "Proyecto Jira" },
  { value: "web_url", label: "URL web" },
  { value: "manual_upload", label: "Carga manual" },
];

type IntegrationOption = {
  id: string;
  provider: string;
  display_name: string;
  account_email: string | null;
  status: string;
};

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export default function ProjectLinksPage() {
  const t = useTranslations("links");
  const locale = useLocale();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";

  const [links, setLinks] = useState<ProjectLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingLink, setEditingLink] = useState<ProjectLinkRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formType, setFormType] = useState("");
  const [saving, setSaving] = useState(false);
  const linkModalFirstInputRef = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ProjectLinkRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fuentes del proyecto
  const [sources, setSources] = useState<ProjectSourceRow[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [errorSources, setErrorSources] = useState<string | null>(null);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [sourceFormName, setSourceFormName] = useState("");
  const [sourceFormType, setSourceFormType] = useState(SOURCE_TYPE_OPTIONS[0].value);
  const [sourceFormUrl, setSourceFormUrl] = useState("");
  const [sourceFormDescription, setSourceFormDescription] = useState("");
  const [sourceFormExternalId, setSourceFormExternalId] = useState("");
  const [sourceFormIntegrationId, setSourceFormIntegrationId] = useState("");
  const [sourceFormSyncEnabled, setSourceFormSyncEnabled] = useState(false);
  const [savingSource, setSavingSource] = useState(false);
  const [sourceFormError, setSourceFormError] = useState<string | null>(null);
  const [googleIntegrations, setGoogleIntegrations] = useState<IntegrationOption[]>([]);
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncDriveLoading, setSyncDriveLoading] = useState(false);
  const [syncDriveMessage, setSyncDriveMessage] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/links?limit=100`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg((data as { error?: string }).error ?? t("errors.loadLinks"));
        setLinks([]);
        return;
      }
      const payload = data as { projectId?: string; links?: ProjectLinkRow[] };
      setLinks(payload.links ?? []);
    } catch {
      setErrorMsg(t("errors.connection"));
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  const loadSources = useCallback(async () => {
    if (!projectId) return;
    setLoadingSources(true);
    setErrorSources(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/sources?limit=100`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorSources((data as { error?: string }).error ?? t("errors.loadSources"));
        setSources([]);
        return;
      }
      const payload = data as { projectId?: string; sources?: ProjectSourceRow[] };
      setSources(payload.sources ?? []);
    } catch {
      setErrorSources(t("errors.connection"));
      setSources([]);
    } finally {
      setLoadingSources(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    async function loadPermissions() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const headers: Record<string, string> = {};

        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
        
        const permRes = await fetch(`/api/projects/${projectId}/permissions`, { headers });

        if (cancelled) return;
        const permData = await permRes.json().catch(() => ({}));
        const fromApi = (permData as { canEdit?: boolean }).canEdit ?? false;
        setCanEdit(fromApi);
      } catch {
        if (!cancelled) setCanEdit(false);
      }
    }
    loadPermissions();
    return () => { cancelled = true; };
  }, [projectId]);

  const openCreateModal = () => {
    setModalMode("create");
    setEditingLink(null);
    setFormName("");
    setFormUrl("");
    setFormType("");
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (link: ProjectLinkRow) => {
    setModalMode("edit");
    setEditingLink(link);
    setFormName(link.name ?? "");
    setFormUrl(link.url ?? "");
    setFormType(link.link_type ?? "");
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (!saving) {
      setModalOpen(false);
      setEditingLink(null);
      setFormError(null);
    }
  };

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) {
        setModalOpen(false);
        setEditingLink(null);
        setFormError(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const id = requestAnimationFrame(() => linkModalFirstInputRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(id);
    };
  }, [modalOpen, saving]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = formName.trim();
    const url = formUrl.trim();
    if (!name || !url) {
      setFormError(t("errors.nameUrlRequired"));
      return;
    }
    if (!url.toLowerCase().startsWith("http")) {
      setFormError("La URL debe comenzar con http o https.");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      if (modalMode === "create") {
        const res = await fetch(`/api/projects/${projectId}/links`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({
            name,
            url,
            link_type: formType.trim() || "Otro",
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFormError((data as { error?: string }).error ?? "Error al crear el enlace.");
          return;
        }
        const payload = data as { link?: ProjectLinkRow };
        if (payload.link) setLinks((prev) => [payload.link!, ...prev]);
        closeModal();
      } else if (editingLink) {
        const res = await fetch(
          `/api/projects/${projectId}/links/${editingLink.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify({
              name,
              url,
              link_type: formType.trim() || null,
            }),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFormError((data as { error?: string }).error ?? "Error al actualizar.");
          return;
        }
        setLinks((prev) =>
          prev.map((l) => (l.id === editingLink.id ? (data as ProjectLinkRow) : l))
        );
        closeModal();
      }
    } catch {
      setFormError(t("errors.connection"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `/api/projects/${projectId}/links/${deleteTarget.id}`,
        { method: "DELETE", headers }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError((data as { error?: string }).error ?? "Error al eliminar.");
        return;
      }
      setLinks((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setDeleteError(t("errors.connection"));
    } finally {
      setDeleting(false);
    }
  };

  const openSourceModal = () => {
    setSourceFormName("");
    setSourceFormType(SOURCE_TYPE_OPTIONS[0].value);
    setSourceFormUrl("");
    setSourceFormDescription("");
    setSourceFormExternalId("");
    setSourceFormIntegrationId("");
    setSourceFormSyncEnabled(false);
    setSourceFormError(null);
    setSourceModalOpen(true);
    // Load user integrations for Google Drive dropdown
    getAuthHeaders().then((headers) => {
      fetch("/api/integrations", { headers })
        .then((res) => res.json().catch(() => ({ integrations: [] })))
        .then((data: { integrations?: IntegrationOption[] }) => {
          const list = (data.integrations ?? []).filter((i) => i.provider === "google_drive");
          setGoogleIntegrations(list);
        })
        .catch(() => setGoogleIntegrations([]));
    });
  };

  const closeSourceModal = () => {
    if (!savingSource) setSourceModalOpen(false);
  };

  const handleCreateSource = async (e: FormEvent) => {
    e.preventDefault();
    const name = sourceFormName.trim();
    if (!name) {
      setSourceFormError("El nombre es obligatorio.");
      return;
    }
    setSourceFormError(null);
    setSavingSource(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/projects/${projectId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          name,
          source_type: sourceFormType,
          source_url: sourceFormUrl.trim() || null,
          description: sourceFormDescription.trim() || null,
          external_id: sourceFormExternalId.trim() || null,
          integration_id: sourceFormIntegrationId.trim() || null,
          sync_enabled: sourceFormSyncEnabled,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSourceFormError((data as { error?: string }).error ?? "Error al crear la fuente.");
        return;
      }
      const payload = data as { source?: ProjectSourceRow };
      if (payload.source) setSources((prev) => [payload.source!, ...prev]);
      closeSourceModal();
    } catch {
      setSourceFormError(t("errors.connection"));
    } finally {
      setSavingSource(false);
    }
  };

  const formatSyncDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(localeTag, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const canSyncSource = (src: ProjectSourceRow) =>
    (src.source_type === "google_drive_folder" || src.source_type === "google_drive_file") &&
    !!src.integration_id &&
    !!src.external_id;

  const handleSyncSource = async (src: ProjectSourceRow) => {
    if (!projectId || !canSyncSource(src)) return;
    setSyncingSourceId(src.id);
    setSyncError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/projects/${projectId}/sources/${src.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncError((data as { error?: string }).error ?? "No se pudo sincronizar esta fuente");
        return;
      }
      setSyncError(null);
      await loadSources();
    } catch {
      setSyncError(t("errors.connection"));
    } finally {
      setSyncingSourceId(null);
    }
  };

  const handleSyncGoogleDrive = async () => {
    if (!projectId) return;
    setSyncDriveLoading(true);
    setSyncDriveMessage(null);
    setSyncError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/integrations/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; message?: string; chunksCreated?: number; filesProcessed?: number };
      if (!res.ok) {
        setSyncDriveMessage((data as { error?: string }).error ?? "No se pudo sincronizar Google Drive.");
        return;
      }
      setSyncDriveMessage(data.message ?? (data.ok ? t("sync.completed") : t("sync.completedWithErrors")));
      await loadSources();
    } catch {
      setSyncDriveMessage(t("errors.connection"));
    } finally {
      setSyncDriveLoading(false);
    }
  };

  if (!projectId) {
    return (
      <div className={PROJECT_WORKSPACE_PAGE}>
        <p className="text-sm text-slate-500">{t("invalidProjectId")}</p>
      </div>
    );
  }

  return (
    <div className={PROJECT_WORKSPACE_PAGE}>
      <div className={PROJECT_WORKSPACE_HERO}>
        <ProjectPageHeader
          variant="page"
          eyebrow={t("eyebrow")}
          title={t("title")}
          subtitle={t("subtitle")}
          primaryActionLabel={canEdit ? t("newLink") : undefined}
          primaryActionOnClick={canEdit ? openCreateModal : undefined}
        />
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      {/* Operational project links */}
      <ModuleContentCard tone="light">
        <div className="px-6 py-4 border-b border-slate-200/90 bg-slate-50/80">
          <h2 className="text-sm font-semibold text-slate-900">{t("projectLinks.title")}</h2>
          <p className="mt-0.5 text-xs text-slate-600 max-w-2xl leading-relaxed">
            {t("projectLinks.subtitle")}
          </p>
        </div>
        {loading ? (
          <div className="px-6 py-10 text-sm text-slate-500">{t("projectLinks.loading")}</div>
        ) : links.length === 0 ? (
          <div className={`${PROJECT_WORKSPACE_EMPTY} py-12`}>
            <p className="text-base font-semibold text-slate-900">{t("projectLinks.emptyTitle")}</p>
            <p className="mt-1.5 text-sm text-slate-600">{t("projectLinks.emptyBody")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {links.map((link) => (
              <li
                key={link.id}
                className="flex items-center justify-between gap-4 px-6 py-4 cursor-pointer hover:bg-slate-50/90 transition-colors duration-150"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={link.url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-slate-900 hover:text-[rgb(var(--rb-brand-primary-active))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/25 focus-visible:ring-offset-2 rounded"
                    >
                      {link.name ?? t("projectLinks.untitled")}
                    </a>
                    {link.link_type && (
                      <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/80">
                        {link.link_type}
                      </span>
                    )}
                  </div>
                  {link.url && (
                    <p className="text-xs text-slate-500 truncate max-w-2xl">
                      {link.url}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(link)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/25"
                      title={t("actions.edit")}
                      aria-label={t("actions.edit")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(link)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-red-600 shadow-sm hover:bg-red-50 hover:border-red-200 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
                      title={t("actions.delete")}
                      aria-label={t("actions.delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </ModuleContentCard>

      {/* Project knowledge sources (Sapito) */}
      <ModuleContentCard tone="light">
        <div className="px-6 py-4 border-b border-slate-200/90 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative h-10 w-10 rounded-xl overflow-hidden bg-slate-100 shrink-0 ring-1 ring-slate-200/90">
              <Image
                src={getSapitoProject().avatarImage}
                alt=""
                fill
                className="object-cover"
                sizes="40px"
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">{t("sources.title")}</h2>
              <p className="mt-0.5 text-xs text-slate-600 max-w-2xl leading-relaxed">
                {t("sources.subtitle")}
              </p>
            </div>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2 shrink-0">
              {sources.some((s) => s.source_type === "google_drive_folder" || s.source_type === "google_drive_file") && (
                <button
                  type="button"
                  onClick={handleSyncGoogleDrive}
                  disabled={syncDriveLoading}
                  className="rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 transition-colors duration-150"
                >
                  {syncDriveLoading ? t("sync.syncing") : t("sync.drive")}
                </button>
              )}
              <button
                type="button"
                onClick={openSourceModal}
                className="rounded-xl rb-btn-primary px-4 py-2 text-sm font-medium shadow-sm transition-colors duration-150 shrink-0"
              >
                {t("sources.new")}
              </button>
            </div>
          )}
        </div>
        {errorSources && (
          <div className="px-6 py-3 border-b border-red-200 bg-red-50 flex flex-wrap items-center gap-2">
            <span className="text-sm text-red-800">{errorSources}</span>
            <button
              type="button"
              onClick={() => void loadSources()}
              className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-800 hover:bg-red-100 transition-colors duration-150"
            >
              {t("actions.retry")}
            </button>
          </div>
        )}
        {syncError && (
          <div className="px-6 py-3 border-b border-amber-200 bg-amber-50 text-sm text-amber-900">
            {syncError}
          </div>
        )}
        {syncDriveMessage && (
          <div className={`px-6 py-3 border-b text-sm ${syncDriveMessage.startsWith("Sync") || syncDriveMessage.includes("completad") ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            {syncDriveMessage}
          </div>
        )}
        {loadingSources ? (
          <div className="px-6 py-10 text-sm text-slate-500">{t("sources.loading")}</div>
        ) : sources.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <h3 className="text-base font-semibold text-slate-900">{t("sources.emptyTitle")}</h3>
            <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              {t("sources.emptyBody")}
            </p>
            <a
              href="/admin"
              className="mt-4 inline-block text-sm font-medium text-[rgb(var(--rb-brand-primary-active))] hover:text-[rgb(var(--rb-brand-primary-hover))] transition-colors duration-150"
            >
              {t("sources.goAdmin")}
            </a>
            {canEdit && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={openSourceModal}
                  className="rounded-xl rb-btn-primary px-4 py-2.5 text-sm font-medium shadow-sm transition-colors duration-150"
                >
                  {t("sources.new")}
                </button>
              </div>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sources.map((src) => (
              <li
                key={src.id}
                className="flex items-start justify-between gap-4 px-6 py-4 cursor-pointer hover:bg-slate-50/90 transition-colors duration-150"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="font-medium text-slate-900">{src.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-slate-700 ring-1 ring-slate-200/80">
                      {SOURCE_TYPE_OPTIONS.find((o) => o.value === src.source_type)?.label ?? src.source_type}
                    </span>
                    <span>
                      {t("sync.status")}: {syncingSourceId === src.id
                        ? t("sync.running")
                        : t(`sync.states.${src.last_sync_status}`)}
                    </span>
                    {src.last_synced_at && (
                      <span>{t("sync.last")}: {formatSyncDate(src.last_synced_at)}</span>
                    )}
                    {src.sync_enabled && (
                      <span className="text-emerald-700 font-medium">{t("sync.enabled")}</span>
                    )}
                    {src.integration_id && (
                      <span className="inline-flex items-center rounded-lg bg-[rgb(var(--rb-brand-surface))] px-2 py-0.5 text-[rgb(var(--rb-brand-primary-active))] ring-1 ring-[rgb(var(--rb-brand-primary))]/18">
                        {t("sync.accountLinked")}
                      </span>
                    )}
                  </div>
                  {src.description && (
                    <p className="text-xs text-slate-600 line-clamp-2">{src.description}</p>
                  )}
                  {src.source_url && (
                    <p className="text-xs text-slate-500 truncate max-w-2xl">{src.source_url}</p>
                  )}
                  {src.last_sync_status === "success" && (
                    <p className="text-xs text-emerald-700 font-medium">{t("sync.availableForSapito")}</p>
                  )}
                </div>
                {canEdit && canSyncSource(src) && (
                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSyncSource(src)}
                      disabled={syncingSourceId !== null}
                      className="rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 transition-colors duration-150"
                    >
                      {syncingSourceId === src.id ? t("sync.syncing") : t("sync.sync")}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </ModuleContentCard>

      {/* Create/Edit link modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 overflow-y-auto"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="link-modal-title"
        >
          <div
            className="w-full max-w-md min-w-0 rounded-2xl border border-slate-200/90 bg-white shadow-xl ring-1 ring-slate-100 p-6 md:p-8 max-h-[85vh] overflow-y-auto my-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Escape") closeModal(); }}
          >
            <div className="mb-6">
              <h2 id="link-modal-title" className="text-lg font-semibold text-slate-900">
                {modalMode === "create" ? t("modal.newLinkTitle") : t("modal.editLinkTitle")}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {t("modal.linkHelp")}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="link-form-name">{t("modal.name")} *</label>
                <input
                  id="link-form-name"
                  ref={linkModalFirstInputRef}
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30 focus-visible:border-[rgb(var(--rb-brand-primary))]/30"
                  placeholder={t("modal.namePlaceholder")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="link-form-url">{t("modal.url")} *</label>
                <input
                  id="link-form-url"
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30 focus-visible:border-[rgb(var(--rb-brand-primary))]/30"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{t("modal.type")}</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30 focus-visible:border-[rgb(var(--rb-brand-primary))]/30"
                >
                  {LINK_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value || "empty"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {formError && (
                <p className="text-sm text-red-700">{formError}</p>
              )}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/90">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors duration-150"
                >
                  {t("actions.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl rb-btn-primary px-4 py-2.5 text-sm font-medium disabled:opacity-60 transition-colors duration-150"
                >
                  {saving ? t("actions.saving") : modalMode === "create" ? t("actions.create") : t("actions.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40"
          onClick={() => !deleting && setDeleteTarget(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="link-delete-title"
        >
          <div
            className="w-full max-w-md min-w-0 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl ring-1 ring-slate-100"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Escape" && !deleting) setDeleteTarget(null); }}
          >
            <h3 id="link-delete-title" className="text-lg font-semibold text-slate-900">{t("delete.title")}</h3>
            <p className="mt-2 text-sm text-slate-600">
              {t("delete.body", { name: deleteTarget.name ?? t("projectLinks.untitled") })}
            </p>
            {deleteError && (
              <p className="mt-2 text-sm text-red-700">{deleteError}</p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors duration-150"
              >
                {t("actions.cancel")}
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 disabled:opacity-60 transition-colors duration-150"
              >
                {deleting ? t("actions.deleting") : t("actions.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create source modal */}
      {sourceModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 overflow-y-auto"
          onClick={closeSourceModal}
        >
          <div
            className="w-full max-w-lg min-w-0 my-8 rounded-2xl border border-slate-200/90 bg-white shadow-xl ring-1 ring-slate-100 overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 md:p-8 border-b border-slate-200/90 bg-slate-50/75">
              <h2 className="text-lg font-semibold text-slate-900">{t("sourceModal.title")}</h2>
              <p className="mt-1.5 text-sm text-slate-600">
                {t("sourceModal.subtitle")}
              </p>
            </div>
            <form onSubmit={handleCreateSource} className="p-6 md:p-8 max-h-[min(70vh,520px)] overflow-y-auto">
              <div className="space-y-6">
                {/* Section 1 — Identificación */}
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("sourceModal.sections.identification")}</h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">{t("sourceModal.name")} *</label>
                    <input
                      type="text"
                      value={sourceFormName}
                      onChange={(e) => setSourceFormName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30"
                      placeholder={t("sourceModal.namePlaceholder")}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">{t("sourceModal.sourceType")} *</label>
                    <select
                      value={sourceFormType}
                      onChange={(e) => setSourceFormType(e.target.value)}
                      className="w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30"
                    >
                      {SOURCE_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Section 2 — Conexión */}
                <div className="space-y-4 pt-4 border-t border-slate-200/90">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("sourceModal.sections.connection")}</h3>
                  {(sourceFormType === "google_drive_folder" || sourceFormType === "google_drive_file") && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Cuenta de Google Drive</label>
                      <select
                        value={sourceFormIntegrationId}
                        onChange={(e) => setSourceFormIntegrationId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30"
                      >
                        <option value="">Seleccionar cuenta conectada</option>
                        {googleIntegrations.map((int) => (
                          <option key={int.id} value={int.id}>
                            {int.account_email || int.display_name || int.id}
                          </option>
                        ))}
                      </select>
                      {googleIntegrations.length === 0 && (
                        <p className="mt-1.5 text-xs text-slate-500">
                          {t("sourceModal.connectAccountHint")}
                        </p>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {(sourceFormType === "google_drive_folder" || sourceFormType === "google_drive_file")
                        ? "ID de carpeta o archivo (opcional)"
                        : "ID externo (opcional)"}
                    </label>
                    <input
                      type="text"
                      value={sourceFormExternalId}
                      onChange={(e) => setSourceFormExternalId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30"
                      placeholder={
                        sourceFormType === "google_drive_folder" || sourceFormType === "google_drive_file"
                          ? "ID de la carpeta o archivo en Drive"
                          : "Ej: ID de espacio Confluence"
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">URL (opcional)</label>
                    <input
                      type="url"
                      value={sourceFormUrl}
                      onChange={(e) => setSourceFormUrl(e.target.value)}
                      className="w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                {/* Section 3 — Contexto adicional */}
                <div className="space-y-4 pt-4 border-t border-slate-200/90">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("sourceModal.sections.additionalContext")}</h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">{t("sourceModal.description")}</label>
                    <textarea
                      value={sourceFormDescription}
                      onChange={(e) => setSourceFormDescription(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30 resize-y"
                      placeholder={t("sourceModal.descriptionPlaceholder")}
                    />
                  </div>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="source-sync-enabled"
                      checked={sourceFormSyncEnabled}
                      onChange={(e) => setSourceFormSyncEnabled(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 bg-white text-[rgb(var(--rb-brand-primary))] focus:ring-[rgb(var(--rb-brand-ring))]/35"
                    />
                    <label htmlFor="source-sync-enabled" className="text-sm text-slate-700">
                      {t("sourceModal.syncEnabledHelp")}
                    </label>
                  </div>
                </div>
              </div>
              {sourceFormError && <p className="mt-4 text-sm text-red-700">{sourceFormError}</p>}
              <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-slate-200/90">
                <button
                  type="button"
                  onClick={closeSourceModal}
                  disabled={savingSource}
                  className="rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors duration-150"
                >
                  {t("actions.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={savingSource}
                  className="rounded-xl rb-btn-primary px-4 py-2.5 text-sm font-medium disabled:opacity-60 transition-colors duration-150"
                >
                  {savingSource ? t("actions.saving") : t("sources.create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
