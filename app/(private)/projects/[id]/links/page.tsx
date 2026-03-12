"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { Pencil, Trash2, Database } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";
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

const SYNC_STATUS_LABELS: Record<string, string> = {
  never: "Nunca",
  running: "En curso",
  success: "Correcto",
  partial: "Parcial",
  error: "Error",
};

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
        setErrorMsg((data as { error?: string }).error ?? "Error al cargar los enlaces.");
        setLinks([]);
        return;
      }
      const payload = data as { projectId?: string; links?: ProjectLinkRow[] };
      setLinks(payload.links ?? []);
    } catch {
      setErrorMsg("Error de conexión.");
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

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
        setErrorSources((data as { error?: string }).error ?? "Error al cargar las fuentes.");
        setSources([]);
        return;
      }
      const payload = data as { projectId?: string; sources?: ProjectSourceRow[] };
      setSources(payload.sources ?? []);
    } catch {
      setErrorSources("Error de conexión.");
      setSources([]);
    } finally {
      setLoadingSources(false);
    }
  }, [projectId]);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = formName.trim();
    const url = formUrl.trim();
    if (!name || !url) {
      setFormError("Nombre y URL son obligatorios.");
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
      setFormError("Error de conexión.");
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
      setDeleteError("Error de conexión.");
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
      setSourceFormError("Error de conexión.");
    } finally {
      setSavingSource(false);
    }
  };

  const formatSyncDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-ES", {
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
      setSyncError("Error de conexión.");
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
      setSyncDriveMessage(data.message ?? (data.ok ? "Sync completed" : "Sincronización completada con errores."));
      await loadSources();
    } catch {
      setSyncDriveMessage("Error de conexión.");
    } finally {
      setSyncDriveLoading(false);
    }
  };

  if (!projectId) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-slate-600">Identificador de proyecto no válido.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProjectPageHeader
        variant="section"
        title="Enlaces y fuentes de conocimiento"
        subtitle="Enlaces operativos (Jira, Confluence, etc.) y fuentes de conocimiento del proyecto para Sapito. Google Drive se gestiona desde Admin."
        primaryActionLabel={canEdit ? "Nuevo enlace" : undefined}
        primaryActionOnClick={canEdit ? openCreateModal : undefined}
      />

      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80">
          <h2 className="text-sm font-semibold text-slate-800">Enlaces del proyecto</h2>
          <p className="text-xs text-slate-500 mt-0.5">Enlaces operativos de navegación: Jira, tableros, Confluence, carpeta principal, etc.</p>
          <p className="text-xs text-slate-500 mt-0.5">Accesos rápidos a documentación y herramientas.</p>
        </div>
        {loading ? (
          <div className="px-6 py-10 text-sm text-slate-500">Cargando enlaces…</div>
        ) : links.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-700">No hay enlaces registrados</p>
            <p className="mt-1 text-sm text-slate-500">Crea uno con «Nuevo enlace».</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {links.map((link) => (
              <li
                key={link.id}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50/50 transition"
              >
                <div className="min-w-0 flex-1">
                  <a
                    href={link.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    {link.name ?? "Sin nombre"}
                  </a>
                  {link.link_type && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                      {link.link_type}
                    </span>
                  )}
                  {link.url && (
                    <p className="mt-1 text-xs text-slate-500 truncate max-w-2xl">
                      {link.url}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(link)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition"
                      title="Editar"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(link)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 transition"
                      title="Eliminar"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Fuentes de conocimiento (Sapito del Proyecto) */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 rounded-xl overflow-hidden bg-slate-100 shrink-0">
              <Image
                src={getSapitoProject().avatarImage}
                alt=""
                fill
                className="object-cover"
                sizes="40px"
              />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Project knowledge sources</h2>
              <p className="text-xs text-slate-500 mt-0.5">Fuentes de conocimiento de este proyecto. Google Drive y fuentes globales se gestionan desde Admin → Knowledge Sources.</p>
            </div>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2 shrink-0">
              {sources.some((s) => s.source_type === "google_drive_folder" || s.source_type === "google_drive_file") && (
                <button
                  type="button"
                  onClick={handleSyncGoogleDrive}
                  disabled={syncDriveLoading}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 transition"
                >
                  {syncDriveLoading ? "Sincronizando…" : "Sync Google Drive"}
                </button>
              )}
              <button
                type="button"
                onClick={openSourceModal}
                className="rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-colors shrink-0"
              >
                Nueva fuente
              </button>
            </div>
          )}
        </div>
        {errorSources && (
          <div className="px-4 py-2 border-b border-red-100 bg-red-50 flex flex-wrap items-center gap-2">
            <span className="text-sm text-red-700">{errorSources}</span>
            <button
              type="button"
              onClick={() => void loadSources()}
              className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              Reintentar
            </button>
          </div>
        )}
        {syncError && (
          <div className="px-4 py-2 border-b border-amber-200 bg-amber-50 text-sm text-amber-800">
            {syncError}
          </div>
        )}
        {syncDriveMessage && (
          <div className={`px-4 py-2 border-b text-sm ${syncDriveMessage.startsWith("Sync") || syncDriveMessage.includes("completad") ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            {syncDriveMessage}
          </div>
        )}
        {loadingSources ? (
          <div className="px-6 py-10 text-sm text-slate-500">Cargando fuentes…</div>
        ) : sources.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-700">Este proyecto aún no tiene fuentes de conocimiento</p>
            <p className="mt-1 text-sm text-slate-500">Las fuentes de Google Drive y el conocimiento global se gestionan desde Admin. Añade aquí fuentes ya conectadas o enlaza otras fuentes.</p>
            <a
              href="/admin"
              className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              Ir a Admin → Knowledge Sources
            </a>
            {canEdit && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={openSourceModal}
                  className="rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                >
                  Nueva fuente
                </button>
              </div>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sources.map((src) => (
              <li
                key={src.id}
                className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-50/50 transition"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{src.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                      {SOURCE_TYPE_OPTIONS.find((o) => o.value === src.source_type)?.label ?? src.source_type}
                    </span>
                    <span>
                      Estado de sincronización: {syncingSourceId === src.id
                        ? SYNC_STATUS_LABELS.running
                        : SYNC_STATUS_LABELS[src.last_sync_status] ?? src.last_sync_status}
                    </span>
                    {src.last_synced_at && (
                      <span>Última sincronización: {formatSyncDate(src.last_synced_at)}</span>
                    )}
                    {src.sync_enabled && (
                      <span className="text-emerald-600">Sync activada</span>
                    )}
                    {src.integration_id && (
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">
                        Cuenta vinculada
                      </span>
                    )}
                  </div>
                  {src.description && (
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2">{src.description}</p>
                  )}
                  {src.source_url && (
                    <p className="mt-1 text-xs text-slate-500 truncate max-w-2xl">{src.source_url}</p>
                  )}
                  {src.last_sync_status === "success" && (
                    <p className="mt-1 text-xs text-emerald-600">Esta fuente ya puede ser utilizada por Sapito</p>
                  )}
                </div>
                {canEdit && canSyncSource(src) && (
                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSyncSource(src)}
                      disabled={syncingSourceId !== null}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 transition"
                    >
                      {syncingSourceId === src.id ? "Sincronizando…" : "Sincronizar"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Create/Edit link modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={closeModal}
        >
          <div
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900">
              {modalMode === "create" ? "Nuevo enlace" : "Editar enlace"}
            </h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Ej: Documentación SAP"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">URL *</label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {LINK_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value || "empty"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {formError && (
                <p className="text-xs text-red-600">{formError}</p>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? "Guardando…" : modalMode === "create" ? "Crear" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900">Eliminar enlace</h3>
            <p className="mt-2 text-sm text-slate-600">
              ¿Eliminar «{deleteTarget.name ?? "Sin nombre"}»? Esta acción no se puede deshacer.
            </p>
            {deleteError && (
              <p className="mt-2 text-sm text-red-600">{deleteError}</p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {deleting ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create source modal */}
      {sourceModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={closeSourceModal}
        >
          <div
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900">Nueva fuente</h2>
            <p className="mt-1 text-xs text-slate-500">Registra una fuente externa. Esta fuente podrá sincronizarse con Sapito en el siguiente paso.</p>
            <form onSubmit={handleCreateSource} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={sourceFormName}
                  onChange={(e) => setSourceFormName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Ej: Documentación Drive del proyecto"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de fuente *</label>
                <select
                  value={sourceFormType}
                  onChange={(e) => setSourceFormType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {SOURCE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {(sourceFormType === "google_drive_folder" || sourceFormType === "google_drive_file") && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Cuenta de Google Drive</label>
                  <select
                    value={sourceFormIntegrationId}
                    onChange={(e) => setSourceFormIntegrationId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">Seleccionar cuenta conectada</option>
                    {googleIntegrations.map((int) => (
                      <option key={int.id} value={int.id}>
                        {int.account_email || int.display_name || int.id}
                      </option>
                    ))}
                  </select>
                  {googleIntegrations.length === 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      Google Drive se gestiona desde Admin. Conecta una cuenta en Admin → Knowledge Sources y vuelve aquí para elegir la fuente del proyecto.
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {(sourceFormType === "google_drive_folder" || sourceFormType === "google_drive_file")
                    ? "ID de carpeta o archivo (opcional)"
                    : "ID externo (opcional)"}
                </label>
                <input
                  type="text"
                  value={sourceFormExternalId}
                  onChange={(e) => setSourceFormExternalId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder={
                    sourceFormType === "google_drive_folder" || sourceFormType === "google_drive_file"
                      ? "ID de la carpeta o archivo en Drive"
                      : "Ej: ID de espacio Confluence"
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">URL (opcional)</label>
                <input
                  type="url"
                  value={sourceFormUrl}
                  onChange={(e) => setSourceFormUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descripción (opcional)</label>
                <textarea
                  value={sourceFormDescription}
                  onChange={(e) => setSourceFormDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Breve descripción de la fuente"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="source-sync-enabled"
                  checked={sourceFormSyncEnabled}
                  onChange={(e) => setSourceFormSyncEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="source-sync-enabled" className="text-sm text-slate-700">
                  Sincronización activada (esta fuente podrá sincronizarse con Sapito en el siguiente paso)
                </label>
              </div>
              {sourceFormError && (
                <p className="text-xs text-red-600">{sourceFormError}</p>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeSourceModal}
                  disabled={savingSource}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSource}
                  className="rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
                >
                  {savingSource ? "Guardando…" : "Crear fuente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
