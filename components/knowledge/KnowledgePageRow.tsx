"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { FileText, MoreVertical, Pencil, Trash2, FolderInput, FilePlus } from "lucide-react";
import type { KnowledgePage } from "@/lib/types/knowledge";

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
}: KnowledgePageRowProps) {
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
    "flex items-center gap-3 w-full rounded-xl px-3.5 py-3 text-left text-sm transition-colors";
  const darkRow =
    "text-slate-200 hover:bg-slate-800/70 hover:text-slate-100 group";
  const lightRow =
    "text-slate-700 hover:bg-slate-50";
  const rowClass = dark ? `${baseRow} ${darkRow}` : `${baseRow} ${lightRow}`;

  const updatedStr = showUpdated && page.updated_at
    ? new Date(page.updated_at).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
      })
    : null;

  return (
    <div className="group/page flex items-center gap-2 rounded-xl hover:bg-slate-800/40">
      <button
        type="button"
        onClick={() => onOpen(page)}
        className={`flex-1 min-w-0 ${rowClass}`}
      >
        <FileText
          className={`h-4 w-4 shrink-0 ${dark ? "text-slate-500 group-hover/page:text-slate-400" : "text-slate-400"}`}
        />
        <span className="flex-1 min-w-0 font-medium truncate">{page.title}</span>
        {updatedStr && (
          <span className="shrink-0 text-xs text-slate-500">{updatedStr}</span>
        )}
      </button>
      <div className="relative shrink-0 opacity-0 group-hover/page:opacity-100" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="rounded-lg p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/80 transition-colors"
          aria-label="Page actions"
          aria-expanded={menuOpen}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-slate-600/80 bg-slate-900 shadow-xl py-1"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onOpen(page);
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <FileText className="h-4 w-4 text-slate-500" />
              Open
            </button>
            <Link
              href={`${fullEditorHref}/${page.id}${fullEditorQuery ?? ""}`}
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <Pencil className="h-4 w-4 text-slate-500" />
              Full editor
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onEdit(page);
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <Pencil className="h-4 w-4 text-slate-500" />
              Edit details
            </button>
            <div className="border-t border-slate-700/60 my-1" />
            <button
              type="button"
              role="menuitem"
              disabled
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-500 cursor-not-allowed"
              title="Coming soon"
            >
              <FolderInput className="h-4 w-4" />
              Move
            </button>
            <button
              type="button"
              role="menuitem"
              disabled
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-500 cursor-not-allowed"
              title="Coming soon"
            >
              <FilePlus className="h-4 w-4" />
              Create subpage
            </button>
            <div className="border-t border-slate-700/60 my-1" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onDelete(page);
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-300 hover:bg-slate-800 hover:text-red-200 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
