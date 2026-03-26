"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  /** Override redirect after delete/archive (e.g. project list). If not set, uses default list for entity. */
  listPath?: string;
  /** Callback after successful archive (e.g. refresh project data). If not set, redirects to list. */
  onArchived?: () => void;
  /** Use "dark" when rendering inside a dark header/shell (e.g. project workspace header). */
  variant?: "light" | "dark";
  /** Stack action buttons vertically (e.g. inside a dropdown menu). */
  stacked?: boolean;
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
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function ObjectActions({
  entity,
  canEdit,
  canDelete,
  canArchive = false,
  editHref,
  deleteEndpoint,
  archiveEndpoint,
  listPath: listPathOverride,
  onArchived,
  variant = "light",
  stacked = false,
}: ObjectActionsProps) {
  const t = useTranslations("common.actions");
  const router = useRouter();
  const [modal, setModal] = useState<"delete" | "archive" | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDark = variant === "dark";
  const focusRing = " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0";
  const editBtnClass = (isDark
    ? "inline-flex items-center gap-1.5 rounded-lg border border-slate-600/80 bg-slate-800/80 px-2.5 h-8 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:border-slate-500 hover:text-white transition-colors"
    : "inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 h-8 text-sm font-medium text-white hover:bg-indigo-700 transition-colors") + focusRing;
  const archiveBtnClass = (isDark
    ? "inline-flex items-center gap-1.5 rounded-lg border border-slate-600/80 bg-slate-800/80 px-2.5 h-8 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:border-slate-500 hover:text-white transition-colors"
    : "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 h-8 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors") + focusRing;
  const deleteBtnClass = (isDark
    ? "inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 h-8 text-xs font-medium text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/60 transition-colors"
    : "inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-white px-3 h-8 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors") + focusRing;

  const label = ENTITY_LABELS[entity];
  const listPath = listPathOverride ?? LIST_PATHS[entity];

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
        setErrorMessage(data?.error ?? t("actionFailed"));
        setLoading(false);
        return;
      }
      closeModal();
      router.push(listPath);
    } catch {
      setErrorMessage(t("connectionError"));
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
        setErrorMessage(data?.error ?? t("archiveFailed"));
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
      setErrorMessage(t("connectionError"));
      setLoading(false);
    }
  };

  const hasAnyAction = (canEdit && editHref) || (canDelete && deleteEndpoint) || (canArchive && archiveEndpoint);
  if (!hasAnyAction) return null;

  return (
    <>
      <div
        className={
          stacked
            ? "flex w-full flex-col gap-1.5"
            : "flex flex-wrap items-center gap-2"
        }
      >
        {canEdit && editHref && (
          <button
            type="button"
            onClick={handleEdit}
            className={editBtnClass}
          >
            <Pencil className="h-3.5 w-3.5" />
            {t("edit")}
          </button>
        )}
        {canArchive && archiveEndpoint && (
          <button
            type="button"
            onClick={() => setModal("archive")}
            className={archiveBtnClass}
          >
            <Archive className="h-3.5 w-3.5" />
            {t("archive")}
          </button>
        )}
        {canDelete && deleteEndpoint && (
          <button
            type="button"
            onClick={() => setModal("delete")}
            className={deleteBtnClass}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("delete")}
          </button>
        )}
      </div>

      {/* Delete confirmation modal */}
      {modal === "delete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeModal} role="dialog" aria-modal="true" aria-labelledby="object-delete-title">
          <div
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Escape") closeModal(); }}
          >
            <h3 id="object-delete-title" className="text-lg font-semibold text-slate-900">
              {t("deleteTitle", { label })}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {t("deleteBody", { label })}
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
                className="rounded-full border border-slate-200 px-3 h-8 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={loading}
                className="rounded-full bg-rose-600 px-3 h-8 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0"
              >
                {loading ? t("deleting") : t("delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive confirmation modal */}
      {modal === "archive" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeModal} role="dialog" aria-modal="true" aria-labelledby="object-archive-title">
          <div
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Escape") closeModal(); }}
          >
            <h3 id="object-archive-title" className="text-lg font-semibold text-slate-900">
              {t("archiveTitle", { label })}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {t("archiveBody", { label })}
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
                className="rounded-full border border-slate-200 px-3 h-8 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleArchiveConfirm}
                disabled={loading}
                className="rounded-full bg-indigo-600 px-3 h-8 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0"
              >
                {loading ? t("archiving") : t("archive")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
