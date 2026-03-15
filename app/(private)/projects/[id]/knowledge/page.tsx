"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { Plus, FolderOpen, FileText } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  listSpaces,
  createSpace,
  listPages,
  createPage,
  getPage,
  updatePage,
  deletePage,
} from "@/lib/knowledgeService";
import type { KnowledgeSpace, KnowledgePage } from "@/lib/types/knowledge";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageDetailDrawer, type PageDetailPayload } from "@/components/knowledge/PageDetailDrawer";
import { KnowledgePageRow } from "@/components/knowledge/KnowledgePageRow";

export default function ProjectKnowledgePage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "";

  const [spaces, setSpaces] = useState<KnowledgeSpace[]>([]);
  const [pages, setPages] = useState<KnowledgePage[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalSpace, setModalSpace] = useState(false);
  const [modalPage, setModalPage] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceDesc, setNewSpaceDesc] = useState("");
  const [newPageTitle, setNewPageTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPageId, setDetailPageId] = useState<string | null>(null);
  const [detailPage, setDetailPage] = useState<KnowledgePage | null>(null);
  const [detailSaving, setDetailSaving] = useState(false);
  const [deleteConfirmPage, setDeleteConfirmPage] = useState<KnowledgePage | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadSpaces = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listSpaces(supabase, { projectId });
      setSpaces(list);
      if (list.length > 0 && !selectedSpaceId) {
        setSelectedSpaceId(list[0].id);
      } else if (list.length === 0) {
        setSelectedSpaceId(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar espacios.");
      setSpaces([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedSpaceId]);

  const loadPages = useCallback(async () => {
    if (!selectedSpaceId) {
      setPages([]);
      return;
    }
    try {
      const list = await listPages(supabase, selectedSpaceId);
      setPages(list);
    } catch {
      setPages([]);
    }
  }, [selectedSpaceId]);

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces]);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single()
      .then(
        ({ data }) => setProjectName((data as { name?: string } | null)?.name ?? null),
        () => setProjectName(null)
      );
  }, [projectId]);

  useEffect(() => {
    if (!detailOpen || !detailPageId) {
      setDetailPage(null);
      return;
    }
    let cancelled = false;
    getPage(supabase, detailPageId)
      .then(({ page }) => {
        if (!cancelled) setDetailPage(page);
      })
      .catch(() => {
        if (!cancelled) setDetailPage(null);
      });
    return () => { cancelled = true; };
  }, [detailOpen, detailPageId]);

  const handleCreateSpace = async (e: FormEvent) => {
    e.preventDefault();
    const name = newSpaceName.trim();
    if (!name || !projectId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const space = await createSpace(supabase, {
        projectId,
        name,
        description: newSpaceDesc.trim() || null,
      });
      setSpaces((prev) => [...prev, space]);
      setSelectedSpaceId(space.id);
      setNewSpaceName("");
      setNewSpaceDesc("");
      setModalSpace(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error al crear espacio.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePage = async (e: FormEvent) => {
    e.preventDefault();
    const title = newPageTitle.trim();
    if (!title || !selectedSpaceId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const page = await createPage(supabase, selectedSpaceId, title);
      setPages((prev) => [page, ...prev]);
      setNewPageTitle("");
      setModalPage(false);
      setDetailPageId(page.id);
      setDetailOpen(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error al crear página.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDetail = useCallback((page: KnowledgePage) => {
    setDetailPageId(page.id);
    setDetailOpen(true);
  }, []);

  const handleSaveDetail = useCallback(async (pageId: string, payload: PageDetailPayload) => {
    setDetailSaving(true);
    try {
      const updated = await updatePage(supabase, pageId, {
        title: payload.title,
        summary: payload.summary,
        space_id: payload.space_id,
      });
      setDetailPage(updated);
      setPages((prev) =>
        prev.map((p) => (p.id === pageId ? updated : p))
      );
      setDetailOpen(false);
      setDetailPageId(null);
      setDetailPage(null);
      if (payload.space_id !== selectedSpaceId) loadPages();
    } catch (e) {
      console.error(e);
    } finally {
      setDetailSaving(false);
    }
  }, [selectedSpaceId, loadPages]);

  const handleDeletePage = useCallback(async (page: KnowledgePage) => {
    setDeleteLoading(true);
    try {
      await deletePage(supabase, page.id);
      setPages((prev) => prev.filter((p) => p.id !== page.id));
      setDeleteConfirmPage(null);
      if (detailPageId === page.id) {
        setDetailOpen(false);
        setDetailPageId(null);
        setDetailPage(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeleteLoading(false);
    }
  }, [detailPageId]);

  const selectedSpace = spaces.find((s) => s.id === selectedSpaceId);
  const spaceOptions = spaces.map((s) => ({ value: s.id, label: s.name }));

  if (!projectId) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-slate-400">Identificador de proyecto no válido.</p>
      </div>
    );
  }

  const lastUpdatedPage = pages.length > 0
    ? pages.reduce((a, b) => (new Date(b.updated_at) > new Date(a.updated_at) ? b : a))
    : null;

  return (
    <div className="w-full min-w-0 space-y-6 sm:space-y-8">
      <header className="space-y-1">
        <ProjectPageHeader
          variant="section"
          dark
          title="Conocimiento"
          subtitle="Espacios y páginas de conocimiento vinculados a este proyecto."
          primaryActionLabel="Nuevo espacio"
          primaryActionOnClick={() => { setSaveError(null); setModalSpace(true); }}
        />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-500">
          <span>{spaces.length} {spaces.length === 1 ? "espacio" : "espacios"}</span>
          <span>{pages.length} {pages.length === 1 ? "página" : "páginas"}</span>
          {lastUpdatedPage && (
            <span>Última actualización: {new Date(lastUpdatedPage.updated_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</span>
          )}
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden">
          <div className="border-b border-slate-700/50 px-4 sm:px-5 py-4">
            <h2 className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Espacios
            </h2>
          </div>
          <div className="p-3">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-11 w-full rounded-xl" />
                <Skeleton className="h-11 w-full rounded-xl" />
                <Skeleton className="h-11 w-4/5 rounded-xl" />
              </div>
            ) : spaces.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/30 py-12 text-center">
                <FolderOpen className="mx-auto h-10 w-10 text-slate-500" />
                <p className="mt-3 text-sm font-medium text-slate-200">No hay espacios</p>
                <p className="mt-1 text-xs text-slate-500">Crea uno con «Nuevo espacio» para organizar tus páginas.</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {spaces.map((space) => (
                  <li key={space.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedSpaceId(space.id)}
                      className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-medium transition-colors duration-150 ${
                        selectedSpaceId === space.id
                          ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/40"
                          : "text-slate-300 hover:bg-slate-800/50 border border-transparent"
                      }`}
                    >
                      <FolderOpen className={`h-4 w-4 shrink-0 ${selectedSpaceId === space.id ? "text-indigo-400" : "text-slate-500"}`} />
                      <span className="truncate">{space.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="md:col-span-2 rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden">
          <div className="border-b border-slate-700/50 px-4 sm:px-5 py-4 flex items-center justify-between gap-3">
            <h2 className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Páginas
            </h2>
            <button
              type="button"
              onClick={() => { setSaveError(null); setModalPage(true); }}
              disabled={!selectedSpaceId}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nueva página
            </button>
          </div>
          <div className="p-4">
            {!selectedSpaceId ? (
              <div className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/30 py-12 text-center">
                <FileText className="mx-auto h-10 w-10 text-slate-500" />
                <p className="mt-3 text-sm font-medium text-slate-200">Selecciona un espacio</p>
                <p className="mt-1 text-xs text-slate-500">Elige un espacio a la izquierda para ver y crear páginas.</p>
              </div>
            ) : pages.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/30 py-12 text-center">
                <FileText className="mx-auto h-10 w-10 text-slate-500" />
                <p className="mt-3 text-sm font-medium text-slate-200">No hay páginas en este espacio</p>
                <p className="mt-1 text-xs text-slate-500">Crea la primera con «Nueva página».</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {pages.map((page) => (
                  <li key={page.id}>
                    <KnowledgePageRow
                      page={page}
                      dark
                      onOpen={handleOpenDetail}
                      onEdit={handleOpenDetail}
                      onDelete={(p) => setDeleteConfirmPage(p)}
fullEditorHref="/knowledge"
                          fullEditorQuery={projectId ? `?projectId=${projectId}` : undefined}
                          showUpdated
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <PageDetailDrawer
        page={detailPage}
        spaceName={selectedSpace?.name ?? null}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailPageId(null);
          setDetailPage(null);
        }}
        onSave={handleSaveDetail}
        context="project"
        spaceOptions={spaceOptions}
        projectName={projectName}
        fullEditorPath="/knowledge"
        fullEditorQuery={projectId ? `?projectId=${projectId}` : undefined}
        saving={detailSaving}
      />

      {deleteConfirmPage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => !deleteLoading && setDeleteConfirmPage(null)}
        >
          <div
            className="rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-xl max-w-md w-full ring-1 ring-slate-700/50"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-100">Eliminar página</h2>
            <p className="mt-2 text-sm text-slate-400">
              ¿Eliminar «{deleteConfirmPage.title}»? Se puede deshacer más tarde.
            </p>
            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={() => setDeleteConfirmPage(null)}
                disabled={deleteLoading}
                className="rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeletePage(deleteConfirmPage)}
                disabled={deleteLoading}
                className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-200 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
              >
                {deleteLoading ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalSpace && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => !saving && setModalSpace(false)}
        >
          <div
            className="rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-xl max-w-md w-full ring-1 ring-slate-700/50"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-100">Nuevo espacio</h2>
            <form onSubmit={handleCreateSpace} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  className="w-full rounded-xl border border-slate-600/80 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                  placeholder="Ej: Configuración SAP"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Descripción (opcional)</label>
                <textarea
                  value={newSpaceDesc}
                  onChange={(e) => setNewSpaceDesc(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-600/80 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                  placeholder="Breve descripción"
                  disabled={saving}
                />
              </div>
              {saveError && <p className="text-sm text-red-400">{saveError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalSpace(false)}
                  disabled={saving}
                  className="rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !newSpaceName.trim()}
                  className="rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50"
                >
                  {saving ? "Creando…" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalPage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => !saving && setModalPage(false)}
        >
          <div
            className="rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-xl max-w-md w-full ring-1 ring-slate-700/50"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-100">Nueva página</h2>
            <form onSubmit={handleCreatePage} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Título *</label>
                <input
                  type="text"
                  value={newPageTitle}
                  onChange={(e) => setNewPageTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-600/80 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                  placeholder="Ej: Cómo configurar variante de valoración"
                  disabled={saving}
                />
              </div>
              {saveError && <p className="text-sm text-red-400">{saveError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalPage(false)}
                  disabled={saving}
                  className="rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !newPageTitle.trim()}
                  className="rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50"
                >
                  {saving ? "Creando…" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
