"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getKnowledgeListHref } from "@/lib/routes";
import {
  ChevronLeft,
  Network,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getPage, getSpace, updatePage, upsertBlocks } from "@/lib/knowledgeService";
import { getPageGraph } from "@/lib/knowledgeGraphService";
import type { KnowledgePage, KnowledgeSpace, KnowledgeBlock } from "@/lib/types/knowledge";
import type { BlockNoteBlock } from "@/lib/knowledge/blockNoteToText";
import { KnowledgePageEditor } from "@/components/knowledge/KnowledgePageEditor";
import { Badge } from "@/components/ui/Badge";

function getInitialContent(page: KnowledgePage | null, blocks: KnowledgeBlock[]): BlockNoteBlock[] | null {
  const fromPage = page?.content_json;
  if (fromPage != null && typeof fromPage === "object" && Array.isArray((fromPage as { blocks?: unknown }).blocks)) {
    return (fromPage as { blocks: BlockNoteBlock[] }).blocks;
  }
  const first = blocks[0];
  if (!first?.content_json || typeof first.content_json !== "object") return null;
  const raw = (first.content_json as { blocks?: unknown }).blocks;
  return Array.isArray(raw) ? (raw as BlockNoteBlock[]) : null;
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
  const [graph, setGraph] = useState<{ nodes: { id: string; title: string }[]; edges: { from_page_id: string; to_page_id: string; link_type: string }[] }>({ nodes: [], edges: [] });
  const [space, setSpace] = useState<KnowledgeSpace | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const backToListHref = getKnowledgeListHref(projectIdFromQuery ?? space?.project_id);

  const load = useCallback(async () => {
    if (!pageId) return;
    setLoading(true);
    setError(null);
    try {
      const { page: p, blocks: b } = await getPage(supabase, pageId);
      setPage(p);
      setBlocks(b);
      setTitle(p.title);
      setInitialBlocks(getInitialContent(p, b));
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
      try {
        await updatePage(supabase, pageId, {
          title: payload.title,
          content_json: { blocks: payload.content_json },
          content_text: payload.content_text || null,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error al guardar.";
        const looksLikeMissingColumn =
          msg.toLowerCase().includes("content_json") && msg.toLowerCase().includes("knowledge_pages");

        if (looksLikeMissingColumn) {
          // Backward-safe fallback for environments where knowledge_pages.content_json/content_text
          // has not been applied yet: persist through legacy knowledge_blocks.
          try {
            await updatePage(supabase, pageId, {
              title: payload.title,
            });
            await upsertBlocks(supabase, pageId, [
              {
                block_type: "rich_text",
                content_json: { blocks: payload.content_json },
                sort_order: 0,
              },
            ]);
            return;
          } catch (fallbackError) {
            const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : "Error al guardar.";
            setSaveError(fallbackMsg);
            return;
          }
        }

        setSaveError(msg);
      }
    },
    [pageId]
  );

  if (!pageId) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 md:px-8 xl:px-10 py-8">
        <p className="text-sm text-slate-400">ID de página no válido.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 md:px-8 xl:px-10 py-8 flex items-center justify-center">
        <p className="text-sm text-slate-500">Cargando…</p>
      </div>
    );
  }

  if (error && !page) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 md:px-8 xl:px-10 py-8">
        <div className="max-w-2xl mx-auto rounded-2xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">{error}</div>
        <Link href={knowledgeListHref} className="mt-4 inline-block text-sm text-indigo-400 hover:text-indigo-300">Volver a Knowledge</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 w-full min-w-0 px-4 sm:px-6 py-10">
      <div className="max-w-[780px] mx-auto space-y-6">
        {/* Breadcrumb: Global|Project > Space > Page */}
        <div>
          <nav className="flex items-center gap-1.5 text-sm text-slate-500 flex-wrap">
            {projectName ? (
              <Link
                href={`/projects/${space?.project_id ?? ""}/knowledge`}
                className="hover:text-slate-200 transition-colors"
              >
                {projectName}
              </Link>
            ) : (
              <Link href="/knowledge/documents" className="hover:text-slate-200 transition-colors">
                Global
              </Link>
            )}
            {space && (
              <>
                <span className="text-slate-600">/</span>
                <Link
                  href={space.project_id ? `/projects/${space.project_id}/knowledge` : "/knowledge/documents"}
                  className="hover:text-slate-200 transition-colors"
                >
                  {space.name}
                </Link>
              </>
            )}
            {page?.title && (
              <>
                <span className="text-slate-600">/</span>
                <span className="text-slate-300">{page.title}</span>
              </>
            )}
          </nav>
          <Link
            href={backToListHref}
            className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 mt-1 transition-colors"
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

        {/* Related Knowledge — bottom, visually secondary */}
        <div className="mt-14 pt-5 border-t border-slate-900/80">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 mb-3">
            Related Knowledge
          </h2>
          {graph.edges.length === 0 ? (
            <p className="text-sm text-slate-600">No hay enlaces a otras páginas aún.</p>
          ) : (
            <ul className="space-y-1">
              {graph.edges.map((edge, i) => {
                const otherId = edge.from_page_id === pageId ? edge.to_page_id : edge.from_page_id;
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
