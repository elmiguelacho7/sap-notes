"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Archive } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export type ObjectActionsEntity = "note" | "project" | "ticket";

export type ObjectActionsProps = {
  entity: ObjectActionsEntity;
  id: string;
  canEdit: boolean;
  canDelete: boolean;
  canArchive?: boolean;
  editHref?: string;
  deleteEndpoint?: string;
  archiveEndpoint?: string;
  /** Callback after successful archive (e.g. refresh project data). If not set, redirects to list. */
  onArchived?: () => void;
};

const ENTITY_LABELS: Record<ObjectActionsEntity, string> = {
  note: "nota",
  project: "proyecto",
  ticket: "ticket",
};

const LIST_PATHS: Record<ObjectActionsEntity, string> = {
  note: "/notes",
  project: "/projects",
  ticket: "/tickets",
};

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function ObjectActions({
  entity,
  id,
  canEdit,
  canDelete,
  canArchive = false,
  editHref,
  deleteEndpoint,
  archiveEndpoint,
  onArchived,
}: ObjectActionsProps) {
  const router = useRouter();
  const [modal, setModal] = useState<"delete" | "archive" | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const label = ENTITY_LABELS[entity];
  const listPath = LIST_PATHS[entity];

  const handleEdit = () => {
    if (canEdit && editHref) router.push(editHref);
  };

  const closeModal = () => {
    if (!loading) {
      setModal(null);
      setErrorMessage(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteEndpoint) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(deleteEndpoint, { method: "DELETE", headers });
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setErrorMessage(data?.error ?? "No se pudo completar la acción.");
        setLoading(false);
        return;
      }
      closeModal();
      router.push(listPath);
    } catch {
      setErrorMessage("Error de conexión. Inténtalo de nuevo.");
      setLoading(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!archiveEndpoint) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(archiveEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setErrorMessage(data?.error ?? "No se pudo archivar.");
        setLoading(false);
        return;
      }
      closeModal();
      if (onArchived) {
        onArchived();
      } else {
        router.push(listPath);
      }
    } catch {
      setErrorMessage("Error de conexión. Inténtalo de nuevo.");
      setLoading(false);
    }
  };

  const hasAnyAction = (canEdit && editHref) || (canDelete && deleteEndpoint) || (canArchive && archiveEndpoint);
  if (!hasAnyAction) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && editHref && (
          <button
            type="button"
            onClick={handleEdit}
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 h-8 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
        )}
        {canArchive && archiveEndpoint && (
          <button
            type="button"
            onClick={() => setModal("archive")}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 h-8 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Archive className="h-3.5 w-3.5" />
            Archivar
          </button>
        )}
        {canDelete && deleteEndpoint && (
          <button
            type="button"
            onClick={() => setModal("delete")}
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-white px-3 h-8 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </button>
        )}
      </div>

      {/* Delete confirmation modal */}
      {modal === "delete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeModal}>
          <div
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900">
              Eliminar {label}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              ¿Seguro que quieres eliminar esta {label}? Esta acción no se puede deshacer.
            </p>
            {errorMessage && (
              <p className="mt-3 text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
                {errorMessage}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={loading}
                className="rounded-full border border-slate-200 px-3 h-8 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={loading}
                className="rounded-full bg-rose-600 px-3 h-8 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {loading ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive confirmation modal */}
      {modal === "archive" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeModal}>
          <div
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900">
              Archivar {label}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              ¿Seguro que quieres archivar este {label}? Dejará de aparecer en la lista de activos.
            </p>
            {errorMessage && (
              <p className="mt-3 text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
                {errorMessage}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={loading}
                className="rounded-full border border-slate-200 px-3 h-8 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleArchiveConfirm}
                disabled={loading}
                className="rounded-full bg-indigo-600 px-3 h-8 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading ? "Archivando…" : "Archivar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
