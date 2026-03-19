"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Link2, Search, Eye, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";

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

const SORT_OPTIONS = [
  { value: "recent", label: "Más recientes" },
  { value: "oldest", label: "Más antiguas" },
  { value: "title", label: "Título A-Z" },
] as const;
type SortValue = (typeof SORT_OPTIONS)[number]["value"];

/** Row actions for global notes: Ver (primary) + overflow menu (Editar, Eliminar). */
function GlobalNoteRowActions({
  viewHref,
  editHref,
  canEdit,
  canDelete,
  deleteEndpoint,
  onDeleted,
}: {
  viewHref: string;
  editHref?: string;
  canEdit: boolean;
  canDelete: boolean;
  deleteEndpoint?: string;
  onDeleted?: () => void;
}) {
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
        setDeleteError(data?.error ?? "No se pudo completar la acción.");
        return;
      }
      setDeleteOpen(false);
      onDeleted?.();
    } catch {
      setDeleteError("Error de conexión. Inténtalo de nuevo.");
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
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-600/80 bg-slate-800/60 px-3 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:border-slate-500 hover:text-slate-100 transition-colors"
      >
        <Eye className="h-3.5 w-3.5" />
        Ver
      </Link>
      <div className="relative">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-600/80 bg-slate-800/60 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
          aria-label="Más opciones"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-xl border border-slate-600/80 bg-slate-800 shadow-lg ring-1 ring-slate-700/50 py-1">
            {showEdit && (
              <button
                type="button"
                onClick={() => { setMenuOpen(false); router.push(editHref!); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
            )}
            {showDelete && (
              <button
                type="button"
                onClick={() => { setMenuOpen(false); setDeleteOpen(true); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-rose-300 hover:bg-slate-700 hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </button>
            )}
          </div>
        )}
      </div>
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !deleteLoading && setDeleteOpen(false)}>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-800 p-6 shadow-xl ring-1 ring-slate-700/50 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-100">Eliminar nota</h3>
            <p className="mt-2 text-sm text-slate-400">¿Seguro que quieres eliminar esta nota? Esta acción no se puede deshacer.</p>
            {deleteError && <p className="mt-3 text-sm text-rose-400 bg-rose-950/30 rounded-lg px-3 py-2">{deleteError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => !deleteLoading && setDeleteOpen(false)} disabled={deleteLoading} className="rounded-xl border border-slate-600 bg-slate-700 px-3 h-9 text-sm font-medium text-slate-200 hover:bg-slate-600 disabled:opacity-60">Cancelar</button>
              <button type="button" onClick={handleDeleteConfirm} disabled={deleteLoading} className="rounded-xl bg-rose-600 px-3 h-9 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60">{deleteLoading ? "Eliminando…" : "Eliminar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NotesPage() {
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
      setErrorMsg("Debes iniciar sesión para ver las notas.");
      setLoadingNotes(false);
      return;
    }

    try {
      const res = await fetch("/api/notes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 401) {
          setErrorMsg("Sesión expirada. Inicia sesión de nuevo.");
        } else {
          setErrorMsg("No se pudieron cargar las notas.");
        }
        setLoadingNotes(false);
        return;
      }
      const data = (await res.json()) as Note[];
      setNotes(Array.isArray(data) ? data : []);
    } catch {
      handleSupabaseError("notes", new Error("Network error"));
      setErrorMsg("No se pudieron cargar las notas.");
      setNotes([]);
    } finally {
      setLoadingNotes(false);
    }
  }, []);

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
        const module = (n.module ?? "").toLowerCase();
        const scope = (n.scope_item ?? "").toLowerCase();
        const err = (n.error_code ?? "").toLowerCase();
        const noteType = (n.note_type ?? "").toLowerCase();
        return (
          title.includes(q) ||
          body.includes(q) ||
          extra.includes(q) ||
          module.includes(q) ||
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
    <div className="w-full px-6 lg:px-8 py-8">
      <div className="w-full min-w-0 space-y-8">
      <header className="space-y-1">
        <ProjectPageHeader
          variant="section"
          dark
          title="Global Knowledge Notes"
          subtitle="Reusable SAP patterns, incidents, configuration standards, and cross-project decisions. Only users with global notes permission can view and create them."
          primaryActionLabel={manageGlobalNotes ? "New global note" : undefined}
          primaryActionHref={manageGlobalNotes ? "/notes/new" : undefined}
          primaryActionClassName="shadow-sm shadow-indigo-500/20 bg-indigo-500/20 hover:bg-indigo-500/30"
        />
      </header>

      {errorMsg && (
        <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      {loadingNotes ? (
        <section className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden">
          <div className="px-6 py-6">
            <TableSkeleton rows={6} colCount={5} />
          </div>
        </section>
      ) : (
        <>
          {/* Metrics cards — subdued so notes dominate */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-3 sm:p-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Total notes</p>
              <p className="mt-0.5 text-base font-semibold text-slate-300">{summary.total}</p>
            </div>
            <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-3 sm:p-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">SAP modules covered</p>
              <p className="mt-0.5 text-base font-semibold text-slate-300">{summary.modulesCovered}</p>
            </div>
            <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-3 sm:p-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Recent notes (7d)</p>
              <p className="mt-0.5 text-base font-semibold text-slate-300">{summary.recentlyAdded}</p>
            </div>
            <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-3 sm:p-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Recurring incidents</p>
              <p className="mt-0.5 text-base font-semibold text-slate-300">{summary.recurringIncidents}</p>
            </div>
          </div>

          {/* Filter / search bar — aligned with notes width */}
          <div className="flex flex-wrap items-center gap-3 w-full">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar en notas..."
                className="h-10 w-full rounded-xl border border-slate-600 bg-slate-800/80 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
              />
            </div>
            {uniqueModules.length > 0 && (
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="h-10 rounded-xl border border-slate-600 bg-slate-800/80 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
              >
                <option value="">Todos los módulos</option>
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
              className="h-10 rounded-xl border border-slate-600 bg-slate-800/80 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <section className="w-full rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden pb-1 min-h-[200px]">
            {notes.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/30 py-16 px-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-800/40 text-slate-500">
                  <FileText className="h-7 w-7" />
                </div>
                <p className="mt-4 text-base font-medium text-slate-200">No global notes yet</p>
                <p className="mt-1.5 max-w-md mx-auto text-sm text-slate-500">
                  {manageGlobalNotes
                    ? "Create your first global note to document SAP patterns, recurring incidents, configuration standards, or cross-project decisions."
                    : "Global notes are only visible to users with permission. Create or view notes within a project from the project Notes tab."}
                </p>
                {manageGlobalNotes && (
                  <Link
                    href="/notes/new"
                    className="mt-5 inline-flex items-center gap-2 rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 transition-colors"
                  >
                    Create first note
                  </Link>
                )}
              </div>
            ) : filteredAndSortedNotes.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/30 py-12 px-6 text-center">
                <p className="text-sm font-medium text-slate-300">No notes match the filters</p>
                <p className="mt-1 text-xs text-slate-500">Try changing the search or module.</p>
              </div>
            ) : (
              <ul className="w-full space-y-5 p-4 pb-6">
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
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-700/60 bg-slate-800/40 px-5 py-5 cursor-pointer transition-all duration-150 hover:bg-slate-800/60 hover:border-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-inset"
                    >
                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); router.push(`/notes/${note.id}`); }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-slate-100">
                            {note.title ?? "Sin título"}
                          </p>
                          <span className="text-xs text-slate-500 shrink-0">
                            {new Date(note.created_at).toLocaleString("es-ES", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {excerpt && (
                          <p className="mt-1.5 line-clamp-2 text-xs text-slate-400">
                            {excerpt.length > 160 ? excerpt.slice(0, 160).trimEnd() + "…" : excerpt}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {note.module && (
                            <span className="inline-flex items-center rounded-lg bg-slate-700/60 px-2 py-0.5 text-[10px] text-slate-300">
                              {note.module}
                            </span>
                          )}
                          {note.note_type && (
                            <span className="inline-flex items-center rounded-lg bg-indigo-500/20 px-2 py-0.5 text-[10px] text-indigo-300">
                              {note.note_type}
                            </span>
                          )}
                          {note.scope_item && (
                            <span className="inline-flex items-center rounded-lg bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300">
                              {note.scope_item}
                            </span>
                          )}
                          {note.error_code && (
                            <span className="inline-flex items-center rounded-lg bg-red-500/20 px-2 py-0.5 text-[10px] text-red-400">
                              Error {note.error_code}
                            </span>
                          )}
                          {hasLinks && (
                            <span className="inline-flex items-center gap-0.5 rounded-lg bg-slate-600/50 px-2 py-0.5 text-[10px] text-slate-400">
                              <Link2 className="h-3 w-3" /> Enlaces
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        <GlobalNoteRowActions
                          viewHref={`/notes/${note.id}`}
                          editHref={manageGlobalNotes ? `/notes/${note.id}` : undefined}
                          canEdit={manageGlobalNotes}
                          canDelete={manageGlobalNotes}
                          deleteEndpoint={manageGlobalNotes ? `/api/notes/${note.id}` : undefined}
                          onDeleted={fetchNotes}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="pb-10" aria-hidden />
        </>
      )}
      </div>
    </div>
  );
}
