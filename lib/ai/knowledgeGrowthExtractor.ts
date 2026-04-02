/**
 * Phase 2: Knowledge Growth Engine — structured extraction (lightweight).
 *
 * - Deterministic prefiltering to avoid unnecessary LLM calls.
 * - LLM-assisted extraction when text looks high-signal.
 * - Output is normalized and safe to store into project_memory (text-only).
 */
import OpenAI from "openai";

export const KNOWLEDGE_TYPES = [
  "problem",
  "cause",
  "solution",
  "workaround",
  "decision",
  "lesson",
  "configuration",
  "reference",
  "process_note",
] as const;

export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number];

export type ExtractedKnowledgeItem = {
  memory_type: KnowledgeType;
  title: string | null;
  summary: string;
};

const SUMMARY_MAX_CHARS = 2200;
const TITLE_MAX_CHARS = 500;

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("Missing OPENAI_API_KEY for knowledge growth extraction");
  return new OpenAI({ apiKey: key });
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max).trim() + "…";
}

function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fast heuristic to decide whether LLM extraction is likely to be useful.
 * This keeps the pipeline selective and cheap.
 */
export function shouldAttemptKnowledgeExtraction(text: string): boolean {
  const t = normalize(text || "");
  if (!t || t.length < 80) return false;
  const lower = t.toLowerCase();
  // Strong signals: resolution/solution, errors, steps, config/customizing, decisions, learnings.
  if (
    /\b(error|dump|abend|st22|sm21|sm37|exception)\b/i.test(lower) ||
    /\b(solution|solucion|solución|fixed|fix|resuelto|resolvimos|workaround)\b/i.test(lower) ||
    /\b(root cause|causa|because|debido a)\b/i.test(lower) ||
    /\b(step|steps|paso|pasos|how to|como se|cómo se|procedure|procedimiento)\b/i.test(lower) ||
    /\b(spro|customizing|configuraci[oó]n|parametrizaci[oó]n|setting|tabla|sm30)\b/i.test(lower) ||
    /\b(decision|decidimos|acordamos|we chose|trade[-\s]?off)\b/i.test(lower) ||
    /\b(lesson|lecci[oó]n|aprendimos|best practice|recomendaci[oó]n)\b/i.test(lower)
  ) {
    return true;
  }
  return false;
}

const EXTRACTION_SYSTEM = `You are a SAP project knowledge extraction engine.
Given an input text (note / knowledge page / ticket resolution / connected document excerpt), extract reusable knowledge items.

Output ONLY a JSON array of objects. Each object MUST have:
- memory_type: one of "problem","cause","solution","workaround","decision","lesson","configuration","reference","process_note"
- title: short label (optional, can be null)
- summary: concise reusable summary (required, 1-3 sentences)

Rules:
- Only extract what is explicitly present. Do NOT invent.
- If the text is mostly generic or has no concrete reusable knowledge, return [].
- Prefer fewer, higher-signal items.
- Avoid duplicating the same idea in multiple items.
- Output valid JSON only (no markdown, no commentary).`;

export async function extractKnowledgeItemsFromText(
  input: { title?: string | null; text: string; hint?: string }
): Promise<ExtractedKnowledgeItem[]> {
  const text = normalize(input.text ?? "");
  if (!text) return [];

  // Deterministic skip: do not call LLM unless high-signal.
  if (!shouldAttemptKnowledgeExtraction([input.title, text].filter(Boolean).join("\n\n"))) {
    return [];
  }

  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 1600,
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM },
        {
          role: "user",
          content: `Extract reusable knowledge (JSON array only).
Context hint: ${input.hint ?? "n/a"}

TITLE:
${(input.title ?? "").slice(0, 400)}

TEXT:
${text.slice(0, 7000)}`,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content?.trim();
    if (!content) return [];

    const parsed = JSON.parse(content) as unknown;
    if (!Array.isArray(parsed)) return [];

    const results: ExtractedKnowledgeItem[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const raw = item as Record<string, unknown>;
      const type = raw.memory_type;
      const summaryRaw = raw.summary;
      if (!type || typeof type !== "string" || !KNOWLEDGE_TYPES.includes(type as KnowledgeType)) continue;
      if (!summaryRaw || typeof summaryRaw !== "string") continue;
      const summary = truncate(String(summaryRaw).trim(), SUMMARY_MAX_CHARS);
      if (!summary) continue;
      const title =
        raw.title != null && typeof raw.title === "string" && raw.title.trim()
          ? truncate(String(raw.title).trim(), TITLE_MAX_CHARS)
          : null;
      results.push({ memory_type: type as KnowledgeType, title, summary });
    }

    // Lightweight dedupe by normalized summary.
    const seen = new Set<string>();
    const out: ExtractedKnowledgeItem[] = [];
    for (const r of results) {
      const key = normalize(r.summary).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
    return out.slice(0, 8);
  } catch (err) {
    console.error("[knowledgeGrowthExtractor] extract error", err);
    return [];
  }
}

