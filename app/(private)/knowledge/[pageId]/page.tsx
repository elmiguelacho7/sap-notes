"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronUp, ChevronDown, Plus, Save, Network } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getPage, upsertBlocks } from "@/lib/knowledgeService";
import { getPageGraph } from "@/lib/knowledgeGraphService";
import type { KnowledgePage, KnowledgeBlock, KnowledgeBlockType } from "@/lib/types/knowledge";

const BLOCK_TYPES: { value: KnowledgeBlockType; label: string }[] = [
  { value: "rich_text", label: "Rich text" },
  { value: "checklist", label: "Checklist" },
  { value: "code", label: "Code" },
  { value: "link", label: "Link" },
  { value: "callout", label: "Callout" },
];

function blockDefaultContent(blockType: KnowledgeBlockType): Record<string, unknown> {
  switch (blockType) {
    case "rich_text":
      return { text: "" };
    case "checklist":
      return { items: [] as { text: string; checked: boolean }[] };
    case "code":
      return { language: "", code: "" };
    case "link":
      return { url: "", label: "" };
    case "callout":
      return { title: "", body: "" };
    default:
      return {};
  }
}

function BlockEditor({
  block,
  onChange,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  block: KnowledgeBlock;
  onChange: (content: Record<string, unknown>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const content = block.content_json || {};
  const type = block.block_type;

  if (type === "rich_text") {
    const text = (content.text as string) ?? "";
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">Rich text</span>
          <div className="flex items-center gap-0.5">
            {canMoveUp && (
              <button type="button" onClick={onMoveUp} className="p-1 rounded text-slate-400 hover:bg-slate-100">
                <ChevronUp className="h-4 w-4" />
              </button>
            )}
            {canMoveDown && (
              <button type="button" onClick={onMoveDown} className="p-1 rounded text-slate-400 hover:bg-slate-100">
                <ChevronDown className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <textarea
          value={text}
          onChange={(e) => onChange({ ...content, text: e.target.value })}
          rows={3}
          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Write content..."
        />
      </div>
    );
  }

  if (type === "code") {
    const language = (content.language as string) ?? "";
    const code = (content.code as string) ?? "";
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">Code</span>
          <div className="flex items-center gap-0.5">
            {canMoveUp && <button type="button" onClick={onMoveUp} className="p-1 rounded text-slate-400 hover:bg-slate-200"><ChevronUp className="h-4 w-4" /></button>}
            {canMoveDown && <button type="button" onClick={onMoveDown} className="p-1 rounded text-slate-400 hover:bg-slate-200"><ChevronDown className="h-4 w-4" /></button>}
          </div>
        </div>
        <input
          type="text"
          value={language}
          onChange={(e) => onChange({ ...content, language: e.target.value })}
          placeholder="Language (e.g. abap)"
          className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 mb-2"
        />
        <textarea
          value={code}
          onChange={(e) => onChange({ ...content, code: e.target.value })}
          rows={5}
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Code..."
        />
      </div>
    );
  }

  if (type === "link") {
    const url = (content.url as string) ?? "";
    const label = (content.label as string) ?? "";
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">Link</span>
          <div className="flex items-center gap-0.5">
            {canMoveUp && <button type="button" onClick={onMoveUp} className="p-1 rounded text-slate-400 hover:bg-slate-100"><ChevronUp className="h-4 w-4" /></button>}
            {canMoveDown && <button type="button" onClick={onMoveDown} className="p-1 rounded text-slate-400 hover:bg-slate-100"><ChevronDown className="h-4 w-4" /></button>}
          </div>
        </div>
        <input
          type="text"
          value={label}
          onChange={(e) => onChange({ ...content, label: e.target.value })}
          placeholder="Label"
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
        />
        <input
          type="url"
          value={url}
          onChange={(e) => onChange({ ...content, url: e.target.value })}
          placeholder="URL"
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
        />
      </div>
    );
  }

  if (type === "callout") {
    const title = (content.title as string) ?? "";
    const body = (content.body as string) ?? "";
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-amber-700">Callout</span>
          <div className="flex items-center gap-0.5">
            {canMoveUp && <button type="button" onClick={onMoveUp} className="p-1 rounded text-amber-600 hover:bg-amber-100"><ChevronUp className="h-4 w-4" /></button>}
            {canMoveDown && <button type="button" onClick={onMoveDown} className="p-1 rounded text-amber-600 hover:bg-amber-100"><ChevronDown className="h-4 w-4" /></button>}
          </div>
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => onChange({ ...content, title: e.target.value })}
          placeholder="Title"
          className="w-full rounded border border-amber-200 px-2 py-1.5 text-sm bg-white"
        />
        <textarea
          value={body}
          onChange={(e) => onChange({ ...content, body: e.target.value })}
          rows={2}
          placeholder="Body"
          className="w-full rounded border border-amber-200 px-2 py-1.5 text-sm bg-white"
        />
      </div>
    );
  }

  if (type === "checklist") {
    const items = (content.items as { text: string; checked: boolean }[]) ?? [];
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">Checklist</span>
          <div className="flex items-center gap-0.5">
            {canMoveUp && <button type="button" onClick={onMoveUp} className="p-1 rounded text-slate-400 hover:bg-slate-100"><ChevronUp className="h-4 w-4" /></button>}
            {canMoveDown && <button type="button" onClick={onMoveDown} className="p-1 rounded text-slate-400 hover:bg-slate-100"><ChevronDown className="h-4 w-4" /></button>}
          </div>
        </div>
        <textarea
          value={items.map((i) => `${i.checked ? "[x]" : "[ ]"} ${i.text}`).join("\n")}
          onChange={(e) => {
            const lines = e.target.value.split("\n").filter(Boolean);
            const newItems = lines.map((line) => {
              const checked = line.startsWith("[x]") || line.startsWith("[X]");
              const text = line.replace(/^\[.?\]\s*/, "").trim();
              return { text: text || line, checked };
            });
            onChange({ ...content, items: newItems });
          }}
          rows={4}
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm font-mono"
          placeholder="[ ] Item 1
[x] Item 2"
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-between">
      <span className="text-xs text-slate-500">{type}</span>
      <div className="flex items-center gap-0.5">
        {canMoveUp && <button type="button" onClick={onMoveUp} className="p-1 rounded text-slate-400 hover:bg-slate-100"><ChevronUp className="h-4 w-4" /></button>}
        {canMoveDown && <button type="button" onClick={onMoveDown} className="p-1 rounded text-slate-400 hover:bg-slate-100"><ChevronDown className="h-4 w-4" /></button>}
      </div>
    </div>
  );
}

export default function KnowledgePageDetail() {
  const params = useParams<{ pageId: string }>();
  const router = useRouter();
  const pageId = params?.pageId as string | undefined;

  const [page, setPage] = useState<KnowledgePage | null>(null);
  const [blocks, setBlocks] = useState<KnowledgeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [addBlockType, setAddBlockType] = useState<KnowledgeBlockType | "">("");
  const [graph, setGraph] = useState<{ nodes: { id: string; title: string }[]; edges: { from_page_id: string; to_page_id: string; link_type: string }[] }>({ nodes: [], edges: [] });

  const load = useCallback(async () => {
    if (!pageId) return;
    setLoading(true);
    setError(null);
    try {
      const { page: p, blocks: b } = await getPage(supabase, pageId);
      setPage(p);
      setBlocks(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar la página.");
      setPage(null);
      setBlocks([]);
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

  const updateBlockContent = (index: number, content: Record<string, unknown>) => {
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === index ? { ...b, content_json: content } : b
      )
    );
  };

  const moveBlock = (index: number, dir: "up" | "down") => {
    setBlocks((prev) => {
      const next = [...prev];
      const j = dir === "up" ? index - 1 : index + 1;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next.map((b, i) => ({ ...b, sort_order: i }));
    });
  };

  const addBlock = () => {
    if (!addBlockType) return;
    const newBlock: KnowledgeBlock = {
      id: `new-${Date.now()}`,
      page_id: pageId!,
      block_type: addBlockType,
      content_json: blockDefaultContent(addBlockType),
      sort_order: blocks.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setBlocks((prev) => [...prev, newBlock]);
    setAddBlockType("");
  };

  const saveBlocks = async () => {
    if (!pageId) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      await upsertBlocks(
        supabase,
        pageId,
        blocks.map((b, i) => ({
          id: b.id.startsWith("new-") ? undefined : b.id,
          block_type: b.block_type,
          content_json: b.content_json,
          sort_order: i,
        }))
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (!pageId) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <p className="text-sm text-slate-600">ID de página no válido.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <p className="text-sm text-slate-500">Cargando…</p>
      </div>
    );
  }

  if (error && !page) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        <Link href="/knowledge" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">Volver a Knowledge</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Link
        href="/knowledge"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-indigo-600 mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        Volver a Knowledge
      </Link>

      <header className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">{page?.title ?? "Page"}</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/knowledge/${pageId}/graph`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Network className="h-4 w-4" />
            View Graph
          </Link>
          <button
            type="button"
            onClick={saveBlocks}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Guardando…" : saveSuccess ? "Guardado" : "Guardar"}
          </button>
        </div>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>}

      <div className="space-y-4">
        {blocks.map((block, index) => (
          <BlockEditor
            key={block.id}
            block={block}
            onChange={(content) => updateBlockContent(index, content)}
            onMoveUp={() => moveBlock(index, "up")}
            onMoveDown={() => moveBlock(index, "down")}
            canMoveUp={index > 0}
            canMoveDown={index < blocks.length - 1}
          />
        ))}

        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={addBlockType}
              onChange={(e) => setAddBlockType(e.target.value as KnowledgeBlockType | "")}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
            >
              <option value="">Add block...</option>
              {BLOCK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={addBlock}
              disabled={!addBlockType}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-200 px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-300 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Related Knowledge */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 bg-slate-50/50">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Related Knowledge
          </h2>
        </div>
        <div className="p-4">
          {graph.edges.length === 0 ? (
            <p className="text-sm text-slate-500">No links to other pages yet.</p>
          ) : (
            <ul className="space-y-2">
              {graph.edges.map((edge, i) => {
                const otherId = edge.from_page_id === pageId ? edge.to_page_id : edge.from_page_id;
                const title = graph.nodes.find((n) => n.id === otherId)?.title ?? otherId;
                return (
                  <li key={`${edge.from_page_id}-${edge.to_page_id}-${edge.link_type}-${i}`}>
                    <Link
                      href={`/knowledge/${otherId}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 hover:border-slate-200 hover:bg-slate-50 transition"
                    >
                      <span className="font-medium truncate">{title}</span>
                      <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
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
    </div>
  );
}
