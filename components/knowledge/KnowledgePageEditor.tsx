"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import LinkExtension from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common as lowlightCommon, createLowlight } from "lowlight";
import { Node, mergeAttributes } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { Plugin } from "prosemirror-state";
import { NodeSelection } from "prosemirror-state";
import type { BlockNoteBlock } from "@/lib/knowledge/blockNoteToText";
import {
  blockNoteBlocksToTiptapDoc,
  tiptapDocToBlockNoteBlocks,
} from "@/lib/knowledge/blockNoteTiptapAdapter";
import { blockNoteDocumentToText } from "@/lib/knowledge/blockNoteToText";
import { getKnowledgeTemplateBlocks, type KnowledgeTemplateId } from "@/lib/knowledge/knowledgeTemplates";
import { searchKnowledge } from "@/lib/knowledgeService";
import { supabase } from "@/lib/supabaseClient";
import { uploadKnowledgeImage } from "@/lib/knowledge/uploadKnowledgeImage";
import type { KnowledgeSearchResult } from "@/lib/types/knowledge";
import {
  Save,
  Network,
  MoreHorizontal,
  Type,
  Heading1,
  Heading2,
  Heading3,
  List as ListIcon,
  ListOrdered,
  ListChecks,
  Image as ImageIcon,
  Table as TableIcon,
  Minus,
  Code as CodeIcon,
  MessageSquareQuote,
  Flag,
  Lightbulb,
  TriangleAlert,
  Terminal,
  Key,
  Notebook,
} from "lucide-react";

type KnowledgePageEditorProps = {
  pageId: string;
  projectId?: string | null;
  title: string;
  onTitleChange: (title: string) => void;
  initialContent?: BlockNoteBlock[] | null;
  onSave?: (payload: { title: string; content_json: BlockNoteBlock[]; content_text: string }) => void;
  debounceMs?: number;
  editable?: boolean;
  viewGraphHref?: string;
};

function extractTiptapContentText(blocks: BlockNoteBlock[]) {
  // Keeps the same indexing format used by the legacy BlockNote editor.
  return blockNoteDocumentToText(blocks);
}

function collectTiptapImageUrls(node: unknown): string[] {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const obj = n as { type?: unknown; attrs?: { src?: unknown }; content?: unknown[] };
    if (obj.type === "image" && typeof obj.attrs?.src === "string" && obj.attrs.src.length > 0) {
      out.push(obj.attrs.src);
    }
    if (Array.isArray(obj.content)) obj.content.forEach(walk);
  };
  walk(node);
  return out;
}

type SapCalloutVariant =
  | "procedure"
  | "tip"
  | "warning"
  | "configuration"
  | "reference"
  | "expected"
  | "quote"
  | "knowledge_reference";

const SAP_CALLOUT_LABELS: Record<SapCalloutVariant, string> = {
  procedure: "Procedure Step",
  tip: "SAP Tip",
  warning: "Warning / Risk",
  configuration: "Configuration Note",
  reference: "Transaction / App Reference",
  expected: "Expected Result",
  quote: "Note",
  knowledge_reference: "Linked Page",
};

const SAP_CALLOUT_ICONS: Record<SapCalloutVariant, string> = {
  procedure: "📋",
  tip: "💡",
  warning: "⚠️",
  configuration: "⚙️",
  reference: "🧭",
  expected: "✅",
  quote: "📝",
  knowledge_reference: "🔗",
};

const SAP_CALLOUT_STYLES: Record<
  SapCalloutVariant,
  { bg: string; label: string; sideBorder: string; iconBg: string }
> = {
  /** Ribbit brand primary callout (green) */
  procedure: {
    bg: "bg-[rgb(var(--rb-brand-primary))]/10",
    label: "text-[rgb(var(--rb-brand-primary-active))]",
    sideBorder: "border-[rgb(var(--rb-brand-primary))]/30",
    iconBg: "bg-[rgb(var(--rb-brand-primary))]/12",
  },
  /** Keep distinct but still green-family */
  tip: {
    bg: "bg-[rgb(var(--rb-brand-primary))]/7",
    label: "text-[rgb(var(--rb-brand-primary-active))]",
    sideBorder: "border-[rgb(var(--rb-brand-primary))]/24",
    iconBg: "bg-[rgb(var(--rb-brand-primary))]/10",
  },
  warning: { bg: "bg-amber-50/70", label: "text-amber-950", sideBorder: "border-amber-200/90", iconBg: "bg-amber-100/80" },
  /**
   * Neutral surface + green accent (keeps semantics, avoids fuchsia).
   * Reads as a "result / confirmation" without feeling off-brand.
   */
  expected: {
    bg: "bg-[rgb(var(--rb-surface-2))]/65",
    label: "text-[rgb(var(--rb-brand-primary-active))]",
    sideBorder: "border-[rgb(var(--rb-brand-primary))]/28",
    iconBg: "bg-[rgb(var(--rb-brand-primary))]/10",
  },
  /** Calm neutral with slight brand tint */
  configuration: {
    bg: "bg-[rgb(var(--rb-surface-2))]/55",
    label: "text-[rgb(var(--rb-text-secondary))]",
    sideBorder: "border-[rgb(var(--rb-brand-primary))]/18",
    iconBg: "bg-[rgb(var(--rb-surface-3))]/60",
  },
  /** Reference gets a cool-neutral but still within ribbit shell */
  reference: {
    bg: "bg-[rgb(var(--rb-surface-2))]/55",
    label: "text-[rgb(var(--rb-text-secondary))]",
    sideBorder: "border-[rgb(var(--rb-surface-border))]/90",
    iconBg: "bg-[rgb(var(--rb-surface-3))]/60",
  },
  quote: { bg: "bg-[rgb(var(--rb-surface-2))]/55", label: "text-[rgb(var(--rb-text-secondary))]", sideBorder: "border-[rgb(var(--rb-surface-border))]/90", iconBg: "bg-[rgb(var(--rb-surface-3))]/60" },
  knowledge_reference: {
    bg: "bg-[rgb(var(--rb-brand-surface))]/85",
    label: "text-[rgb(var(--rb-brand-primary-active))]",
    sideBorder: "border-[rgb(var(--rb-brand-primary))]/25",
    iconBg: "bg-[rgb(var(--rb-brand-primary))]/10",
  },
};

const SapCallout = Node.create({
  name: "sapCallout",
  group: "block",
  content: "block+",
  isolating: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      variant: {
        default: "quote",
        parseHTML: (element) => element.getAttribute("data-variant") || "quote",
      },
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-label"),
      },
      pageId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-page-id"),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-sap-callout]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const variantRaw = HTMLAttributes.variant as SapCalloutVariant | undefined;
    const variant =
      variantRaw && variantRaw in SAP_CALLOUT_LABELS
        ? (variantRaw as SapCalloutVariant)
        : "quote";

    const styles = SAP_CALLOUT_STYLES[variant];
    const icon = SAP_CALLOUT_ICONS[variant];
    const label = (HTMLAttributes.label as string | null | undefined) || SAP_CALLOUT_LABELS[variant];

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-sap-callout": "",
        "data-variant": variant,
        "data-label": label,
        "data-page-id": HTMLAttributes.pageId ?? undefined,
        class:
          `sap-callout relative rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 ${styles.bg} ` +
          "border-l-4 " +
          `${styles.sideBorder} p-5 my-5 transition-colors ` +
          "hover:border-[rgb(var(--rb-surface-border))]/90 focus-within:border-[rgb(var(--rb-brand-primary))]/35",
      }),
      [
        "div",
        {
          class:
            "flex items-center gap-3 border-b border-[rgb(var(--rb-surface-border))]/60 pb-3 mb-4 " +
            "text-[11px] uppercase tracking-widest font-bold",
        },
        [
          "span",
          {
            class:
              `inline-flex items-center justify-center w-10 h-10 rounded-xl border border-[rgb(var(--rb-surface-border))]/65 text-[16px] leading-none ${styles.iconBg} ${styles.label}`,
          },
          icon,
        ],
        ["span", { class: `text-[11px] ${styles.label}` }, label],
      ],
      ["div", { class: "sap-callout-body mt-1 space-y-2" }, 0],
    ];
  },
});

/**
 * Automatically numbers "procedure" sapCallout blocks as Step 1, Step 2, ...
 * The numbering is UI-only (saved compatibility is preserved by the adapter).
 */
const SapProcedureAutoNumber = Extension.create({
  name: "sapProcedureAutoNumber",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (_transactions, oldState, newState) => {
          // Fast path: if the doc didn't change, don't touch attrs.
          if (oldState.doc === newState.doc) return null;

          let step = 0;
          let tr = null as null | ReturnType<typeof newState.tr.setNodeMarkup>;
          let needsUpdate = false;

          newState.doc.descendants((node, pos) => {
            if (node.type.name !== "sapCallout") return;
            if (node.attrs?.variant !== "procedure") return;

            step++;
            const desired = `Step ${step}`;
            const current = typeof node.attrs?.label === "string" ? node.attrs.label : null;
            if (current === desired) return;

            // Lazily create the transaction only if we find an out-of-date label.
            if (!tr) tr = newState.tr;
            const nextAttrs = { ...(node.attrs ?? {}), label: desired };
            tr.setNodeMarkup(pos, node.type, nextAttrs);
            needsUpdate = true;
          });

          return needsUpdate ? tr : null;
        },
      }),
    ];
  },
});

export function KnowledgePageEditor({
  pageId,
  projectId = null,
  title,
  onTitleChange,
  initialContent,
  onSave,
  debounceMs = 800,
  editable = true,
  viewGraphHref,
}: KnowledgePageEditorProps) {
  const lowlight = useMemo(() => createLowlight(lowlightCommon), []);
  const initialDoc = useMemo(() => blockNoteBlocksToTiptapDoc(initialContent), [initialContent]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [slashOpen, setSlashOpen] = useState(false);
  const [slashPos, setSlashPos] = useState<{ top: number; left: number } | null>(null);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashActiveIndex, setSlashActiveIndex] = useState(0);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const slashItemsRef = useRef<Array<{ id: string; run: () => void; icon?: ReactNode; label: string; group: string }>>([]);
  const slashActiveIndexRef = useRef(0);
  const slashOpenRef = useRef(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [imagePickerNonce, setImagePickerNonce] = useState(0);

  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const imageUploadErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Internal Knowledge page reference picker (Phase 1).
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [linkPickerQuery, setLinkPickerQuery] = useState("");
  const [linkPickerLoading, setLinkPickerLoading] = useState(false);
  const [linkPickerError, setLinkPickerError] = useState<string | null>(null);
  const [linkPickerResults, setLinkPickerResults] = useState<KnowledgeSearchResult[]>([]);
  const linkPickerInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedImagePos, setSelectedImagePos] = useState<number | null>(null);
  const [selectedImageOverlay, setSelectedImageOverlay] = useState<{ top: number; left: number } | null>(null);

  const [saveFeedback, setSaveFeedback] = useState<"idle" | "saving" | "saved">("idle");
  const saveFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveVersionRef = useRef(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!linkPickerOpen) return;
    setLinkPickerError(null);
    // Focus search immediately for a smooth slash-command workflow.
    setTimeout(() => linkPickerInputRef.current?.focus(), 0);
  }, [linkPickerOpen]);

  useEffect(() => {
    if (!linkPickerOpen) return;
    const q = linkPickerQuery.trim();
    if (!q) {
      setLinkPickerResults([]);
      setLinkPickerLoading(false);
      return;
    }

    const handle = setTimeout(async () => {
      setLinkPickerLoading(true);
      try {
        const results = await searchKnowledge(supabase, q);
        setLinkPickerResults(results);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error al buscar páginas.";
        setLinkPickerError(msg);
        setLinkPickerResults([]);
      } finally {
        setLinkPickerLoading(false);
      }
    }, 250);

    return () => clearTimeout(handle);
  }, [linkPickerOpen, linkPickerQuery]);

  const showImageUploadError = useCallback((message: string) => {
    setImageUploadError(message);
    if (imageUploadErrorTimeoutRef.current) clearTimeout(imageUploadErrorTimeoutRef.current);
    imageUploadErrorTimeoutRef.current = setTimeout(() => {
      setImageUploadError(null);
    }, 5000);
  }, []);

  const flushSaveNow = useCallback(
    (activeEditor: ReturnType<typeof useEditor> | null, nextTitle?: string) => {
      if (!activeEditor || !onSave) return;
      // Read the live ProseMirror doc at call time (manual save must not rely on stale snapshots).
      const docJSON = activeEditor.state.doc.toJSON();
      const blocks = tiptapDocToBlockNoteBlocks(docJSON);
      const content_text = extractTiptapContentText(blocks);
      if (process.env.NODE_ENV !== "production") {
        const tiptapImageUrls = collectTiptapImageUrls(docJSON);
        const imageBlocks = blocks.filter((b) => b.type === "image");
        console.debug("[Knowledge save outgoing payload]", {
          title: nextTitle ?? title,
          tiptapImageCount: tiptapImageUrls.length,
          tiptapImages: tiptapImageUrls,
          imageCount: imageBlocks.length,
          images: imageBlocks.map((b) => (b.props?.src as string) ?? (b.props?.url as string) ?? null),
          content_json: blocks,
          content_text,
        });
      }
      onSave({ title: nextTitle ?? title, content_json: blocks, content_text });
    },
    [onSave, title]
  );

  const editor = useEditor({
    editable,
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // We'll use lowlight-enhanced code blocks.
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return "Write a step header…";
          return "Write your SAP procedure… type / to insert blocks";
        },
        emptyEditorClass: "is-empty",
      }),
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      ImageExtension.configure({
        inline: false,
        allowBase64: false,
      }),
      TaskList,
      TaskItem,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({ lowlight }),
      SapCallout,
      SapProcedureAutoNumber,
    ],
    content: initialDoc as unknown as Record<string, unknown>,
    autofocus: "start",
    editorProps: {
      attributes: {
        className: "outline-none text-[rgb(var(--rb-text-primary))]",
      },
      handlePaste: (view, event) => {
        if (!editable) return false;
        const clipboardItems = Array.from(event.clipboardData?.items ?? []);
        const imageItem = clipboardItems.find((i) => i.type.startsWith("image/"));
        if (!imageItem) return false;
        const file = imageItem.getAsFile();
        if (!file) return false;

        // Prevent default insertion immediately (we only allow images once we persist them).
        const { state } = view;
        const { from, to } = state.selection;

        const schema = state.schema;
        // Async upload (we must return synchronously here).
        void uploadKnowledgeImage({ supabase, file, pageId, projectId })
          .then((url) => {
            if (!url) return;
            view.dispatch(
              view.state.tr.replaceRangeWith(
                from,
                to,
                schema.nodes.image.create({ src: url, alt: file.name })
              )
            );
            // Persist immediately after async image insertion to avoid race on quick reload/navigation.
            if (saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current);
              saveTimeoutRef.current = null;
            }
            saveVersionRef.current += 1;
            setTimeout(() => flushSaveNow(editor), 0);
          })
          .catch((e) => {
            const msg = e instanceof Error ? e.message : "Error al subir la imagen.";
            showImageUploadError(msg);
          });

        return true;
      },
      handleKeyDown: (view, event) => {
        if (!editable) return false;

        const selNode = (view.state.selection as { node?: { type?: { name?: string } } }).node;
        const isImageSelected = selNode?.type?.name === "image";
        if (isImageSelected && (event.key === "Backspace" || event.key === "Delete")) {
          event.preventDefault();
          view.dispatch(view.state.tr.deleteSelection());
          return true;
        }

        if (slashOpenRef.current) {
          const items = slashItemsRef.current;
          if (event.key === "Escape") {
            event.preventDefault();
            setSlashOpen(false);
            setSlashQuery("");
            return true;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSlashActiveIndex((i) => {
              const next = items.length === 0 ? 0 : (i + 1) % items.length;
              slashActiveIndexRef.current = next;
              return next;
            });
            return true;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setSlashActiveIndex((i) => {
              const next = items.length === 0 ? 0 : (i - 1 + items.length) % items.length;
              slashActiveIndexRef.current = next;
              return next;
            });
            return true;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            const item = items[slashActiveIndexRef.current];
            if (item) {
              item.run();
              setSlashOpen(false);
              setSlashQuery("");
            }
            return true;
          }
          if (event.key === "Backspace") {
            event.preventDefault();
            setSlashQuery((q) => q.slice(0, -1));
            return true;
          }
          // Keep the editor clean while the menu is open.
          if (event.key.length === 1) {
            event.preventDefault();
            setSlashQuery((q) => `${q}${event.key}`);
            return true;
          }
          // For any other key, just block editor insertion while menu is open.
          event.preventDefault();
          return true;
        }

        // Minimal slash-command trigger architecture.
        // We open a basic menu when user types "/" at the beginning of a block.
        if (event.key !== "/") return false;
        const { $from } = view.state.selection;
        const parentTextOffset = $from.parentOffset;
        const isAtStart = parentTextOffset <= 1;
        if (!isAtStart) return false;

        event.preventDefault();
        setSlashQuery("");
        setSlashActiveIndex(0);
        const rect = editorHostRef.current?.getBoundingClientRect();
        const coords = view.coordsAtPos(view.state.selection.from);
        setSlashPos(
          rect
            ? { top: coords.top - rect.top + (editorHostRef.current?.scrollTop ?? 0), left: coords.left - rect.left }
            : { top: coords.top, left: coords.left }
        );
        setSlashOpen(true);
        return true;
      },
      handleClickOn: (view, pos, node, nodePos) => {
        if (!editable) return false;
        if (node.type.name !== "image") return false;
        const tr = view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos));
        view.dispatch(tr);
        view.focus();
        return true;
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      if (!onSave) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      const nextVersion = saveVersionRef.current + 1;
      saveVersionRef.current = nextVersion;
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        if (saveVersionRef.current !== nextVersion) return;
        flushSaveNow(activeEditor);
      }, debounceMs);
    },
  });

  useEffect(() => {
    // Close slash menu on escape.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSlashOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    slashOpenRef.current = slashOpen;
  }, [slashOpen]);

  useEffect(() => {
    if (!editor || !isMounted) return;

    const updateImageSelectionOverlay = () => {
      const sel = editor.state.selection as { from: number; node?: { type?: { name?: string } } };
      const isImageSelected = sel?.node?.type?.name === "image";
      if (!isImageSelected) {
        setSelectedImagePos(null);
        setSelectedImageOverlay(null);
        return;
      }

      const pos = sel.from;
      setSelectedImagePos(pos);

      const hostRect = editorHostRef.current?.getBoundingClientRect();
      if (!hostRect) {
        setSelectedImageOverlay(null);
        return;
      }

      const domAtPos = editor.view.nodeDOM(pos) as HTMLElement | null;
      const imageRect = domAtPos?.getBoundingClientRect?.();
      if (!imageRect) {
        setSelectedImageOverlay(null);
        return;
      }

      setSelectedImageOverlay({
        top: imageRect.top - hostRect.top + (editorHostRef.current?.scrollTop ?? 0) + 8,
        left: imageRect.right - hostRect.left - 130,
      });
    };

    updateImageSelectionOverlay();
    editor.on("selectionUpdate", updateImageSelectionOverlay);
    editor.on("update", updateImageSelectionOverlay);
    return () => {
      editor.off("selectionUpdate", updateImageSelectionOverlay);
      editor.off("update", updateImageSelectionOverlay);
    };
  }, [editor, isMounted]);

  const removeSelectedImage = useCallback(() => {
    if (!editor || selectedImagePos == null) return;
    const tr = editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, selectedImagePos)).deleteSelection();
    editor.view.dispatch(tr);
    editor.commands.focus();
    setSelectedImagePos(null);
    setSelectedImageOverlay(null);
  }, [editor, selectedImagePos]);

  useEffect(() => {
    slashActiveIndexRef.current = slashActiveIndex;
  }, [slashActiveIndex]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (saveFeedbackTimeoutRef.current) clearTimeout(saveFeedbackTimeoutRef.current);
    };
  }, []);

  const performSaveNow = useCallback(() => {
    if (!editor || !onSave) return;
    setSaveFeedback("saving");
    if (saveFeedbackTimeoutRef.current) clearTimeout(saveFeedbackTimeoutRef.current);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    saveVersionRef.current += 1;

    flushSaveNow(editor);

    saveFeedbackTimeoutRef.current = setTimeout(() => setSaveFeedback("saved"), 500);
    saveFeedbackTimeoutRef.current = setTimeout(() => setSaveFeedback("idle"), 1800);
  }, [editor, flushSaveNow, onSave]);

  const handleTitleChange = useCallback(
    (v: string) => {
      onTitleChange(v);
      // Title changes should also trigger autosave.
      if (!editor || !onSave) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        flushSaveNow(editor, v);
      }, 600);
    },
    [editor, flushSaveNow, onSave, onTitleChange]
  );

  const insertTemplate = useCallback(
    (templateId: KnowledgeTemplateId) => {
      if (!editor) return;

      const blocks = getKnowledgeTemplateBlocks(templateId);
      const doc = blockNoteBlocksToTiptapDoc(blocks) as any;
      const nodes = Array.isArray(doc?.content) ? doc.content : [];

      // When inserting procedures, we want steps to start from the current context count.
      const insertPos = editor.state.selection.from;
      let step = (() => {
        let count = 0;
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name !== "sapCallout") return;
          if (node.attrs?.variant !== "procedure") return;
          if (pos < insertPos) count++;
        });
        return count + 1;
      })();

      const nodesWithStepLabels = nodes.map((n: any) => {
        if (n?.type === "sapCallout" && n?.attrs?.variant === "procedure") {
          const desired = `Step ${step}`;
          step++;
          return { ...n, attrs: { ...(n.attrs ?? {}), label: desired } };
        }
        return n;
      });

      editor.chain().focus().insertContent(nodesWithStepLabels).run();
    },
    [editor]
  );

  const insertKnowledgeReference = useCallback(
    (target: KnowledgeSearchResult) => {
      if (!editor) return;
      editor
        .chain()
        .focus()
        .insertContent({
          type: "sapCallout",
          attrs: { variant: "knowledge_reference", pageId: target.page_id },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: target.title }],
            },
          ],
        })
        .run();

      setLinkPickerOpen(false);
      setLinkPickerQuery("");
    },
    [editor]
  );

  const uploadAndInsertImageFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file || !editor) return;
      try {
        setImageUploadError(null);
        const url = await uploadKnowledgeImage({ supabase, file, pageId, projectId });
        editor.chain().focus().setImage({ src: url, alt: file.name }).run();
        // Persist immediately after async image insertion to avoid race on quick reload/navigation.
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
        saveVersionRef.current += 1;
        setTimeout(() => flushSaveNow(editor), 0);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error al subir la imagen.";
        showImageUploadError(msg);
      }
    },
    [editor, flushSaveNow, pageId, projectId, showImageUploadError]
  );

  const openImagePicker = useCallback(() => {
    setImagePickerNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (imagePickerNonce === 0) return;
    imageInputRef.current?.click();
  }, [imagePickerNonce]);

  const slashActions = useMemo(() => {
    if (!editor) return [];
    const mk = (
      id: string,
      group: "Text" | "Lists" | "Media" | "Structure" | "SAP Documentation",
      label: string,
      icon: ReactNode,
      run: () => void
    ) => ({
      id,
      group,
      label,
      icon,
      searchText: `${group} ${label}`.toLowerCase(),
      run,
    });

    const insertSapProcedureTemplate = () => {
      const blocks = getKnowledgeTemplateBlocks("sap_procedure");
      const doc = blockNoteBlocksToTiptapDoc(blocks) as any;
      const nodes = Array.isArray(doc?.content) ? doc.content : [];
      const insertPos = editor.state.selection.from;
      let step = (() => {
        let count = 0;
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name !== "sapCallout") return;
          if (node.attrs?.variant !== "procedure") return;
          if (pos < insertPos) count++;
        });
        return count + 1;
      })();

      const nodesWithStepLabels = nodes.map((n: any) => {
        if (n?.type === "sapCallout" && n?.attrs?.variant === "procedure") {
          const desired = `Step ${step}`;
          step++;
          return { ...n, attrs: { ...(n.attrs ?? {}), label: desired } };
        }
        return n;
      });

      editor.chain().focus().insertContent(nodesWithStepLabels).run();
    };

    const getNextProcedureStepNumber = () => {
      const insertPos = editor.state.selection.from;
      let count = 0;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name !== "sapCallout") return;
        if (node.attrs?.variant !== "procedure") return;
        if (pos < insertPos) count++;
      });
      return count + 1;
    };

    return [
      mk(
        "paragraph",
        "Text",
        "Párrafo",
        <Type className="h-4 w-4 text-slate-400" />,
        () => {
          editor.chain().focus().setParagraph().run();
        }
      ),
      mk(
        "heading1",
        "Text",
        "Heading 1",
        <Heading1 className="h-4 w-4 text-slate-400" />,
        () => {
          editor.chain().focus().toggleHeading({ level: 1 }).run();
        }
      ),
      mk(
        "heading2",
        "Text",
        "Heading 2",
        <Heading2 className="h-4 w-4 text-slate-400" />,
        () => {
          editor.chain().focus().toggleHeading({ level: 2 }).run();
        }
      ),
      mk(
        "heading3",
        "Text",
        "Heading 3",
        <Heading3 className="h-4 w-4 text-slate-400" />,
        () => {
          editor.chain().focus().toggleHeading({ level: 3 }).run();
        }
      ),
      mk(
        "quote",
        "Text",
        "Quote",
        <MessageSquareQuote className="h-4 w-4 text-slate-400" />,
        () => {
          editor.chain().focus().toggleBlockquote().run();
        }
      ),
      mk(
        "bullet",
        "Lists",
        "Bullet list",
        <ListIcon className="h-4 w-4 text-slate-400" />,
        () => {
          editor.chain().focus().toggleBulletList().run();
        }
      ),
      mk(
        "ordered",
        "Lists",
        "Numbered list",
        <ListOrdered className="h-4 w-4 text-slate-400" />,
        () => {
          editor.chain().focus().toggleOrderedList().run();
        }
      ),
      mk(
        "checklist",
        "Lists",
        "Checklist",
        <ListChecks className="h-4 w-4 text-slate-400" />,
        () => {
          editor.chain().focus().toggleTaskList().run();
        }
      ),
      mk(
        "image",
        "Media",
        "Image",
        <ImageIcon className="h-4 w-4 text-slate-400" />,
        () => {
          openImagePicker();
        }
      ),
      mk(
        "table",
        "Structure",
        "Table",
        <TableIcon className="h-4 w-4 text-slate-400" />,
        () => {
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        }
      ),
      mk(
        "divider",
        "Structure",
        "Divider",
        <Minus className="h-4 w-4 text-slate-400" />,
        () => {
          editor.chain().focus().setHorizontalRule().run();
        }
      ),
      mk(
        "code",
        "Structure",
        "Code block",
        <CodeIcon className="h-4 w-4 text-slate-400" />,
        () => {
          editor.chain().focus().toggleCodeBlock().run();
        }
      ),
      mk(
        "procedure",
        "SAP Documentation",
        "Procedure",
        <Flag className="h-4 w-4 text-slate-400" />,
        insertSapProcedureTemplate
      ),
      mk(
        "step",
        "SAP Documentation",
        "Step",
        <Flag className="h-4 w-4 text-slate-400" />,
        () => {
          const nextStep = getNextProcedureStepNumber();
          editor
            .chain()
            .focus()
            .insertContent({
              type: "sapCallout",
              attrs: { variant: "procedure", label: `Step ${nextStep}` },
              content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }],
            })
            .run();
        }
      ),
      mk(
        "sap_tip",
        "SAP Documentation",
        "SAP Tip",
        <Lightbulb className="h-4 w-4 text-slate-400" />,
        () => {
          editor
            .chain()
            .focus()
            .insertContent({
              type: "sapCallout",
              attrs: { variant: "tip" },
              content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }],
            })
            .run();
        }
      ),
      mk(
        "warning",
        "SAP Documentation",
        "Warning",
        <TriangleAlert className="h-4 w-4 text-slate-400" />,
        () => {
          editor
            .chain()
            .focus()
            .insertContent({
              type: "sapCallout",
              attrs: { variant: "warning" },
              content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }],
            })
            .run();
        }
      ),
      mk(
        "config",
        "SAP Documentation",
        "Config",
        <Terminal className="h-4 w-4 text-slate-400" />,
        () => {
          editor
            .chain()
            .focus()
            .insertContent({
              type: "sapCallout",
              attrs: { variant: "configuration" },
              content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }],
            })
            .run();
        }
      ),
      mk(
        "sap_reference",
        "SAP Documentation",
        "Transaction / App Reference",
        <Key className="h-4 w-4 text-slate-400" />,
        () => {
          editor
            .chain()
            .focus()
            .insertContent({
              type: "sapCallout",
              attrs: { variant: "reference" },
              content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }],
            })
            .run();
        }
      ),
      mk(
        "knowledge_reference",
        "SAP Documentation",
        "Linked page",
        <Network className="h-4 w-4 text-slate-400" />,
        () => {
          setSlashOpen(false);
          setSlashQuery("");
          setLinkPickerOpen(true);
          setLinkPickerQuery("");
        }
      ),
      mk(
        "result",
        "SAP Documentation",
        "Result",
        <Notebook className="h-4 w-4 text-slate-400" />,
        () => {
          editor
            .chain()
            .focus()
            .insertContent({
              type: "sapCallout",
              attrs: { variant: "expected" },
              content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }],
            })
            .run();
        }
      ),
    ];
  }, [editor, openImagePicker]);

  const filteredSlashActions = useMemo(() => {
    const q = slashQuery.trim().toLowerCase();
    const items = slashActions;
    if (!q) return items;

    const score = (query: string, target: string) => {
      // Simple fuzzy scoring: all chars must appear in order; lower is better.
      let ti = 0;
      let scoreSum = 0;
      for (const qc of query) {
        const idx = target.indexOf(qc, ti);
        if (idx === -1) return null;
        scoreSum += idx;
        ti = idx + 1;
      }
      return scoreSum;
    };

    return items
      .map((it) => {
        const s = score(q, it.searchText);
        return s == null ? null : { it, s };
      })
      .filter(Boolean)
      .sort((a, b) => (a!.s ?? 0) - (b!.s ?? 0))
      .map((x) => x!.it);
  }, [slashActions, slashQuery]);

  useEffect(() => {
    slashItemsRef.current = filteredSlashActions.map((a) => ({ id: a.id, label: a.label, group: a.group, icon: a.icon, run: a.run }));
    setSlashActiveIndex((i) => {
      const clamped = Math.min(i, Math.max(0, filteredSlashActions.length - 1));
      slashActiveIndexRef.current = clamped;
      return clamped;
    });
  }, [filteredSlashActions]);

  const saveButtonLabel = saveFeedback === "saving" ? "Guardando…" : saveFeedback === "saved" ? "Guardado" : "Guardar";

  return (
    <div className="w-full px-2 sm:px-0">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0] ?? null;
          // Clear the input so the same file can be re-selected if needed.
          e.currentTarget.value = "";
          void uploadAndInsertImageFile(file);
        }}
      />
      <div className="max-w-6xl mx-auto space-y-9">
        {/* Title + action bar */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Untitled"
              spellCheck={false}
              disabled={!editable}
              className="w-full text-4xl font-semibold bg-transparent border-none text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] leading-tight tracking-tight focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-0"
              aria-label="Page title"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0 lg:pt-1">
            <div className="sticky top-4 z-10 flex items-center gap-2">
              <button
                type="button"
                onClick={performSaveNow}
                disabled={!onSave || !editable}
                className="inline-flex items-center justify-center gap-2 rounded-xl rb-btn-primary px-4 py-2.5 text-sm font-medium transition-colors duration-150 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--rb-shell-bg))]"
              >
                <Save className="h-4 w-4" />
                {saveButtonLabel}
              </button>

              {viewGraphHref && (
                <Link
                  href={viewGraphHref}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-4 py-2.5 text-sm font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-2))]/60 hover:text-[rgb(var(--rb-text-primary))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30"
                >
                  <Network className="h-4 w-4" />
                  View Graph
                </Link>
              )}

              <div className="relative">
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 text-[rgb(var(--rb-text-muted))] hover:bg-[rgb(var(--rb-surface-2))]/60 hover:text-[rgb(var(--rb-text-primary))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30"
                  aria-label="More actions"
                  title="More actions"
                  onClick={openImagePicker}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {imageUploadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {imageUploadError}
          </div>
        )}

        {/* Editor */}
        <div
          ref={editorHostRef}
          className="
            relative
            rounded-3xl
            border border-[rgb(var(--rb-surface-border))]/80
            bg-[rgb(var(--rb-surface))]
            shadow-sm
            ring-1 ring-[rgb(var(--rb-brand-primary))]/6
            overflow-hidden
            [&_.ProseMirror]:min-h-[320px]
            [&_.ProseMirror]:px-6
            [&_.ProseMirror]:py-6
            [&_.ProseMirror]:text-[rgb(var(--rb-text-primary))]
            [&_.ProseMirror]:outline-none
            [&_.ProseMirror]:transition-shadow
            [&_.ProseMirror]:focus-visible:ring-2
            [&_.ProseMirror]:focus-visible:ring-[rgb(var(--rb-brand-ring))]/35
            [&_.ProseMirror]:focus-visible:ring-offset-0
            [&_.ProseMirror-selectednode]:ring-2
            [&_.ProseMirror-selectednode]:ring-[rgb(var(--rb-brand-ring))]/40
            [&_.ProseMirror-selectednode]:ring-offset-0
            [&_.ProseMirror-selectednode]:rounded-xl
            [&_.ProseMirror_p]:my-4
            [&_.ProseMirror_p]:leading-7
            [&_.ProseMirror_h1]:text-4xl [&_.ProseMirror_h1]:font-semibold [&_.ProseMirror_h1]:mt-8 [&_.ProseMirror_h1]:mb-4
            [&_.ProseMirror_h2]:text-2xl [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:mt-7 [&_.ProseMirror_h2]:mb-4
            [&_.ProseMirror_h3]:text-xl [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mt-5 [&_.ProseMirror_h3]:mb-3
            [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-[rgb(var(--rb-surface-border))]/80 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:my-4 [&_.ProseMirror_blockquote]:text-[rgb(var(--rb-text-primary))]
            [&_.ProseMirror ul]:my-4 [&_.ProseMirror ul]:list-disc [&_.ProseMirror ul]:ml-6 [&_.ProseMirror ol]:my-4 [&_.ProseMirror ol]:list-decimal [&_.ProseMirror ol]:ml-6
            [&_.ProseMirror li]:my-1.5
            [&_.ProseMirror code]:font-mono [&_.ProseMirror pre]:bg-[rgb(var(--rb-surface-2))]/70 [&_.ProseMirror pre]:border [&_.ProseMirror pre]:border-[rgb(var(--rb-surface-border))]/75 [&_.ProseMirror pre]:rounded-xl [&_.ProseMirror pre]:p-4 [&_.ProseMirror pre]:overflow-x-auto
            [&_.ProseMirror pre]:my-5
            [&_.ProseMirror img]:my-8 [&_.ProseMirror img]:mx-auto [&_.ProseMirror img]:w-full [&_.ProseMirror img]:max-w-4xl [&_.ProseMirror img]:h-auto [&_.ProseMirror img]:rounded-xl [&_.ProseMirror img]:border [&_.ProseMirror img]:border-[rgb(var(--rb-surface-border))]/75 [&_.ProseMirror img]:bg-[rgb(var(--rb-surface))] [&_.ProseMirror img]:shadow-sm
            [&_.ProseMirror hr]:border-[rgb(var(--rb-surface-border))]/80
            [&_.ProseMirror table]:w-full [&_.ProseMirror table]:border-collapse [&_.ProseMirror th]:border [&_.ProseMirror th]:border-[rgb(var(--rb-surface-border))]/75 [&_.ProseMirror th]:bg-[rgb(var(--rb-surface-2))]/70 [&_.ProseMirror th]:p-2 [&_.ProseMirror th]:text-[rgb(var(--rb-text-primary))]
            [&_.ProseMirror td]:border [&_.ProseMirror td]:border-[rgb(var(--rb-surface-border))]/75 [&_.ProseMirror td]:p-2 [&_.ProseMirror td]:text-[rgb(var(--rb-text-primary))]
            [&_.ProseMirror table]:my-6
            [&_.ProseMirror .task-list]:my-2
          "
        >
          {editor && isMounted ? (
            <>
              {/* Slash menu (basic placeholder menu) */}
              {slashOpen && slashPos && (
                <div
                  className="absolute z-20 w-[320px] rounded-2xl border border-[rgb(var(--rb-surface-border))]/80 bg-[rgb(var(--rb-surface))]/96 backdrop-blur-md px-2 py-2 shadow-2xl shadow-black/10"
                  style={{ top: slashPos.top + 10, left: Math.max(8, slashPos.left - 8) }}
                  role="dialog"
                  aria-label="Slash menu"
                >
                  <div className="px-3 py-2 text-xs font-medium text-[rgb(var(--rb-text-muted))] border-b border-[rgb(var(--rb-surface-border))]/70 mb-1">
                    / {slashQuery ? slashQuery : "comando"}
                  </div>
                  <div className="max-h-80 overflow-auto px-1 pb-1 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.55)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgb(var(--rb-surface-border))] [&::-webkit-scrollbar-track]:bg-transparent">
                    {(["Text", "Lists", "Media", "Structure", "SAP Documentation"] as const).map((group) => {
                      const groupItems = filteredSlashActions.filter((a) => a.group === group);
                      if (groupItems.length === 0) return null;
                      return (
                        <div key={group} className="px-2 pb-1">
                          <div className="px-2 pb-1 pt-1 text-[11px] uppercase tracking-wide text-[rgb(var(--rb-text-muted))]">
                            {group === "Text"
                              ? "Texto"
                              : group === "Lists"
                                ? "Listas"
                                : group === "Media"
                                  ? "Medios"
                                  : group === "SAP Documentation"
                                    ? "SAP Documentation"
                                    : "Estructura"}
                          </div>
                          {groupItems.map((it) => {
                            const flatIndex = filteredSlashActions.findIndex((x) => x.id === it.id);
                            const active = flatIndex === slashActiveIndex;
                            return (
                              <button
                                key={it.id}
                                type="button"
                                onClick={() => {
                                  it.run();
                                  setSlashOpen(false);
                                  setSlashQuery("");
                                }}
                                className={`w-full px-3 py-2.5 text-left text-sm rounded-xl transition-colors flex items-center gap-2 border ${
                                  active
                                    ? "bg-[rgb(var(--rb-brand-primary))]/10 border-[rgb(var(--rb-brand-primary))]/25 text-[rgb(var(--rb-text-primary))]"
                                    : "border-transparent text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-2))]/70 hover:text-[rgb(var(--rb-text-primary))]"
                                }`}
                              >
                                <span className="shrink-0">{it.icon}</span>
                                <span className="flex-1 min-w-0">{it.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                    {filteredSlashActions.length === 0 && (
                      <div className="px-3 py-4 text-sm text-slate-500">Sin resultados</div>
                    )}
                  </div>
                </div>
              )}

              {selectedImageOverlay && (
                <button
                  type="button"
                  onClick={removeSelectedImage}
                  className="absolute z-20 rounded-lg border border-[rgb(var(--rb-surface-border))]/80 bg-[rgb(var(--rb-surface))]/95 px-2.5 py-1.5 text-xs font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-2))]/70 hover:text-[rgb(var(--rb-text-primary))] shadow-sm"
                  style={{
                    top: Math.max(4, selectedImageOverlay.top),
                    left: Math.max(4, selectedImageOverlay.left),
                  }}
                >
                  Remove image
                </button>
              )}

              {linkPickerOpen && (
                <div className="absolute inset-0 z-30 bg-slate-900/35 backdrop-blur-[2px] flex items-start justify-center p-4">
                  <div className="w-full max-w-xl rounded-2xl border border-[rgb(var(--rb-surface-border))]/80 bg-[rgb(var(--rb-surface))]/98 px-4 py-4 shadow-2xl shadow-black/10">
                    <div className="flex items-center gap-2">
                      <input
                        ref={linkPickerInputRef}
                        value={linkPickerQuery}
                        onChange={(e) => setLinkPickerQuery(e.target.value)}
                        placeholder="Buscar página de conocimiento…"
                        className="w-full h-10 rounded-xl border border-[rgb(var(--rb-surface-border))]/80 bg-[rgb(var(--rb-surface))]/95 px-3 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30 focus-visible:border-[rgb(var(--rb-brand-primary))]/25"
                        aria-label="Buscar páginas"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setLinkPickerOpen(false);
                          setLinkPickerQuery("");
                          setLinkPickerError(null);
                        }}
                        className="h-10 rounded-xl border border-[rgb(var(--rb-surface-border))]/80 bg-[rgb(var(--rb-surface))]/95 px-3 text-sm font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-2))]/70 hover:text-[rgb(var(--rb-text-primary))] transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>

                    <div className="mt-3">
                      {linkPickerError && (
                        <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                          {linkPickerError}
                        </div>
                      )}

                      {!linkPickerError && (
                        <>
                          <div className="px-1 text-[11px] uppercase tracking-wide text-slate-500 mb-2">
                            Resultados
                          </div>
                          {linkPickerLoading ? (
                            <div className="text-sm text-[rgb(var(--rb-text-secondary))] py-2">Buscando…</div>
                          ) : linkPickerResults.length === 0 ? (
                            <div className="text-sm text-[rgb(var(--rb-text-muted))] py-2">
                              Escribe para buscar. (Se muestran solo páginas a las que tienes acceso.)
                            </div>
                          ) : (
                            <div className="max-h-72 overflow-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.55)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgb(var(--rb-surface-border))] [&::-webkit-scrollbar-track]:bg-transparent">
                              <div className="space-y-2">
                                {linkPickerResults.slice(0, 10).map((r) => (
                                  <button
                                    key={r.page_id}
                                    type="button"
                                    onClick={() => insertKnowledgeReference(r)}
                                    className="w-full text-left rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2.5 hover:bg-[rgb(var(--rb-surface-2))]/70 transition-colors"
                                  >
                                    <div className="text-sm font-semibold text-[rgb(var(--rb-text-primary))]">{r.title}</div>
                                    {r.summary ? (
                                      <div className="text-xs text-[rgb(var(--rb-text-muted))] mt-0.5 line-clamp-2">{r.summary}</div>
                                    ) : null}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <EditorContent editor={editor} />

              {/* Empty state hint */}
              {editor.isEmpty && (
                <div className="absolute inset-0 flex items-center justify-center px-2 py-8">
                  <div className="w-full max-w-[760px] rounded-3xl border border-[rgb(var(--rb-surface-border))]/75 bg-[rgb(var(--rb-surface))]/98 px-6 py-6 shadow-lg ring-1 ring-[rgb(var(--rb-brand-primary))]/10">
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 h-11 w-11 rounded-2xl bg-[rgb(var(--rb-brand-primary))]/12 flex items-center justify-center text-[rgb(var(--rb-brand-primary-active))] font-semibold border border-[rgb(var(--rb-brand-primary))]/18">
                        SAP
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-[rgb(var(--rb-text-primary))]">
                          Start writing your SAP documentation
                        </h3>
                        <p className="mt-1 text-sm text-[rgb(var(--rb-text-secondary))] leading-6">
                          Build procedures, configuration notes, and troubleshooting guides with structured blocks and screenshots.
                        </p>
                        <p className="mt-2 text-sm text-[rgb(var(--rb-text-secondary))]">
                          Type{" "}
                          <span className="px-1.5 py-0.5 rounded-md border border-[rgb(var(--rb-surface-border))]/80 bg-[rgb(var(--rb-surface-2))]/70 text-[rgb(var(--rb-text-primary))] font-mono text-[12px]">
                            /
                          </span>{" "}
                          to insert blocks (steps, warnings, config, results, tables, code, images).
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => insertTemplate("sap_procedure")}
                        className="inline-flex items-center justify-center gap-2 rounded-xl rb-btn-primary px-4 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/35 focus-visible:ring-offset-2"
                      >
                        <span className="text-base" aria-hidden>
                          📋
                        </span>
                        SAP Procedure
                      </button>
                      <button
                        type="button"
                        onClick={() => insertTemplate("sap_configuration")}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-4 py-2.5 text-sm font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-2))]/60 hover:text-[rgb(var(--rb-text-primary))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30"
                      >
                        <span className="text-base" aria-hidden>
                          ⚙️
                        </span>
                        SAP Configuration
                      </button>
                      <button
                        type="button"
                        onClick={() => insertTemplate("troubleshooting_guide")}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-4 py-2.5 text-sm font-medium text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-2))]/60 hover:text-[rgb(var(--rb-text-primary))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30"
                      >
                        <span className="text-base" aria-hidden>
                          🧯
                        </span>
                        Troubleshooting
                      </button>
                    </div>

                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-4 py-3">
                        <p className="text-xs font-semibold text-[rgb(var(--rb-text-muted))] uppercase tracking-wide">SAP-aware guidance</p>
                        <p className="mt-1 text-sm text-[rgb(var(--rb-text-secondary))] leading-6">
                          Procedure steps, warnings/risks, configuration notes, transaction references, expected results.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface-2))]/55 px-4 py-3">
                        <p className="text-xs font-semibold text-[rgb(var(--rb-text-muted))] uppercase tracking-wide">Screenshot-first docs</p>
                        <p className="mt-1 text-sm text-[rgb(var(--rb-text-secondary))] leading-6">
                          Paste screenshots, add tables and code/config snippets, keep everything clean and consistent.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-slate-500">Cargando editor…</div>
          )}
        </div>
      </div>
    </div>
  );
}

