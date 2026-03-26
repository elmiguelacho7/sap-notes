"use client";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useEffect, useRef } from "react";
import { blockNoteDocumentToText, type BlockNoteBlock } from "@/lib/knowledge/blockNoteToText";

export type KnowledgeBlockEditorSavePayload = {
  content_json: BlockNoteBlock[];
  content_text: string;
};

type KnowledgeBlockEditorProps = {
  /** Initial blocks (BlockNote format). */
  initialContent?: BlockNoteBlock[] | null;
  /** Page title (controlled). */
  title: string;
  onTitleChange: (title: string) => void;
  /** Called when content or title should be saved (debounced). Receives JSON + normalized text for indexing. */
  onSave?: (payload: { title: string; content_json: BlockNoteBlock[]; content_text: string }) => void;
  /** Debounce ms for onSave. */
  debounceMs?: number;
  /** If true, constrain width for reading. */
  readMode?: boolean;
  /** Editable title and editor. */
  editable?: boolean;
};

export function KnowledgeBlockEditor({
  initialContent,
  title,
  onTitleChange,
  onSave,
  debounceMs = 800,
  readMode = false,
  editable = true,
}: KnowledgeBlockEditorProps) {
  const blocks = Array.isArray(initialContent) && initialContent.length > 0 ? initialContent : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- BlockNote PartialBlock from stored JSON
  const editor = useCreateBlockNote({ initialContent: blocks as any });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editor || !onSave) return;
    const sub = editor.onChange(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        const doc = editor.document;
        const content_text = blockNoteDocumentToText(doc as BlockNoteBlock[]);
        onSave({ title, content_json: doc as BlockNoteBlock[], content_text });
      }, debounceMs);
    });
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      (sub as () => void)();
    };
  }, [editor, onSave, debounceMs, title]);

  const handleTitleChange = (newTitle: string) => {
    onTitleChange(newTitle);
    if (onSave && editor) {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      titleDebounceRef.current = setTimeout(() => {
        titleDebounceRef.current = null;
        const doc = editor.document;
        const content_text = blockNoteDocumentToText(doc as BlockNoteBlock[]);
        onSave({ title: newTitle, content_json: doc as BlockNoteBlock[], content_text });
      }, 600);
    }
  };

  const wrapperClass = readMode ? "max-w-[900px] mx-auto w-full" : "w-full";

  return (
    <div className={wrapperClass}>
      <input
        type="text"
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        placeholder="Untitled"
        disabled={!editable}
        className="w-full mb-4 text-2xl font-semibold bg-transparent border-none text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-0"
        aria-label="Page title"
      />
      {/* Single outer chrome only — do not use [&_.bn-editor] (BlockNote nests multiple .bn-editor nodes). */}
      <div className="knowledge-bn-editor-root min-h-[200px] rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3">
        <BlockNoteView editor={editor} theme="dark" className="bn-editor-dark" />
      </div>
    </div>
  );
}
