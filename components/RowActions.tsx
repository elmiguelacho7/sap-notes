"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export type RowActionsEntity = "note" | "ticket";

export type RowActionsProps = {
  entity: RowActionsEntity;
  id: string;
  viewHref: string;
  editHref?: string;
  canEdit: boolean;
  canDelete: boolean;
  deleteEndpoint?: string;
  /** Called after successful delete so the list can refetch (e.g. router.refresh() or loadNotes()). */
  onDeleted?: () => void;
};

const ENTITY_LABELS: Record<RowActionsEntity, string> = {
  note: "nota",
  ticket: "ticket",
};

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function RowActions({
  entity,
  id,
  viewHref,
  editHref,
  canEdit,
  canDelete,
  deleteEndpoint,
  onDeleted,
}: RowActionsProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const label = ENTITY_LABELS[entity];

  const handleView = () => {
    router.push(viewHref);
  };

  const handleEdit = () => {
    if (canEdit && editHref) router.push(editHref);
  };

  const closeModal = () => {
    if (!loading) {
      setModalOpen(false);
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
      if (onDeleted) {
        onDeleted();
      } else {
        router.refresh();
      }
    } catch {
      setErrorMessage("Error de conexión. Inténtalo de nuevo.");
      setLoading(false);
    }
  };

  const showEdit = canEdit && editHref;
  const showDelete = canDelete && deleteEndpoint;

  return (
    <>
      <div className="flex items-center justify-end gap-1 shrink-0">
        <button
          type="button"
          onClick={handleView}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          title="Ver"
          aria-label="Ver"
        >
          <Eye className="h-4 w-4" />
        </button>
        {showEdit && (
          <button
            type="button"
            onClick={handleEdit}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            title="Editar"
            aria-label="Editar"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {showDelete && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors"
            title="Eliminar"
            aria-label="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={closeModal}
        >
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
    </>
  );
}
