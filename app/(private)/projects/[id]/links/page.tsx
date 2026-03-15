"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { Pencil, Trash2 } from "lucide-react";
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

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onKeyDown);
    const id = requestAnimationFrame(() => linkModalFirstInputRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(id);
    };
  }, [modalOpen]);

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
      <div className="w-full min-w-0 space-y-6">
        <p className="text-sm text-slate-400">Identificador de proyecto no válido.</p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-8">
      <header className="space-y-1">
        <ProjectPageHeader
          variant="section"
          dark
          title="Enlaces y fuentes de conocimiento"
          subtitle="Enlaces operativos del proyecto (Jira, Confluence, documentación) y fuentes de conocimiento para Sapito. Las cuentas de Google Drive se gestionan desde Admin."
          primaryActionLabel={canEdit ? "Nuevo enlace" : undefined}
          primaryActionOnClick={canEdit ? openCreateModal : undefined}
        />
      </header>

      {errorMsg && (
        <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      {/* Operational project links */}
      <section className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-sm font-medium text-slate-200">Enlaces del proyecto</h2>
          <p className="mt-0.5 text-xs text-slate-400 max-w-2xl">
            Enlaces operativos: Jira, Confluence, documentación y herramientas.
          </p>
        </div>
        {loading ? (
          <div className="px-6 py-10 text-sm text-slate-500">Cargando enlaces…</div>
        ) : links.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/30 py-12 px-6 text-center">
            <p className="text-base font-medium text-slate-200">No hay enlaces registrados</p>
            <p className="mt-1.5 text-sm text-slate-500">Añade enlaces con «Nuevo enlace» para accesos rápidos desde el proyecto.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-700/40">
            {links.map((link) => (
              <li
                key={link.id}
                className="flex items-center justify-between gap-4 px-6 py-4 cursor-pointer hover:bg-slate-800/50 transition-colors duration-150"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={link.url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-slate-100 hover:text-indigo-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0 rounded"
                    >
                      {link.name ?? "Sin nombre"}
                    </a>
                    {link.link_type && (
                      <span className="inline-flex items-center rounded-lg bg-slate-700/60 px-2 py-0.5 text-[11px] font-medium text-slate-400">
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
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-600/80 bg-slate-800/60 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0"
                      title="Editar"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(link)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-600/80 bg-slate-800/60 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0"
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

      {/* Project knowledge sources (Sapito) */}
      <section className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative h-10 w-10 rounded-xl overflow-hidden bg-slate-700 shrink-0 ring-1 ring-slate-600/50">
              <Image
                src={getSapitoProject().avatarImage}
                alt=""
                fill
                className="object-cover"
                sizes="40px"
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-medium text-slate-200">Fuentes de conocimiento</h2>
              <p className="mt-0.5 text-xs text-slate-400 max-w-2xl">
                Fuentes conectadas a este proyecto para que Sapito las use como contexto. Las cuentas de Google Drive y fuentes globales se gestionan en Admin → Knowledge Sources.
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
                  className="rounded-xl border border-slate-600/80 bg-slate-800/60 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 hover:border-slate-500 disabled:opacity-60 transition-colors duration-150"
                >
                  {syncDriveLoading ? "Sincronizando…" : "Sincronizar Drive"}
                </button>
              )}
              <button
                type="button"
                onClick={openSourceModal}
                className="rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 transition-colors duration-150 shrink-0"
              >
                Nueva fuente
              </button>
            </div>
          )}
        </div>
        {errorSources && (
          <div className="px-6 py-3 border-b border-red-800/50 bg-red-950/30 flex flex-wrap items-center gap-2">
            <span className="text-sm text-red-200">{errorSources}</span>
            <button
              type="button"
              onClick={() => void loadSources()}
              className="rounded-lg border border-red-600/60 bg-red-900/30 px-2.5 py-1 text-xs font-medium text-red-200 hover:bg-red-800/40 transition-colors duration-150"
            >
              Reintentar
            </button>
          </div>
        )}
        {syncError && (
          <div className="px-6 py-3 border-b border-amber-800/50 bg-amber-950/20 text-sm text-amber-200">
            {syncError}
          </div>
        )}
        {syncDriveMessage && (
          <div className={`px-6 py-3 border-b text-sm ${syncDriveMessage.startsWith("Sync") || syncDriveMessage.includes("completad") ? "border-emerald-800/50 bg-emerald-950/20 text-emerald-200" : "border-amber-800/50 bg-amber-950/20 text-amber-200"}`}>
            {syncDriveMessage}
          </div>
        )}
        {loadingSources ? (
          <div className="px-6 py-10 text-sm text-slate-500">Cargando fuentes…</div>
        ) : sources.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <h3 className="text-base font-semibold text-slate-200">Aún no hay fuentes de conocimiento</h3>
            <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
              Las fuentes de Google Drive y el conocimiento global se configuran en Admin. Aquí puedes registrar fuentes ya conectadas o enlazar otras para que Sapito las use en este proyecto.
            </p>
            <a
              href="/admin"
              className="mt-4 inline-block text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors duration-150"
            >
              Ir a Admin → Knowledge Sources
            </a>
            {canEdit && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={openSourceModal}
                  className="rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 transition-colors duration-150"
                >
                  Nueva fuente
                </button>
              </div>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-700/50">
            {sources.map((src) => (
              <li
                key={src.id}
                className="flex items-start justify-between gap-4 px-6 py-4 cursor-pointer hover:bg-slate-800/50 transition-colors duration-150"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="font-medium text-slate-100">{src.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="inline-flex items-center rounded-lg bg-slate-700/60 px-2 py-0.5 text-slate-300">
                      {SOURCE_TYPE_OPTIONS.find((o) => o.value === src.source_type)?.label ?? src.source_type}
                    </span>
                    <span>
                      Sincronización: {syncingSourceId === src.id
                        ? SYNC_STATUS_LABELS.running
                        : SYNC_STATUS_LABELS[src.last_sync_status] ?? src.last_sync_status}
                    </span>
                    {src.last_synced_at && (
                      <span>Última: {formatSyncDate(src.last_synced_at)}</span>
                    )}
                    {src.sync_enabled && (
                      <span className="text-emerald-400">Sync activada</span>
                    )}
                    {src.integration_id && (
                      <span className="inline-flex items-center rounded-lg bg-indigo-500/20 px-2 py-0.5 text-indigo-300">
                        Cuenta vinculada
                      </span>
                    )}
                  </div>
                  {src.description && (
                    <p className="text-xs text-slate-400 line-clamp-2">{src.description}</p>
                  )}
                  {src.source_url && (
                    <p className="text-xs text-slate-500 truncate max-w-2xl">{src.source_url}</p>
                  )}
                  {src.last_sync_status === "success" && (
                    <p className="text-xs text-emerald-400">Disponible para Sapito</p>
                  )}
                </div>
                {canEdit && canSyncSource(src) && (
                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSyncSource(src)}
                      disabled={syncingSourceId !== null}
                      className="rounded-xl border border-slate-600/80 bg-slate-800/60 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-60 transition-colors duration-150"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="link-modal-title"
        >
          <div
            className="w-full max-w-md min-w-0 rounded-2xl border border-slate-700/80 bg-slate-800/95 shadow-xl ring-1 ring-slate-700/50 p-6 md:p-8 max-h-[85vh] overflow-y-auto my-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Escape") closeModal(); }}
          >
            <div className="mb-6">
              <h2 id="link-modal-title" className="text-lg font-semibold text-slate-100">
                {modalMode === "create" ? "Nuevo enlace" : "Editar enlace"}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Enlace operativo del proyecto: Jira, Confluence, documentación o herramientas. Acceso rápido para el equipo.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5" htmlFor="link-form-name">Nombre *</label>
                <input
                  id="link-form-name"
                  ref={linkModalFirstInputRef}
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-500/50"
                  placeholder="Ej: Documentación SAP"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5" htmlFor="link-form-url">URL *</label>
                <input
                  id="link-form-url"
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-500/50"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Tipo</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:border-indigo-500/50"
                >
                  {LINK_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value || "empty"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {formError && (
                <p className="text-sm text-red-400">{formError}</p>
              )}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-600 bg-slate-700/80 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-60 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-indigo-500/90 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => !deleting && setDeleteTarget(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="link-delete-title"
        >
          <div
            className="w-full max-w-md min-w-0 rounded-2xl border border-slate-700/80 bg-slate-800/95 p-6 shadow-xl ring-1 ring-slate-700/50"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Escape") !deleting && setDeleteTarget(null); }}
          >
            <h3 id="link-delete-title" className="text-lg font-semibold text-slate-100">Eliminar enlace</h3>
            <p className="mt-2 text-sm text-slate-400">
              ¿Eliminar «{deleteTarget.name ?? "Sin nombre"}»? Esta acción no se puede deshacer.
            </p>
            {deleteError && (
              <p className="mt-2 text-sm text-red-400">{deleteError}</p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-xl border border-slate-600 bg-slate-700/80 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-60 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto"
          onClick={closeSourceModal}
        >
          <div
            className="w-full max-w-lg min-w-0 my-8 rounded-2xl border border-slate-700/80 bg-slate-800/95 shadow-xl ring-1 ring-slate-700/50 overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 md:p-8 border-b border-slate-700/60">
              <h2 className="text-lg font-semibold text-slate-100">Nueva fuente de conocimiento</h2>
              <p className="mt-1.5 text-sm text-slate-400">
                Registra una fuente externa para que Sapito la use como contexto en este proyecto. Podrás activar la sincronización después.
              </p>
            </div>
            <form onSubmit={handleCreateSource} className="p-6 md:p-8 max-h-[min(70vh,520px)] overflow-y-auto">
              <div className="space-y-6">
                {/* Section 1 — Identificación */}
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Identificación</h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre *</label>
                    <input
                      type="text"
                      value={sourceFormName}
                      onChange={(e) => setSourceFormName(e.target.value)}
                      className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                      placeholder="Ej: Documentación Drive del proyecto"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Tipo de fuente *</label>
                    <select
                      value={sourceFormType}
                      onChange={(e) => setSourceFormType(e.target.value)}
                      className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
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
                <div className="space-y-4 pt-4 border-t border-slate-700/50">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Conexión</h3>
                  {(sourceFormType === "google_drive_folder" || sourceFormType === "google_drive_file") && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Cuenta de Google Drive</label>
                      <select
                        value={sourceFormIntegrationId}
                        onChange={(e) => setSourceFormIntegrationId(e.target.value)}
                        className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
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
                          Conecta una cuenta en Admin → Knowledge Sources y vuelve aquí para elegir la fuente del proyecto.
                        </p>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      {(sourceFormType === "google_drive_folder" || sourceFormType === "google_drive_file")
                        ? "ID de carpeta o archivo (opcional)"
                        : "ID externo (opcional)"}
                    </label>
                    <input
                      type="text"
                      value={sourceFormExternalId}
                      onChange={(e) => setSourceFormExternalId(e.target.value)}
                      className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                      placeholder={
                        sourceFormType === "google_drive_folder" || sourceFormType === "google_drive_file"
                          ? "ID de la carpeta o archivo en Drive"
                          : "Ej: ID de espacio Confluence"
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">URL (opcional)</label>
                    <input
                      type="url"
                      value={sourceFormUrl}
                      onChange={(e) => setSourceFormUrl(e.target.value)}
                      className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                {/* Section 3 — Contexto adicional */}
                <div className="space-y-4 pt-4 border-t border-slate-700/50">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Contexto adicional</h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Descripción (opcional)</label>
                    <textarea
                      value={sourceFormDescription}
                      onChange={(e) => setSourceFormDescription(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-y"
                      placeholder="Breve descripción de la fuente"
                    />
                  </div>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="source-sync-enabled"
                      checked={sourceFormSyncEnabled}
                      onChange={(e) => setSourceFormSyncEnabled(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-500 bg-slate-700 text-indigo-500 focus:ring-indigo-500/50"
                    />
                    <label htmlFor="source-sync-enabled" className="text-sm text-slate-300">
                      Sincronización activada. Esta fuente podrá sincronizarse con Sapito en un siguiente paso.
                    </label>
                  </div>
                </div>
              </div>
              {sourceFormError && (
                <p className="mt-4 text-sm text-red-400">{sourceFormError}</p>
              )}
              <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={closeSourceModal}
                  disabled={savingSource}
                  className="rounded-xl border border-slate-600 bg-slate-700/80 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-60 transition-colors duration-150"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSource}
                  className="rounded-xl bg-indigo-500/90 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60 transition-colors duration-150"
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
