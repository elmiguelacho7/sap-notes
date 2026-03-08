/**
 * Resolve a project by name or slug for global Sapito mode.
 * Returns single match, or result for ambiguity / no match (caller asks for clarification or says not found).
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserProjectIds } from "@/lib/metrics/platformMetrics";

/** Normalize for matching: accents, case, trim. */
function normalizeForMatch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export type ResolvedProject = {
  projectId: string;
  projectName: string;
};

export type ResolveResult =
  | { kind: "one"; project: ResolvedProject }
  | { kind: "none" }
  | { kind: "multiple"; projectNames: string[] };

/** Optional debug info returned in development for global project resolution. */
export type ResolveResultDebug = {
  accessibleProjectIdsCount: number;
  accessibleProjectNamesFull: string[];
  normalizedExtractedName: string;
  normalizedAccessibleProjectNames: string[];
  matchStrategyUsed: "exact" | "contains" | "reverse_contains" | "none";
  matchResult: "one" | "none" | "multiple";
  matchedProjectId: string | null;
  matchedProjectTitle: string | null;
};

/**
 * Resolve a project by name fragment (e.g. "Sauleda", "Eurotronic", "cccc").
 * Only considers projects the user is a member of.
 * Matching: exact match first, then fragment contained in name, then name contained in fragment.
 * - One strong match → { kind: 'one', project }.
 * - Multiple matches → { kind: 'multiple', projectNames }.
 * - No matches → { kind: 'none' }.
 * In development, returns optional .debug for [Global project resolution debug] logging.
 */
export async function resolveProjectByName(
  userId: string | null,
  nameFragment: string
): Promise<ResolveResult & { debug?: ResolveResultDebug }> {
  const rawFragment = nameFragment.trim();
  const fragment = cleanFragmentForMatch(rawFragment);
  if (!fragment || fragment.length < 1) {
    const emptyDebug: ResolveResultDebug = {
      accessibleProjectIdsCount: 0,
      accessibleProjectNamesFull: [],
      normalizedExtractedName: normalizeForMatch(rawFragment),
      normalizedAccessibleProjectNames: [],
      matchStrategyUsed: "none",
      matchResult: "none",
      matchedProjectId: null,
      matchedProjectTitle: null,
    };
    return { kind: "none", ...(process.env.NODE_ENV === "development" ? { debug: emptyDebug } : {}) };
  }

  const projectIds = await getUserProjectIds(userId);
  if (projectIds.length === 0) {
    if (process.env.NODE_ENV === "development") {
      console.log("[Project name resolution] no accessible projects", {
        userId: userId ? `${userId.slice(0, 8)}…` : null,
        nameFragment: fragment.slice(0, 50),
      });
    }
    const emptyDebug: ResolveResultDebug = {
      accessibleProjectIdsCount: 0,
      accessibleProjectNamesFull: [],
      normalizedExtractedName: normalizeForMatch(fragment),
      normalizedAccessibleProjectNames: [],
      matchStrategyUsed: "none",
      matchResult: "none",
      matchedProjectId: null,
      matchedProjectTitle: null,
    };
    return { kind: "none", ...(process.env.NODE_ENV === "development" ? { debug: emptyDebug } : {}) };
  }

  const { data: rows, error } = await supabaseAdmin
    .from("projects")
    .select("id, name")
    .in("id", projectIds);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.log("[Project name resolution] projects query error", error.message);
    }
    const emptyDebug: ResolveResultDebug = {
      accessibleProjectIdsCount: projectIds.length,
      accessibleProjectNamesFull: [],
      normalizedExtractedName: normalizeForMatch(fragment),
      normalizedAccessibleProjectNames: [],
      matchStrategyUsed: "none",
      matchResult: "none",
      matchedProjectId: null,
      matchedProjectTitle: null,
    };
    return { kind: "none", ...(process.env.NODE_ENV === "development" ? { debug: emptyDebug } : {}) };
  }
  if (!rows?.length) {
    const emptyDebug: ResolveResultDebug = {
      accessibleProjectIdsCount: projectIds.length,
      accessibleProjectNamesFull: [],
      normalizedExtractedName: normalizeForMatch(fragment),
      normalizedAccessibleProjectNames: [],
      matchStrategyUsed: "none",
      matchResult: "none",
      matchedProjectId: null,
      matchedProjectTitle: null,
    };
    return { kind: "none", ...(process.env.NODE_ENV === "development" ? { debug: emptyDebug } : {}) };
  }

  const projects = rows as { id: string; name: string | null }[];
  const accessibleProjectNamesFull = projects.map((p) => (p.name ?? "").trim()).filter(Boolean);
  const normalizedFragment = normalizeForMatch(fragment);
  const normalizedAccessibleProjectNames = accessibleProjectNamesFull.map(normalizeForMatch);

  let matches: { id: string; name: string | null }[] = [];
  let matchStrategyUsed: ResolveResultDebug["matchStrategyUsed"] = "none";

  // 1) Exact match (normalized)
  matches = projects.filter((p) => {
    const name = (p.name ?? "").trim();
    if (!name) return false;
    return normalizeForMatch(name) === normalizedFragment;
  });
  if (matches.length > 0) matchStrategyUsed = "exact";

  // 2) Fragment contained in project name (e.g. fragment "cccc" matches name "cccc")
  if (matches.length === 0) {
    matches = projects.filter((p) => {
      const name = (p.name ?? "").trim();
      if (!name) return false;
      const normalizedName = normalizeForMatch(name);
      return normalizedName.includes(normalizedFragment);
    });
    if (matches.length > 0) matchStrategyUsed = "contains";
  }

  // 3) Project name contained in fragment (e.g. fragment "cccc project" vs name "cccc")
  if (matches.length === 0) {
    matches = projects.filter((p) => {
      const name = (p.name ?? "").trim();
      if (!name) return false;
      const normalizedName = normalizeForMatch(name);
      return normalizedFragment.includes(normalizedName) && normalizedName.length >= 2;
    });
    if (matches.length > 0) matchStrategyUsed = "reverse_contains";
  }

  const matchResult: ResolveResultDebug["matchResult"] =
    matches.length === 0 ? "none" : matches.length === 1 ? "one" : "multiple";
  const matchedProjectId = matches.length === 1 ? matches[0].id : null;
  const matchedProjectTitle = matches.length === 1 ? (matches[0].name ?? null) : null;

  const debug: ResolveResultDebug = {
    accessibleProjectIdsCount: projectIds.length,
    accessibleProjectNamesFull,
    normalizedExtractedName: normalizedFragment,
    normalizedAccessibleProjectNames,
    matchStrategyUsed: matches.length === 0 ? "none" : matchStrategyUsed,
    matchResult,
    matchedProjectId,
    matchedProjectTitle,
  };

  if (matches.length === 0) {
    if (process.env.NODE_ENV === "development") {
      console.log("[Project name resolution] matchResult: none");
    }
    return { kind: "none", ...(process.env.NODE_ENV === "development" ? { debug } : {}) };
  }
  if (matches.length > 1) {
    if (process.env.NODE_ENV === "development") {
      console.log("[Project name resolution] matchResult: multiple", matches.map((m) => m.name));
    }
    return {
      kind: "multiple",
      projectNames: matches.map((m) => m.name ?? "").filter(Boolean),
      ...(process.env.NODE_ENV === "development" ? { debug } : {}),
    };
  }
  if (process.env.NODE_ENV === "development") {
    console.log("[Project name resolution] matchResult: one", {
      matchedProjectId: matches[0].id,
      matchedProjectTitle: matches[0].name,
    });
  }
  return {
    kind: "one",
    project: { projectId: matches[0].id, projectName: matches[0].name ?? "" },
    ...(process.env.NODE_ENV === "development" ? { debug } : {}),
  };
}

/** Trim punctuation, quotes, trailing/leading noise from fragment before matching. */
function cleanFragmentForMatch(fragment: string): string {
  let s = fragment.trim().replace(/^["']|["']$/g, "").trim();
  const trailing = /\s+(project|proyecto|going|doing|status|overview|summary)$/i;
  s = s.replace(trailing, "").trim();
  const leadingThe = /^the\s+/i;
  s = s.replace(leadingThe, "").trim();
  return s.replace(/[.,;:?!]+$/g, "").trim();
}

/**
 * Extract the project name fragment from a message.
 * Handles English and Spanish patterns; returns only the name (e.g. "cccc"), not "project cccc" or "the cccc project".
 *
 * English:
 * - "How is the cccc project going?" -> "cccc"
 * - "Give me a summary of project cccc" -> "cccc"
 * - "How is project cccc doing?" -> "cccc"
 * - "Tell me about the cccc project" -> "cccc"
 *
 * Spanish:
 * - "¿Cómo va el proyecto cccc?" -> "cccc"
 * - "Resumen del proyecto cccc" -> "cccc"
 * - "Dime cómo va cccc" -> "cccc"
 * - "Estado del proyecto cccc" -> "cccc"
 */
export function extractProjectNameFromMessage(message: string): string | null {
  const m = message.trim();
  if (!m || m.length < 2) return null;

  // Quoted name first: "cccc" or 'Sauleda'
  const quoted = /["']([^"']+)["']/;
  const quotedMatch = m.match(quoted);
  if (quotedMatch?.[1]) return cleanExtractedName(quotedMatch[1].trim());

  // "the X project" or "about the X project" -> X (must run before "project X" so "the cccc project going?" captures cccc not going)
  const theNameProject = /\b(?:about\s+)?(?:the\s+)?([a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF_.-]+)\s+project\b/gi;
  let match = theNameProject.exec(m);
  if (match?.[1]) {
    const name = match[1].trim();
    if (!isProjectNameStopword(name)) return cleanExtractedName(name);
  }

  // Spanish: "proyecto X" or "del proyecto X" -> X
  const spanishProyecto = /\b(?:del\s+)?proyecto\s+([a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF_.-]+)/gi;
  match = spanishProyecto.exec(m);
  if (match?.[1]) return cleanExtractedName(match[1].trim());

  // English: "project X" (X at end or before going/doing/summary etc) -> X
  const englishProjectAfter = /\bproject\s+([a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF_.-]+)(?:\s+(?:going|doing|summary|status|overview)?|[\s.?])/gi;
  match = englishProjectAfter.exec(m);
  if (match?.[1]) return cleanExtractedName(match[1].trim());

  // "How is the X project" / "How is project X" (X captured between keywords)
  const howIsThe = /\b(?:how\s+is|how's|summary\s+of|tell\s+me\s+about)\s+(?:the\s+)?([a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF_.-]+)\s*(?:\s+project)?/gi;
  match = howIsThe.exec(m);
  if (match?.[1]) return cleanExtractedName(match[1].trim());

  // "estado del proyecto X", "resumen del proyecto X"
  const estadoResumen = /\b(?:estado|resumen)\s+del\s+proyecto\s+([a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF_.-]+)/gi;
  match = estadoResumen.exec(m);
  if (match?.[1]) return cleanExtractedName(match[1].trim());

  // "¿Cómo va el proyecto X?" / "Dime cómo va X"
  const comoVa = /\b(?:c[oó]mo\s+va|dime\s+c[oó]mo\s+va)\s+(?:el\s+proyecto\s+)?([a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF_.-]+)/gi;
  match = comoVa.exec(m);
  if (match?.[1]) return cleanExtractedName(match[1].trim());

  return null;
}

/** Remove trailing/leading noise from extracted name: punctuation, quotes, trailing "project"/"proyecto"/"going"/"status", leading "the". */
function cleanExtractedName(name: string): string {
  let s = name.trim().replace(/^["']|["']$/g, "").trim();
  const trailing = /\s+(project|proyecto|going|doing|status|overview|summary)$/i;
  s = s.replace(trailing, "").trim();
  const leadingThe = /^the\s+/i;
  s = s.replace(leadingThe, "").trim();
  return s.replace(/[.,;:?!]+$/g, "").trim();
}

const PROJECT_NAME_STOPWORDS = new Set(
  "is,the,how,going,doing,summary,status,overview,project,proyecto,about,tell,me".split(",")
);
function isProjectNameStopword(word: string): boolean {
  return word.length < 2 || PROJECT_NAME_STOPWORDS.has(word.toLowerCase());
}

/**
 * Returns true if the message looks like a project-specific question (mentions a project name).
 */
export function isSpecificProjectQuestion(message: string): boolean {
  return extractProjectNameFromMessage(message) != null;
}

/**
 * Returns true if the message asks about "the project" / "este proyecto" without naming one (ambiguous).
 */
export function isAmbiguousProjectQuestion(message: string): boolean {
  const normalized = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (
    /\b(how is|how's|estado|resumen|summary|progress|going)\s+(the\s+)?project\b/i.test(
      normalized
    )
  )
    return true;
  if (/\b(este\s+proyecto|el\s+proyecto|this\s+project)\b/i.test(normalized))
    return true;
  if (/estado\s+del\s+proyecto|resumen\s+del\s+proyecto/i.test(normalized))
    return true;
  return false;
}
