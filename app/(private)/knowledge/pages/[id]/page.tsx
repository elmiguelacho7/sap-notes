"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getPage, getSpace, updatePage } from "@/lib/knowledgeService";
import type { KnowledgeBlock } from "@/lib/types/knowledge";
import type { KnowledgePage } from "@/lib/types/knowledge";
import { KnowledgePageEditor } from "@/components/knowledge/KnowledgePageEditor";
import { AppPageShell } from "@/components/ui/layout/AppPageShell";
import type { BlockNoteBlock } from "@/lib/knowledge/blockNoteToText";

/** Initial BlockNote content: from page.content_json or legacy first block. */
function getInitialContent(page: KnowledgePage, blocks: KnowledgeBlock[]): BlockNoteBlock[] | null {
  const fromPage = page.content_json;
  if (fromPage != null && typeof fromPage === "object" && Array.isArray((fromPage as { blocks?: unknown }).blocks)) {
    return (fromPage as { blocks: BlockNoteBlock[] }).blocks;
  }
  const first = blocks[0];
  if (!first?.content_json || typeof first.content_json !== "object") return null;
  const raw = (first.content_json as { blocks?: unknown }).blocks;
  return Array.isArray(raw) ? (raw as BlockNoteBlock[]) : null;
}

export default function KnowledgePageEditorPage() {
  const params = useParams();
  const pageId = typeof params.id === "string" ? params.id : null;
  const [title, setTitle] = useState("");
  const [initialBlocks, setInitialBlocks] = useState<BlockNoteBlock[] | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setInitialBlocks(getInitialContent(page, blocks));
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

  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
  }, []);

  const handleSave = useCallback(
    (payload: { title: string; content_json: BlockNoteBlock[]; content_text: string }) => {
      if (!pageId) return;
      updatePage(supabase, pageId, {
        title: payload.title,
        content_json: { blocks: payload.content_json },
        content_text: payload.content_text || null,
      }).catch(() => {});
    },
    [pageId]
  );

  if (loading) {
    return (
      <div className="bg-slate-950 min-h-full">
        <AppPageShell>
          <div className="py-12 text-center text-slate-400">Loading…</div>
        </AppPageShell>
      </div>
    );
  }

  if (error || !pageId) {
    return (
      <div className="bg-slate-950 min-h-full">
        <AppPageShell>
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-6 text-center">
            <p className="text-slate-200">{error ?? "Page not found"}</p>
            <Link href="/knowledge/documents" className="mt-4 inline-block text-indigo-400 hover:text-indigo-300">
              ← Back to Spaces & Pages
            </Link>
          </div>
        </AppPageShell>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 min-h-full">
      <AppPageShell>
        <div className="w-full px-0">
          <nav className="mb-4">
            <Link
              href="/knowledge/documents"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-2"
            >
              <span aria-hidden>←</span>
              Spaces & Pages
            </Link>
          </nav>

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
        </div>
      </AppPageShell>
    </div>
  );
}
