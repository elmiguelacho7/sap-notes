import type { BlockNoteBlock } from "@/lib/knowledge/blockNoteToText";
import { blockNoteDocumentToText } from "@/lib/knowledge/blockNoteToText";

type TiptapNodeJSON = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNodeJSON[];
  text?: string;
};

function getBlockText(block: BlockNoteBlock): string {
  const content = block.content;
  if (content == null) return "";
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === "string" ? c : (c as { text?: string })?.text ?? ""))
      .join("")
      .trim();
  }
  if (typeof content === "object" && content && "text" in (content as object)) {
    return String((content as { text: string }).text ?? "").trim();
  }
  return "";
}

function getBlockTextRecursive(block: BlockNoteBlock): string {
  const main = getBlockText(block);
  const children = block.children;
  if (!Array.isArray(children) || children.length === 0) return main;
  const childText = children.map((c) => getBlockTextRecursive(c)).filter(Boolean).join("\n").trim();
  return [main, childText].filter(Boolean).join("\n").trim();
}

function textNode(text: string) {
  const t = text ?? "";
  return t ? [{ type: "text", text: t }] : [];
}

function paragraphNode(text: string): TiptapNodeJSON {
  return {
    type: "paragraph",
    content: textNode(text) as unknown as TiptapNodeJSON[],
  };
}

function headingNode(level: number, text: string): TiptapNodeJSON {
  return {
    type: "heading",
    attrs: { level },
    content: textNode(text) as unknown as TiptapNodeJSON[],
  };
}

function blockquoteNode(text: string): TiptapNodeJSON {
  return {
    type: "blockquote",
    content: [paragraphNode(text)],
  };
}

function sapCalloutNode(variant: string, text: string): TiptapNodeJSON {
  return {
    type: "sapCallout",
    attrs: { variant },
    // sapCallout contains block children (paragraphs).
    content: [paragraphNode(text)],
  };
}

function codeBlockNode(language: string, code: string): TiptapNodeJSON {
  return {
    type: "codeBlock",
    attrs: { language },
    content: textNode(code) as unknown as TiptapNodeJSON[],
  };
}

function horizontalRuleNode(): TiptapNodeJSON {
  return { type: "horizontalRule" };
}

function imageNode(src: string, alt?: string): TiptapNodeJSON {
  return {
    type: "image",
    attrs: { src, alt: alt ?? "" },
  };
}

function bulletListNode(items: string[]): TiptapNodeJSON {
  return {
    type: "bulletList",
    content: items.map((t) => ({
      type: "listItem",
      content: [paragraphNode(t)],
    })),
  };
}

function orderedListNode(items: string[]): TiptapNodeJSON {
  return {
    type: "orderedList",
    content: items.map((t) => ({
      type: "listItem",
      content: [paragraphNode(t)],
    })),
  };
}

function taskListNode(tasks: Array<{ text: string; checked: boolean }>): TiptapNodeJSON {
  return {
    type: "taskList",
    content: tasks.map((task) => ({
      type: "taskItem",
      attrs: { checked: task.checked },
      content: [paragraphNode(task.text)],
    })),
  };
}

function tableNode(rows: Array<Array<string>>): TiptapNodeJSON {
  return {
    type: "table",
    content: rows.map((row) => ({
      type: "tableRow",
      content: row.map((cellText) => ({
        type: "tableCell",
        content: [paragraphNode(cellText)],
      })),
    })),
  };
}

/**
 * Convert existing BlockNote blocks into a Tiptap document JSON structure.
 * Best-effort mapping for the types we support in the MVP.
 */
export function blockNoteBlocksToTiptapDoc(blocks: BlockNoteBlock[] | null | undefined): unknown {
  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  const nodes: TiptapNodeJSON[] = [];

  for (let i = 0; i < safeBlocks.length; i++) {
    const block = safeBlocks[i];
    const type = (block.type as string) || "paragraph";

    if (type === "bulletListItem") {
      const items: string[] = [];
      let j = i;
      while (j < safeBlocks.length && (safeBlocks[j].type as string) === "bulletListItem") {
        items.push(getBlockTextRecursive(safeBlocks[j]) || "");
        j++;
      }
      nodes.push(bulletListNode(items.filter((x) => x.trim() !== "")));
      i = j - 1;
      continue;
    }

    if (type === "numberedListItem") {
      const items: string[] = [];
      let j = i;
      while (j < safeBlocks.length && (safeBlocks[j].type as string) === "numberedListItem") {
        items.push(getBlockTextRecursive(safeBlocks[j]) || "");
        j++;
      }
      nodes.push(orderedListNode(items.filter((x) => x.trim() !== "")));
      i = j - 1;
      continue;
    }

    if (type === "checklistItem") {
      const tasks: Array<{ text: string; checked: boolean }> = [];
      let j = i;
      while (j < safeBlocks.length && (safeBlocks[j].type as string) === "checklistItem") {
        const b = safeBlocks[j];
        tasks.push({
          text: getBlockTextRecursive(b) || "",
          checked: b.props?.checked === true,
        });
        j++;
      }
      nodes.push(taskListNode(tasks.filter((t) => t.text.trim() !== "")));
      i = j - 1;
      continue;
    }

    const fallbackText = () => {
      const t = getBlockTextRecursive(block);
      if (t) return t;
      try {
        // Last resort: serialize content/props so we don't lose data silently.
        return JSON.stringify(block.content ?? block.props ?? block).slice(0, 2000);
      } catch {
        return "";
      }
    };

    switch (type) {
      case "heading": {
        const level = typeof block.props?.level === "number" ? block.props.level : 1;
        nodes.push(headingNode(level, getBlockTextRecursive(block)));
        break;
      }
      case "blockquote":
        {
          const variant = typeof block.props?.variant === "string" ? (block.props?.variant as string) : null;
          if (variant) nodes.push(sapCalloutNode(variant, getBlockTextRecursive(block)));
          else nodes.push(blockquoteNode(getBlockTextRecursive(block)));
        }
        break;
      case "codeBlock": {
        const language = (block.props?.language as string) || "";
        nodes.push(codeBlockNode(language, getBlockTextRecursive(block)));
        break;
      }
      case "table": {
        const content = block.content as { content?: unknown } | undefined;
        const rawRows = (content?.content as BlockNoteBlock[] | undefined) ?? [];
        const cellsRows: Array<Array<string>> = rawRows.map((row) => {
          const rawCells = (row.content as BlockNoteBlock[] | undefined) ?? [];
          return rawCells.map((cell) => getBlockTextRecursive(cell));
        });
        nodes.push(tableNode(cellsRows));
        break;
      }
      case "horizontalRule":
        nodes.push(horizontalRuleNode());
        break;
      case "image": {
        const src =
          (block.props?.src as string) ??
          ((block.content as { src?: string } | undefined)?.src as string) ??
          "";
        const alt =
          (block.props?.alt as string) ??
          ((block.content as { alt?: string } | undefined)?.alt as string) ??
          "";
        if (src) nodes.push(imageNode(src, alt));
        break;
      }
      case "paragraph":
        nodes.push(paragraphNode(getBlockTextRecursive(block)));
        break;
      default: {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[Knowledge adapter] Unknown BlockNote block type:", type, block);
        }
        nodes.push(paragraphNode(fallbackText()));
        break;
      }
    }
  }

  // Tiptap expects a root "doc" with a "content" array.
  return {
    type: "doc",
    content: nodes.length > 0 ? nodes : [paragraphNode("")],
  };
}

function extractTextFromTiptapNode(node: TiptapNodeJSON): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  if (Array.isArray(node.content) && node.content.length > 0) {
    return node.content.map(extractTextFromTiptapNode).join("");
  }
  return node.text ?? "";
}

function tiptapNodeToPlainTextBlocks(node: TiptapNodeJSON): string {
  return extractTextFromTiptapNode(node).trim();
}

/**
 * Convert a Tiptap document JSON back to the existing BlockNote blocks JSON contract.
 * This is the primary compatibility layer for storage + indexing.
 */
export function tiptapDocToBlockNoteBlocks(docJSON: unknown): BlockNoteBlock[] {
  const doc = docJSON as TiptapNodeJSON | null;
  const top = Array.isArray(doc?.content) ? doc!.content : [];
  const blocks: BlockNoteBlock[] = [];

  const pushParagraph = (text: string) => {
    blocks.push({ type: "paragraph", content: text });
  };

  for (const node of top) {
    const nodeType = node.type as string | undefined;
    switch (nodeType) {
      case "paragraph": {
        pushParagraph(tiptapNodeToPlainTextBlocks(node));
        break;
      }
      case "heading": {
        const level = typeof node.attrs?.level === "number" ? node.attrs!.level : undefined;
        blocks.push({ type: "heading", content: tiptapNodeToPlainTextBlocks(node), props: level != null ? { level } : {} });
        break;
      }
      case "blockquote": {
        blocks.push({ type: "blockquote", content: tiptapNodeToPlainTextBlocks(node) });
        break;
      }
      case "sapCallout": {
        const variant = typeof node.attrs?.variant === "string" ? node.attrs!.variant : "quote";
        blocks.push({
          type: "blockquote",
          content: extractTextFromTiptapNode(node).trim(),
          props: { variant },
        });
        break;
      }
      case "codeBlock": {
        const language = typeof node.attrs?.language === "string" ? node.attrs!.language : "";
        blocks.push({
          type: "codeBlock",
          content: tiptapNodeToPlainTextBlocks(node),
          props: { language },
        });
        break;
      }
      case "horizontalRule": {
        blocks.push({ type: "horizontalRule", content: "" });
        break;
      }
      case "image": {
        const src = typeof node.attrs?.src === "string" ? node.attrs!.src : "";
        const alt = typeof node.attrs?.alt === "string" ? node.attrs!.alt : "";
        blocks.push({ type: "image", content: { src, alt }, props: { src, alt } });
        break;
      }
      case "bulletList": {
        const listItems = node.content ?? [];
        listItems.forEach((li) => {
          // listItem -> content -> paragraph -> text
          blocks.push({ type: "bulletListItem", content: extractTextFromTiptapNode(li).trim() });
        });
        break;
      }
      case "orderedList": {
        const listItems = node.content ?? [];
        listItems.forEach((li) => {
          blocks.push({ type: "numberedListItem", content: extractTextFromTiptapNode(li).trim() });
        });
        break;
      }
      case "taskList": {
        const taskItems = node.content ?? [];
        taskItems.forEach((ti) => {
          const checked = ti.attrs?.checked === true;
          blocks.push({
            type: "checklistItem",
            content: extractTextFromTiptapNode(ti).trim(),
            props: { checked },
          });
        });
        break;
      }
      case "table": {
        const rows = node.content ?? [];
        const blockRows: BlockNoteBlock[] = rows.map((row) => {
          const cells = row.content ?? [];
          const cellBlocks: BlockNoteBlock[] = cells.map((cell) => ({
            type: (cell.type as string) === "tableHeader" ? "tableCell" : "tableCell",
            content: extractTextFromTiptapNode(cell).trim(),
          }));
          return { type: "tableRow", content: cellBlocks };
        });
        blocks.push({ type: "table", content: { content: blockRows } });
        break;
      }
      default: {
        // Fallback to paragraph text so we don't lose content.
        if (process.env.NODE_ENV !== "production") {
          console.warn("[Knowledge adapter] Unknown Tiptap node type:", nodeType, node);
        }
        pushParagraph(extractTextFromTiptapNode(node).trim());
        break;
      }
    }
  }

  return blocks;
}

export function tiptapDocToContentText(docJSON: unknown): string {
  return blockNoteDocumentToText(tiptapDocToBlockNoteBlocks(docJSON));
}

