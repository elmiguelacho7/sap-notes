"use client";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useEffect, useRef } from "react";

/** BlockNote block shape (partial). */
type BlockNoteBlock = Record<string, unknown>;

type NotionEditorProps = {
  /** Initial blocks (BlockNote format). */
  initialContent?: BlockNoteBlock[] | null;
  /** Page title (controlled). */
  title: string;
  onTitleChange: (title: string) => void;
  /** Called when document content changes (debounced). */
  onContentChange?: (blocks: BlockNoteBlock[]) => void;
  /** Debounce ms for onContentChange. */
  debounceMs?: number;
  /** If true, constrain width for reading (max-w-[900px] mx-auto). */
  readMode?: boolean;
  /** Editable title input. */
  editable?: boolean;
};

export function NotionEditor({
  initialContent,
  title,
  onTitleChange,
  onContentChange,
  debounceMs = 800,
  readMode = false,
  editable = true,
}: NotionEditorProps) {
  const blocks = Array.isArray(initialContent) && initialContent.length > 0 ? initialContent : undefined;
  const editor = useCreateBlockNote({ initialContent: blocks });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editor || !onContentChange) return;
    const sub = editor.onChange(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        onContentChange(editor.document);
      }, debounceMs);
    });
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      (sub as () => void)();
    };
  }, [editor, onContentChange, debounceMs]);

  const wrapperClass = readMode ? "max-w-[900px] mx-auto w-full" : "w-full";

  return (
    <div className={wrapperClass}>
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Untitled"
        disabled={!editable}
        className="w-full mb-4 text-2xl font-semibold bg-transparent border-none text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-0"
        aria-label="Page title"
      />
      <BlockNoteView editor={editor} theme="dark" className="bn-editor-dark" />
    </div>
  );
}
