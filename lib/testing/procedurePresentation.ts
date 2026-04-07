import type { TestScriptStepRow } from "@/lib/types/testing";

/** Max characters before procedure UI shows collapsed / truncated preview. */
export const PROCEDURE_TEXT_PREVIEW_CHARS = 240;

export type TextPreview = {
  full: string;
  preview: string;
  truncated: boolean;
};

export function previewProcedureText(text: string, maxChars = PROCEDURE_TEXT_PREVIEW_CHARS): TextPreview {
  const full = text.replace(/\r\n/g, "\n").trim();
  if (!full) return { full: "", preview: "", truncated: false };
  if (full.length <= maxChars && full.split("\n").length <= 5) {
    return { full, preview: full, truncated: false };
  }
  const lines = full.split("\n");
  let preview = "";
  for (const line of lines) {
    const next = preview ? `${preview}\n${line}` : line;
    if (next.length > maxChars) {
      if (!preview) preview = line.slice(0, maxChars) + "…";
      else preview = preview + "…";
      return { full, preview, truncated: true };
    }
    preview = next;
    if (preview.split("\n").length >= 4) {
      return { full, preview: preview + "…", truncated: true };
    }
  }
  return { full, preview, truncated: full.length > preview.length };
}

/** Heuristic: long unstructured blob (reference / narrative), not a tight step line. */
export function isHeavyNarrativeBlock(text: string): boolean {
  const t = text.trim();
  if (t.length >= 520) return true;
  const lines = t.split(/\n/).filter((l) => l.trim().length > 0);
  if (lines.length >= 8) return true;
  if (t.length >= 280 && lines.length <= 2) return true;
  return false;
}

/**
 * Infer app / transaction bucket for grouping steps when `transaction_or_app` is empty.
 */
export function inferAppGroupLabel(step: TestScriptStepRow, generalLabel: string): string {
  const tx = step.transaction_or_app?.trim();
  if (tx) return tx.length > 120 ? tx.slice(0, 117) + "…" : tx;

  const name = step.step_name?.trim() ?? "";
  if (name) {
    const slashCode = name.match(/^(\/[A-Z0-9]{2,}\/[A-Z0-9]{2,})/i);
    if (slashCode) return slashCode[1];
    const tcode = name.match(/^([A-Z]{2,4}\d{2,4})\b/);
    if (tcode) return tcode[1];
    const tcode2 = name.match(/^([A-Z]{2,4})\d{0,3}\b/);
    if (tcode2 && tcode2[1].length >= 2) return tcode2[1];
    const fi = name.match(/^(SAP Fiori|Fiori|Launchpad|SAP GUI)\b/i);
    if (fi) {
      const seg = name.split(/[:\n]/)[0]?.trim() ?? fi[0];
      return seg.length > 100 ? seg.slice(0, 97) + "…" : seg;
    }
  }

  const instr = step.instruction?.trim() ?? "";
  const openApp = instr.match(/\b(?:open|launch|navigate to|go to|access)\s+([^.…\n]{2,56})/i);
  if (openApp) {
    const g = openApp[1].trim();
    return g.length > 100 ? g.slice(0, 97) + "…" : g;
  }

  const fioriApp = instr.match(
    /\b((?:Manage|Create|Display|Change|Post|Maintain|Review)\s+[A-Z][A-Za-z0-9]+(?:\s+[A-Za-z0-9]+){0,5})\b/
  );
  if (fioriApp) {
    const g = fioriApp[1].trim();
    if (g.length >= 8) return g.length > 80 ? g.slice(0, 77) + "…" : g;
  }

  if (/\b(?:SAP\s+)?Fiori\s+launchpad|SAP\s+Launchpad\b/i.test(instr)) {
    return "SAP Fiori launchpad";
  }

  const tcodeGuess = instr.match(/\b([A-Z]{2,4}\d{1,4}[A-Z]?)\b/);
  if (tcodeGuess && isLikelySapTcode(tcodeGuess[1])) return tcodeGuess[1];

  return generalLabel;
}

export type AppStepGroup = { label: string; steps: TestScriptStepRow[] };

export function groupStepsByApp(steps: TestScriptStepRow[], generalLabel: string): AppStepGroup[] {
  const ordered = [...steps].sort((a, b) => a.step_order - b.step_order);
  const labelOrder: string[] = [];
  const map = new Map<string, TestScriptStepRow[]>();
  for (const st of ordered) {
    const lab = inferAppGroupLabel(st, generalLabel);
    if (!map.has(lab)) {
      map.set(lab, []);
      labelOrder.push(lab);
    }
    map.get(lab)!.push(st);
  }
  return labelOrder.map((label) => ({ label, steps: map.get(label)! }));
}

/** Strip embedded "Instruction:", "Expected result:", etc. from imported blobs (display only). */
export function stripImportedLabelNoise(text: string): string {
  if (!text || typeof text !== "string") return "";
  const s = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .replace(
          /^(instruction|action|expected\s*result|expected|result|step|activity|procedure|notes?|overview|purpose|test\s*procedure|procedure\s*step|input\s*data|output|actual)\s*:\s*/i,
          ""
        )
        .trim()
    )
    .join("\n");
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

/** First block = executable instruction body; following blocks = supplemental notes (SAP help / narrative). */
export function splitInstructionAndNotes(instruction: string): { instruction: string; notes: string | null } {
  const cleaned = stripImportedLabelNoise(instruction).trim();
  if (!cleaned) return { instruction: "", notes: null };
  const parts = cleaned.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return { instruction: cleaned, notes: null };
  const first = parts[0];
  const rest = parts.slice(1).join("\n\n");
  if (rest.length < 24) return { instruction: cleaned, notes: null };
  return { instruction: first, notes: rest };
}

export type TestDataPair = { field: string; value: string };

const SAP_DATA_LABELS: { field: string; pattern: RegExp }[] = [
  { field: "Customer", pattern: /\b(?:customer|sold-?to|ship-?to|payer|bill-?to)\s*[:=]\s*([^\n]+)/i },
  { field: "Material", pattern: /\b(?:material|mat\.?|product)\s*[:=]\s*([^\n]+)/i },
  { field: "Plant", pattern: /\bplant\s*[:=]\s*([^\n]+)/i },
  { field: "Storage location", pattern: /\b(?:storage\s*location|sloc|stor\.?\s*loc\.?)\s*[:=]\s*([^\n]+)/i },
  { field: "Sales org.", pattern: /\b(?:sales\s*org(?:anization)?|vkorg)\s*[:=]\s*([^\n]+)/i },
  { field: "Company code", pattern: /\b(?:company\s*code|bukrs)\s*[:=]\s*([^\n]+)/i },
  { field: "Supplier", pattern: /\b(?:supplier|vendor)\s*[:=]\s*([^\n]+)/i },
  { field: "Purchasing org.", pattern: /\b(?:purchasing\s*org|pur\.?\s*org)\s*[:=]\s*([^\n]+)/i },
  { field: "Purchasing group", pattern: /\b(?:purchasing\s*group|pur\.?\s*group)\s*[:=]\s*([^\n]+)/i },
  { field: "PO", pattern: /\b(?:purchase\s*order|p\.?o\.?|order)\s*[:=#]?\s*([A-Z0-9][A-Z0-9\-./]{2,40})/i },
  { field: "Delivery", pattern: /\b(?:delivery|dn|outbound)\s*[:=#]?\s*([A-Z0-9][A-Z0-9\-./]{2,40})/i },
  { field: "Billing document", pattern: /\b(?:billing\s*doc(?:ument)?|invoice)\s*[:=#]?\s*([A-Z0-9][A-Z0-9\-./]{2,40})/i },
  { field: "Order type", pattern: /\b(?:order\s*type|auart)\s*[:=]\s*([^\n]+)/i },
  { field: "Billing type", pattern: /\b(?:billing\s*type)\s*[:=]\s*([^\n]+)/i },
  { field: "Batch", pattern: /\bbatch\s*[:=]\s*([^\n]+)/i },
  { field: "Distribution channel", pattern: /\b(?:distribution\s*channel|vtweg)\s*[:=]\s*([^\n]+)/i },
  { field: "Division", pattern: /\b(?:division|spart)\s*[:=]\s*([^\n]+)/i },
  { field: "Document type", pattern: /\b(?:document\s*type|doc\.?\s*type|doctype)\s*[:=]\s*([^\n]+)/i },
  {
    field: "Movement type",
    pattern: /\b(?:movement\s*type|mvt\s*type|bwart)\s*[:=]\s*([^\n]+)/i,
  },
];

/** Parse obvious key:value and SAP-ish labeled lines from free text + step bodies. */
export function parseTestDataKeyValues(...sources: (string | null | undefined)[]): TestDataPair[] {
  const seen = new Set<string>();
  const out: TestDataPair[] = [];
  const add = (field: string, value: string) => {
    const v = value.replace(/\s+/g, " ").trim();
    const f = field.trim();
    if (!f || !v || v.length > 500) return;
    const key = `${f.toLowerCase()}|${v.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ field: f, value: v });
  };

  for (const src of sources) {
    if (!src?.trim()) continue;
    const text = src.replace(/\r\n/g, "\n");
    for (const { field, pattern } of SAP_DATA_LABELS) {
      const m = text.match(pattern);
      if (m?.[1]) add(field, m[1]);
    }
    for (const line of text.split("\n")) {
      const kv = line.match(/^([^:]{2,42})\s*:\s*(.+)$/);
      if (kv && kv[1] && kv[2]) {
        const k = kv[1].trim();
        const v = kv[2].trim();
        if (/^(step|action|instruction|expected|result|procedure|notes?)$/i.test(k)) continue;
        if (k.length <= 40 && v.length >= 1 && v.length < 400) add(k, v);
      }
    }
  }
  return out.slice(0, 40);
}

/** Distinct apps / transactions / Fiori labels from steps (for setup summary). */
export function collectAppsUsedFromSteps(steps: TestScriptStepRow[], generalLabel: string): string[] {
  const byKey = new Map<string, string>();
  for (const st of steps) {
    const tx = st.transaction_or_app?.trim();
    if (tx) {
      const label = tx.length > 80 ? tx.slice(0, 77) + "…" : tx;
      const k = label.toLowerCase();
      if (!byKey.has(k)) byKey.set(k, label);
      continue;
    }
    const inf = inferAppGroupLabel(st, generalLabel);
    if (inf && inf !== generalLabel) {
      const k = inf.toLowerCase();
      if (!byKey.has(k)) byKey.set(k, inf);
    }
  }
  return Array.from(byKey.values());
}

/**
 * Merge many single-step “weak” app groups into general to reduce fragmentation.
 */
export type GroupStepsMergeOptions = {
  /** XLSX / wide scripts: merge more single-step buckets into General to reduce visual fragmentation. */
  aggressive?: boolean;
};

export function groupStepsByAppMerged(
  steps: TestScriptStepRow[],
  generalLabel: string,
  opts?: GroupStepsMergeOptions
): AppStepGroup[] {
  const raw = groupStepsByApp(steps, generalLabel);
  const maxGroups = opts?.aggressive ? 8 : 4;
  if (raw.length <= maxGroups) return raw;

  const maxStepsPerWeak = opts?.aggressive ? 3 : 2;
  const minWeakGroups = opts?.aggressive ? 2 : 3;

  const weak = raw.filter(
    (g) => g.label !== generalLabel && !isLikelySapTcode(g.label) && g.steps.length <= maxStepsPerWeak
  );
  if (weak.length < minWeakGroups) return raw;

  const weakSet = new Set(weak.map((g) => g.label));
  const bucket: TestScriptStepRow[] = [];
  const keep: AppStepGroup[] = [];
  for (const g of raw) {
    if (weakSet.has(g.label)) bucket.push(...g.steps);
    else keep.push(g);
  }
  bucket.sort((a, b) => a.step_order - b.step_order);
  const generalExisting = keep.find((g) => g.label === generalLabel);
  if (bucket.length > 0) {
    if (generalExisting) {
      generalExisting.steps = [...generalExisting.steps, ...bucket].sort((x, y) => x.step_order - y.step_order);
    } else {
      keep.push({ label: generalLabel, steps: bucket });
    }
  }
  keep.sort((a, b) => {
    const minA = Math.min(...a.steps.map((s) => s.step_order));
    const minB = Math.min(...b.steps.map((s) => s.step_order));
    return minA - minB;
  });
  return keep;
}

/** SAP GUI-style transaction / short code for mono chip. */
export function isLikelySapTcode(label: string): boolean {
  const t = label.trim();
  if (!t || t.length > 12) return false;
  if (/^(MIGO|SE16|SE38|SM30|SU01|SPRO)$/i.test(t)) return true;
  if (/^[A-Z]{2,4}\d{1,4}[A-Z]?$/i.test(t)) return true;
  if (/^\/[A-Z0-9]{2,}\/[A-Z0-9]{2,}/i.test(t)) return true;
  if (/^F\d{3,4}$/i.test(t)) return true;
  return false;
}

/** Split context field into list-friendly lines (bullets / numbered / lines). */
export function splitContextForDisplay(text: string): { lines: string[]; preferList: boolean } {
  const raw = stripImportedLabelNoise(text);
  if (!raw) return { lines: [], preferList: false };
  const lines = raw
    .split("\n")
    .map((l) => l.replace(/^\s*([•\-\*]|\d+[.)])\s+/, "").trim())
    .filter((l) => l.length > 0);
  const preferList = lines.length >= 2 && lines.every((l) => l.length < 200);
  return { lines: lines.length ? lines : [raw], preferList };
}

/** First meaningful sentence from instruction (imperative-friendly). */
function firstInstructionSentence(instr: string): string {
  const cleaned = stripImportedLabelNoise(instr).trim();
  if (!cleaned) return "";
  const first = cleaned.split("\n").find((l) => l.trim().length > 0) ?? cleaned;
  const endSentence = first.search(/[.!?](\s|$)/);
  const sentence = endSentence > 0 ? first.slice(0, endSentence + 1).trim() : first.trim();
  const line = sentence.length > 140 ? sentence.slice(0, 137) + "…" : sentence;
  return line;
}

/**
 * Short action line for the runbook: concise step name when it is not redundant with the instruction,
 * otherwise the first meaningful sentence of the instruction, then fallback.
 */
export function extractActionLabel(step: TestScriptStepRow, fallback: string): string {
  const name = stripImportedLabelNoise(step.step_name?.trim() ?? "");
  const instr = stripImportedLabelNoise(step.instruction?.trim() ?? "");
  const sentence = firstInstructionSentence(instr);

  if (name && instr) {
    const n = name.toLowerCase();
    const i0 = instr.toLowerCase();
    const prefixLen = Math.min(48, n.length);
    if (prefixLen >= 12 && i0.startsWith(n.slice(0, prefixLen))) {
      return sentence || (name.length <= 100 ? name : name.slice(0, 97) + "…") || fallback;
    }
    if (name.length > 180 && sentence && sentence.length < name.length * 0.6) {
      return sentence;
    }
  }

  if (name) {
    if (name.length <= 100) return name;
    return name.slice(0, 97) + "…";
  }

  return sentence || fallback;
}

function normCompact(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Body for the collapsed reference panel: stored reference_notes plus heavy objective/expected,
 * skipping blocks that duplicate prerequisites / business conditions / test data.
 */
export function mergeReferenceNotesForViewer(opts: {
  reference_notes: string | null | undefined;
  objective: string | null | undefined;
  expected_result: string | null | undefined;
  preconditions: string | null | undefined;
  business_conditions: string | null | undefined;
  test_data: string | null | undefined;
}): string | null {
  const setupBlocks = [opts.preconditions, opts.business_conditions, opts.test_data]
    .map((x) => normCompact(stripImportedLabelNoise(x ?? "")))
    .filter((x) => x.length > 0);

  const overlapsSetup = (text: string): boolean => {
    const n = normCompact(text);
    if (!n) return true;
    return setupBlocks.some(
      (s) => s === n || (n.length >= 56 && (s.includes(n) || n.includes(s)))
    );
  };

  const chunks: string[] = [];
  const ref = stripImportedLabelNoise(opts.reference_notes ?? "").trim();
  if (ref && !overlapsSetup(ref)) chunks.push(ref);

  const obj = stripImportedLabelNoise(opts.objective ?? "").trim();
  if (obj && (isHeavyNarrativeBlock(obj) || obj.length > 300) && !overlapsSetup(obj)) {
    const joined = chunks.join("\n\n");
    if (!joined.includes(obj.slice(0, Math.min(72, obj.length)))) {
      chunks.push(`## Objective\n${obj}`);
    }
  }

  const exp = stripImportedLabelNoise(opts.expected_result ?? "").trim();
  if (exp && (isHeavyNarrativeBlock(exp) || exp.length > 300) && !overlapsSetup(exp)) {
    const joined = chunks.join("\n\n");
    if (!joined.includes(exp.slice(0, Math.min(72, exp.length)))) {
      chunks.push(`## Expected result (script)\n${exp}`);
    }
  }

  const body = chunks.join("\n\n").trim();
  return body.length > 0 ? body : null;
}
