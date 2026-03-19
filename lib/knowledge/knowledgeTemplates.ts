import type { BlockNoteBlock } from "@/lib/knowledge/blockNoteToText";

export type KnowledgeTemplateId = "sap_procedure" | "sap_configuration" | "troubleshooting_guide";

export const KNOWLEDGE_PAGE_TEMPLATES: Array<{
  id: KnowledgeTemplateId;
  label: string;
}> = [
  { id: "sap_procedure", label: "SAP Procedure" },
  { id: "sap_configuration", label: "SAP Configuration" },
  { id: "troubleshooting_guide", label: "Troubleshooting Guide" },
];

function heading(level: number, text: string): BlockNoteBlock {
  return { type: "heading", content: text, props: { level } };
}

function paragraph(text: string): BlockNoteBlock {
  return { type: "paragraph", content: text };
}

function callout(variant: string, text: string = ""): BlockNoteBlock {
  return { type: "blockquote", content: text, props: { variant } };
}

/**
 * BlockNote template blocks (fed into the existing editor adapter).
 * Stored format stays backward compatible: blockquote{props.variant} -> sapCallout.
 */
export function getKnowledgeTemplateBlocks(templateId: KnowledgeTemplateId): BlockNoteBlock[] {
  switch (templateId) {
    case "sap_procedure": {
      return [
        heading(2, "Title"),
        paragraph("Description"),
        callout("procedure", ""),
        callout("procedure", ""),
        callout("expected", ""),
      ];
    }
    case "sap_configuration": {
      return [
        heading(2, "Title"),
        paragraph("Purpose / context"),
        callout("configuration", ""),
        callout("expected", ""),
      ];
    }
    case "troubleshooting_guide": {
      return [
        heading(2, "Title"),
        paragraph("Context / symptoms"),
        callout("warning", ""),
        callout("procedure", ""),
        callout("expected", ""),
      ];
    }
    default: {
      // Ensures easy extension without breaking compile.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _exhaustiveCheck: never = templateId;
      return [];
    }
  }
}

