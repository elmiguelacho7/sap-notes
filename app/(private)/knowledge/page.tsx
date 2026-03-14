"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FolderOpen, FileText, Search, MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { logSupabaseError } from "@/lib/logSupabaseError";
import {
  listSpaces,
  createSpace,
  listPages,
  createPage,
} from "@/lib/knowledgeService";
import type { KnowledgeSpace, KnowledgePage } from "@/lib/types/knowledge";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { ContentSkeleton } from "@/components/skeletons/ContentSkeleton";

export default function KnowledgePage() {
  const router = useRouter();
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
  const [askSapitoOpen, setAskSapitoOpen] = useState(false);

  const loadSpaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listSpaces(supabase, { projectId: null });
      setSpaces(list);
      if (list.length > 0 && !selectedSpaceId) {
        setSelectedSpaceId(list[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar espacios.");
      setSpaces([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSpaceId]);

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

  // Temporary: sanity ping to surface Supabase/RLS errors for knowledge_spaces
  useEffect(() => {
    (async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      console.log("Supabase URL hostname:", url ? new URL(url).hostname : "MISSING");

      const { data: _ping, error: pingError } = await supabase
        .from("knowledge_spaces")
        .select("id")
        .limit(1);
      if (pingError) {
        logSupabaseError("knowledge/page.tsx sanity ping knowledge_spaces", pingError);
      }
    })();
  }, []);

  const handleCreateSpace = async (e: FormEvent) => {
    e.preventDefault();
    const name = newSpaceName.trim();
    if (!name) return;
    setSaving(true);
    setSaveError(null);
    try {
      const space = await createSpace(supabase, {
        projectId: null,
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

  return (
    <PageShell wide>
      <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Knowledge</h1>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">
            Espacios y páginas de conocimiento global. Crea espacios, añade páginas y busca en todo el contenido.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="secondary" onClick={() => setAskSapitoOpen(true)}>
            <MessageCircle className="h-4 w-4" />
            Preguntar a Sapito
          </Button>
          <Link href="/knowledge/search">
            <Button variant="secondary">
              <Search className="h-4 w-4" />
              Buscar
            </Button>
          </Link>
          <Button variant="secondary" onClick={() => { setSaveError(null); setModalSpace(true); }}>
            <Plus className="h-4 w-4" />
            New Space
          </Button>
          <Button
            disabled={!selectedSpaceId}
            onClick={() => { setSaveError(null); setModalPage(true); }}
          >
            <Plus className="h-4 w-4" />
            New Page
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-slate-800 mb-1">Espacios y páginas</h2>
        <p className="text-xs text-slate-500 mb-4">Selecciona un espacio para ver sus páginas. Crea espacios y páginas desde los botones de arriba.</p>
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <Card className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-[320px]">
          <CardHeader className="border-b border-slate-200 bg-slate-50/80 px-5 py-4 shrink-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Spaces
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-1 min-h-0 flex flex-col">
            {loading ? (
              <ContentSkeleton title lines={4} />
            ) : spaces.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-slate-700">No hay espacios</p>
                <p className="mt-1 text-sm text-slate-500">Crea uno con «New Space».</p>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {spaces.map((space) => (
                  <li key={space.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedSpaceId(space.id)}
                      className={`w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                        selectedSpaceId === space.id
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <FolderOpen className="h-[18px] w-[18px] shrink-0" />
                      <span className="truncate">{space.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-[320px]">
          <CardHeader className="border-b border-slate-200 bg-slate-50/80 px-5 py-4 shrink-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pages
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 flex-1 min-h-0 flex flex-col">
            {!selectedSpaceId ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                <FolderOpen className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-700">Selecciona un espacio</p>
                <p className="mt-1 text-xs text-slate-500 max-w-xs">Elige un espacio de la lista para ver sus páginas.</p>
              </div>
            ) : pages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                <FileText className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-700">No hay páginas en este espacio</p>
                <p className="mt-1 text-xs text-slate-500 max-w-xs">Crea una con el botón «New Page».</p>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {pages.map((page) => (
                  <li key={page.id}>
                    <Link
                      href={`/knowledge/${page.id}`}
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <FileText className="h-[18px] w-[18px] shrink-0 text-slate-400" />
                      <span className="font-medium">{page.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      </section>
      </div>

      {askSapitoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAskSapitoOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Preguntar a Sapito</h2>
                <p className="text-xs text-slate-500">Asistente de conocimiento</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Pregunta a Sapito sobre tus fuentes de conocimiento ya integradas (Google Drive, fuentes web). Podrás consultar documentos y páginas desde aquí.
            </p>
            <p className="text-xs text-slate-500 mb-6">
              La implementación del asistente de IA llegará en una próxima fase. Por ahora puedes usar la búsqueda para encontrar contenido en Knowledge.
            </p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setAskSapitoOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {modalSpace && (
        <Modal onClose={() => !saving && setModalSpace(false)}>
          <form onSubmit={handleCreateSpace}>
            <ModalHeader>
              <ModalTitle>New Space</ModalTitle>
            </ModalHeader>
            <ModalBody className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
                <Input
                  type="text"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  placeholder="e.g. SAP Configuration"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description (optional)</label>
                <textarea
                  value={newSpaceDesc}
                  onChange={(e) => setNewSpaceDesc(e.target.value)}
                  rows={2}
                  className="h-auto w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-slate-400"
                  placeholder="Brief description"
                  disabled={saving}
                />
              </div>
              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="secondary" onClick={() => setModalSpace(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !newSpaceName.trim()}>
                {saving ? "Creating…" : "Create"}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {modalPage && (
        <Modal onClose={() => !saving && setModalPage(false)}>
          <form onSubmit={handleCreatePage}>
            <ModalHeader>
              <ModalTitle>New Page</ModalTitle>
            </ModalHeader>
            <ModalBody className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
                <Input
                  type="text"
                  value={newPageTitle}
                  onChange={(e) => setNewPageTitle(e.target.value)}
                  placeholder="e.g. How to configure variant valuation"
                  disabled={saving}
                />
              </div>
              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="secondary" onClick={() => setModalPage(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !newPageTitle.trim()}>
                {saving ? "Creating…" : "Create"}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </PageShell>
  );
}
