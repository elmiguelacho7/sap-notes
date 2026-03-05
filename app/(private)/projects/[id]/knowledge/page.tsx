"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Plus, FolderOpen, FileText } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  listSpaces,
  createSpace,
  listPages,
  createPage,
} from "@/lib/knowledgeService";
import type { KnowledgeSpace, KnowledgePage } from "@/lib/types/knowledge";
import { ProjectPageHeader } from "@/components/layout/ProjectPageHeader";

export default function ProjectKnowledgePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
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
      router.push(`/knowledge/${page.id}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error al crear página.");
    } finally {
      setSaving(false);
    }
  };

  if (!projectId) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-slate-600">Identificador de proyecto no válido.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProjectPageHeader
        title="Knowledge"
        subtitle="Espacios y páginas de conocimiento vinculados a este proyecto."
        primaryActionLabel="Nuevo espacio"
        primaryActionOnClick={() => { setSaveError(null); setModalSpace(true); }}
      />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 bg-slate-50/50">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Espacios
            </h2>
          </div>
          <div className="p-2">
            {loading ? (
              <p className="text-sm text-slate-500 px-2 py-4">Cargando…</p>
            ) : spaces.length === 0 ? (
              <p className="text-sm text-slate-500 px-2 py-4">
                No hay espacios. Crea uno con «Nuevo espacio».
              </p>
            ) : (
              <ul className="space-y-0.5">
                {spaces.map((space) => (
                  <li key={space.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedSpaceId(space.id)}
                      className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                        selectedSpaceId === space.id
                          ? "bg-indigo-600 text-white"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <FolderOpen className="h-4 w-4 shrink-0" />
                      <span className="truncate">{space.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Páginas
            </h2>
            <button
              type="button"
              onClick={() => { setSaveError(null); setModalPage(true); }}
              disabled={!selectedSpaceId}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva página
            </button>
          </div>
          <div className="p-4">
            {!selectedSpaceId ? (
              <p className="text-sm text-slate-500">
                Selecciona un espacio para ver sus páginas.
              </p>
            ) : pages.length === 0 ? (
              <p className="text-sm text-slate-500">
                No hay páginas en este espacio. Crea una con «Nueva página».
              </p>
            ) : (
              <ul className="space-y-1">
                {pages.map((page) => (
                  <li key={page.id}>
                    <Link
                      href={`/knowledge/${page.id}`}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="font-medium">{page.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {modalSpace && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => !saving && setModalSpace(false)}
        >
          <div
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900">Nuevo espacio</h2>
            <form onSubmit={handleCreateSpace} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ej: Configuración SAP"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descripción (opcional)</label>
                <textarea
                  value={newSpaceDesc}
                  onChange={(e) => setNewSpaceDesc(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Breve descripción"
                  disabled={saving}
                />
              </div>
              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalSpace(false)}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !newSpaceName.trim()}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => !saving && setModalPage(false)}
        >
          <div
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900">Nueva página</h2>
            <form onSubmit={handleCreatePage} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Título *</label>
                <input
                  type="text"
                  value={newPageTitle}
                  onChange={(e) => setNewPageTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ej: Cómo configurar variante de valoración"
                  disabled={saving}
                />
              </div>
              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalPage(false)}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !newPageTitle.trim()}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
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
