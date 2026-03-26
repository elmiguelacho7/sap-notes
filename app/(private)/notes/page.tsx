"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { FileText, Link2, Search, Eye, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";
import { AppPageShell } from "@/components/ui/layout/AppPageShell";

type Note = {
  id: string;
  title: string;
  body: string | null;
  note_type: string | null;
  system_type: string | null;
  client: string | null;
  client_id: string | null;
  module: string | null;
  module_id: string | null;
  scope_item: string | null;
  scope_item_id: string | null;
  transaction: string | null;
  error_code: string | null;
  web_link_1: string | null;
  web_link_2: string | null;
  extra_info: string | null;
  project_id: string | null;
  created_at: string;
};

const SORT_OPTIONS = [{ value: "recent" }, { value: "oldest" }, { value: "title" }] as const;
type SortValue = (typeof SORT_OPTIONS)[number]["value"];

/** Row actions for global notes: Ver (primary) + overflow menu (Editar, Eliminar). */
function GlobalNoteRowActions({
  editHref,
  canEdit,
  canDelete,
  deleteEndpoint,
  onDeleted,
}: {
  editHref?: string;
  canEdit: boolean;
  canDelete: boolean;
  deleteEndpoint?: string;
  onDeleted?: () => void;
}) {
  const t = useTranslations("notes");
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
    <div className="flex items-center shrink-0" ref={menuRef}>
      <div className="relative">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[rgb(var(--rb-surface-border))]/50 bg-[rgb(var(--rb-surface-3))]/20 text-[rgb(var(--rb-text-muted))] hover:bg-[rgb(var(--rb-surface-3))]/35 hover:text-[rgb(var(--rb-text-secondary))] transition-colors"
          aria-label={t("actions.more")}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] shadow-lg ring-1 ring-[rgb(var(--rb-surface-border))]/40 py-1">
            {showEdit && (
              <button
                type="button"
                onClick={() => { setMenuOpen(false); router.push(editHref!); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-3))]/35"
              >
                <Pencil className="h-3.5 w-3.5" /> {t("actions.edit")}
              </button>
            )}
            {showDelete && (
              <button
                type="button"
                onClick={() => { setMenuOpen(false); setDeleteOpen(true); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-rose-700 hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> {t("actions.delete")}
              </button>
            )}
          </div>
        )}
      </div>
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !deleteLoading && setDeleteOpen(false)}>
          <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] p-6 shadow-xl ring-1 ring-[rgb(var(--rb-surface-border))]/40 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[rgb(var(--rb-text-primary))]">{t("delete.title")}</h3>
            <p className="mt-2 text-sm text-[rgb(var(--rb-text-muted))]">{t("delete.body")}</p>
            {deleteError && <p className="mt-3 text-sm text-rose-800 bg-rose-50 rounded-lg px-3 py-2 border border-rose-200/80">{deleteError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => !deleteLoading && setDeleteOpen(false)}
                disabled={deleteLoading}
                className="rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] px-3 h-9 text-sm font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-3))]/25 disabled:opacity-60"
              >
                {t("delete.cancel")}
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="rounded-xl bg-rose-600 px-3 h-9 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60"
              >
                {deleteLoading ? t("delete.deleting") : t("delete.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getScopeBadge(note: Note): { label: string; className: string } {
  const isProject = Boolean(note.project_id);
  return isProject
    ? { label: "Project note", className: "bg-blue-100 text-blue-600" }
    : { label: "Global note", className: "bg-purple-100 text-purple-600" };
}

function getTypeBadge(note: Note): { label: string; className: string } | null {
  const raw = `${note.note_type ?? ""} ${note.scope_item ?? ""}`.toLowerCase();
  const hasError = Boolean(note.error_code && note.error_code.trim() !== "");
  if (hasError || raw.includes("incident") || raw.includes("error")) {
    return { label: "Incident / error", className: "bg-rose-100 text-rose-600" };
  }
  if (raw.includes("config") || raw.includes("configuration") || raw.includes("process") || raw.includes("sap") || raw.includes("note")) {
    return { label: "Configuration / process", className: "bg-amber-100 text-amber-700" };
  }
  return null;
}

export default function NotesPage() {
  const t = useTranslations("notes");
  const locale = useLocale();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const router = useRouter();

  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [manageGlobalNotes, setManageGlobalNotes] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortValue>("recent");

  const fetchNotes = useCallback(async () => {
    setLoadingNotes(true);
    setErrorMsg(null);
    setNotes([]);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setErrorMsg(t("errors.loginRequired"));
      setLoadingNotes(false);
      return;
    }

    try {
      const res = await fetch("/api/notes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 401) {
          setErrorMsg(t("errors.sessionExpired"));
        } else {
          setErrorMsg(t("errors.load"));
        }
        setLoadingNotes(false);
        return;
      }
      const data = (await res.json()) as Note[];
      setNotes(Array.isArray(data) ? data : []);
    } catch {
      handleSupabaseError("notes", new Error("Network error"));
      setErrorMsg(t("errors.load"));
      setNotes([]);
    } finally {
      setLoadingNotes(false);
    }
  }, [t]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    let cancelled = false;
    async function loadMe() {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      if (cancelled) return;
      const data = await res.json().catch(() => ({ permissions: { manageGlobalNotes: false } }));
      const perms = (data as { permissions?: { manageGlobalNotes?: boolean } }).permissions;
      setManageGlobalNotes(perms?.manageGlobalNotes ?? false);
    }
    loadMe();
    return () => { cancelled = true; };
  }, []);

  const summary = useMemo(() => {
    const total = notes.length;
    const uniqueModules = new Set(notes.map((n) => n.module).filter(Boolean));
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentlyAdded = notes.filter((n) => new Date(n.created_at) >= sevenDaysAgo).length;
    const recurringIncidents = notes.filter((n) => n.error_code && n.error_code.trim() !== "").length;
    return { total, modulesCovered: uniqueModules.size, recentlyAdded, recurringIncidents };
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
        const noteType = (n.note_type ?? "").toLowerCase();
        return (
          title.includes(q) ||
          body.includes(q) ||
          extra.includes(q) ||
          moduleName.includes(q) ||
          scope.includes(q) ||
          err.includes(q) ||
          noteType.includes(q)
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

  return (
    <AppPageShell>
      <div className="space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--rb-text-primary))]">
              Global Knowledge Notes
            </h1>
            <p className="mt-1 text-sm text-[rgb(var(--rb-text-muted))] max-w-3xl">
              Reusable SAP patterns, incidents, configuration standards, and cross-project decisions.
            </p>
          </div>
          {manageGlobalNotes && (
            <Link
              href="/notes/new"
              className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-transparent bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[rgb(var(--rb-brand-primary-hover))] active:bg-[rgb(var(--rb-brand-primary-active))] mt-0.5"
            >
              New note
            </Link>
          )}
        </header>

      {errorMsg && (
        <div className="rounded-xl border border-red-200/90 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      {loadingNotes ? (
        <section className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] overflow-hidden shadow-sm">
          <div className="px-6 py-6">
            <TableSkeleton rows={6} colCount={5} />
          </div>
        </section>
      ) : (
        <>
          {/* Metrics cards — subdued so notes dominate */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-2">
            <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] p-4 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">Total notes</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[rgb(var(--rb-text-primary))]">{summary.total}</p>
            </div>
            <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] p-4 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">SAP modules covered</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[rgb(var(--rb-text-primary))]">{summary.modulesCovered}</p>
            </div>
            <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] p-4 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">Recent notes (7d)</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[rgb(var(--rb-text-primary))]">{summary.recentlyAdded}</p>
            </div>
            <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] p-4 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">Recurring incidents</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[rgb(var(--rb-text-primary))]">{summary.recurringIncidents}</p>
            </div>
          </div>

          {/* Filter / search bar — aligned with notes width */}
          <div className="flex flex-wrap gap-3 rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] shadow-sm p-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[rgb(var(--rb-text-muted))]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="h-10 w-full rounded-md border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/20 pl-9 pr-3 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30"
              />
            </div>
            {uniqueModules.length > 0 && (
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="h-10 rounded-md border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/20 px-3 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30"
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
              className="h-10 rounded-md border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/20 px-3 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(`sort.${opt.value}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Grid of note cards */}
          <section className="w-full min-h-[200px]">
            {notes.length === 0 ? (
              <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] py-16 px-6 text-center shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/20 text-[rgb(var(--rb-text-muted))]">
                  <FileText className="h-7 w-7" />
                </div>
                <p className="mt-4 text-base font-medium text-[rgb(var(--rb-text-primary))]">No global notes yet</p>
                <p className="mt-1.5 max-w-md mx-auto text-sm text-[rgb(var(--rb-text-muted))]">
                  {manageGlobalNotes
                    ? "Create your first global note to document SAP patterns, recurring incidents, configuration standards, or cross-project decisions."
                    : "Global notes are only visible to users with permission. Create or view notes within a project from the project Notes tab."}
                </p>
                {manageGlobalNotes && (
                  <Link
                    href="/notes/new"
                    className="mt-5 inline-flex items-center gap-2 rounded-xl border border-transparent bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[rgb(var(--rb-brand-primary-hover))] active:bg-[rgb(var(--rb-brand-primary-active))]"
                  >
                    Create first note
                  </Link>
                )}
              </div>
            ) : filteredAndSortedNotes.length === 0 ? (
              <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] py-12 px-6 text-center shadow-sm">
                <p className="text-sm font-medium text-[rgb(var(--rb-text-primary))]">No notes match the filters</p>
                <p className="mt-1 text-xs text-[rgb(var(--rb-text-muted))]">Try changing the search or module.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] shadow-sm p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
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
                    const scopeBadge = getScopeBadge(note);
                    const typeBadge = getTypeBadge(note);
                    const sapitoHref = `/knowledge/search?context=${encodeURIComponent(`note:${note.id}`)}`;
                    return (
                      <div
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
                        className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-white shadow-sm p-4 space-y-3.5 cursor-pointer hover:shadow-md hover:-translate-y-[2px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-primary))]/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            {typeBadge ? (
                              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium tracking-wide ${typeBadge.className}`}>
                                {typeBadge.label}
                              </span>
                            ) : (
                              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium tracking-wide ${scopeBadge.className}`}>
                                {scopeBadge.label}
                              </span>
                            )}
                            {typeBadge ? (
                              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium tracking-wide ${scopeBadge.className}`}>
                                {scopeBadge.label}
                              </span>
                            ) : null}
                          </div>
                          {note.module ? (
                            <span className="shrink-0 inline-flex items-center rounded-md border border-[rgb(var(--rb-surface-border))]/40 bg-[rgb(var(--rb-surface-3))]/20 px-2 py-0.5 text-[10px] text-[rgb(var(--rb-text-muted))]">
                              {note.module}
                            </span>
                          ) : null}
                        </div>

                        <div className="space-y-1.5">
                          <h3 className="text-[16px] font-semibold tracking-tight text-[rgb(var(--rb-text-primary))] line-clamp-2">
                            {note.title ?? t("untitled")}
                          </h3>
                          {excerpt ? (
                            <p className="text-sm leading-relaxed text-[rgb(var(--rb-text-muted))] line-clamp-3">
                              {excerpt.length > 220 ? excerpt.slice(0, 220).trimEnd() + "…" : excerpt}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {note.note_type ? (
                            <span className="inline-flex items-center rounded-md bg-[rgb(var(--rb-surface-3))]/30 px-2 py-0.5 text-xs text-[rgb(var(--rb-text-secondary))]">
                              {note.note_type}
                            </span>
                          ) : null}
                          {note.scope_item ? (
                            <span className="inline-flex items-center rounded-md bg-[rgb(var(--rb-surface-3))]/30 px-2 py-0.5 text-xs text-[rgb(var(--rb-text-secondary))]">
                              {note.scope_item}
                            </span>
                          ) : null}
                          {note.error_code ? (
                            <span className="inline-flex items-center rounded-md bg-rose-100 px-2 py-0.5 text-xs text-rose-600">
                              Error {note.error_code}
                            </span>
                          ) : null}
                          {hasLinks ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[rgb(var(--rb-surface-3))]/30 px-2 py-0.5 text-xs text-[rgb(var(--rb-text-secondary))]">
                              <Link2 className="h-3 w-3" /> {t("links")}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-0.5">
                          <span className="text-xs tabular-nums text-[rgb(var(--rb-text-muted))]">
                            {new Date(note.created_at).toLocaleString(localeTag, {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-3 border-t border-[rgb(var(--rb-surface-border))]/50 mt-0.5">
                          <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Link
                              href={`/notes/${note.id}`}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/20 px-3 text-xs font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-3))]/35 transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              {t("actions.view")}
                            </Link>
                            <Link
                              href={sapitoHref}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/20 px-3 text-xs font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-3))]/35 transition-colors"
                            >
                              Ask Sapito
                            </Link>
                          </div>
                          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            <GlobalNoteRowActions
                              editHref={manageGlobalNotes ? `/notes/${note.id}` : undefined}
                              canEdit={manageGlobalNotes}
                              canDelete={manageGlobalNotes}
                              deleteEndpoint={manageGlobalNotes ? `/api/notes/${note.id}` : undefined}
                              onDeleted={fetchNotes}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <div className="pb-10" aria-hidden />
        </>
      )}
      </div>
    </AppPageShell>
  );
}
