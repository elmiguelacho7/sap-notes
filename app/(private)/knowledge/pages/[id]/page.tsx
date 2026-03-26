"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getPage, getSpace, updatePage } from "@/lib/knowledgeService";
import { getPageGraph, syncKnowledgePageLinks } from "@/lib/knowledgeGraphService";
import type { KnowledgeBlock } from "@/lib/types/knowledge";
import type { KnowledgePage } from "@/lib/types/knowledge";
import { KnowledgePageEditor } from "@/components/knowledge/KnowledgePageEditor";
import { AppPageShell } from "@/components/ui/layout/AppPageShell";
import type { BlockNoteBlock } from "@/lib/knowledge/blockNoteToText";

/** Initial BlockNote content: from page.content_json or legacy first block. */
function getBlocksFromContentJson(contentJson: unknown): BlockNoteBlock[] | null {
  if (Array.isArray(contentJson)) return contentJson as BlockNoteBlock[];
  if (
    contentJson != null &&
    typeof contentJson === "object" &&
    Array.isArray((contentJson as { blocks?: unknown }).blocks)
  ) {
    return (contentJson as { blocks: BlockNoteBlock[] }).blocks;
  }
  return null;
}

function getInitialContent(page: KnowledgePage, blocks: KnowledgeBlock[]): BlockNoteBlock[] | null {
  const fromPage = getBlocksFromContentJson(page.content_json);
  if (fromPage) return fromPage;
  const first = blocks[0];
  if (!first?.content_json || typeof first.content_json !== "object") return null;
  return getBlocksFromContentJson(first.content_json);
}

function getImageUrls(blocks: BlockNoteBlock[] | null | undefined): string[] {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .filter((b) => b?.type === "image")
    .map((b) => {
      const srcFromProps = typeof b?.props?.src === "string" ? (b.props.src as string) : null;
      const srcFromPropsUrl = typeof b?.props?.url === "string" ? (b.props.url as string) : null;
      const contentObj = b?.content as { src?: unknown; url?: unknown } | undefined;
      const srcFromContent = typeof contentObj?.src === "string" ? contentObj.src : null;
      const srcFromContentUrl = typeof contentObj?.url === "string" ? contentObj.url : null;
      return srcFromProps ?? srcFromPropsUrl ?? srcFromContent ?? srcFromContentUrl ?? "";
    })
    .filter((u) => u.length > 0);
}

function extractInternalKnowledgeReferencePageIds(blocks: BlockNoteBlock[] | null | undefined): string[] {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .filter((b) => {
      if (b?.type !== "blockquote") return false;
      const variant = (b.props?.variant as string | undefined) ?? null;
      if (variant !== "knowledge_reference") return false;
      return typeof b.props?.page_id === "string" && b.props.page_id.length > 0;
    })
    .map((b) => b.props!.page_id as string);
}

export default function KnowledgePageEditorPage() {
  const params = useParams();
  const pageId = typeof params.id === "string" ? params.id : null;
  const [title, setTitle] = useState("");
  const [initialBlocks, setInitialBlocks] = useState<BlockNoteBlock[] | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const lastSyncedReferencesKeyRef = useRef<string>("");
  const [graph, setGraph] = useState<{ nodes: { id: string; title: string }[]; edges: { from_page_id: string; to_page_id: string; link_type: string }[] }>({ nodes: [], edges: [] });
  const isDev = process.env.NODE_ENV !== "production";

  useEffect(() => {
    if (!pageId) {
      setLoading(false);
      setError("Missing page id");
      return;
    }
    let cancelled = false;
    getPage(supabase, pageId)
      .then(({ page, blocks }) => {
        if (cancelled) return;
        setTitle(page.title);
        const initial = getInitialContent(page, blocks);
        setInitialBlocks(initial);
        if (isDev) {
          console.debug("[Knowledge pages load payload]", {
            source: getBlocksFromContentJson(page.content_json) ? "knowledge_pages.content_json" : "legacy_knowledge_blocks",
            imageCount: getImageUrls(initial).length,
            images: getImageUrls(initial),
          });
        }
        if (page.space_id) {
          getSpace(supabase, page.space_id)
            .then((space) => {
              if (!cancelled) setProjectId(space?.project_id ?? null);
            })
            .catch(() => {
              if (!cancelled) setProjectId(null);
            });
        } else {
          setProjectId(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load page");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [pageId]);

  useEffect(() => {
    if (!pageId) return;
    getPageGraph(supabase, pageId).then(setGraph).catch(() => setGraph({ nodes: [], edges: [] }));
  }, [pageId]);

  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
  }, []);

  const handleSave = useCallback(
    (payload: { title: string; content_json: BlockNoteBlock[]; content_text: string }) => {
      if (!pageId) return;
      setSaveError(null);
      const referencedPageIds = extractInternalKnowledgeReferencePageIds(payload.content_json);
      const referencesKey = JSON.stringify(Array.from(new Set(referencedPageIds)).sort());

      updatePage(supabase, pageId, {
        title: payload.title,
        content_json: { blocks: payload.content_json },
        content_text: payload.content_text || null,
      })
        .then(async () => {
          if (!isDev) return;
          console.debug("[Knowledge pages save outgoing payload]", {
            title: payload.title,
            content_json: payload.content_json,
            content_text: payload.content_text,
            imageCount: getImageUrls(payload.content_json).length,
            images: getImageUrls(payload.content_json),
          });
          const { data: readBack, error: readBackError } = await supabase
            .from("knowledge_pages")
            .select("id, content_json")
            .eq("id", pageId)
            .single();
          if (readBackError) {
            console.error("[Knowledge pages save readback] failed", readBackError);
            return;
          }
          const storedBlocks = getBlocksFromContentJson(
            (readBack as { content_json?: unknown } | null)?.content_json
          );
          console.debug("[Knowledge pages save readback]", {
            imageCount: getImageUrls(storedBlocks).length,
            images: getImageUrls(storedBlocks),
            content_json: (readBack as { content_json?: unknown } | null)?.content_json ?? null,
          });

          if (referencesKey !== lastSyncedReferencesKeyRef.current) {
            lastSyncedReferencesKeyRef.current = referencesKey;
            await syncKnowledgePageLinks(supabase, pageId, referencedPageIds).catch((e) => {
              if (isDev) console.error("[Knowledge link sync error]", e);
            });
          }
        })
        .catch((e) => {
          setSaveError(e instanceof Error ? e.message : "Error al guardar.");
        });
    },
    [isDev, pageId]
  );

  if (loading) {
    return (
      <div className="bg-[rgb(var(--rb-shell-bg))] min-h-full">
        <AppPageShell>
          <div className="py-12 text-center text-slate-600">Loading…</div>
        </AppPageShell>
      </div>
    );
  }

  if (error || !pageId) {
    return (
      <div className="bg-[rgb(var(--rb-shell-bg))] min-h-full">
        <AppPageShell>
          <div className="rounded-xl border border-slate-200/90 bg-white p-6 text-center shadow-sm ring-1 ring-slate-100">
            <p className="text-slate-900 font-medium">{error ?? "Page not found"}</p>
            <Link
              href="/knowledge/documents"
              className="mt-4 inline-block text-sm font-medium text-[rgb(var(--rb-brand-primary-active))] hover:text-[rgb(var(--rb-brand-primary-hover))]"
            >
              ← Back to Spaces & Pages
            </Link>
          </div>
        </AppPageShell>
      </div>
    );
  }

  return (
    <div className="bg-[rgb(var(--rb-shell-bg))] min-h-full">
      <AppPageShell>
        <div className="w-full px-0">
          <nav className="mb-4">
            <Link
              href="/knowledge/documents"
              className="text-xs text-slate-500 hover:text-slate-900 transition-colors inline-flex items-center gap-2"
            >
              <span aria-hidden>←</span>
              Spaces & Pages
            </Link>
          </nav>
          {saveError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm ring-1 ring-red-100">
              {saveError}
            </div>
          )}

          <KnowledgePageEditor
            pageId={pageId}
            projectId={projectId}
            title={title}
            onTitleChange={handleTitleChange}
            initialContent={initialBlocks}
            onSave={handleSave}
            debounceMs={800}
            editable
            viewGraphHref={pageId ? `/knowledge/${pageId}/graph` : undefined}
          />

          {/* Backlinks: pages that link to this one */}
          <div className="mt-12 pt-5 border-t border-slate-200/90">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 mb-3">
              Linked from
            </h2>
            {graph.edges.filter((e) => e.to_page_id === pageId).length === 0 ? (
              <p className="text-sm text-slate-600">Nadie enlaza esta página todavía.</p>
            ) : (
              <ul className="space-y-1">
                {graph.edges
                  .filter((e) => e.to_page_id === pageId)
                  .map((edge, i) => {
                    const otherId = edge.from_page_id;
                    const otherTitle = graph.nodes.find((n) => n.id === otherId)?.title ?? otherId;
                    return (
                      <li key={`${edge.from_page_id}-${edge.to_page_id}-${edge.link_type}-${i}`}>
                        <Link
                          href={`/knowledge/${otherId}${projectId ? `?projectId=${projectId}` : ""}`}
                          className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <span className="font-medium truncate flex-1 min-w-0">{otherTitle}</span>
                          <span className="rounded-md border border-[rgb(var(--rb-brand-primary))]/22 bg-[rgb(var(--rb-brand-surface))] text-[rgb(var(--rb-brand-primary-active))] px-2 py-0.5 text-[11px] shrink-0">
                            {edge.link_type.replace(/_/g, " ")}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        </div>
      </AppPageShell>
    </div>
  );
}
