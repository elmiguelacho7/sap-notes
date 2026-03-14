"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Plus,
  Save,
  Network,
  Type,
  ListChecks,
  Code,
  Link2,
  MessageSquareQuote,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getPage, upsertBlocks } from "@/lib/knowledgeService";
import { getPageGraph } from "@/lib/knowledgeGraphService";
import type { KnowledgePage, KnowledgeBlock, KnowledgeBlockType } from "@/lib/types/knowledge";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const BLOCK_TYPES: { value: KnowledgeBlockType; label: string; icon: React.ReactNode }[] = [
  { value: "rich_text", label: "Texto", icon: <Type className="h-4 w-4" /> },
  { value: "checklist", label: "Checklist", icon: <ListChecks className="h-4 w-4" /> },
  { value: "code", label: "Código", icon: <Code className="h-4 w-4" /> },
  { value: "link", label: "Enlace", icon: <Link2 className="h-4 w-4" /> },
  { value: "callout", label: "Nota destacada", icon: <MessageSquareQuote className="h-4 w-4" /> },
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

const btnControl =
  "p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/80 transition-colors";

function BlockEditor({
  block,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp,
  canMoveDown,
}: {
  block: KnowledgeBlock;
  onChange: (content: Record<string, unknown>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const content = block.content_json || {};
  const type = block.block_type;

  const controls = (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      {canMoveUp && (
        <button type="button" onClick={onMoveUp} className={btnControl} title="Subir">
          <ChevronUp className="h-4 w-4" />
        </button>
      )}
      {canMoveDown && (
        <button type="button" onClick={onMoveDown} className={btnControl} title="Bajar">
          <ChevronDown className="h-4 w-4" />
        </button>
      )}
      <button type="button" onClick={onDelete} className={`${btnControl} hover:text-red-400`} title="Eliminar bloque">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  const inputBase =
    "w-full rounded-lg border border-slate-600/80 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50";
  const inputMono = "font-mono " + inputBase;

  if (type === "rich_text") {
    const text = (content.text as string) ?? "";
    return (
      <div className="group rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 space-y-3 hover:border-slate-600/80 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">Texto</span>
          {controls}
        </div>
        <textarea
          value={text}
          onChange={(e) => onChange({ ...content, text: e.target.value })}
          rows={3}
          className={`${inputBase} min-h-[80px] resize-y`}
          placeholder="Escribe el contenido..."
        />
      </div>
    );
  }

  if (type === "code") {
    const language = (content.language as string) ?? "";
    const code = (content.code as string) ?? "";
    return (
      <div className="group rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 space-y-3 hover:border-slate-600/80 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">Código</span>
          {controls}
        </div>
        <input
          type="text"
          value={language}
          onChange={(e) => onChange({ ...content, language: e.target.value })}
          placeholder="Lenguaje (ej. abap)"
          className="w-full rounded-lg border border-slate-600/80 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 mb-2"
        />
        <textarea
          value={code}
          onChange={(e) => onChange({ ...content, code: e.target.value })}
          rows={5}
          className={`${inputMono} resize-y`}
          placeholder="Código..."
        />
      </div>
    );
  }

  if (type === "link") {
    const url = (content.url as string) ?? "";
    const label = (content.label as string) ?? "";
    return (
      <div className="group rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 space-y-3 hover:border-slate-600/80 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">Enlace</span>
          {controls}
        </div>
        <input
          type="text"
          value={label}
          onChange={(e) => onChange({ ...content, label: e.target.value })}
          placeholder="Etiqueta"
          className={inputBase}
        />
        <input
          type="url"
          value={url}
          onChange={(e) => onChange({ ...content, url: e.target.value })}
          placeholder="URL"
          className={inputBase}
        />
      </div>
    );
  }

  if (type === "callout") {
    const title = (content.title as string) ?? "";
    const body = (content.body as string) ?? "";
    return (
      <div className="group rounded-xl border border-amber-700/50 bg-amber-950/30 p-4 space-y-3 hover:border-amber-600/60 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-amber-600/80">Nota destacada</span>
          {controls}
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => onChange({ ...content, title: e.target.value })}
          placeholder="Título"
          className="w-full rounded-lg border border-amber-700/50 bg-slate-800/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        />
        <textarea
          value={body}
          onChange={(e) => onChange({ ...content, body: e.target.value })}
          rows={2}
          placeholder="Cuerpo"
          className="w-full rounded-lg border border-amber-700/50 bg-slate-800/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        />
      </div>
    );
  }

  if (type === "checklist") {
    const items = (content.items as { text: string; checked: boolean }[]) ?? [];
    return (
      <div className="group rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 space-y-3 hover:border-slate-600/80 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">Checklist</span>
          {controls}
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
          className={`${inputMono} resize-y`}
          placeholder="[ ] Elemento 1
[x] Elemento 2"
        />
      </div>
    );
  }

  return (
    <div className="group rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 flex items-center justify-between">
      <span className="text-xs text-slate-500">{type}</span>
      {controls}
    </div>
  );
}

export default function KnowledgePageDetail() {
  const params = useParams<{ pageId: string }>();
  const pageId = params?.pageId as string | undefined;

  const [page, setPage] = useState<KnowledgePage | null>(null);
  const [blocks, setBlocks] = useState<KnowledgeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const addBlockRef = useRef<HTMLDivElement>(null);
  const [graph, setGraph] = useState<{ nodes: { id: string; title: string }[]; edges: { from_page_id: string; to_page_id: string; link_type: string }[] }>({ nodes: [], edges: [] });

  useEffect(() => {
    if (!addBlockOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (addBlockRef.current && !addBlockRef.current.contains(e.target as Node)) setAddBlockOpen(false);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [addBlockOpen]);

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

  const deleteBlock = (index: number) => {
    setBlocks((prev) => prev.filter((_, i) => i !== index).map((b, i) => ({ ...b, sort_order: i })));
  };

  const addBlock = (blockType: KnowledgeBlockType) => {
    const newBlock: KnowledgeBlock = {
      id: `new-${Date.now()}`,
      page_id: pageId!,
      block_type: blockType,
      content_json: blockDefaultContent(blockType),
      sort_order: blocks.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setBlocks((prev) => [...prev, newBlock]);
    setAddBlockOpen(false);
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

  const saveStatus = saving ? "Guardando…" : saveSuccess ? "Guardado" : "Guardar";

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
        <Link href="/knowledge" className="mt-4 inline-block text-sm text-indigo-400 hover:text-indigo-300">Volver a Knowledge</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 w-full min-w-0 px-6 md:px-8 xl:px-10 py-8">
      <div className="flex justify-center w-full">
        <div className="w-full max-w-[880px] space-y-8">
          {/* PageHeader: back link + title + actions */}
          <div>
            <Link
              href="/knowledge"
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 mb-4 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Volver a Knowledge
            </Link>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
                {page?.title ?? "Page"}
              </h1>
              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/knowledge/${pageId}/graph`}>
                  <Button variant="secondary" className="border-slate-600 bg-slate-800/80 text-slate-200 hover:bg-slate-700">
                    <Network className="h-4 w-4" />
                    View Graph
                  </Button>
                </Link>
                <Button
                  onClick={saveBlocks}
                  disabled={saving}
                  className="bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  <Save className="h-4 w-4" />
                  {saveStatus}
                </Button>
              </div>
            </div>
            {saving && (
              <p className="mt-2 text-xs text-slate-500">Guardando cambios…</p>
            )}
            {saveSuccess && (
              <p className="mt-2 text-xs text-emerald-400">Guardado correctamente.</p>
            )}
          </div>

          {/* DocumentEditor */}
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/40 px-10 py-8">
            {error && (
              <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200 mb-6">
                {error}
              </div>
            )}

            <div className="space-y-5">
              {blocks.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-600/60 bg-slate-800/20 py-12 text-center">
                  <p className="text-sm font-medium text-slate-300">Documento vacío</p>
                  <p className="mt-1 text-xs text-slate-400">Añade un bloque debajo para empezar a escribir.</p>
                </div>
              )}
              {blocks.map((block, index) => (
                <BlockEditor
                  key={block.id}
                  block={block}
                  onChange={(content) => updateBlockContent(index, content)}
                  onMoveUp={() => moveBlock(index, "up")}
                  onMoveDown={() => moveBlock(index, "down")}
                  onDelete={() => deleteBlock(index)}
                  canMoveUp={index > 0}
                  canMoveDown={index < blocks.length - 1}
                />
              ))}

              <div className="relative" ref={addBlockRef}>
                <button
                  type="button"
                  onClick={() => setAddBlockOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-500/50 bg-slate-800/20 px-4 py-3 text-sm font-medium text-slate-400 hover:border-slate-400/60 hover:bg-slate-800/40 hover:text-slate-300 transition-colors w-full justify-center"
                >
                  <Plus className="h-4 w-4" />
                  Añadir bloque
                </button>
                {addBlockOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 z-10 rounded-xl border border-slate-600/80 bg-slate-900 shadow-xl shadow-black/20 py-1 min-w-[200px]">
                    {BLOCK_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => addBlock(t.value)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800 hover:text-slate-100 transition-colors"
                      >
                        <span className="text-slate-500">{t.icon}</span>
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Related Knowledge — same column, inside container */}
          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-4">
              Related Knowledge
            </h2>
            {graph.edges.length === 0 ? (
              <p className="text-sm text-slate-500">No hay enlaces a otras páginas aún.</p>
            ) : (
              <ul className="space-y-1">
                {graph.edges.map((edge, i) => {
                  const otherId = edge.from_page_id === pageId ? edge.to_page_id : edge.from_page_id;
                  const title = graph.nodes.find((n) => n.id === otherId)?.title ?? otherId;
                  return (
                    <li key={`${edge.from_page_id}-${edge.to_page_id}-${edge.link_type}-${i}`}>
                      <Link
                        href={`/knowledge/${otherId}`}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-700/40 transition-colors"
                      >
                        <span className="font-medium truncate flex-1 min-w-0">{title}</span>
                        <Badge variant="brand" className="bg-indigo-500/20 text-indigo-200 shrink-0">{edge.link_type.replace(/_/g, " ")}</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
