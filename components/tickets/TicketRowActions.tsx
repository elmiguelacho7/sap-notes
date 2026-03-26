"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function TicketRowActions({
  viewHref,
  editHref,
  canEdit,
  canDelete,
  deleteEndpoint,
  onDeleted,
  tone = "dark",
}: {
  viewHref: string;
  editHref?: string;
  canEdit: boolean;
  canDelete: boolean;
  deleteEndpoint?: string;
  onDeleted?: () => void;
  /** Match surrounding table surface (project workspace uses `light`). */
  tone?: "dark" | "light";
}) {
  const router = useRouter();
  const t = useTranslations("tickets.rowActions");
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [open]);

  const handleView = useCallback(() => {
    setOpen(false);
    router.push(viewHref);
  }, [router, viewHref]);

  const handleEdit = useCallback(() => {
    setOpen(false);
    if (canEdit && editHref) router.push(editHref);
    else router.push(viewHref);
  }, [router, canEdit, editHref, viewHref]);

  const handleDeleteClick = () => {
    setOpen(false);
    setModalOpen(true);
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
        setErrorMessage(data?.error ?? t("actionFailed"));
        setLoading(false);
        return;
      }
      closeModal();
      onDeleted?.();
    } catch {
      setErrorMessage(t("connectionError"));
      setLoading(false);
    }
  };

  const showEdit = canEdit;
  const showDelete = canDelete && deleteEndpoint;
  const isLight = tone === "light";
  const triggerBtn = isLight
    ? "inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200/90 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
    : "inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-700/50 bg-slate-900/50 text-slate-500 hover:bg-slate-800/70 hover:text-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-500/40 focus-visible:ring-offset-0";
  const menuPanel = isLight
    ? "absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg ring-1 ring-slate-100"
    : "absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-xl border border-slate-600/80 bg-slate-800 shadow-xl py-1";
  const menuItem = isLight
    ? "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/20 rounded-lg"
    : "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0 rounded-lg";
  const menuIcon = isLight ? "h-4 w-4 text-slate-400" : "h-4 w-4 text-slate-500";
  const deleteItem = isLight
    ? "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 rounded-lg"
    : "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-300 hover:bg-slate-700/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0 rounded-lg";
  const modalBackdrop = isLight ? "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40" : "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60";
  const modalBox = isLight
    ? "rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl max-w-md w-full ring-1 ring-slate-100"
    : "rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-xl max-w-md w-full";
  const modalTitle = isLight ? "text-lg font-semibold text-slate-900" : "text-lg font-semibold text-slate-100";
  const modalBody = isLight ? "mt-2 text-sm text-slate-600" : "mt-2 text-sm text-slate-400";
  const cancelBtn = isLight
    ? "rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/25"
    : "rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-0";

  return (
    <div className="relative flex items-center justify-end shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={triggerBtn}
        title={t("moreTitle")}
        aria-label={t("moreAria")}
      >
        <MoreHorizontal className="h-3.5 w-3.5 opacity-80" />
      </button>
      {open && (
        <div className={menuPanel}>
          <button type="button" onClick={handleView} className={menuItem}>
            <Eye className={menuIcon} />
            {t("view")}
          </button>
          {showEdit && (
            <button type="button" onClick={handleEdit} className={menuItem}>
              <Pencil className={menuIcon} />
              {t("edit")}
            </button>
          )}
          {showDelete && (
            <button type="button" onClick={handleDeleteClick} className={deleteItem}>
              <Trash2 className="h-4 w-4" />
              {t("delete")}
            </button>
          )}
        </div>
      )}
      {modalOpen && (
        <div
          className={modalBackdrop}
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-delete-title"
        >
          <div
            className={modalBox}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeModal();
            }}
          >
            <h3 id="ticket-delete-title" className={modalTitle}>
              {t("deleteTitle")}
            </h3>
            <p className={modalBody}>{t("deleteBody")}</p>
            {errorMessage && (
              <p
                className={
                  isLight
                    ? "mt-3 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2 border border-red-100"
                    : "mt-3 text-sm text-red-400 bg-red-950/30 rounded-lg px-3 py-2"
                }
              >
                {errorMessage}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeModal} disabled={loading} className={cancelBtn}>
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={loading}
                className={`rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 ${
                  isLight ? "focus-visible:ring-red-200" : "focus-visible:ring-red-400/40"
                } focus-visible:ring-offset-0`}
              >
                {loading ? t("deleting") : t("deleteConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
