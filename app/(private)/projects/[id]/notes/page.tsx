"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FileText, Link2, AlertCircle, Calendar, Search, Eye, MoreVertical, Pencil, BookMarked, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";

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

const SORT_OPTIONS = [
  { value: "recent", label: "Más recientes" },
  { value: "oldest", label: "Más antiguas" },
  { value: "title", label: "Título A-Z" },
] as const;
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
            <button
              type="button"
              onClick={(e) => { setMenuOpen(false); onToggleKnowledge(e); }}
              disabled={!!togglingId}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              <BookMarked className="h-3.5 w-3.5" />
              {togglingId === note.id ? "…" : note.is_knowledge_base ? "Quitar de KB" : "Añadir a KB"}
            </button>
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

export default function ProjectNotesPage() {
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
  }, [projectId]);

  const loadNotes = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/notes?limit=50`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg((data as { error?: string }).error ?? "Error al cargar las notas.");
        setNotes([]);
        return;
      }
      const list = (data as { notes?: ProjectNoteSummary[] }).notes ?? [];
      setNotes(list);
    } catch {
      setErrorMsg("Error de conexión.");
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

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
        const module = (n.module ?? "").toLowerCase();
        const scope = (n.scope_item ?? "").toLowerCase();
        const err = (n.error_code ?? "").toLowerCase();
        return (
          title.includes(q) ||
          body.includes(q) ||
          extra.includes(q) ||
          module.includes(q) ||
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
      <div className="space-y-6">
        <p className="text-sm text-slate-400">Identificador de proyecto no válido.</p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-8">
      <header className="space-y-1">
        <ProjectPageHeader
          variant="section"
          dark
          title="Notas del proyecto"
          subtitle="Notas operativas y memoria funcional de este proyecto. No son conocimiento global; solo visibles para miembros del proyecto."
          primaryActionLabel="Nueva nota"
          primaryActionHref={`/notes/new?projectId=${projectId}`}
        />
      </header>

      {errorMsg && (
        <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <section className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden">
          <div className="px-6 py-6">
            <TableSkeleton rows={6} colCount={5} />
          </div>
        </section>
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 sm:p-5 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
              <p className="text-xs uppercase text-slate-400">Total</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">{summary.total}</p>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 sm:p-5 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
              <p className="text-xs uppercase text-slate-400">Con código error</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">{summary.withErrorCode}</p>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 sm:p-5 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
              <p className="text-xs uppercase text-slate-400">Con enlaces</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">{summary.withLinks}</p>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 sm:p-5 hover:border-slate-600 hover:shadow-sm transition-all duration-150">
              <p className="text-xs uppercase text-slate-400">Recientes (7 d)</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">{summary.recentlyAdded}</p>
            </div>
          </div>

          {/* Filter / search bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar en notas..."
                className="w-full rounded-xl border border-slate-600/80 bg-slate-900/80 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
              />
            </div>
            {uniqueModules.length > 0 && (
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="rounded-xl border border-slate-600/80 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
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
              className="rounded-xl border border-slate-600/80 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <section className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden">
            {notes.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/30 py-16 px-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-800/40 text-slate-500">
                  <FileText className="h-7 w-7" />
                </div>
                <p className="mt-4 text-base font-medium text-slate-200">Aún no hay notas en este proyecto</p>
                <p className="mt-1.5 max-w-md mx-auto text-sm text-slate-500">
                  Captura incidencias, soluciones, decisiones y contexto operativo. Crea la primera para empezar.
                </p>
                <Link
                  href={`/notes/new?projectId=${projectId}`}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 transition-colors"
                >
                  Crear primera nota
                </Link>
              </div>
            ) : filteredAndSortedNotes.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/30 py-12 px-6 text-center">
                <p className="text-sm font-medium text-slate-300">Ninguna nota coincide con los filtros</p>
                <p className="mt-1 text-xs text-slate-500">Prueba a cambiar la búsqueda o el módulo.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-700/40">
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
                      className="flex items-start justify-between gap-3 px-6 py-4 cursor-pointer hover:bg-slate-800/50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-inset"
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
                            {excerpt}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {note.module && (
                            <span className="inline-flex items-center rounded-lg bg-slate-700/60 px-2 py-0.5 text-[10px] text-slate-300">
                              {note.module}
                            </span>
                          )}
                          {note.scope_item && (
                            <span className="inline-flex items-center rounded-lg bg-indigo-500/20 px-2 py-0.5 text-[10px] text-indigo-300">
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
          </section>
        </>
      )}
    </div>
  );
}
