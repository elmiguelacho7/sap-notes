/**
 * SAP Project Memory: store and reuse solutions discovered during projects.
 * Extract knowledge from ticket closed, project note created, document added.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getEmbedding } from "@/lib/knowledge/ingestHelpers";

export type MemorySourceType = "ticket_closed" | "project_note" | "document_added";

export type ProjectMemoryRecord = {
  title: string | null;
  problem: string | null;
  solution: string;
  module: string | null;
};

const SOLUTION_MAX_CHARS = 8000;
const MODULE_MAX_LENGTH = 120;

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max) + "…";
}

/**
 * Extract knowledge from a closed ticket.
 * Uses title as problem, description as solution; module from content or "general".
 */
export function extractKnowledgeFromTicket(
  title: string,
  description: string | null
): ProjectMemoryRecord {
  const problem = title.trim() || "Issue resolved";
  const solution = (description ?? "").trim() || problem;
  let module: string | null = "general";
  const lower = solution.toLowerCase();
  if (/\b(mm|sd|fi|co|pp|qm|pm|ps)\b/.test(lower)) {
    const match = lower.match(/\b(mm|sd|fi|co|pp|qm|pm|ps)\b/);
    if (match) module = match[1].toUpperCase();
  }
  return {
    title: truncate(title, 500),
    problem: truncate(problem, 2000),
    solution: truncate(solution, SOLUTION_MAX_CHARS),
    module: module ? truncate(module, MODULE_MAX_LENGTH) : null,
  };
}

/**
 * Extract knowledge from a project note.
 */
export function extractKnowledgeFromNote(
  title: string,
  body: string | null,
  noteModule: string | null
): ProjectMemoryRecord {
  const problem = title.trim() || "Note";
  const solution = (body ?? "").trim() || problem;
  const module = (noteModule ?? "general").trim() || "general";
  return {
    title: truncate(title, 500),
    problem: truncate(problem, 2000),
    solution: truncate(solution, SOLUTION_MAX_CHARS),
    module: truncate(module, MODULE_MAX_LENGTH),
  };
}

/**
 * Extract knowledge from a document added to the project.
 */
export function extractKnowledgeFromDocument(
  documentTitle: string,
  content: string,
  moduleLabel: string
): ProjectMemoryRecord {
  const problem = `Document added: ${documentTitle.trim()}`;
  const solution = content.trim() || documentTitle;
  return {
    title: truncate(documentTitle, 500),
    problem: truncate(problem, 2000),
    solution: truncate(solution, SOLUTION_MAX_CHARS),
    module: moduleLabel ? truncate(moduleLabel, MODULE_MAX_LENGTH) : "general",
  };
}

/**
 * Generate embedding from solution (and optionally problem) and store in project_knowledge_memory.
 */
export async function storeProjectMemory(
  projectId: string,
  userId: string | null,
  record: ProjectMemoryRecord,
  sourceType: MemorySourceType
): Promise<{ id: string } | null> {
  const textToEmbed = [record.problem, record.solution].filter(Boolean).join("\n\n");
  if (!textToEmbed.trim()) return null;

  try {
    const embedding = await getEmbedding(textToEmbed.slice(0, 8000));
    const { data, error } = await supabaseAdmin
      .from("project_knowledge_memory")
      .insert({
        project_id: projectId,
        user_id: userId ?? null,
        title: record.title ?? null,
        problem: record.problem ?? null,
        solution: record.solution,
        module: record.module ?? null,
        source_type: sourceType,
        embedding,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[projectMemory] store error", error.message);
      return null;
    }
    return data as { id: string };
  } catch (err) {
    console.error("[projectMemory] store error", err);
    return null;
  }
}
