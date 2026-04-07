"use client";

import type { MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Copy, Eye, MoreHorizontal, Pencil, Play, Trash2 } from "lucide-react";
import type { TestScriptListItem, TestScriptWithSteps } from "@/lib/types/testing";
import { buildDuplicateTestScriptBody } from "@/lib/testing/buildDuplicateTestScriptBody";
import { Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/Modal";

export function TestScriptCardActions({
  projectId,
  script,
  canEdit,
  detailHref,
  onEdit,
  onDeleted,
  onToast,
}: {
  projectId: string;
  script: TestScriptListItem;
  /** Editors can duplicate, delete, run, and edit; viewers only see Open. */
  canEdit: boolean;
  detailHref: string;
  onEdit: () => void;
  onDeleted: (scriptId: string) => void;
  onToast: (message: string, variant: "success" | "error") => void;
}) {
  const router = useRouter();
  const t = useTranslations("testing.listActions");
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [dupLoading, setDupLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasExecutionHistory = Boolean(script.last_executed_at);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  const stop = (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const openDetail = useCallback(() => {
    setMenuOpen(false);
    router.push(detailHref);
  }, [router, detailHref]);

  const handleEdit = useCallback(() => {
    setMenuOpen(false);
    onEdit();
  }, [onEdit]);

  const handleDuplicate = useCallback(async () => {
    if (!canEdit) return;
    setMenuOpen(false);
    setDupLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/testing/scripts/${script.id}`, {
        credentials: "include",
      });
      const full = (await res.json().catch(() => null)) as TestScriptWithSteps | null;
      if (!res.ok || !full || typeof full !== "object" || !("title" in full)) {
        onToast(t("duplicateError"), "error");
        return;
      }
      const newTitle = `${full.title.trim()} (${t("copySuffix")})`;
      const body = buildDuplicateTestScriptBody(full, newTitle, t("ungroupedBucket"));
      const post = await fetch(`/api/projects/${projectId}/testing/scripts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const created = (await post.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!post.ok || !created.id) {
        onToast(created.error ?? t("duplicateError"), "error");
        return;
      }
      onToast(t("duplicated"), "success");
      router.push(`/projects/${projectId}/testing/${created.id}`);
    } catch {
      onToast(t("duplicateError"), "error");
    } finally {
      setDupLoading(false);
    }
  }, [canEdit, projectId, script.id, router, onToast, t]);

  const closeDelete = () => {
    if (!deleteLoading) {
      setDeleteOpen(false);
    }
  };

  const confirmDelete = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/testing/scripts/${script.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onToast(data.error ?? t("deleteError"), "error");
        setDeleteLoading(false);
        return;
      }
      setDeleteOpen(false);
      onDeleted(script.id);
      onToast(t("deleted"), "success");
    } catch {
      onToast(t("deleteError"), "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="relative shrink-0" ref={menuRef} onClick={stop}>
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          setMenuOpen((o) => !o);
        }}
        disabled={dupLoading}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30 disabled:opacity-50"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        title={t("moreTitle")}
        aria-label={t("moreTitle")}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {menuOpen && (
        <div
          className="absolute right-0 top-full z-30 mt-1 min-w-[168px] rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg ring-1 ring-slate-100"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            onClick={openDetail}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/20"
          >
            <Eye className="h-4 w-4 text-slate-400" />
            {t("open")}
          </button>
          {canEdit && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                router.push(`${detailHref}?run=1`);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/20"
            >
              <Play className="h-4 w-4 text-slate-400" />
              {t("runTest")}
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              role="menuitem"
              onClick={handleEdit}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/20"
            >
              <Pencil className="h-4 w-4 text-slate-400" />
              {t("edit")}
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleDuplicate()}
              disabled={dupLoading}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/20 disabled:opacity-50"
            >
              <Copy className="h-4 w-4 text-slate-400" />
              {dupLoading ? t("duplicating") : t("duplicate")}
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setDeleteOpen(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200/60"
            >
              <Trash2 className="h-4 w-4" />
              {t("delete")}
            </button>
          )}
        </div>
      )}

      {deleteOpen && (
        <Modal onClose={closeDelete}>
          <ModalHeader>
            <ModalTitle>{t("deleteTitle")}</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <p className="text-sm leading-relaxed text-[rgb(var(--rb-text-muted))]">
              {hasExecutionHistory ? t("deleteBodyWithExecutions") : t("deleteBody")}
            </p>
          </ModalBody>
          <ModalFooter className="justify-end border-t border-[rgb(var(--rb-surface-border))]/60 pt-4">
            <button
              type="button"
              onClick={closeDelete}
              disabled={deleteLoading}
              className="rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/25"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={() => void confirmDelete()}
              disabled={deleteLoading}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/50"
            >
              {deleteLoading ? t("deleting") : t("deleteConfirm")}
            </button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
