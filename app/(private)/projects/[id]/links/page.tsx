"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";

type ProjectLinkRow = {
  id: string;
  project_id?: string;
  name: string | null;
  url: string | null;
  link_type: string | null;
  created_at: string;
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

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
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

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    async function loadPermissions() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [permRes, meRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/permissions`, { headers }),
          fetch("/api/me", { headers }),
        ]);
        if (cancelled) return;
        const permData = await permRes.json().catch(() => ({}));
        const meData = await meRes.json().catch(() => ({ appRole: null }));
        const appRole = (meData as { appRole?: string | null }).appRole ?? null;
        const fromApi = (permData as { canEdit?: boolean }).canEdit ?? false;
        setCanEdit(appRole === "superadmin" || fromApi);
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
        title="Enlaces del proyecto"
        subtitle="Gestión de enlaces y accesos rápidos de este proyecto."
        primaryActionLabel={canEdit ? "Nuevo enlace" : undefined}
        primaryActionOnClick={canEdit ? openCreateModal : undefined}
      />

      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            Cargando enlaces…
          </div>
        ) : links.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            No hay enlaces registrados. Crea uno con «Nuevo enlace».
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

      {/* Create/Edit modal */}
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
    </div>
  );
}
