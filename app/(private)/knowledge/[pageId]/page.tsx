"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getKnowledgeListHref } from "@/lib/routes";
import {
  ChevronLeft,
  Network,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getPage, getSpace, updatePage, upsertBlocks } from "@/lib/knowledgeService";
import { getPageGraph, syncKnowledgePageLinks } from "@/lib/knowledgeGraphService";
import type { KnowledgePage, KnowledgeSpace, KnowledgeBlock } from "@/lib/types/knowledge";
import type { BlockNoteBlock } from "@/lib/knowledge/blockNoteToText";
import { KnowledgePageEditor } from "@/components/knowledge/KnowledgePageEditor";
import { Badge } from "@/components/ui/Badge";

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

function getInitialContent(page: KnowledgePage | null, blocks: KnowledgeBlock[]): BlockNoteBlock[] | null {
  const fromPage = getBlocksFromContentJson(page?.content_json);
  if (fromPage) return fromPage;
  const first = blocks[0];
  if (!first?.content_json || typeof first.content_json !== "object") return null;
  return getBlocksFromContentJson(first.content_json);
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

export default function KnowledgePageDetail() {
  const params = useParams<{ pageId: string }>();
  const searchParams = useSearchParams();
  const pageId = params?.pageId as string | undefined;
  const projectIdFromQuery = searchParams?.get("projectId") ?? null;
  const knowledgeListHref = getKnowledgeListHref(projectIdFromQuery);

  const [page, setPage] = useState<KnowledgePage | null>(null);
  const [blocks, setBlocks] = useState<KnowledgeBlock[]>([]);
  const [title, setTitle] = useState("");
  const [initialBlocks, setInitialBlocks] = useState<BlockNoteBlock[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const lastSyncedReferencesKeyRef = useRef<string>("");
  const [graph, setGraph] = useState<{ nodes: { id: string; title: string }[]; edges: { from_page_id: string; to_page_id: string; link_type: string }[] }>({ nodes: [], edges: [] });
  const [space, setSpace] = useState<KnowledgeSpace | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const backToListHref = getKnowledgeListHref(projectIdFromQuery ?? space?.project_id);

  const isDev = process.env.NODE_ENV !== "production";

  const logWriteFailure = useCallback(
    (label: string, err: unknown) => {
      const e = err as Error & {
        supabase?: { code?: string; message?: string; details?: string; hint?: string; status?: number };
        table?: string;
        operation?: string;
      };
      if (isDev) {
        console.error("[Knowledge save write failure]", {
          label,
          table: e?.table,
          operation: e?.operation,
          code: e?.supabase?.code,
          message: e?.supabase?.message ?? e?.message,
          details: e?.supabase?.details,
          hint: e?.supabase?.hint,
          status: e?.supabase?.status,
        });
      }
      const human = e?.supabase?.message ?? e?.message ?? "Error al guardar.";
      const op = e?.operation ? `${e.operation}` : null;
      const table = e?.table ? `${e.table}` : null;
      if (isDev && (op || table)) {
        setSaveError(`${human}${table ? ` [table: ${table}]` : ""}${op ? ` [op: ${op}]` : ""}`);
      } else {
        setSaveError(human);
      }
    },
    [isDev]
  );

  const load = useCallback(async () => {
    if (!pageId) return;
    setLoading(true);
    setError(null);
    try {
      const { page: p, blocks: b } = await getPage(supabase, pageId);
      setPage(p);
      setBlocks(b);
      setTitle(p.title);
      const initial = getInitialContent(p, b);
      setInitialBlocks(initial);
      if (isDev) {
        console.debug("[Knowledge load payload]", {
          source: p?.content_json ? "knowledge_pages.content_json" : "legacy_knowledge_blocks",
          imageCount: getImageUrls(initial).length,
          images: getImageUrls(initial),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar la página.");
      setPage(null);
      setBlocks([]);
      setTitle("");
      setInitialBlocks(null);
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!pageId) return;
    getPageGraph(supabase, pageId).then(setGraph).catch(() => setGraph({ nodes: [], edges: [] }));
  }, [pageId]);

  useEffect(() => {
    if (!page?.space_id) {
      setSpace(null);
      setProjectName(null);
      return;
    }
    let cancelled = false;
    getSpace(supabase, page.space_id)
      .then((s) => {
        if (cancelled || !s) return;
        setSpace(s);
        if (s.project_id) {
          supabase
            .from("projects")
            .select("name")
            .eq("id", s.project_id)
            .single()
            .then(
              ({ data }) => {
                if (!cancelled) setProjectName((data as { name?: string } | null)?.name ?? null);
              },
              () => {
                if (!cancelled) setProjectName(null);
              }
            );
        } else {
          setProjectName(null);
        }
      })
      .catch(() => { if (!cancelled) setSpace(null); setProjectName(null); });
    return () => { cancelled = true; };
  }, [page?.space_id]);

  const handleSave = useCallback(
    async (payload: { title: string; content_json: BlockNoteBlock[]; content_text: string }) => {
      if (!pageId) return;
      setSaveError(null);
      const referencedPageIds = extractInternalKnowledgeReferencePageIds(payload.content_json);
      const referencesKey = JSON.stringify(Array.from(new Set(referencedPageIds)).sort());

      if (isDev) {
        const imageUrls = getImageUrls(payload.content_json);
        console.debug("[Knowledge save] write attempt", {
          table: "knowledge_pages",
          operation: "update",
          hasContentJson: true,
          hasContentText: true,
          imageCount: imageUrls.length,
          images: imageUrls,
        });
      }
      try {
        await updatePage(supabase, pageId, {
          title: payload.title,
          content_json: { blocks: payload.content_json },
          content_text: payload.content_text || null,
        });
        if (isDev) {
          console.debug("[Knowledge save outgoing payload]", {
            title: payload.title,
            content_json: payload.content_json,
            content_text: payload.content_text,
            imageCount: getImageUrls(payload.content_json).length,
            images: getImageUrls(payload.content_json),
          });
          const { data: readBack, error: readBackError } = await supabase
            .from("knowledge_pages")
            .select("id, content_json, content_text")
            .eq("id", pageId)
            .single();
          if (readBackError) {
            console.error("[Knowledge save readback] failed", readBackError);
          } else {
            const storedBlocks = getBlocksFromContentJson(
              (readBack as { content_json?: unknown } | null)?.content_json
            );
            console.debug("[Knowledge save readback]", {
              imageCount: getImageUrls(storedBlocks).length,
              images: getImageUrls(storedBlocks),
              content_json: (readBack as { content_json?: unknown } | null)?.content_json ?? null,
            });
          }
        }

        // Sync backlinks source-of-truth (Phase 1).
        if (referencesKey !== lastSyncedReferencesKeyRef.current) {
          lastSyncedReferencesKeyRef.current = referencesKey;
          await syncKnowledgePageLinks(supabase, pageId, referencedPageIds).catch((err) => {
            if (isDev) console.error("[Knowledge link sync error]", err);
          });
        }
      } catch (e) {
        logWriteFailure("primary_updatePage", e);
        const msg = e instanceof Error ? e.message : "Error al guardar.";
        const looksLikeMissingColumn =
          msg.toLowerCase().includes("content_json") && msg.toLowerCase().includes("knowledge_pages");

        if (looksLikeMissingColumn) {
          // Backward-safe fallback for environments where knowledge_pages.content_json/content_text
          // has not been applied yet: persist through legacy knowledge_blocks.
          try {
            if (isDev) {
              console.debug("[Knowledge save] fallback write attempt", {
                table: "knowledge_pages",
                operation: "update",
                payload: "title-only",
              });
            }
            await updatePage(supabase, pageId, {
              title: payload.title,
            });
            if (isDev) {
              console.debug("[Knowledge save] fallback write attempt", {
                table: "knowledge_blocks",
                operation: "insert/update/delete via upsertBlocks",
              });
            }
            await upsertBlocks(supabase, pageId, [
              {
                block_type: "rich_text",
                content_json: { blocks: payload.content_json },
                sort_order: 0,
              },
            ]);

            if (referencesKey !== lastSyncedReferencesKeyRef.current) {
              lastSyncedReferencesKeyRef.current = referencesKey;
              await syncKnowledgePageLinks(supabase, pageId, referencedPageIds).catch((err) => {
                if (isDev) console.error("[Knowledge link sync error]", err);
              });
            }
            return;
          } catch (fallbackError) {
            logWriteFailure("fallback_upsertBlocks", fallbackError);
            return;
          }
        }
      }
    },
    [isDev, logWriteFailure, pageId]
  );

  if (!pageId) {
    return (
      <div className="min-h-screen rb-workspace-bg px-6 md:px-8 xl:px-10 py-8">
        <p className="text-sm text-slate-600">ID de página no válido.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen rb-workspace-bg px-6 md:px-8 xl:px-10 py-8 flex items-center justify-center">
        <p className="text-sm text-slate-600">Cargando…</p>
      </div>
    );
  }

  if (error && !page) {
    return (
      <div className="min-h-screen rb-workspace-bg px-6 md:px-8 xl:px-10 py-8">
        <div className="max-w-2xl mx-auto rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
        <Link
          href={knowledgeListHref}
          className="mt-4 inline-block text-sm font-medium text-[rgb(var(--rb-brand-primary-active))] hover:text-[rgb(var(--rb-brand-primary-hover))]"
        >
          Volver a Knowledge
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen rb-workspace-bg w-full min-w-0 px-4 sm:px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Breadcrumb: Global|Project > Space > Page */}
        <div>
          <nav className="flex items-center gap-1.5 text-sm text-slate-500 flex-wrap">
            {projectName ? (
              <Link
                href={`/projects/${space?.project_id ?? ""}/knowledge`}
                className="hover:text-slate-900 transition-colors"
              >
                {projectName}
              </Link>
            ) : (
              <Link href="/knowledge/documents" className="hover:text-slate-900 transition-colors">
                Global
              </Link>
            )}
            {space && (
              <>
                <span className="text-slate-600">/</span>
                <Link
                  href={space.project_id ? `/projects/${space.project_id}/knowledge` : "/knowledge/documents"}
                  className="hover:text-slate-900 transition-colors"
                >
                  {space.name}
                </Link>
              </>
            )}
            {page?.title && (
              <>
                <span className="text-slate-600">/</span>
                <span className="text-slate-700">{page.title}</span>
              </>
            )}
          </nav>
          <Link
            href={backToListHref}
            className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-900 mt-1 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back to list
          </Link>
        </div>

        {error && (
          <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
        {saveError && (
          <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {saveError}
          </div>
        )}

        <KnowledgePageEditor
          pageId={pageId}
          projectId={space?.project_id ?? projectIdFromQuery}
          title={title}
          onTitleChange={setTitle}
          initialContent={initialBlocks}
          onSave={handleSave}
          debounceMs={800}
          editable
          viewGraphHref={`/knowledge/${pageId}/graph${projectIdFromQuery ? `?projectId=${projectIdFromQuery}` : ""}`}
        />

        {/* Backlinks: pages that link to this one */}
        <div className="mt-14 pt-5 border-t border-slate-900/80">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 mb-3">
            Linked from
          </h2>
          {graph.edges.filter((e) => e.to_page_id === pageId).length === 0 ? (
            <p className="text-sm text-slate-600">Nadie enlaza esta página todavía.</p>
          ) : (
            <ul className="space-y-1">
              {graph.edges
                .filter((edge) => edge.to_page_id === pageId)
                .map((edge, i) => {
                const otherId = edge.from_page_id;
                const title = graph.nodes.find((n) => n.id === otherId)?.title ?? otherId;
                return (
                  <li key={`${edge.from_page_id}-${edge.to_page_id}-${edge.link_type}-${i}`}>
                    <Link
                      href={`/knowledge/${otherId}${projectIdFromQuery ? `?projectId=${projectIdFromQuery}` : ""}`}
                      className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-300 hover:bg-slate-900/35 transition-colors"
                    >
                      <span className="font-medium truncate flex-1 min-w-0">{title}</span>
                      <Badge variant="brand" className="bg-indigo-500/10 text-indigo-300/90 shrink-0">{edge.link_type.replace(/_/g, " ")}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
