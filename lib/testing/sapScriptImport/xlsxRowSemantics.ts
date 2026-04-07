/**
 * Classifies Excel / ALM-style rows so narrative and helper content does not become pseudo-steps.
 * Import-time only — does not change the persisted schema.
 */

const NARRATIVE_SECTION = new RegExp(
  String.raw`^\s*(purpose|overview|additional\s*information|appendix|process\s*integration|succeeding\s*processes|preceding\s*processes|notes?|general\s*info|background|introduction|scope|references?|glossary|assumptions?|dependencies?)\s*[:.\-–]\s*(.*)$`,
  "i"
);

const NARRATIVE_ONLY_LINE = new RegExp(
  String.raw`^\s*(purpose|overview|additional\s*information|appendix|process\s*integration|succeeding\s*processes|preceding\s*processes|notes?|general\s*info|background|introduction|scope)\s*[:.\-–]?\s*$`,
  "i"
);

/** Imperative / SAP-ish patterns that indicate an executable step. */
const EXECUTABLE_LEAD = new RegExp(
  String.raw`^(?:\d+[\.)]\s*)?(?:open|launch|click|double-?click|select|choose|enter|input|navigate|go\s+to|access|run|execute|call|start|verify|check|confirm|validate|ensure|compare|review|post|save|submit|create|change|display|maintain|assign|release|approve|reject|cancel|delete|add|remove|update|import|export|download|upload|print|schedule)\b`,
  "i"
);

const SAP_TECH_HINT = /\b(?:\/[A-Z0-9]{2,}\/[A-Z0-9]{2,}|[A-Z]{2,4}\d{1,4}[A-Z]?|t-?code|transaction|fiori|launchpad|sap\s*gui)\b/i;

export function hasExecutableVerb(text: string): boolean {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (!t) return false;
  const firstLine = t.split("\n").find((l) => l.trim().length > 0) ?? t;
  if (EXECUTABLE_LEAD.test(firstLine.trim())) return true;
  if (SAP_TECH_HINT.test(t)) return true;
  if (/^(?:select|choose)\s+.+\s+(from|in|on)\b/i.test(firstLine)) return true;
  return false;
}

export type XlsxRowSemantic =
  | { kind: "executable" }
  | { kind: "reference"; text: string }
  | { kind: "setup"; text: string }
  | { kind: "skip" };

function trimJoin(lines: string[]): string {
  return lines
    .map((l) => l.replace(/\r\n/g, "\n").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

/**
 * Decide whether this ALM / flat row should become a step or flow into reference/setup.
 */
export function classifyXlsxRowContent(
  instructionRaw: string,
  stepName: string | null | undefined,
  expected: string | null | undefined
): XlsxRowSemantic {
  const instruction = instructionRaw.replace(/\r\n/g, "\n").trim();
  if (!instruction) return { kind: "skip" };

  if (NARRATIVE_ONLY_LINE.test(instruction)) {
    return { kind: "skip" };
  }

  const m = instruction.match(NARRATIVE_SECTION);
  if (m) {
    const body = (m[2] ?? "").trim();
    const title = (m[1] ?? "").trim();
    if (body.length >= 8) {
      const label = title.charAt(0).toUpperCase() + title.slice(1);
      return { kind: "reference", text: `## ${label}\n${body}` };
    }
    if (/^precondition|prerequisite|setup|data\s*requirement/i.test(title)) {
      return body.length > 0 ? { kind: "setup", text: body } : { kind: "skip" };
    }
    return { kind: "skip" };
  }

  const name = (stepName ?? "").trim();
  const combined = trimJoin([name, instruction]);
  const looksNarrativeHeading =
    name.length > 0 &&
    name.length < 72 &&
    !hasExecutableVerb(name) &&
    /^(purpose|overview|appendix|notes?|background|scope|general)/i.test(name);

  if (looksNarrativeHeading) {
    return { kind: "reference", text: instruction.length >= 8 ? `## ${name}\n${instruction}` : `## ${name}` };
  }

  const longBlob = instruction.length >= 360 || instruction.split(/\n/).filter((l) => l.trim()).length >= 6;
  if (!hasExecutableVerb(instruction) && longBlob) {
    return { kind: "reference", text: instruction };
  }

  if (!hasExecutableVerb(instruction) && instruction.length >= 120 && instruction.length < 360) {
    const lower = instruction.toLowerCase();
    if (
      /\b(shall|must\s+be|is\s+used\s+to|provides\s+an?\s+overview|describes\s+the|this\s+section)/i.test(
        instruction
      ) ||
      lower.startsWith("the ") ||
      /^in\s+order\s+to\b/i.test(instruction)
    ) {
      return { kind: "reference", text: instruction };
    }
  }

  if (!hasExecutableVerb(instruction) && instruction.length < 120) {
    if (/^(precondition|prerequisite|business\s*condition|test\s*data\s*setup)\s*[:.\-–]/i.test(instruction)) {
      return { kind: "setup", text: instruction.replace(/^[^:]+:\s*/i, "").trim() || instruction };
    }
  }

  const exp = (expected ?? "").trim();
  if (!hasExecutableVerb(instruction) && !exp && name.length < 3 && instruction.split(/\s+/).length <= 8) {
    if (/^[A-Z][a-z]+(\s+[a-z]+){0,5}\.?$/.test(instruction) && instruction.length < 64) {
      return { kind: "reference", text: instruction };
    }
  }

  return { kind: "executable" };
}
