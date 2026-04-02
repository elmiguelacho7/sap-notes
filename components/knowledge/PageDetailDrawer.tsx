"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { X, ExternalLink } from "lucide-react";
import type { KnowledgePage } from "@/lib/types/knowledge";

export type PageDetailDrawerContext = "global" | "project";

export type PageDetailPayload = {
  title: string;
  summary: string | null;
  space_id: string;
};

export type PageDetailDrawerProps = {
  page: KnowledgePage | null;
  /** Space for display when page.space_id is set (e.g. current space name). */
  spaceName?: string | null;
  open: boolean;
  onClose: () => void;
  onSave: (pageId: string, payload: PageDetailPayload) => void | Promise<void>;
  context: PageDetailDrawerContext;
  spaceOptions: { value: string; label: string }[];
  /** Project name (read-only in project context). */
  projectName?: string | null;
  saving?: boolean;
  /** Base path for "Open full editor" link (e.g. /knowledge). */
  fullEditorPath?: string;
  /** Optional query string for full editor link (e.g. ?projectId=xxx to preserve context). */
  fullEditorQuery?: string;
};

const inputClass =
  "w-full h-10 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/25";
const textareaClass =
  "w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2.5 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 focus:border-[rgb(var(--rb-brand-primary))]/25";
const labelClass = "block text-xs font-medium text-[rgb(var(--rb-text-muted))] mb-1.5";

function formatDate(iso: string | undefined, localeTag: string, emDash: string): string {
  if (!iso) return emDash;
  try {
    return new Date(iso).toLocaleDateString(localeTag, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return emDash;
  }
}

export function PageDetailDrawer({
  page,
  spaceName = null,
  open,
  onClose,
  onSave,
  context,
  spaceOptions,
  projectName = null,
  saving = false,
  fullEditorPath = "/knowledge",
  fullEditorQuery,
}: PageDetailDrawerProps) {
  const t = useTranslations("knowledge.drawer");
  const locale = useLocale();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [spaceId, setSpaceId] = useState("");

  useEffect(() => {
    if (page && open) {
      /* Sincronizar formulario al abrir; patrón controlado por props del drawer */
      /* eslint-disable react-hooks/set-state-in-effect */
      setTitle(page.title ?? "");
      setSummary(page.summary ?? "");
      setSpaceId(page.space_id ?? "");
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [page, open]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!page) return;
      onSave(page.id, {
        title: title.trim(),
        summary: summary.trim() || null,
        space_id: spaceId.trim() || page.space_id,
      });
    },
    [page, title, summary, spaceId, onSave]
  );

  if (!open) return null;

  const contextLabel = context === "global" ? t("context.global") : t("context.project");

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/45 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed top-0 right-0 bottom-0 z-50 w-full md:max-w-xl bg-[rgb(var(--rb-surface))] border-l border-[rgb(var(--rb-surface-border))]/80 shadow-xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="page-detail-title"
      >
        <div className="flex items-center justify-between shrink-0 border-b border-[rgb(var(--rb-surface-border))]/70 px-4 py-3 bg-[rgb(var(--rb-surface))]">
          <h2 id="page-detail-title" className="text-lg font-semibold text-[rgb(var(--rb-text-primary))]">
            {t("title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[rgb(var(--rb-text-muted))] hover:text-[rgb(var(--rb-text-primary))] hover:bg-[rgb(var(--rb-surface-2))]/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30"
            aria-label={t("close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Breadcrumb / context */}
        {page && (
          <div className="shrink-0 px-4 py-2 border-b border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-2))]/35">
            <p className="text-xs text-[rgb(var(--rb-text-muted))]">
              {contextLabel}
              {spaceName ? ` · ${spaceName}` : ""}
              {page.title ? ` · ${page.title}` : ""}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div>
            <label className={labelClass}>{t("fields.title")}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder={t("fields.titlePlaceholder")}
              required
            />
          </div>

          <div>
            <label className={labelClass}>{t("fields.summary")}</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              className={textareaClass}
              placeholder={t("fields.summaryPlaceholder")}
            />
          </div>

          <div>
            <label className={labelClass}>{t("fields.space")}</label>
            <select
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
              className={inputClass}
            >
              {spaceOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {context === "project" && projectName != null && (
            <div>
              <label className={labelClass}>{t("fields.project")}</label>
              <p className="text-sm text-[rgb(var(--rb-text-secondary))]">{projectName}</p>
            </div>
          )}

          {page && (
            <div className="space-y-2 pt-3 border-t border-[rgb(var(--rb-surface-border))]/60">
              <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-2))]/35 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--rb-text-muted))]">
                  {t("timestamps.updated")}
                </p>
                <p className="mt-1 text-sm text-[rgb(var(--rb-text-secondary))]">
                  {formatDate(page.updated_at, localeTag, t("emDash"))}
                </p>
              </div>
              <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-2))]/35 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--rb-text-muted))]">
                  {t("timestamps.created")}
                </p>
                <p className="mt-1 text-sm text-[rgb(var(--rb-text-secondary))]">
                  {formatDate(page.created_at, localeTag, t("emDash"))}
                </p>
              </div>
            </div>
          )}

          <div className="pt-4 flex flex-col gap-3">
            {page && (
              <Link
                href={`${fullEditorPath}/${page.id}${fullEditorQuery ?? ""}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-4 py-2.5 text-sm font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-2))]/60 hover:text-[rgb(var(--rb-text-primary))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30"
              >
                <ExternalLink className="h-4 w-4" />
                {t("openFullEditor")}
              </Link>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-10 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-4 text-sm font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-2))]/60 hover:text-[rgb(var(--rb-text-primary))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30 disabled:opacity-50"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={saving || !title.trim()}
                className="h-10 rounded-xl rb-btn-primary px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {saving ? t("saving") : t("save")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
