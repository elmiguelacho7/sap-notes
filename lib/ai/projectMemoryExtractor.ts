/**
 * Automatic project memory extraction from project notes.
 * Uses GPT-4o-mini to classify and extract structured memory (problem, solution, decision, etc.).
 */

import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const MEMORY_TYPES = [
  "problem",
  "solution",
  "decision",
  "workaround",
  "lesson",
  "configuration",
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

export type ExtractedMemoryItem = {
  memory_type: MemoryType;
  title: string | null;
  summary: string;
};

const SUMMARY_MAX_CHARS = 2000;
const TITLE_MAX_CHARS = 500;

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("Missing OPENAI_API_KEY for project memory extraction");
  return new OpenAI({ apiKey: key });
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max).trim() + "…";
}

const EXTRACTION_SYSTEM = `You are a SAP project knowledge extractor. Given a project note (title + body), extract structured memory items that are useful for future reference.

Output a JSON array of objects. Each object must have:
- memory_type: one of "problem", "solution", "decision", "workaround", "lesson", "configuration"
- title: short label (optional, can be null)
- summary: concise description (required, 1-3 sentences)

Rules:
- Only extract if the note clearly contains that type of content. Do not invent or extrapolate.
- problem: an issue or error encountered
- solution: how something was fixed or implemented
- decision: a design or process decision made
- workaround: a temporary or alternative way to achieve something
- lesson: something learned or a recommendation
- configuration: a setting, customizing, or technical configuration
- Return an empty array [] if the note has no extractable memory.
- Output only valid JSON, no markdown or explanation.`;

/**
 * Analyze note text and extract structured project memory items.
 * Returns an array of { memory_type, title, summary }.
 */
export async function extractProjectMemoryFromNote(noteText: string): Promise<ExtractedMemoryItem[]> {
  const text = (noteText ?? "").trim();
  if (!text || text.length < 10) return [];

  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 1500,
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM },
        {
          role: "user",
          content: `Extract project memory from this note (output JSON array only):\n\n${text.slice(0, 6000)}`,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content?.trim();
    if (!content) return [];

    const parsed = JSON.parse(content) as unknown;
    if (!Array.isArray(parsed)) return [];

    const results: ExtractedMemoryItem[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const raw = item as Record<string, unknown>;
      const type = raw.memory_type;
      const summaryRaw = raw.summary;
      if (!type || typeof type !== "string" || !MEMORY_TYPES.includes(type as MemoryType)) continue;
      if (!summaryRaw || typeof summaryRaw !== "string") continue;
      const summary = truncate(String(summaryRaw).trim(), SUMMARY_MAX_CHARS);
      if (!summary) continue;
      const title =
        raw.title != null && typeof raw.title === "string" && raw.title.trim()
          ? truncate(String(raw.title).trim(), TITLE_MAX_CHARS)
          : null;
      results.push({
        memory_type: type as MemoryType,
        title,
        summary,
      });
    }
    return results;
  } catch (err) {
    console.error("[projectMemoryExtractor] extract error", err);
    return [];
  }
}

/**
 * Store extracted memory items into project_memory, skipping duplicates (same project + same summary).
 * Logs [ProjectMemory extracted] in development.
 */
export async function storeExtractedProjectMemory(
  projectId: string,
  sourceType: string,
  sourceId: string | null,
  items: ExtractedMemoryItem[]
): Promise<void> {
  if (!projectId || items.length === 0) return;

  for (const item of items) {
    const summaryTrim = item.summary.trim();
    const { data: existing } = await supabaseAdmin
      .from("project_memory")
      .select("id")
      .eq("project_id", projectId)
      .eq("summary", summaryTrim)
      .limit(1)
      .maybeSingle();

    if (existing) continue;

    const { error } = await supabaseAdmin.from("project_memory").insert({
      project_id: projectId,
      memory_type: item.memory_type,
      title: item.title ?? null,
      summary: item.summary,
      source_type: sourceType,
      source_id: sourceId ?? null,
    });

    if (error) {
      console.error("[projectMemoryExtractor] insert error", error.message);
      continue;
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[ProjectMemory extracted]", {
        type: item.memory_type,
        summary: item.summary.slice(0, 100) + (item.summary.length > 100 ? "…" : ""),
        project_id: projectId,
      });
    }
  }
}
