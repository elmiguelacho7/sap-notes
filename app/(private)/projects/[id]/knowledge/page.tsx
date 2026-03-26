"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Plus, FolderOpen, FileText, Search } from "lucide-react";
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
import { Skeleton } from "@/components/ui/Skeleton";
import { PageDetailDrawer, type PageDetailPayload } from "@/components/knowledge/PageDetailDrawer";
import { KnowledgePageRow } from "@/components/knowledge/KnowledgePageRow";
import { blockNoteDocumentToText } from "@/lib/knowledge/blockNoteToText";
import { getKnowledgeTemplateBlocks, type KnowledgeTemplateId } from "@/lib/knowledge/knowledgeTemplates";
import { PROJECT_WORKSPACE_CARD_FRAME, PROJECT_WORKSPACE_PANEL_HEADER } from "@/lib/projectWorkspaceUi";

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
    selectedBg: "bg-[rgb(var(--rb-brand-surface))]",
    selectedText: "text-[rgb(var(--rb-brand-primary-active))]",
    iconSelected: "text-[rgb(var(--rb-brand-primary-active))]",
    leftBorderUnselected: "border-l-[rgb(var(--rb-brand-primary))]/10",
    leftBorderSelected: "border-l-[rgb(var(--rb-brand-primary))]/35",
    ringSelected: "ring-[rgb(var(--rb-brand-primary))]/22",
    pageBorder: "border-l-[rgb(var(--rb-brand-primary))]/20 pl-2",
    pageBorderHover: "hover:border-l-[rgb(var(--rb-brand-primary))]/35",
  },
  {
    key: "cyan",
    selectedBg: "bg-sky-50",
    selectedText: "text-sky-800",
    iconSelected: "text-sky-600",
    leftBorderUnselected: "border-l-sky-200",
    leftBorderSelected: "border-l-sky-400",
    ringSelected: "ring-sky-200",
    pageBorder: "border-l-sky-300 pl-2",
    pageBorderHover: "hover:border-l-sky-400",
  },
  {
    key: "emerald",
    selectedBg: "bg-emerald-50",
    selectedText: "text-emerald-800",
    iconSelected: "text-emerald-600",
    leftBorderUnselected: "border-l-emerald-200",
    leftBorderSelected: "border-l-emerald-400",
    ringSelected: "ring-emerald-200",
    pageBorder: "border-l-emerald-300 pl-2",
    pageBorderHover: "hover:border-l-emerald-400",
  },
  {
    key: "amber",
    selectedBg: "bg-amber-50",
    selectedText: "text-amber-900",
    iconSelected: "text-amber-700",
    leftBorderUnselected: "border-l-amber-200",
    leftBorderSelected: "border-l-amber-400",
    ringSelected: "ring-amber-200",
    pageBorder: "border-l-amber-300 pl-2",
    pageBorderHover: "hover:border-l-amber-400",
  },
  {
    key: "rose",
    selectedBg: "bg-rose-50",
    selectedText: "text-rose-800",
    iconSelected: "text-rose-600",
    leftBorderUnselected: "border-l-rose-200",
    leftBorderSelected: "border-l-rose-400",
    ringSelected: "ring-rose-200",
    pageBorder: "border-l-rose-300 pl-2",
    pageBorderHover: "hover:border-l-rose-400",
  },
  {
    key: "violet",
    selectedBg: "bg-violet-50",
    selectedText: "text-violet-800",
    iconSelected: "text-violet-600",
    leftBorderUnselected: "border-l-violet-200",
    leftBorderSelected: "border-l-violet-400",
    ringSelected: "ring-violet-200",
    pageBorder: "border-l-violet-300 pl-2",
    pageBorderHover: "hover:border-l-violet-400",
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

export default function ProjectKnowledgePage() {
  const t = useTranslations("knowledge");
  const locale = useLocale();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
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
  const [newPageTemplateId, setNewPageTemplateId] = useState<KnowledgeTemplateId | "">("sap_procedure");
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
      setError(e instanceof Error ? e.message : t("errors.loadSpaces"));
      setSpaces([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedSpaceId, t]);

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
      setSaveError(e instanceof Error ? e.message : t("errors.createSpace"));
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
      const templateBlocks = newPageTemplateId ? getKnowledgeTemplateBlocks(newPageTemplateId) : null;
      const page = await createPage(supabase, selectedSpaceId, title, {
        content_json: templateBlocks ? { blocks: templateBlocks } : undefined,
        content_text: templateBlocks ? blockNoteDocumentToText(templateBlocks) : undefined,
      });
      setPages((prev) => [page, ...prev]);
      setNewPageTitle("");
      setNewPageTemplateId("sap_procedure");
      setModalPage(false);
      setDetailPageId(page.id);
      setDetailOpen(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t("errors.createPage"));
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

  if (!projectId) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <p className="text-sm text-slate-500">{t("errors.invalidProjectId")}</p>
      </div>
    );
  }

  const lastUpdatedPage = pages.length > 0
    ? pages.reduce((a, b) => (new Date(b.updated_at) > new Date(a.updated_at) ? b : a))
    : null;

  return (
    <div className="w-full min-w-0 flex flex-col gap-6 min-h-0 h-full">
      <div className="shrink-0 rounded-2xl border border-slate-200/85 bg-white p-5 sm:p-6 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between min-w-0">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{t("page.eyebrow")}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t("page.title")}</h1>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              {t("page.subtitle")}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch sm:justify-end shrink-0">
            <button
              type="button"
              disabled={!selectedSpaceId}
              onClick={() => {
                setSaveError(null);
                setModalPage(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl rb-btn-primary px-4 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4 shrink-0" />
              {t("page.newPage")}
            </button>
            <button
              type="button"
              onClick={() => {
                setSaveError(null);
                setModalSpace(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/25 focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4 shrink-0" />
              {t("page.newSpace")}
            </button>
          </div>
        </div>
      </div>

      <div className="shrink-0 rounded-2xl border border-slate-200/85 bg-white p-4 sm:p-5 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 min-w-0">
            <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
              {t("stats.spaces", { count: spaces.length })}
            </span>
            <span className="text-[11px] uppercase tracking-wide text-slate-500">
              {t("stats.pages", { count: pages.length })}
            </span>
            {lastUpdatedPage && (
              <span className="text-xs text-slate-500">
                {t("stats.lastUpdated")}{" "}
                <span className="tabular-nums text-slate-600">
                  {new Date(lastUpdatedPage.updated_at).toLocaleDateString(localeTag, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </span>
            )}
          </div>
          <Link
            href={`/projects/${projectId}/search`}
            className="inline-flex w-full lg:w-auto shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <Search className="h-4 w-4 text-slate-400 shrink-0" aria-hidden />
            {t("page.searchKnowledge")}
          </Link>
        </div>
      </div>

      {error && (
        <div className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* md+: bounded height so panel lists scroll internally; mobile: natural stack + page scroll */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-3 md:h-[max(20rem,calc(100dvh-17rem))] md:max-h-[calc(100dvh-17rem)]">
        <div className={`${PROJECT_WORKSPACE_CARD_FRAME} flex flex-col h-full min-h-0 overflow-hidden`}>
          <div className={`${PROJECT_WORKSPACE_PANEL_HEADER} shrink-0`}>
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("panels.spaces.title")}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{t("panels.spaces.subtitle")}</p>
          </div>
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-11 w-full rounded-xl" />
                  <Skeleton className="h-11 w-full rounded-xl" />
                  <Skeleton className="h-11 w-4/5 rounded-xl" />
                </div>
              ) : spaces.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200/90 bg-slate-50/50 py-10 px-4 text-center">
                  <FolderOpen className="h-9 w-9 text-slate-600" aria-hidden />
                  <p className="mt-3 text-sm font-semibold tracking-tight text-slate-900">{t("empty.noSpaces.title")}</p>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed max-w-[220px]">
                    {t("empty.noSpaces.description")}
                  </p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {spaces.map((space) => (
                    <li key={space.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedSpaceId(space.id)}
                        className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-medium transition-colors duration-150 border border-slate-200/90 border-l-2 ${
                          selectedSpaceId === space.id
                            ? (() => {
                                const a = getSpaceAccent(space.id);
                                return `${a.selectedBg} ${a.selectedText} ring-1 ${a.ringSelected} ${a.leftBorderSelected}`;
                              })()
                            : (() => {
                                const a = getSpaceAccent(space.id);
                                return `text-slate-700 hover:bg-slate-50 ${a.leftBorderUnselected}`;
                              })()
                        }`}
                      >
                        {(() => {
                          const a = getSpaceAccent(space.id);
                          const isSelected = selectedSpaceId === space.id;
                          return <FolderOpen className={`h-4 w-4 shrink-0 ${isSelected ? a.iconSelected : "text-slate-400"}`} />;
                        })()}
                        <span className="truncate">{space.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className={`md:col-span-2 ${PROJECT_WORKSPACE_CARD_FRAME} flex flex-col h-full min-h-0 overflow-hidden`}>
          <div className={`${PROJECT_WORKSPACE_PANEL_HEADER} shrink-0`}>
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("panels.pages.title")}</h2>
            {selectedAccent && selectedSpace ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${selectedAccent.selectedBg} ring-1 ${selectedAccent.ringSelected}`}
                />
                <span
                  className={`inline-flex max-w-full items-center truncate rounded-full border border-slate-200/90 bg-white px-2 py-0.5 text-[11px] font-medium ${selectedAccent.selectedText}`}
                >
                  {selectedSpace.name}
                </span>
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-500">{t("panels.pages.selectSpaceHint")}</p>
            )}
          </div>
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
              {!selectedSpaceId ? (
                <div className="rounded-xl border border-dashed border-slate-200/90 bg-slate-50/50 py-10 px-4 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-400 shadow-sm ring-1 ring-slate-100 mx-auto">
                    <FileText className="h-7 w-7" aria-hidden />
                  </div>
                  <p className="mt-4 text-base font-semibold tracking-tight text-slate-900">{t("empty.selectSpace.title")}</p>
                  <p className="mt-1.5 max-w-md text-sm text-slate-600 leading-relaxed">
                    {t("empty.selectSpace.description")}
                  </p>
                </div>
              ) : pages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200/90 bg-slate-50/50 py-10 px-4 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-400 shadow-sm ring-1 ring-slate-100 mx-auto">
                    <FileText className="h-7 w-7" aria-hidden />
                  </div>
                  <p className="mt-4 text-base font-semibold tracking-tight text-slate-900">{t("empty.spaceEmpty.title")}</p>
                  <p className="mt-1.5 max-w-md text-sm text-slate-600 leading-relaxed">
                    {t("empty.spaceEmpty.description")}
                  </p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {pages.map((page) => (
                    <li
                      key={page.id}
                      className={
                        selectedAccent
                          ? `border-l-2 border-slate-700/50 ${selectedAccent.pageBorder} ${selectedAccent.pageBorderHover}`
                          : undefined
                      }
                    >
                      <KnowledgePageRow
                        page={page}
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40"
          onClick={() => !deleteLoading && setDeleteConfirmPage(null)}
        >
          <div
            className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl max-w-md w-full ring-1 ring-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900">{t("delete.title")}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {t("delete.confirmBody", { title: deleteConfirmPage.title })}
            </p>
            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={() => setDeleteConfirmPage(null)}
                disabled={deleteLoading}
                className="rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => handleDeletePage(deleteConfirmPage)}
                disabled={deleteLoading}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                {deleteLoading ? t("delete.deleting") : t("delete.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalSpace && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40"
          onClick={() => !saving && setModalSpace(false)}
        >
          <div
            className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl max-w-md w-full ring-1 ring-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900">{t("modals.newSpace.title")}</h2>
            <form onSubmit={handleCreateSpace} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("modals.newSpace.nameLabel")}</label>
                <input
                  type="text"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30"
                  placeholder={t("modals.newSpace.namePlaceholder")}
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("modals.newSpace.descriptionLabel")}</label>
                <textarea
                  value={newSpaceDesc}
                  onChange={(e) => setNewSpaceDesc(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30"
                  placeholder={t("modals.newSpace.descriptionPlaceholder")}
                  disabled={saving}
                />
              </div>
              {saveError && <p className="text-sm text-red-700">{saveError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalSpace(false)}
                  disabled={saving}
                  className="rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving || !newSpaceName.trim()}
                  className="rounded-xl rb-btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {saving ? t("common.creating") : t("common.create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalPage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40"
          onClick={() => !saving && setModalPage(false)}
        >
          <div
            className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl max-w-md w-full ring-1 ring-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900">{t("modals.newPage.title")}</h2>
            <form onSubmit={handleCreatePage} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("modals.newPage.titleLabel")}</label>
                <input
                  type="text"
                  value={newPageTitle}
                  onChange={(e) => setNewPageTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30"
                  placeholder={t("modals.newPage.titlePlaceholder")}
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t("modals.newPage.templateLabel")}
                </label>
                <select
                  value={newPageTemplateId}
                  onChange={(e) => setNewPageTemplateId(e.target.value as KnowledgeTemplateId | "")}
                  disabled={saving}
                  className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/30 focus:border-[rgb(var(--rb-brand-primary))]/30"
                >
                  <option value="">{t("templates.blank")}</option>
                  <option value="sap_procedure">{t("templates.sapProcedure")}</option>
                  <option value="sap_configuration">{t("templates.sapConfiguration")}</option>
                  <option value="troubleshooting_guide">{t("templates.troubleshootingGuide")}</option>
                </select>
              </div>
              {saveError && <p className="text-sm text-red-700">{saveError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalPage(false)}
                  disabled={saving}
                  className="rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving || !newPageTitle.trim()}
                  className="rounded-xl rb-btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {saving ? t("common.creating") : t("common.create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
