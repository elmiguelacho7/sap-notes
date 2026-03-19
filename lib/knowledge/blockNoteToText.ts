/**
 * Convert BlockNote-style blocks to normalized plain text / markdown for search and indexing.
 * Handles paragraph, heading, bullet list, numbered list, checklist, quote, code, table.
 */

export type BlockNoteBlock = {
  type?: string;
  content?: unknown;
  children?: BlockNoteBlock[];
  props?: Record<string, unknown>;
  [key: string]: unknown;
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
  if (typeof content === "object" && "text" in (content as object)) {
    return String((content as { text: string }).text ?? "").trim();
  }
  return "";
}

function blockToLines(block: BlockNoteBlock, indent = ""): string[] {
  const text = getBlockText(block);
  const type = (block.type as string) || "paragraph";
  const lines: string[] = [];

  switch (type) {
    case "heading":
      lines.push(`${indent}# ${text}`);
      break;
    case "numberedListItem":
      lines.push(`${indent}1. ${text}`);
      break;
    case "bulletListItem":
      lines.push(`${indent}- ${text}`);
      break;
    case "checklistItem": {
      const checked = block.props?.checked === true;
      lines.push(`${indent}- ${checked ? "[x]" : "[ ]"} ${text}`);
      break;
    }
    case "blockquote":
      lines.push(`${indent}> ${text}`);
      break;
    case "codeBlock": {
      const lang = (block.props?.language as string) || "";
      lines.push(`${indent}\`\`\`${lang}`);
      lines.push(text);
      lines.push(`${indent}\`\`\``);
      break;
    }
    case "table": {
      const rows = (block.content as { type?: string; content?: unknown[] })?.content as BlockNoteBlock[] | undefined;
      if (Array.isArray(rows)) {
        rows.forEach((row) => {
          const cells = (row.content as BlockNoteBlock[] | undefined) ?? [];
          const cellTexts = cells.map((c) => getBlockText(c)).filter(Boolean);
          if (cellTexts.length > 0) lines.push(`${indent}| ${cellTexts.join(" | ")} |`);
        });
      }
      break;
    }
    case "paragraph":
    default:
      if (text) lines.push(`${indent}${text}`);
      break;
  }

  const children = block.children;
  if (Array.isArray(children) && children.length > 0) {
    children.forEach((child) => {
      lines.push(...blockToLines(child as BlockNoteBlock, indent + "  "));
    });
  }

  return lines;
}

/**
 * Convert BlockNote document (array of blocks) to plain text / markdown string for indexing.
 */
export function blockNoteDocumentToText(blocks: BlockNoteBlock[]): string {
  if (!Array.isArray(blocks) || blocks.length === 0) return "";
  const lines = blocks.flatMap((b) => blockToLines(b));
  return lines.join("\n").trim();
}
