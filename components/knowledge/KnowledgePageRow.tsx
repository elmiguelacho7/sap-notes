"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { FileText, MoreVertical, Pencil, Trash2, FolderInput, FilePlus } from "lucide-react";
import type { KnowledgePage, KnowledgePageType } from "@/lib/types/knowledge";

/** Subtle list tag labels (neutral; does not use space accent). */
const PAGE_TYPE_TAG_LABEL: Partial<Record<KnowledgePageType, string>> = {
  how_to: "procedure",
  cutover_runbook: "procedure",
  troubleshooting: "note",
  meeting_note: "note",
  decision: "note",
  config: "config",
  template: "guide",
  reference: "guide",
};

export type KnowledgePageRowProps = {
  page: KnowledgePage;
  /** Dark variant for project context; default false for global (light) – we'll use dark everywhere per spec. */
  dark?: boolean;
  onOpen: (page: KnowledgePage) => void;
  onEdit: (page: KnowledgePage) => void;
  onDelete: (page: KnowledgePage) => void;
  fullEditorHref: string;
  /** Optional query for full editor link (e.g. ?projectId=xxx). */
  fullEditorQuery?: string;
  showUpdated?: boolean;
  /**
   * Optional leading glyph (e.g. emoji). When absent, default document icon is shown.
   * Future: can be wired from DB `icon` field when added.
   */
  leadingIconOverride?: string | null;
};

export function KnowledgePageRow({
  page,
  dark = true,
  onOpen,
  onEdit,
  onDelete,
  fullEditorHref,
  fullEditorQuery,
  showUpdated = true,
  leadingIconOverride,
}: KnowledgePageRowProps) {
  const t = useTranslations("knowledge.row");
  const locale = useLocale();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [menuOpen]);

  const baseRow =
    "flex items-center gap-2.5 w-full rounded-[0.65rem] px-3 py-2.5 text-left text-sm transition-colors";
  const darkRow = "text-slate-200 group-hover/page:text-slate-100";
  const lightRow = "text-[rgb(var(--rb-text-secondary))] group-hover/page:text-[rgb(var(--rb-text-primary))]";
  const rowClass = dark ? `${baseRow} ${darkRow}` : `${baseRow} ${lightRow}`;

  const typeTag = PAGE_TYPE_TAG_LABEL[page.page_type];

  const updatedStr = showUpdated && page.updated_at
    ? new Date(page.updated_at).toLocaleDateString(localeTag, {
        day: "numeric",
        month: "short",
      })
    : null;

  const rowShell =
    "group/page flex items-center gap-1 rounded-xl border border-transparent transition-[background-color,box-shadow,border-color,transform] duration-150 " +
    (dark
      ? "hover:bg-slate-800/45 hover:border-slate-700/30 hover:shadow-[inset_3px_0_0_0_rgba(71,85,105,0.22)]"
      : "hover:bg-[rgb(var(--rb-surface-3))]/25 hover:border-[rgb(var(--rb-surface-border))]/70 hover:shadow-[inset_3px_0_0_0_rgba(46,204,113,0.10)] hover:-translate-y-[1px]");

  return (
    <div className={rowShell}>
      <button
        type="button"
        onClick={() => onOpen(page)}
        className={`flex-1 min-w-0 ${rowClass}`}
      >
        {leadingIconOverride ? (
          <span
            className={
              "shrink-0 text-sm leading-none select-none " +
              (dark
                ? "text-slate-400 group-hover/page:text-slate-300"
                : "text-slate-500 group-hover/page:text-slate-600")
            }
            aria-hidden
          >
            {leadingIconOverride}
          </span>
        ) : (
          <FileText
            className={
              "h-3.5 w-3.5 shrink-0 " +
              (dark
                ? "text-slate-400 group-hover/page:text-slate-300"
                : "text-[rgb(var(--rb-text-muted))] group-hover/page:text-[rgb(var(--rb-text-secondary))]")
            }
            aria-hidden
          />
        )}
        <span className="flex-1 min-w-0 font-semibold truncate text-sm">{page.title}</span>
        {typeTag && (
          <span
            className={
              "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium tracking-wide text-slate-400/90 " +
              (dark
                ? "bg-slate-700/40"
                : "bg-[rgb(var(--rb-surface-3))]/45 text-[rgb(var(--rb-text-muted))]")
            }
            title={page.page_type.replace(/_/g, " ")}
          >
            {typeTag}
          </span>
        )}
        {updatedStr && (
          <span
            className={
              "shrink-0 text-xs tabular-nums " +
              (dark ? "text-slate-500" : "text-[rgb(var(--rb-text-muted))]")
            }
          >
            {updatedStr}
          </span>
        )}
      </button>
      <div
        className={
          "relative shrink-0 transition-opacity duration-150 opacity-40 group-hover/page:opacity-100 max-md:opacity-[0.65] max-md:group-hover/page:opacity-100 " +
          (menuOpen ? "opacity-100" : "")
        }
        ref={menuRef}
      >
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className={
            "rounded-lg p-1.5 transition-colors " +
            (dark
              ? "text-slate-500 hover:text-slate-200 hover:bg-slate-800/70"
              : "text-[rgb(var(--rb-text-muted))] hover:text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-3))]/35")
          }
          aria-label={t("pageActions")}
          aria-expanded={menuOpen}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div
            className={
              "absolute right-0 top-full z-50 mt-1 min-w-[192px] rounded-xl shadow-xl py-1 " +
              (dark
                ? "border border-slate-600/70 bg-slate-900"
                : "border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]")
            }
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onOpen(page);
              }}
              className={
                "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors " +
                (dark
                  ? "text-slate-200 hover:bg-slate-800"
                  : "text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-3))]/35")
              }
            >
              <FileText className={dark ? "h-4 w-4 text-slate-500" : "h-4 w-4 text-[rgb(var(--rb-text-muted))]"} />
              {t("open")}
            </button>
            <Link
              href={`${fullEditorHref}/${page.id}${fullEditorQuery ?? ""}`}
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className={
                "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors " +
                (dark
                  ? "text-slate-200 hover:bg-slate-800"
                  : "text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-3))]/35")
              }
            >
              <Pencil className={dark ? "h-4 w-4 text-slate-500" : "h-4 w-4 text-[rgb(var(--rb-text-muted))]"} />
              {t("fullEditor")}
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onEdit(page);
              }}
              className={
                "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors " +
                (dark
                  ? "text-slate-200 hover:bg-slate-800"
                  : "text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-3))]/35")
              }
            >
              <Pencil className={dark ? "h-4 w-4 text-slate-500" : "h-4 w-4 text-[rgb(var(--rb-text-muted))]"} />
              {t("editDetails")}
            </button>
            <div className={dark ? "border-t border-slate-700/60 my-1" : "border-t border-[rgb(var(--rb-surface-border))]/60 my-1"} />
            <button
              type="button"
              role="menuitem"
              disabled
              className={
                "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm cursor-not-allowed " +
                (dark ? "text-slate-500" : "text-[rgb(var(--rb-text-muted))]")
              }
              title={t("comingSoon")}
            >
              <FolderInput className="h-4 w-4" />
              {t("move")}
            </button>
            <button
              type="button"
              role="menuitem"
              disabled
              className={
                "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm cursor-not-allowed " +
                (dark ? "text-slate-500" : "text-[rgb(var(--rb-text-muted))]")
              }
              title={t("comingSoon")}
            >
              <FilePlus className="h-4 w-4" />
              {t("createSubpage")}
            </button>
            <div className={dark ? "border-t border-slate-700/60 my-1" : "border-t border-[rgb(var(--rb-surface-border))]/60 my-1"} />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onDelete(page);
              }}
              className={
                "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors " +
                (dark
                  ? "text-red-300 hover:bg-slate-800 hover:text-red-200"
                  : "text-rose-700 hover:bg-rose-500/10")
              }
            >
              <Trash2 className="h-4 w-4" />
              {t("delete")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
