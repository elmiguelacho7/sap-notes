"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { FileText, Link2, Search, Eye, MoreVertical, Pencil, BookMarked, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";
import { ModuleKpiCard, ModuleKpiRow, ModuleContentCard } from "@/components/layout/module";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";
import {
  PROJECT_WORKSPACE_PAGE,
  PROJECT_WORKSPACE_HERO,
  PROJECT_WORKSPACE_TOOLBAR,
  PROJECT_WORKSPACE_SEARCH_INPUT,
  PROJECT_WORKSPACE_FIELD,
  PROJECT_WORKSPACE_EMPTY,
} from "@/lib/projectWorkspaceUi";

type ProjectNoteSummary = {
  id: string;
  title: string | null;
  body?: string | null;
  module: string | null;
  scope_item: string | null;
  error_code: string | null;
  web_link_1: string | null;
  web_link_2: string | null;
  extra_info: string | null;
  created_at: string;
  is_knowledge_base?: boolean;
};

const SORT_OPTIONS = [{ value: "recent" }, { value: "oldest" }, { value: "title" }] as const;
type SortValue = (typeof SORT_OPTIONS)[number]["value"];

/** Safe row actions: Ver (primary) + overflow menu (Editar, KB, Eliminar). */
function NoteRowActions({
  note,
  viewHref,
  editHref,
  canEdit,
  canDelete,
  deleteEndpoint,
  onDeleted,
  onToggleKnowledge,
  togglingId,
}: {
  note: ProjectNoteSummary;
  viewHref: string;
  editHref?: string;
  canEdit: boolean;
  canDelete: boolean;
  deleteEndpoint?: string;
  onDeleted?: () => void;
  onToggleKnowledge: (e: React.MouseEvent) => void;
  togglingId: string | null;
}) {
  const t = useTranslations("projects.notes");
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("click", handle);
    return () => document.removeEventListener("click", handle);
  }, [menuOpen]);

  const handleDeleteConfirm = async () => {
    if (!deleteEndpoint) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(deleteEndpoint, { method: "DELETE", headers });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setDeleteError(data?.error ?? t("errors.actionFailed"));
        return;
      }
      setDeleteOpen(false);
      onDeleted?.();
    } catch {
      setDeleteError(t("errors.connection"));
    } finally {
      setDeleteLoading(false);
    }
  };

  const showEdit = canEdit && editHref;
  const showDelete = canDelete && deleteEndpoint;

  return (
    <div className="flex items-center gap-2 shrink-0" ref={menuRef}>
      <Link
        href={viewHref}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors"
      >
        <Eye className="h-3.5 w-3.5" />
        {t("actions.view")}
      </Link>
      <div className="relative">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
          aria-label={t("actions.more")}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg ring-1 ring-slate-100">
            {showEdit && (
              <button
                type="button"
                onClick={() => { setMenuOpen(false); router.push(editHref!); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="h-3.5 w-3.5" /> {t("actions.edit")}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { setMenuOpen(false); onToggleKnowledge(e); }}
              disabled={!!togglingId}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <BookMarked className="h-3.5 w-3.5" />
              {togglingId === note.id ? "…" : note.is_knowledge_base ? t("actions.removeKb") : t("actions.addKb")}
            </button>
            {showDelete && (
              <button
                type="button"
                onClick={() => { setMenuOpen(false); setDeleteOpen(true); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> {t("actions.delete")}
              </button>
            )}
          </div>
        )}
      </div>
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40" onClick={() => !deleteLoading && setDeleteOpen(false)}>
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl ring-1 ring-slate-100 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900">{t("delete.title")}</h3>
            <p className="mt-2 text-sm text-slate-600">{t("delete.body")}</p>
            {deleteError && <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{deleteError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => !deleteLoading && setDeleteOpen(false)} disabled={deleteLoading} className="rounded-xl border border-slate-200/90 bg-white px-3 h-9 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">{t("delete.cancel")}</button>
              <button type="button" onClick={handleDeleteConfirm} disabled={deleteLoading} className="rounded-xl bg-red-600 px-3 h-9 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">{deleteLoading ? t("delete.deleting") : t("delete.confirm")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectNotesPage() {
  const t = useTranslations("projects.notes");
  const locale = useLocale();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params?.id ?? "";

  useEffect(() => {
    if (searchParams?.get("new") === "1" && projectId) {
      router.replace(`/notes/new?projectId=${projectId}&from=quick`);
    }
  }, [searchParams, projectId, router]);

  const [notes, setNotes] = useState<ProjectNoteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [canEditNotes, setCanEditNotes] = useState(false);
  const [canDeleteNotes, setCanDeleteNotes] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortValue>("recent");

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    async function loadPermissions() {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/projects/${projectId}/permissions`, { headers });
      if (cancelled) return;
      const data = await res.json().catch(() => ({}));
      const perms = data as { canEditProjectNotes?: boolean; canDeleteProjectNotes?: boolean };
      setCanEditNotes(perms.canEditProjectNotes ?? false);
      setCanDeleteNotes(perms.canDeleteProjectNotes ?? false);
    }
    loadPermissions();
    return () => { cancelled = true; };
  }, [projectId, t]);

  const loadNotes = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/notes?limit=50`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg((data as { error?: string }).error ?? t("errors.load"));
        setNotes([]);
        return;
      }
      const list = (data as { notes?: ProjectNoteSummary[] }).notes ?? [];
      setNotes(list);
    } catch {
      setErrorMsg(t("errors.connection"));
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const summary = useMemo(() => {
    const total = notes.length;
    const withErrorCode = notes.filter((n) => n.error_code && n.error_code.trim() !== "").length;
    const withLinks = notes.filter(
      (n) =>
        (n.web_link_1 && n.web_link_1.trim() !== "") ||
        (n.web_link_2 && n.web_link_2.trim() !== "")
    ).length;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentlyAdded = notes.filter((n) => new Date(n.created_at) >= sevenDaysAgo).length;
    return { total, withErrorCode, withLinks, recentlyAdded };
  }, [notes]);

  const uniqueModules = useMemo(
    () => Array.from(new Set(notes.map((n) => n.module).filter(Boolean))) as string[],
    [notes]
  );

  const filteredAndSortedNotes = useMemo(() => {
    let list = notes;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((n) => {
        const title = (n.title ?? "").toLowerCase();
        const body = (n.body ?? "").toLowerCase();
        const extra = (n.extra_info ?? "").toLowerCase();
        const moduleName = (n.module ?? "").toLowerCase();
        const scope = (n.scope_item ?? "").toLowerCase();
        const err = (n.error_code ?? "").toLowerCase();
        return (
          title.includes(q) ||
          body.includes(q) ||
          extra.includes(q) ||
          moduleName.includes(q) ||
          scope.includes(q) ||
          err.includes(q)
        );
      });
    }
    if (moduleFilter) {
      list = list.filter((n) => n.module === moduleFilter);
    }
    const sorted = [...list].sort((a, b) => {
      if (sortBy === "recent") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      const ta = (a.title ?? "").toLowerCase();
      const tb = (b.title ?? "").toLowerCase();
      return ta.localeCompare(tb);
    });
    return sorted;
  }, [notes, searchQuery, moduleFilter, sortBy]);

  const toggleKnowledge = async (note: ProjectNoteSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    if (togglingId) return;
    const next = !note.is_knowledge_base;
    setTogglingId(note.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ is_knowledge_base: next }),
      });
      if (!res.ok) return;
      setNotes((prev) =>
        prev.map((n) => (n.id === note.id ? { ...n, is_knowledge_base: next } : n))
      );
    } finally {
      setTogglingId(null);
    }
  };

  if (!projectId) {
    return (
      <div className={PROJECT_WORKSPACE_PAGE}>
        <p className="text-sm text-slate-500">{t("invalidProjectId")}</p>
      </div>
    );
  }

  return (
    <div className={PROJECT_WORKSPACE_PAGE}>
      <div className={PROJECT_WORKSPACE_HERO}>
        <ProjectPageHeader
          variant="page"
          eyebrow={t("eyebrow")}
          title={t("title")}
          subtitle={t("subtitle")}
          primaryActionLabel={t("newNote")}
          primaryActionHref={`/notes/new?projectId=${projectId}`}
        />
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <ModuleContentCard tone="light">
          <div className="px-6 py-6">
            <TableSkeleton rows={6} colCount={5} />
          </div>
        </ModuleContentCard>
      ) : (
        <>
          <ModuleKpiRow>
            <ModuleKpiCard tone="light" label={t("summary.total")} value={summary.total} />
            <ModuleKpiCard tone="light" label={t("summary.withErrorCode")} value={summary.withErrorCode} />
            <ModuleKpiCard tone="light" label={t("summary.withLinks")} value={summary.withLinks} />
            <ModuleKpiCard tone="light" label={t("summary.recent7d")} value={summary.recentlyAdded} />
          </ModuleKpiRow>

          <div className={PROJECT_WORKSPACE_TOOLBAR}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className={PROJECT_WORKSPACE_SEARCH_INPUT}
                />
              </div>
              {uniqueModules.length > 0 && (
                <select
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value)}
                  className={PROJECT_WORKSPACE_FIELD}
                >
                  <option value="">{t("allModules")}</option>
                  {uniqueModules.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortValue)}
                className={PROJECT_WORKSPACE_FIELD}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(`sort.${opt.value}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <ModuleContentCard tone="light">
            {notes.length === 0 ? (
              <div className={`${PROJECT_WORKSPACE_EMPTY} py-16`}>
                <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-400 shadow-sm ring-1 ring-slate-100">
                  <FileText className="h-7 w-7" />
                </div>
                <p className="mt-4 text-base font-semibold text-slate-900">{t("empty.title")}</p>
                <p className="mt-1.5 max-w-md text-sm text-slate-600 leading-relaxed">
                  {t("empty.description")}
                </p>
                <Link
                  href={`/notes/new?projectId=${projectId}`}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl rb-btn-primary px-4 py-2.5 text-sm font-medium transition-colors"
                >
                  {t("empty.createFirst")}
                </Link>
              </div>
            ) : filteredAndSortedNotes.length === 0 ? (
              <div className={`${PROJECT_WORKSPACE_EMPTY} py-12`}>
                <p className="text-sm font-semibold text-slate-800">{t("filteredEmpty.title")}</p>
                <p className="mt-1 text-xs text-slate-600">{t("filteredEmpty.description")}</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredAndSortedNotes.map((note) => {
                  const excerpt =
                    (note.body && note.body.trim() !== ""
                      ? note.body
                      : note.extra_info && note.extra_info.trim() !== ""
                        ? note.extra_info
                        : null) ?? "";
                  const hasLinks =
                    (note.web_link_1 && note.web_link_1.trim() !== "") ||
                    (note.web_link_2 && note.web_link_2.trim() !== "");
                  return (
                    <li
                      key={note.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/notes/${note.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/notes/${note.id}`);
                        }
                      }}
                      className="flex items-start justify-between gap-3 px-6 py-4 cursor-pointer hover:bg-slate-50/90 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/20 focus-visible:ring-inset"
                    >
                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); router.push(`/notes/${note.id}`); }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-slate-900">
                            {note.title ?? t("untitled")}
                          </p>
                          <span className="text-xs text-slate-500 shrink-0">
                            {new Date(note.created_at).toLocaleString(localeTag, {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {excerpt && (
                          <p className="mt-1.5 line-clamp-2 text-xs text-slate-600">
                            {excerpt}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {note.module && (
                            <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200/80">
                              {note.module}
                            </span>
                          )}
                          {note.scope_item && (
                            <span className="inline-flex items-center rounded-lg bg-[rgb(var(--rb-brand-surface))] px-2 py-0.5 text-[10px] font-medium text-[rgb(var(--rb-brand-primary-active))] ring-1 ring-[rgb(var(--rb-brand-primary))]/18">
                              {note.scope_item}
                            </span>
                          )}
                          {note.error_code && (
                            <span className="inline-flex items-center rounded-lg bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-800 ring-1 ring-red-200/70">
                              {t("error")} {note.error_code}
                            </span>
                          )}
                          {hasLinks && (
                            <span className="inline-flex items-center gap-0.5 rounded-lg bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200/80">
                              <Link2 className="h-3 w-3" /> {t("links")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        <NoteRowActions
                          note={note}
                          viewHref={`/notes/${note.id}`}
                          canEdit={canEditNotes}
                          canDelete={canDeleteNotes}
                          deleteEndpoint={canDeleteNotes ? `/api/notes/${note.id}` : undefined}
                          onDeleted={loadNotes}
                          onToggleKnowledge={(e) => toggleKnowledge(note, e)}
                          togglingId={togglingId}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </ModuleContentCard>
        </>
      )}
    </div>
  );
}
