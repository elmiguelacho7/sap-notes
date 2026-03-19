"use client";

import type { ReactNode } from "react";

type AssistantMessageContentProps = { content: string; variant?: "light" | "dark" };

const lightClasses = {
  h1: "text-slate-900",
  h2: "text-slate-900",
  h3: "text-slate-800",
  p: "text-slate-700",
  ul: "text-slate-700",
  ol: "text-slate-700",
  strong: "text-slate-800",
};
const darkClasses = {
  h1: "text-slate-100",
  h2: "text-slate-100",
  h3: "text-slate-200",
  p: "text-slate-300",
  ul: "text-slate-300",
  ol: "text-slate-300",
  strong: "text-slate-200",
};

/**
 * Renders assistant message content with safe, lightweight markdown-style formatting:
 * paragraphs, headings (##, ###), bullet lists, numbered lists, and bold.
 * No raw HTML or user-controlled markup — safe for LLM output.
 * Optimized for SAP copilot: clear hierarchy, readable spacing, premium typography.
 * Use variant="dark" when rendering inside dark cards (e.g. Project Copilot).
 */
export function AssistantMessageContent({ content, variant = "light" }: AssistantMessageContentProps) {
  if (!content || typeof content !== "string") return null;

  const trimmed = content.trim();
  if (!trimmed) return null;

  const theme = variant === "dark" ? darkClasses : lightClasses;
  const blocks = splitBlocks(trimmed);
  const nodes: ReactNode[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    // Single-line heading (### or ## or #)
    const h3Match = block.match(/^###\s+(.+)$/);
    const h2Match = !h3Match && block.match(/^##\s+(.+)$/);
    const h1Match = !h2Match && !h3Match && block.match(/^#\s+(.+)$/);
    if (h3Match) {
      nodes.push(
        <h3 key={i} className={`sapito-heading mt-5 first:mt-0 text-sm font-semibold tracking-tight ${theme.h3}`}>
          {renderInline(h3Match[1], theme.strong)}
        </h3>
      );
      continue;
    }
    if (h2Match) {
      nodes.push(
        <h2 key={i} className={`sapito-heading mt-5 first:mt-0 text-base font-semibold tracking-tight ${theme.h2}`}>
          {renderInline(h2Match[1], theme.strong)}
        </h2>
      );
      continue;
    }
    if (h1Match) {
      nodes.push(
        <h1 key={i} className={`sapito-heading mt-5 first:mt-0 text-lg font-semibold tracking-tight ${theme.h1}`}>
          {renderInline(h1Match[1], theme.strong)}
        </h1>
      );
      continue;
    }

    // Full block = bullet list
    const ulLines = block.split("\n").filter((line) => /^[\-\*]\s+/.test(line) || /^\s+[\-\*]\s+/.test(line));
    const isFullUl = ulLines.length > 0 && ulLines.length === block.split("\n").length;
    if (isFullUl && ulLines.length > 0) {
      nodes.push(
        <ul key={i} className={`sapito-list mt-3 first:mt-0 list-disc list-outside pl-4 space-y-2 text-sm leading-relaxed ${theme.ul}`}>
          {ulLines.map((line, j) => (
            <li key={j}>
              {renderInline(line.replace(/^\s*[\-\*]\s+/, ""), theme.strong)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Full block = numbered list
    const olLines = block.split("\n").filter((line) => /^\d+\.\s+/.test(line) || /^\s+\d+\.\s+/.test(line));
    const isFullOl = olLines.length > 0 && olLines.length === block.split("\n").length;
    if (isFullOl && olLines.length > 0) {
      nodes.push(
        <ol key={i} className={`sapito-list mt-3 first:mt-0 list-decimal list-outside pl-4 space-y-2 text-sm leading-relaxed ${theme.ol}`}>
          {olLines.map((line, j) => (
            <li key={j}>
              {renderInline(line.replace(/^\s*\d+\.\s+/, ""), theme.strong)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Mixed block: paragraph(s) + optional list(s) — parse line-by-line
    const lineNodes = renderMixedBlock(block, i, theme);
    nodes.push(...lineNodes);
  }

  return (
    <div className="sapito-message-content space-y-1 max-w-prose break-words text-[15px] leading-[1.6] [&>:first-child]:mt-0">
      {nodes}
    </div>
  );
}

type ThemeClasses = { p: string; ul: string; ol: string; strong: string };

/** Renders a block that may contain paragraphs and list lines mixed. */
function renderMixedBlock(block: string, blockKey: number, theme: ThemeClasses): ReactNode[] {
  const lines = block.split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i++;
      continue;
    }

    // Consecutive bullet lines
    if (/^[\-\*]\s+/.test(trimmed) || /^\s+[\-\*]\s+/.test(line)) {
      const ulLines: string[] = [];
      while (i < lines.length && (/^[\-\*]\s+/.test(lines[i].trim()) || /^\s+[\-\*]\s+/.test(lines[i]))) {
        ulLines.push(lines[i].replace(/^\s*[\-\*]\s+/, "").trim());
        i++;
      }
      out.push(
        <ul key={`${blockKey}-${key++}`} className={`sapito-list mt-3 list-disc list-outside pl-4 space-y-2 text-sm leading-relaxed ${theme.ul}`}>
          {ulLines.map((l, j) => (
            <li key={j}>{renderInline(l, theme.strong)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Consecutive numbered lines
    if (/^\d+\.\s+/.test(trimmed) || /^\s+\d+\.\s+/.test(line)) {
      const olLines: string[] = [];
      while (i < lines.length && (/^\d+\.\s+/.test(lines[i].trim()) || /^\s+\d+\.\s+/.test(lines[i]))) {
        olLines.push(lines[i].replace(/^\s*\d+\.\s+/, "").trim());
        i++;
      }
      out.push(
        <ol key={`${blockKey}-${key++}`} className={`sapito-list mt-3 list-decimal list-outside pl-4 space-y-2 text-sm leading-relaxed ${theme.ol}`}>
          {olLines.map((l, j) => (
            <li key={j}>{renderInline(l, theme.strong)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph: take until next list or empty line
    const paraLines: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      const t = l.trim();
      if (!t) break;
      if (/^[\-\*]\s+/.test(t) || /^\d+\.\s+/.test(t)) break;
      paraLines.push(t);
      i++;
    }
    if (paraLines.length > 0) {
      out.push(
        <p key={`${blockKey}-${key++}`} className={`sapito-paragraph mt-2.5 first:mt-0 text-sm leading-[1.65] ${theme.p}`}>
          {renderInline(paraLines.join(" "), theme.strong)}
        </p>
      );
    }
  }

  return out;
}

function splitBlocks(text: string): string[] {
  return text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
}

/** Renders inline content with **bold** only. No HTML. */
function renderInline(text: string, strongClass = "font-semibold text-slate-800"): ReactNode {
  const parts: ReactNode[] = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    const open = remaining.indexOf("**");
    if (open === -1) {
      if (remaining) parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
    if (open > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, open)}</span>);
    }
    remaining = remaining.slice(open + 2);
    const close = remaining.indexOf("**");
    if (close === -1) {
      parts.push(<span key={key++}>**</span>);
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
    parts.push(<strong key={key++} className={`font-semibold ${strongClass}`}>{remaining.slice(0, close)}</strong>);
    remaining = remaining.slice(close + 2);
  }
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
