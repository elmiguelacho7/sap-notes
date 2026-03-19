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
  getPage,
  updatePage,
  deletePage,
} from "@/lib/knowledgeService";
import type { KnowledgeSpace, KnowledgePage } from "@/lib/types/knowledge";
import { PageDetailDrawer, type PageDetailPayload } from "@/components/knowledge/PageDetailDrawer";
import { KnowledgePageRow } from "@/components/knowledge/KnowledgePageRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { blockNoteDocumentToText } from "@/lib/knowledge/blockNoteToText";
import { getKnowledgeTemplateBlocks, type KnowledgeTemplateId } from "@/lib/knowledge/knowledgeTemplates";

export default function KnowledgeDocumentsPage() {
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
  const [newPageTemplateId, setNewPageTemplateId] = useState<KnowledgeTemplateId | "">("sap_procedure");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [askSapitoOpen, setAskSapitoOpen] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPageId, setDetailPageId] = useState<string | null>(null);
  const [detailPage, setDetailPage] = useState<KnowledgePage | null>(null);
  const [detailSaving, setDetailSaving] = useState(false);
  const [deleteConfirmPage, setDeleteConfirmPage] = useState<KnowledgePage | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
      setError(e instanceof Error ? e.message : "Error loading spaces.");
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

  useEffect(() => {
    (async () => {
      const { data: _ping, error: pingError } = await supabase
        .from("knowledge_spaces")
        .select("id")
        .limit(1);
      if (pingError) {
        logSupabaseError("knowledge/documents/page.tsx sanity ping knowledge_spaces", pingError);
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
      setSaveError(e instanceof Error ? e.message : "Error creating space.");
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
      const templateBlocks = newPageTemplateId
        ? getKnowledgeTemplateBlocks(newPageTemplateId)
        : null;
      const page = await createPage(supabase, selectedSpaceId, title, {
        content_json: templateBlocks ? { blocks: templateBlocks } : undefined,
        content_text: templateBlocks ? blockNoteDocumentToText(templateBlocks) : undefined,
      });
      setPages((prev) => [page, ...prev]);
      setNewPageTitle("");
      setNewPageTemplateId("sap_procedure");
      setModalPage(false);
      router.push(`/knowledge/pages/${page.id}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error creating page.");
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

  return (
    <div className="w-full min-w-0 bg-slate-950 px-4 sm:px-5 lg:px-6 xl:px-8 2xl:px-10 py-8">
      <div className="mx-auto w-full max-w-[1600px] space-y-6 sm:space-y-8">
        <header className="space-y-1">
          <Link
            href="/knowledge"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← Knowledge
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
                Spaces & Pages
              </h1>
              <p className="mt-1 text-sm text-slate-400 max-w-2xl">
                Create spaces and pages for structured knowledge. Use Search to find content across all documents.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                onClick={() => setAskSapitoOpen(true)}
                className="border-slate-600 bg-slate-800/80 text-slate-200 hover:bg-slate-700"
              >
                <MessageCircle className="h-4 w-4" />
                Sapito
              </Button>
              <Link href="/knowledge/search">
                <Button
                  variant="secondary"
                  className="border-slate-600 bg-slate-800/80 text-slate-200 hover:bg-slate-700"
                >
                  <Search className="h-4 w-4" />
                  Search
                </Button>
              </Link>
              <Button
                variant="secondary"
                onClick={() => { setSaveError(null); setModalSpace(true); }}
                className="border-slate-600 bg-slate-800/80 text-slate-200 hover:bg-slate-700"
              >
                <Plus className="h-4 w-4" />
                New space
              </Button>
              <Button
                disabled={!selectedSpaceId}
                onClick={() => { setSaveError(null); setModalPage(true); }}
                className="border-indigo-500/50 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                New page
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-500">
            <span>{spaces.length} {spaces.length === 1 ? "space" : "spaces"}</span>
            <span>{pages.length} {pages.length === 1 ? "page" : "pages"}</span>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <section>
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden flex flex-col min-h-[320px]">
              <div className="border-b border-slate-700/50 px-4 sm:px-5 py-4 shrink-0">
                <h2 className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Spaces
                </h2>
              </div>
              <div className="p-3 flex-1 min-h-0 flex flex-col">
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-11 w-full rounded-xl bg-slate-700/50" />
                    <Skeleton className="h-11 w-full rounded-xl bg-slate-700/50" />
                    <Skeleton className="h-11 w-4/5 rounded-xl bg-slate-700/50" />
                  </div>
                ) : spaces.length === 0 ? (
                  <div className="py-12 flex-1 flex flex-col items-center justify-center text-center rounded-xl bg-slate-800/20">
                    <FolderOpen className="w-10 h-10 text-slate-500 mb-3" />
                    <p className="text-sm font-medium text-slate-200">No spaces</p>
                    <p className="mt-1 text-xs text-slate-500">Create one with «New space».</p>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {spaces.map((space) => (
                      <li key={space.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedSpaceId(space.id)}
                          className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-medium transition-all duration-150 border ${
                            selectedSpaceId === space.id
                              ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-300"
                              : "border-transparent text-slate-300 hover:bg-slate-800/60"
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

            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-visible flex flex-col min-h-[320px]">
              <div className="border-b border-slate-700/50 px-4 sm:px-5 py-5 flex items-center justify-between gap-3 shrink-0">
                <div>
                  <h2 className="text-sm font-medium text-slate-100">Pages</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Manage and organize your documents</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSaveError(null); setModalPage(true); }}
                  disabled={!selectedSpaceId}
                  className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50 transition-colors shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  New page
                </button>
              </div>
              <div className="p-4 flex-1 min-h-0 flex flex-col">
                {!selectedSpaceId ? (
                  <div className="py-12 flex-1 flex flex-col items-center justify-center text-center rounded-xl bg-slate-800/20">
                    <FolderOpen className="w-10 h-10 text-slate-500 mb-3" />
                    <p className="text-sm font-medium text-slate-200">Select a space</p>
                    <p className="mt-1 text-xs text-slate-500 max-w-xs">Choose a space from the list to see its pages.</p>
                  </div>
                ) : pages.length === 0 ? (
                  <div className="py-12 flex-1 flex flex-col items-center justify-center text-center rounded-xl bg-slate-800/20">
                    <FileText className="w-10 h-10 text-slate-500 mb-3" />
                    <p className="text-sm font-medium text-slate-200">No pages yet</p>
                    <p className="text-xs text-slate-500 mb-4 max-w-xs">Create your first page to start documenting this space.</p>
                    <button
                      type="button"
                      onClick={() => { setSaveError(null); setModalPage(true); }}
                      className="mt-2 inline-flex items-center gap-2 rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      New page
                    </button>
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
                          showUpdated
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>
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
        context="global"
        spaceOptions={spaceOptions}
        fullEditorPath="/knowledge"
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
            <h2 className="text-lg font-semibold text-slate-100">Delete page</h2>
            <p className="mt-2 text-sm text-slate-400">
              Delete «{deleteConfirmPage.title}»? This can be undone later by restoring the page.
            </p>
            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={() => setDeleteConfirmPage(null)}
                disabled={deleteLoading}
                className="rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeletePage(deleteConfirmPage)}
                disabled={deleteLoading}
                className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-200 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
              >
                {deleteLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {askSapitoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAskSapitoOpen(false)}>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-xl max-w-md w-full ring-1 ring-slate-700/50" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Sapito</h2>
                <p className="text-xs text-slate-500">Knowledge assistant</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              Ask Sapito about your synced documentation. Use Search to open the chat.
            </p>
            <div className="flex justify-end">
              <Link href="/knowledge/search">
                <Button
                  variant="secondary"
                  onClick={() => setAskSapitoOpen(false)}
                  className="border-slate-600 bg-slate-800/80 text-slate-200 hover:bg-slate-700"
                >
                  Open Search
                </Button>
              </Link>
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
            <h2 className="text-lg font-semibold text-slate-100">New space</h2>
            <form onSubmit={handleCreateSpace} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Name *</label>
                <input
                  type="text"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  className="w-full rounded-xl border border-slate-600/80 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                  placeholder="e.g. SAP Configuration"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Description (optional)</label>
                <textarea
                  value={newSpaceDesc}
                  onChange={(e) => setNewSpaceDesc(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-600/80 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                  placeholder="Brief description"
                  disabled={saving}
                />
              </div>
              {saveError && <p className="text-sm text-red-400">{saveError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalSpace(false)}
                  disabled={saving}
                  className="rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !newSpaceName.trim()}
                  className="rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Creating…" : "Create"}
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
            <h2 className="text-lg font-semibold text-slate-100">New page</h2>
            <form onSubmit={handleCreatePage} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Title *</label>
                <input
                  type="text"
                  value={newPageTitle}
                  onChange={(e) => setNewPageTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-600/80 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                  placeholder="e.g. How to configure variant valuation"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Template (optional)
                </label>
                <select
                  value={newPageTemplateId}
                  onChange={(e) => setNewPageTemplateId(e.target.value as KnowledgeTemplateId | "")}
                  disabled={saving}
                  className="w-full rounded-xl border border-slate-600/80 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                >
                  <option value="">Blank</option>
                  <option value="sap_procedure">SAP Procedure</option>
                  <option value="sap_configuration">SAP Configuration</option>
                  <option value="troubleshooting_guide">Troubleshooting Guide</option>
                </select>
              </div>
              {saveError && <p className="text-sm text-red-400">{saveError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalPage(false)}
                  disabled={saving}
                  className="rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !newPageTitle.trim()}
                  className="rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
