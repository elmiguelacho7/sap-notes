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
import { FORM_PAGE_BLOCK_CLASS, FORM_PAGE_SHELL_CLASS } from "@/components/layout/formPageClasses";

type SpaceAccent = {
  key: "indigo" | "cyan" | "emerald" | "amber" | "rose" | "violet";
  selectedBg: string;
  selectedText: string;
  iconSelected: string;
  leftBorderUnselected: string;
  leftBorderSelected: string;
  ringSelected: string;
  pageBorder: string;
  pageBorderHover: string;
};

const SPACE_ACCENTS: SpaceAccent[] = [
  {
    key: "indigo",
    selectedBg: "bg-[rgb(var(--rb-brand-primary))]/8",
    selectedText: "text-[rgb(var(--rb-text-primary))]",
    iconSelected: "text-[rgb(var(--rb-brand-primary))]",
    leftBorderUnselected: "border-l-[rgb(var(--rb-surface-border))]/40",
    leftBorderSelected: "border-l-[rgb(var(--rb-brand-primary))]/40",
    ringSelected: "ring-[rgb(var(--rb-brand-ring))]/35",
    pageBorder: "border-l-[rgb(var(--rb-brand-primary))]/25 pl-2",
    pageBorderHover: "hover:border-l-[rgb(var(--rb-brand-primary))]/35",
  },
  {
    key: "cyan",
    selectedBg: "bg-[rgb(var(--rb-brand-primary))]/8",
    selectedText: "text-[rgb(var(--rb-text-primary))]",
    iconSelected: "text-[rgb(var(--rb-brand-primary))]",
    leftBorderUnselected: "border-l-[rgb(var(--rb-surface-border))]/40",
    leftBorderSelected: "border-l-[rgb(var(--rb-brand-primary))]/40",
    ringSelected: "ring-[rgb(var(--rb-brand-ring))]/35",
    pageBorder: "border-l-[rgb(var(--rb-brand-primary))]/25 pl-2",
    pageBorderHover: "hover:border-l-[rgb(var(--rb-brand-primary))]/35",
  },
  {
    key: "emerald",
    selectedBg: "bg-[rgb(var(--rb-brand-primary))]/8",
    selectedText: "text-[rgb(var(--rb-text-primary))]",
    iconSelected: "text-[rgb(var(--rb-brand-primary))]",
    leftBorderUnselected: "border-l-[rgb(var(--rb-surface-border))]/40",
    leftBorderSelected: "border-l-[rgb(var(--rb-brand-primary))]/40",
    ringSelected: "ring-[rgb(var(--rb-brand-ring))]/35",
    pageBorder: "border-l-[rgb(var(--rb-brand-primary))]/25 pl-2",
    pageBorderHover: "hover:border-l-[rgb(var(--rb-brand-primary))]/35",
  },
  {
    key: "amber",
    selectedBg: "bg-[rgb(var(--rb-brand-primary))]/8",
    selectedText: "text-[rgb(var(--rb-text-primary))]",
    iconSelected: "text-[rgb(var(--rb-brand-primary))]",
    leftBorderUnselected: "border-l-[rgb(var(--rb-surface-border))]/40",
    leftBorderSelected: "border-l-[rgb(var(--rb-brand-primary))]/40",
    ringSelected: "ring-[rgb(var(--rb-brand-ring))]/35",
    pageBorder: "border-l-[rgb(var(--rb-brand-primary))]/25 pl-2",
    pageBorderHover: "hover:border-l-[rgb(var(--rb-brand-primary))]/35",
  },
  {
    key: "rose",
    selectedBg: "bg-[rgb(var(--rb-brand-primary))]/8",
    selectedText: "text-[rgb(var(--rb-text-primary))]",
    iconSelected: "text-[rgb(var(--rb-brand-primary))]",
    leftBorderUnselected: "border-l-[rgb(var(--rb-surface-border))]/40",
    leftBorderSelected: "border-l-[rgb(var(--rb-brand-primary))]/40",
    ringSelected: "ring-[rgb(var(--rb-brand-ring))]/35",
    pageBorder: "border-l-[rgb(var(--rb-brand-primary))]/25 pl-2",
    pageBorderHover: "hover:border-l-[rgb(var(--rb-brand-primary))]/35",
  },
  {
    key: "violet",
    selectedBg: "bg-[rgb(var(--rb-brand-primary))]/8",
    selectedText: "text-[rgb(var(--rb-text-primary))]",
    iconSelected: "text-[rgb(var(--rb-brand-primary))]",
    leftBorderUnselected: "border-l-[rgb(var(--rb-surface-border))]/40",
    leftBorderSelected: "border-l-[rgb(var(--rb-brand-primary))]/40",
    ringSelected: "ring-[rgb(var(--rb-brand-ring))]/35",
    pageBorder: "border-l-[rgb(var(--rb-brand-primary))]/25 pl-2",
    pageBorderHover: "hover:border-l-[rgb(var(--rb-brand-primary))]/35",
  },
];

function hashAccent(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getSpaceAccent(spaceIdOrName: string | null | undefined): SpaceAccent {
  const basis = (spaceIdOrName ?? "").trim();
  const idx = SPACE_ACCENTS.length === 0 ? 0 : hashAccent(basis) % SPACE_ACCENTS.length;
  return SPACE_ACCENTS[idx] ?? SPACE_ACCENTS[0];
}

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
  const selectedAccent = selectedSpace ? getSpaceAccent(selectedSpace.id) : null;
  const spaceOptions = spaces.map((s) => ({ value: s.id, label: s.name }));

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentlyUpdatedCount = pages.filter((p) => new Date(p.updated_at) >= sevenDaysAgo).length;
  const publishedCount = pages.filter((p) => p.is_published).length;

  return (
    <div className={FORM_PAGE_SHELL_CLASS}>
      <div className="space-y-6">
        <div className={FORM_PAGE_BLOCK_CLASS}>
          <Link
            href="/knowledge"
            className="inline-flex items-center gap-1.5 text-xs text-[rgb(var(--rb-text-muted))] hover:text-[rgb(var(--rb-text-secondary))] transition-colors"
          >
            <span aria-hidden>←</span> Knowledge
          </Link>
        </div>

        <header className={`${FORM_PAGE_BLOCK_CLASS} flex items-start justify-between gap-4`}>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--rb-text-primary))]">
              Spaces & Pages
            </h1>
            <p className="mt-1 text-sm text-[rgb(var(--rb-text-muted))] max-w-3xl">
              Create spaces and pages for structured knowledge. Search finds content across all documents.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setAskSapitoOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-transparent px-4 py-2.5 text-sm font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface))]/70 transition-colors"
              title="Knowledge assistant"
            >
              <MessageCircle className="h-4 w-4" />
              Ask Sapito
            </button>
            <button
              type="button"
              onClick={() => {
                setSaveError(null);
                setModalSpace(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] px-4 py-2.5 text-sm font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface))]/80 transition-colors"
            >
              <Plus className="h-4 w-4 shrink-0" />
              New space
            </button>
            <button
              type="button"
              disabled={!selectedSpaceId}
              onClick={() => {
                setSaveError(null);
                setModalPage(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-transparent bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[rgb(var(--rb-brand-primary-hover))] active:bg-[rgb(var(--rb-brand-primary-active))] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4 shrink-0" />
              New page
            </button>
          </div>
        </header>

        <div className={`${FORM_PAGE_BLOCK_CLASS} grid grid-cols-2 gap-4 sm:grid-cols-4`}>
          <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] p-4 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">Spaces</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[rgb(var(--rb-text-primary))]">{spaces.length}</p>
          </div>
          <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] p-4 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">Pages</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[rgb(var(--rb-text-primary))]">{pages.length}</p>
          </div>
          <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] p-4 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">Recently updated (7d)</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[rgb(var(--rb-text-primary))]">{recentlyUpdatedCount}</p>
          </div>
          <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] p-4 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">Published</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[rgb(var(--rb-text-primary))]">{publishedCount}</p>
          </div>
        </div>

        <div className={`${FORM_PAGE_BLOCK_CLASS} flex flex-wrap gap-3 rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] p-3 shadow-sm`}>
          <Link
            href="/knowledge/search"
            className="relative block flex-1 min-w-[240px] rounded-md border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/20 transition-colors hover:bg-[rgb(var(--rb-surface-3))]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-primary))]/30"
          >
            <span className="sr-only">Search knowledge</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--rb-text-muted))]" />
            <span className="block w-full h-10 py-2 pl-9 pr-3 text-left text-sm text-[rgb(var(--rb-text-muted))]">
              Search knowledge…
            </span>
          </Link>
        </div>

        {error && (
          <div className={`${FORM_PAGE_BLOCK_CLASS} rounded-xl border border-red-200/90 bg-red-50 px-4 py-3 text-sm text-red-800`}>
            {error}
          </div>
        )}

        <section className={FORM_PAGE_BLOCK_CLASS}>
          <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6">
            <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] shadow-sm overflow-hidden flex flex-col min-h-[420px]">
              <div className="border-b border-[rgb(var(--rb-surface-border))]/60 px-4 sm:px-5 py-4 shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-[rgb(var(--rb-text-primary))]">Spaces</h2>
                  <span className="tabular-nums rounded-lg border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/40 px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--rb-text-muted))]">
                    {spaces.length}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[rgb(var(--rb-text-muted))]">Select a container for your pages.</p>
              </div>
              <div className="p-4 flex-1 min-h-0 flex flex-col">
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-11 w-full rounded-xl bg-[rgb(var(--rb-surface-3))]/45" />
                    <Skeleton className="h-11 w-full rounded-xl bg-[rgb(var(--rb-surface-3))]/45" />
                    <Skeleton className="h-11 w-4/5 rounded-xl bg-[rgb(var(--rb-surface-3))]/45" />
                  </div>
                ) : spaces.length === 0 ? (
                  <div className="py-12 flex-1 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/15">
                    <FolderOpen className="w-10 h-10 text-[rgb(var(--rb-text-muted))] mb-3" />
                    <p className="text-sm font-medium text-[rgb(var(--rb-text-primary))]">No spaces</p>
                    <p className="mt-1 text-xs text-[rgb(var(--rb-text-muted))]">Create one with “New space”.</p>
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {spaces.map((space) => (
                      <li key={space.id}>
                        {(() => {
                          const a = getSpaceAccent(space.id);
                          const isSelected = selectedSpaceId === space.id;
                          return (
                        <button
                          type="button"
                          onClick={() => setSelectedSpaceId(space.id)}
                          className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-medium transition-all duration-150 border border-[rgb(var(--rb-surface-border))]/60 border-l-2 shadow-[0_0_0_0_rgba(0,0,0,0)] hover:shadow-sm ${
                            isSelected
                              ? `bg-[rgb(var(--rb-brand-primary))]/8 border-[rgb(var(--rb-brand-primary))]/30 ring-1 ring-[rgb(var(--rb-brand-primary))]/15 ${a.leftBorderSelected} text-[rgb(var(--rb-text-primary))]`
                              : `text-[rgb(var(--rb-text-secondary))] ${a.leftBorderUnselected} hover:bg-[rgb(var(--rb-surface-3))]/25 hover:border-[rgb(var(--rb-surface-border))]/75`
                          }`}
                        >
                          <FolderOpen className={`h-4 w-4 shrink-0 ${isSelected ? "text-[rgb(var(--rb-brand-primary))]" : "text-[rgb(var(--rb-text-muted))]"}`} />
                          <span className="truncate leading-snug">{space.name}</span>
                        </button>
                          );
                        })()}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] shadow-sm overflow-hidden flex flex-col min-h-[420px]">
              <div className="border-b border-[rgb(var(--rb-surface-border))]/60 px-4 sm:px-5 py-4 shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-[rgb(var(--rb-text-primary))] tracking-tight">Pages</h2>
                {selectedAccent && selectedSpace ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2.5">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full bg-[rgb(var(--rb-brand-primary))] ring-1 ring-[rgb(var(--rb-brand-ring))]/35`}
                    />
                    <span
                      className="inline-flex max-w-full items-center truncate rounded-full border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/20 px-2 py-0.5 text-[11px] font-medium text-[rgb(var(--rb-text-secondary))]"
                    >
                      {selectedSpace.name}
                    </span>
                    <span className="tabular-nums rounded-lg border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/40 px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--rb-text-muted))]">
                      {pages.length}
                    </span>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-[rgb(var(--rb-text-muted))]">Choose a space to list its pages.</p>
                )}
                  </div>
                  <button
                    type="button"
                    disabled={!selectedSpaceId}
                    onClick={() => {
                      setSaveError(null);
                      setModalPage(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface))] px-3 py-2 text-sm font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-3))]/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-4 w-4" />
                    New page
                  </button>
                </div>
              </div>
              <div className="p-4 flex-1 min-h-0 flex flex-col">
                {!selectedSpaceId ? (
                  <div className="py-12 flex-1 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/15">
                    <FolderOpen className="w-9 h-9 text-[rgb(var(--rb-text-muted))] mb-3" />
                    <p className="text-sm font-semibold text-[rgb(var(--rb-text-primary))]">Select a space</p>
                    <p className="mt-1 text-xs text-[rgb(var(--rb-text-muted))] max-w-xs leading-relaxed">Choose a space from the left to browse its pages.</p>
                  </div>
                ) : pages.length === 0 ? (
                  <div className="py-12 flex-1 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-[rgb(var(--rb-surface-border))]/60 bg-[rgb(var(--rb-surface-3))]/15">
                    <FileText className="w-9 h-9 text-[rgb(var(--rb-text-muted))] mb-3" />
                    <p className="text-sm font-semibold text-[rgb(var(--rb-text-primary))]">No pages yet</p>
                    <p className="text-xs text-[rgb(var(--rb-text-muted))] mb-4 max-w-sm leading-relaxed">
                      Start documenting procedures, troubleshooting guides, configuration notes, and decisions for this space.
                    </p>
                    <button
                      type="button"
                      onClick={() => { setSaveError(null); setModalPage(true); }}
                      className="mt-2 inline-flex items-center gap-2 rounded-xl border border-transparent bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[rgb(var(--rb-brand-primary-hover))] active:bg-[rgb(var(--rb-brand-primary-active))]"
                    >
                      <Plus className="h-4 w-4" />
                      New page
                    </button>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {pages.map((page) => (
                      <li
                        key={page.id}
                        className={
                          selectedAccent
                            ? `border-l-2 border-[rgb(var(--rb-surface-border))]/60 ${selectedAccent.pageBorder} ${selectedAccent.pageBorderHover}`
                            : undefined
                        }
                      >
                        <KnowledgePageRow
                          page={page}
                          dark={false}
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => !deleteLoading && setDeleteConfirmPage(null)}
        >
          <div
            className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] p-6 shadow-xl max-w-md w-full ring-1 ring-[rgb(var(--rb-surface-border))]/40"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-[rgb(var(--rb-text-primary))]">Delete page</h2>
            <p className="mt-2 text-sm text-[rgb(var(--rb-text-muted))]">
              Delete «{deleteConfirmPage.title}»? This can be undone later by restoring the page.
            </p>
            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={() => setDeleteConfirmPage(null)}
                disabled={deleteLoading}
                className="rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] px-4 py-2.5 text-sm font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-3))]/25 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeletePage(deleteConfirmPage)}
                disabled={deleteLoading}
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-500/15 disabled:opacity-50 transition-colors"
              >
                {deleteLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {askSapitoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setAskSapitoOpen(false)}>
          <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] p-6 shadow-xl max-w-md w-full ring-1 ring-[rgb(var(--rb-surface-border))]/40" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-[rgb(var(--rb-brand-primary))]/10 flex items-center justify-center border border-[rgb(var(--rb-brand-primary))]/15">
                <MessageCircle className="h-5 w-5 text-[rgb(var(--rb-brand-primary))]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[rgb(var(--rb-text-primary))]">Sapito</h2>
                <p className="text-xs text-[rgb(var(--rb-text-muted))]">Knowledge assistant</p>
              </div>
            </div>
            <p className="text-sm text-[rgb(var(--rb-text-muted))] mb-6">
              Ask Sapito about your synced documentation. Use Search to open the chat.
            </p>
            <div className="flex justify-end">
              <Link href="/knowledge/search">
                <Button
                  variant="secondary"
                  onClick={() => setAskSapitoOpen(false)}
                  className="rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-3))]/25"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => !saving && setModalSpace(false)}
        >
          <div
            className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] p-6 shadow-xl max-w-md w-full ring-1 ring-[rgb(var(--rb-surface-border))]/40"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-[rgb(var(--rb-text-primary))]">New space</h2>
            <form onSubmit={handleCreateSpace} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--rb-text-secondary))] mb-1">Name *</label>
                <input
                  type="text"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  className="w-full h-10 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-3))]/20 px-3 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30"
                  placeholder="e.g. SAP Configuration"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--rb-text-secondary))] mb-1">Description (optional)</label>
                <textarea
                  value={newSpaceDesc}
                  onChange={(e) => setNewSpaceDesc(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30"
                  placeholder="Brief description"
                  disabled={saving}
                />
              </div>
              {saveError && <p className="text-sm text-rose-800 bg-rose-50 border border-rose-200/80 rounded-lg px-3 py-2">{saveError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalSpace(false)}
                  disabled={saving}
                  className="rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] px-4 py-2.5 text-sm font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-3))]/25 transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !newSpaceName.trim()}
                  className="rounded-xl border border-transparent bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[rgb(var(--rb-brand-primary-hover))] active:bg-[rgb(var(--rb-brand-primary-active))] disabled:opacity-50 transition-colors"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => !saving && setModalPage(false)}
        >
          <div
            className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] p-6 shadow-xl max-w-md w-full ring-1 ring-[rgb(var(--rb-surface-border))]/40"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-[rgb(var(--rb-text-primary))]">New page</h2>
            <form onSubmit={handleCreatePage} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--rb-text-secondary))] mb-1">Title *</label>
                <input
                  type="text"
                  value={newPageTitle}
                  onChange={(e) => setNewPageTitle(e.target.value)}
                  className="w-full h-10 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30"
                  placeholder="e.g. How to configure variant valuation"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--rb-text-secondary))] mb-1">
                  Template (optional)
                </label>
                <select
                  value={newPageTemplateId}
                  onChange={(e) => setNewPageTemplateId(e.target.value as KnowledgeTemplateId | "")}
                  disabled={saving}
                  className="w-full h-10 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-3))]/20 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-primary))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30"
                >
                  <option value="">Blank</option>
                  <option value="sap_procedure">SAP Procedure</option>
                  <option value="sap_configuration">SAP Configuration</option>
                  <option value="troubleshooting_guide">Troubleshooting Guide</option>
                </select>
              </div>
              {saveError && <p className="text-sm text-rose-800 bg-rose-50 border border-rose-200/80 rounded-lg px-3 py-2">{saveError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalPage(false)}
                  disabled={saving}
                  className="rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] px-4 py-2.5 text-sm font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-3))]/25 transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !newPageTitle.trim()}
                  className="rounded-xl border border-transparent bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[rgb(var(--rb-brand-primary-hover))] active:bg-[rgb(var(--rb-brand-primary-active))] disabled:opacity-50 transition-colors"
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
