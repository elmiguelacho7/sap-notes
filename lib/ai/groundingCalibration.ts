/**
 * Phase 7–8: Grounding calibration & trust — confidence and evidence strength from real retrieval quality.
 * Phase 8: stricter project-documentation vs generic SAP, connected-doc topic alignment, SAP error reliability.
 */
import type { KnowledgeChunk } from "@/lib/ai/knowledgeSearch";
import type { RetrievalDebug } from "@/lib/ai/sapitoContext";
import { detectSapTaxonomy, type SapTaxonomySignal } from "@/lib/ai/sapTaxonomy";
import type { SapIntentCategory } from "@/lib/ai/sapitoIntent";
import { isProjectHistoryQuestion } from "@/lib/ai/sapitoIntent";
import { classifySource } from "@/lib/ai/sourceGovernance";

export type EvidenceStrength = "strong" | "partial" | "weak";

export type ProjectClaimSupport = "confirmed" | "partial" | "generic_only" | "none";

export type SapErrorCodeEvidence = "exact_in_sources" | "weak" | "none";

export type GroundingCalibration = {
  evidenceStrength: EvidenceStrength;
  projectClaimSupport: ProjectClaimSupport;
  confidenceLevel: "high" | "medium" | "low";
  sourceSummary: string;
  /** Phase 8: set for SAP error / troubleshooting questions only. */
  sapErrorCodeEvidence?: SapErrorCodeEvidence;
};

export const STRICT_PROJECT_TRUTH_V2_INTENTS = new Set([
  "project_history",
  "project_decision",
  "project_issue_resolution",
  "project_documentation_lookup",
]);

/** Project mode questions that require honest separation of project evidence vs generic SAP. */
export function isStrictProjectTruthQuestion(
  message: string,
  mode: "global" | "project",
  v2Intent?: string | null
): boolean {
  if (mode !== "project") return false;
  return (
    isProjectHistoryQuestion(message) ||
    isProjectDocumentationExistenceQuestion(message) ||
    (v2Intent != null && STRICT_PROJECT_TRUTH_V2_INTENTS.has(v2Intent))
  );
}

function norm(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function queryTokens(q: string): Set<string> {
  const t = norm(q).replace(/[^a-z0-9áéíóúñü]+/g, " ");
  return new Set(t.split(" ").filter((x) => x.length >= 3).slice(0, 28));
}

/** SAP message-style codes from the user query (e.g. M7170). */
export function extractSapMessageCodes(message: string): string[] {
  const u = (message ?? "").toUpperCase();
  const found = new Set<string>();
  for (const re of [/\bM[-:]?\s*(\d{3,5})\b/g, /\bM(\d{3,5})\b/g]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(u)) !== null) {
      found.add(`M${m[1]}`);
    }
  }
  const reMsg = /\bMESSAGE\s+M?\s*(\d{3,5})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = reMsg.exec(message ?? "")) !== null) {
    found.add(`M${m[1].toUpperCase()}`);
  }
  return Array.from(found).slice(0, 8);
}

function chunkHayForMatch(chunk: KnowledgeChunk, contentLen: number): string {
  return [
    chunk.title ?? "",
    chunk.source_name ?? "",
    chunk.topic ?? "",
    chunk.module ?? "",
    chunk.sap_component ?? "",
    chunk.content?.slice(0, contentLen) ?? "",
  ]
    .join(" ")
    .toUpperCase();
}

export function chunkMentionsSapCodes(chunk: KnowledgeChunk, codes: string[]): boolean {
  if (codes.length === 0) return false;
  const hay = chunkHayForMatch(chunk, 3500);
  return codes.some((c) => hay.includes(c));
}

/**
 * Lightweight overlap score between query and chunk. Used for ranking and calibration.
 * Phase 8: boosts when SAP message codes in the query appear in the chunk.
 */
export function chunkTopicOverlapScore(query: string, chunk: KnowledgeChunk, taxonomy?: SapTaxonomySignal): number {
  const qTokens = queryTokens(query);
  const tax = taxonomy ?? detectSapTaxonomy(query);
  const codes = extractSapMessageCodes(query);
  const hay = [
    chunk.title ?? "",
    chunk.source_name ?? "",
    chunk.topic ?? "",
    chunk.module ?? "",
    chunk.sap_component ?? "",
    chunk.content?.slice(0, 600) ?? "",
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  qTokens.forEach((tok) => {
    if (hay.includes(tok)) score += 2;
  });
  if (tax.domains.length > 0) {
    const mod = (chunk.module ?? "").toLowerCase();
    tax.domains.forEach((d) => {
      if (mod.includes(d)) score += 3;
    });
  }
  if (tax.themes.length > 0) {
    const topic = (chunk.topic ?? "").toLowerCase();
    tax.themes.forEach((t) => {
      if (topic.includes(t.replace(/_/g, " "))) score += 4;
    });
  }
  if (codes.length > 0) {
    const hayU = chunkHayForMatch(chunk, 1200);
    for (const c of codes) {
      if (hayU.includes(c)) score += 8;
    }
  }
  const cap = codes.length > 0 ? 28 : 24;
  return Math.min(cap, score);
}

/** True when the user asks whether project-specific documentation exists for a topic. */
export function isProjectDocumentationExistenceQuestion(message: string): boolean {
  if (!message || message.trim().length < 8) return false;
  const m = message.trim();
  const n = m
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const patterns =
    /\b(do we have|have we got|is there|any)\s+(documentation|docs?|documents?)\b/i.test(m) ||
    /\b(documentation|docs?)\s+(for|about|on)\s+(this|the)\s+(topic|project)\b/i.test(m) ||
    /\b(project[-\s]?specific)\s+(documentation|docs?)\b/i.test(m) ||
    /\b(tenemos|hay)\s+(documentaci[oó]n|docs?)\s*(para|sobre|de)?\s*(este|el)\s*(tema|proyecto)?\b/i.test(n) ||
    /\bdocumentaci[oó]n\s+(del|de este)\s+proyecto\b/i.test(m);

  const projectish =
    /\b(this|our|the)\s+project\b/i.test(m) ||
    /\b(este|nuestro)\s+proyecto\b/i.test(n) ||
    /\ben (este|el) proyecto\b/i.test(n);

  const topicRef =
    /\b(this|the)\s+topic\b/i.test(m) ||
    /\b(este|el)\s+tema\b/i.test(n) ||
    /\b(for this|about this)\b/i.test(m);

  const docForTopicInProject =
    /\b(documentation|docs?|documents?)\s+for\s+[\w\s]{2,40}\s+in\s+(this|our|the)\s+project\b/i.test(m) ||
    /\b(documentaci[oó]n|docs?)\s+(sobre|de|para)\s+[\wáéíóúñ\s]{2,40}\s+en\s+(este|el)\s+proyecto\b/i.test(n) ||
    /\b(project[-\s]?specific)\s+(documentation|docs?)\s+(for|about|on)\b/i.test(m);

  return (patterns && (projectish || topicRef)) || docForTopicInProject;
}

/** User explicitly asks what connected / linked documents say (summary intent). */
export function isConnectedDocsSummaryQuestion(message: string): boolean {
  const m = (message ?? "").trim();
  if (m.length < 8) return false;
  const n = m
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    /\bwhat\s+do\s+(the\s+)?connected\s+(docs?|documents?)\s+say\b/i.test(m) ||
    /\bwhat\s+(the\s+)?connected\s+(docs?|documents?)\s+(say|contain|mention)\b/i.test(m) ||
    /\b(qué|que)\s+dicen\s+(los\s+)?documentos?\s+conectados?\b/i.test(n) ||
    /\bresum(e|ir)\s+(los\s+)?documentos?\s+conectados?\b/i.test(n) ||
    /\bconnected\s+(docs?|documents?)\s+(say|summarize|summary)\b/i.test(m)
  );
}

function maxTopicScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  return Math.max(...scores);
}

function meanTopicScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export type GroundingCalibrationParams = {
  mode: "global" | "project";
  message: string;
  retrievalScopes: string[];
  retrievalDebug: RetrievalDebug;
  v2Intent?: string | null;
  /** Phase 8: legacy SAP classifier (needed for project-mode SAP error routing). */
  legacySapIntent?: SapIntentCategory | null;
  sapTaxonomy?: SapTaxonomySignal | null;
  contextualChunks: KnowledgeChunk[];
  memoryItemCount: number;
};

/** Phase 8: stricter overlap bars for connected docs as “strong” evidence. */
const P8_STRONG_CONNECTED_OL = 14;
const P8_PARTIAL_CONNECTED_OL = 9;
/** Phase 8: project-scoped doc must align this well to count as clear project documentation. */
const P8_STRONG_PROJECT_DOC_OL = 12;
const P8_PARTIAL_PROJECT_DOC_OL = 7;

export function computeGroundingCalibration(p: GroundingCalibrationParams): GroundingCalibration {
  const tax = p.sapTaxonomy ?? detectSapTaxonomy(p.message);
  const scores = p.contextualChunks.map((c) => chunkTopicOverlapScore(p.message, c, tax));
  const maxS = maxTopicScore(scores);
  const meanS = meanTopicScore(scores);

  const s = p.retrievalScopes;
  const hasMemory = p.memoryItemCount > 0;
  const hasConnected = s.includes("connected_documents_project") || s.includes("connected_documents");
  const hasProjectDocs = s.includes("project_documents");
  const hasOfficial = s.includes("official_sap") || s.includes("sap_general_knowledge");
  const hasGlobalKnowledge = s.includes("global_knowledge") || s.includes("fulltext_knowledge_pages");
  const usedRetrieval = p.retrievalDebug.usedRetrieval === true && (p.retrievalDebug.chunkCount ?? 0) > 0;

  const docExistenceQ = isProjectDocumentationExistenceQuestion(p.message);
  const connectedSummaryQ =
    isConnectedDocsSummaryQuestion(p.message) || p.v2Intent === "needs_connected_sources";

  const strictProject =
    p.mode === "project" &&
    (isProjectHistoryQuestion(p.message) ||
      docExistenceQ ||
      (p.v2Intent != null && STRICT_PROJECT_TRUTH_V2_INTENTS.has(p.v2Intent)));

  const projectScopedChunks = p.contextualChunks.filter(
    (c) => (c.scope_type === "project" || c.scope_type === "user") && !(c.external_ref ?? "").trim()
  );
  const connectedChunks = p.contextualChunks.filter((c) => (c.external_ref ?? "").trim() !== "");

  const maxP =
    projectScopedChunks.length === 0
      ? 0
      : maxTopicScore(projectScopedChunks.map((c) => chunkTopicOverlapScore(p.message, c, tax)));
  const maxC =
    connectedChunks.length === 0
      ? 0
      : maxTopicScore(connectedChunks.map((c) => chunkTopicOverlapScore(p.message, c, tax)));

  const isSapTroubleshooting =
    p.legacySapIntent === "sap_error" || p.v2Intent === "sap_error_troubleshooting";

  const queryCodes = extractSapMessageCodes(p.message);
  let sapErrorCodeEvidence: SapErrorCodeEvidence | undefined;
  if (isSapTroubleshooting) {
    if (queryCodes.length === 0) sapErrorCodeEvidence = "weak";
    else {
      const preferred = p.contextualChunks.filter((ch) => {
        const cls = classifySource(ch, p.mode);
        return cls === "official_sap" || cls === "curated_internal";
      });
      if (preferred.some((ch) => chunkMentionsSapCodes(ch, queryCodes))) sapErrorCodeEvidence = "exact_in_sources";
      else if (p.contextualChunks.some((ch) => chunkMentionsSapCodes(ch, queryCodes))) sapErrorCodeEvidence = "weak";
      else sapErrorCodeEvidence = "none";
    }
  }

  let projectClaimSupport: ProjectClaimSupport = "none";
  if (p.mode === "project" && docExistenceQ) {
    if (hasMemory && maxS >= 6) projectClaimSupport = "confirmed";
    else if (hasMemory) projectClaimSupport = "partial";
    else if (projectScopedChunks.length > 0 && maxP >= P8_STRONG_PROJECT_DOC_OL) projectClaimSupport = "confirmed";
    else if (projectScopedChunks.length > 0 && maxP >= P8_PARTIAL_PROJECT_DOC_OL) projectClaimSupport = "partial";
    else if (connectedChunks.length > 0 && maxC >= P8_STRONG_CONNECTED_OL) projectClaimSupport = "partial";
    else if (connectedChunks.length > 0) projectClaimSupport = "partial";
    else if (hasOfficial || hasGlobalKnowledge) projectClaimSupport = "generic_only";
    else if (usedRetrieval) projectClaimSupport = "partial";
  } else if (strictProject) {
    if (hasMemory && maxS >= 6) projectClaimSupport = "confirmed";
    else if (hasMemory) projectClaimSupport = "partial";
    else if (projectScopedChunks.length > 0 && maxP >= P8_STRONG_PROJECT_DOC_OL) projectClaimSupport = "confirmed";
    else if (projectScopedChunks.length > 0 && maxP >= P8_PARTIAL_PROJECT_DOC_OL) projectClaimSupport = "partial";
    else if (connectedChunks.length > 0 && maxC >= P8_STRONG_CONNECTED_OL) projectClaimSupport = "partial";
    else if (connectedChunks.length > 0) projectClaimSupport = "partial";
    else if (hasOfficial || hasGlobalKnowledge) projectClaimSupport = "generic_only";
    else if (usedRetrieval) projectClaimSupport = "partial";
  } else {
    if (hasOfficial || hasGlobalKnowledge) projectClaimSupport = "partial";
    else if (usedRetrieval) projectClaimSupport = "partial";
  }

  let evidenceStrength: EvidenceStrength = "weak";
  if (hasMemory && maxS >= 6) evidenceStrength = "strong";
  else if (hasMemory || (projectScopedChunks.length > 0 && maxP >= P8_STRONG_PROJECT_DOC_OL)) evidenceStrength = "strong";
  else if (connectedChunks.length > 0 && maxC >= P8_STRONG_CONNECTED_OL) evidenceStrength = "strong";
  else if (connectedChunks.length > 0 && maxC >= P8_PARTIAL_CONNECTED_OL) evidenceStrength = "partial";
  else if (projectScopedChunks.length > 0 || hasMemory) evidenceStrength = "partial";
  else if ((hasOfficial || hasGlobalKnowledge) && maxS >= 8) evidenceStrength = "partial";
  else if (hasOfficial || hasGlobalKnowledge || hasConnected) evidenceStrength = "partial";
  else if (usedRetrieval && meanS >= 4) evidenceStrength = "partial";

  if (p.mode === "project" && connectedChunks.length > 0 && maxC < P8_PARTIAL_CONNECTED_OL) {
    evidenceStrength = "weak";
  }

  let confidenceLevel: "high" | "medium" | "low" = "low";
  let sourceSummary = "Based on general SAP knowledge";

  if (p.mode === "global") {
    if (isSapTroubleshooting) {
      if (sapErrorCodeEvidence === "exact_in_sources" && hasOfficial && maxS >= 10) {
        confidenceLevel = "high";
        sourceSummary =
          "Retrieved official/curated sources mention this SAP message; confirm exact text in SAP (e.g. SE91)";
        evidenceStrength = maxS >= 12 ? "strong" : "partial";
      } else if (sapErrorCodeEvidence === "exact_in_sources") {
        confidenceLevel = "medium";
        sourceSummary =
          "Sources in context reference the message code; verify meaning and notes in your SAP system";
        evidenceStrength = "partial";
      } else if (sapErrorCodeEvidence === "weak") {
        confidenceLevel = maxS >= 12 ? "medium" : "low";
        sourceSummary =
          "Only indirect or non-authoritative mentions of the message; avoid a single definitive diagnosis";
        evidenceStrength = "weak";
      } else {
        confidenceLevel = "low";
        sourceSummary =
          "No indexed passage clearly tied to this SAP message; use SE91 / SAP Help and verify in the system";
        evidenceStrength = "weak";
      }
    } else if (!usedRetrieval && !hasOfficial && !hasGlobalKnowledge) {
      confidenceLevel = "low";
      sourceSummary = "Limited indexed context; general guidance";
    } else if (hasOfficial && (maxS >= 8 || (p.contextualChunks.length >= 2 && meanS >= 5))) {
      confidenceLevel = "high";
      sourceSummary = "Based on strong SAP documentation match";
    } else if (hasOfficial || hasGlobalKnowledge || hasConnected) {
      confidenceLevel = maxS >= 6 ? "medium" : "low";
      sourceSummary =
        maxS >= 6
          ? "Based on related platform / SAP documentation"
          : "Based on loosely related documentation; verify in system";
    }
  } else {
    // project mode
    if (strictProject) {
      if (docExistenceQ && (hasOfficial || hasGlobalKnowledge) && maxP < P8_PARTIAL_PROJECT_DOC_OL && !hasMemory) {
        confidenceLevel = "low";
        sourceSummary =
          "Some related SAP or platform material was found, but not clear project-specific documentation for this topic";
        evidenceStrength = "weak";
        projectClaimSupport = projectScopedChunks.length > 0 && maxP > 0 ? "partial" : "generic_only";
      } else if (hasMemory && maxS >= 6) {
        confidenceLevel = "high";
        sourceSummary = "Based on project memory / experience records for this topic";
      } else if (hasMemory) {
        confidenceLevel = "medium";
        sourceSummary = "Based on project memory; topic match is partial — verify details";
      } else if (projectScopedChunks.length > 0 && maxP >= P8_STRONG_PROJECT_DOC_OL) {
        confidenceLevel = "high";
        sourceSummary = "Based on project-synced documentation closely aligned to your question";
      } else if (projectScopedChunks.length > 0 && maxP >= P8_PARTIAL_PROJECT_DOC_OL) {
        confidenceLevel = "medium";
        sourceSummary = "Based on partially related project documentation";
      } else if (connectedSummaryQ && connectedChunks.length > 0) {
        confidenceLevel = maxC >= P8_STRONG_CONNECTED_OL ? "medium" : "low";
        sourceSummary =
          maxC >= P8_STRONG_CONNECTED_OL
            ? "Connected documents appear relevant to your current topic"
            : "Connected documents are available but not strongly aligned with your current topic — do not treat them as a direct answer";
        if (maxC < P8_STRONG_CONNECTED_OL) evidenceStrength = "weak";
      } else if (connectedChunks.length > 0 && maxC >= P8_STRONG_CONNECTED_OL) {
        confidenceLevel = "medium";
        sourceSummary = "Based on connected documentation that appears relevant to your topic";
      } else if (connectedChunks.length > 0) {
        confidenceLevel = "low";
        sourceSummary =
          "Connected documentation is only loosely related to your question — weak topic alignment";
        evidenceStrength = "weak";
      } else if (hasOfficial || hasGlobalKnowledge) {
        confidenceLevel = "low";
        sourceSummary =
          "SAP general knowledge only — not confirmed by project-specific records for this question";
        evidenceStrength = "weak";
        projectClaimSupport = "generic_only";
      } else if (!usedRetrieval) {
        confidenceLevel = "low";
        sourceSummary = "No project-specific evidence found in indexed context";
        evidenceStrength = "weak";
        projectClaimSupport = "none";
      } else {
        confidenceLevel = "low";
        sourceSummary = "Limited or weakly aligned evidence for this project question";
      }
    } else {
      // non-strict project SAP / general
      if (hasMemory && maxS >= 4) {
        confidenceLevel = "high";
        sourceSummary = "Based on project evidence and related context";
      } else if (hasProjectDocs && maxP >= P8_STRONG_PROJECT_DOC_OL) {
        confidenceLevel = "high";
        sourceSummary = "Based on project documentation aligned to the topic";
      } else if (hasConnected && maxC >= P8_STRONG_CONNECTED_OL) {
        confidenceLevel = "medium";
        sourceSummary = "Based on connected documentation with strong topic alignment";
      } else if (hasProjectDocs && maxP >= P8_PARTIAL_PROJECT_DOC_OL) {
        confidenceLevel = maxP >= 10 ? "medium" : "low";
        sourceSummary =
          maxP >= 10
            ? "Based on project documentation with partial topic alignment"
            : "Based on loosely related project documentation — verify";
      } else if (hasConnected && maxC >= P8_PARTIAL_CONNECTED_OL) {
        confidenceLevel = "low";
        sourceSummary =
          "Connected docs relate partially to the topic; they may not answer the question directly";
        evidenceStrength = "partial";
      } else if (hasProjectDocs || hasConnected) {
        confidenceLevel = "low";
        sourceSummary = "Based on loosely related project or connected material — verify";
        evidenceStrength = "weak";
      } else if (hasOfficial || hasGlobalKnowledge) {
        confidenceLevel = maxS >= 12 ? "medium" : "low";
        sourceSummary =
          maxS >= 12
            ? "Based on SAP / global knowledge relevant to the question"
            : "Based on general SAP material; limited direct match";
      } else if (usedRetrieval) {
        confidenceLevel = "low";
        sourceSummary = "Thin evidence in retrieved context";
      }

      if (p.mode === "project" && isSapTroubleshooting && sapErrorCodeEvidence != null) {
        if (sapErrorCodeEvidence === "none" || sapErrorCodeEvidence === "weak") {
          confidenceLevel = confidenceLevel === "high" ? "medium" : "low";
          sourceSummary =
            "SAP troubleshooting context without a clear indexed match for the message — verify in SAP before acting";
          evidenceStrength = "weak";
        }
      }
    }
  }

  // --- Micro-calibration (strict project + connected summary): last-mile confidence caps ---
  if (p.mode === "project") {
    const strongMem = hasMemory && maxS >= 6;
    const strongProjectDocMatch = projectScopedChunks.length > 0 && maxP >= P8_STRONG_PROJECT_DOC_OL;
    const strongConnectedAlign = connectedChunks.length > 0 && maxC >= P8_STRONG_CONNECTED_OL;
    const partialConnectedAlign = connectedChunks.length > 0 && maxC >= P8_PARTIAL_CONNECTED_OL;

    if (connectedSummaryQ) {
      // B) Connected-doc questions: never high; low unless there is real partial-or-better alignment on connected chunks.
      if (connectedChunks.length === 0 || !partialConnectedAlign) {
        confidenceLevel = "low";
        evidenceStrength = "weak";
        sourceSummary =
          "No clearly aligned connected documents in indexed context for this topic — avoid treating unrelated files as an answer";
      } else if (!strongConnectedAlign) {
        confidenceLevel = "medium";
        evidenceStrength = "partial";
        sourceSummary =
          "Connected documents overlap only partially with your topic — summarize cautiously and do not imply strong grounding";
      } else {
        confidenceLevel = "medium";
        evidenceStrength = "partial";
        sourceSummary =
          "Connected documents appear relevant to your topic; still prefer cautious wording (this question targets connected sources only)";
      }
    } else if (strictProject) {
      // A) Strict project (history, doc lookup, etc.): no strong memory, no strong project docs, no strong connected overlap → cap at low.
      if (!strongMem && !strongProjectDocMatch && !strongConnectedAlign) {
        confidenceLevel = "low";
        evidenceStrength = "weak";
        if (projectClaimSupport === "confirmed") projectClaimSupport = "partial";
      }
    }
  }

  const out: GroundingCalibration = {
    evidenceStrength,
    projectClaimSupport,
    confidenceLevel,
    sourceSummary,
  };
  if (sapErrorCodeEvidence !== undefined) out.sapErrorCodeEvidence = sapErrorCodeEvidence;
  return out;
}

/** Phase 8: strict prompting when the user asks for a connected-docs summary in project mode. */
export function isStrictConnectedDocsTopicQuestion(mode: "global" | "project", message: string, v2Intent?: string | null): boolean {
  if (mode !== "project") return false;
  return isConnectedDocsSummaryQuestion(message) || v2Intent === "needs_connected_sources";
}

function buildSapErrorTrustFragment(cal: GroundingCalibration): string {
  if (cal.sapErrorCodeEvidence === "exact_in_sources" && cal.confidenceLevel === "high") {
    return "\n\n[Mensajes SAP] El contexto incluye fuentes que citan el mensaje; pide siempre confirmar el texto exacto y la nota en SAP (p. ej. SE91) antes de cambios en producción.\n";
  }
  return `\n\n[Mensajes SAP — prudencia]\n- No presentes una única causa o procedimiento como certeza si el mensaje no aparece claramente en fuentes oficiales o curadas del contexto (evidencia: ${cal.sapErrorCodeEvidence ?? "débil"}).\n- Ofrece hipótesis y comprobaciones como posibilidades, no como diagnóstico definitivo.\n- Indica verificar el mensaje en la transacción correspondiente / SAP Help / notas SAP.\n`;
}

/** Short LLM instruction fragment (Spanish) from calibration. */
export function buildTrustLayerInstruction(
  cal: GroundingCalibration,
  strictProjectQuestion: boolean,
  opts?: { sapTroubleshooting?: boolean; strictConnectedDocSummary?: boolean }
): string {
  let out = "";

  if (strictProjectQuestion) {
    const lines: string[] = [
      "\n\n[Proyecto — rigor de evidencia]",
      `- Fuerza de evidencia: ${cal.evidenceStrength}. Soporte sobre el proyecto: ${cal.projectClaimSupport}.`,
    ];
    if (cal.projectClaimSupport === "generic_only" || cal.confidenceLevel === "low") {
      lines.push(
        "- No presentes documentación SAP genérica como confirmación de lo ocurrido en este proyecto.",
        "- Si no hay evidencia clara del proyecto, dilo explícitamente y distingue \"conocimiento SAP general\" de \"registro del proyecto\"."
      );
    } else if (cal.evidenceStrength === "partial") {
      lines.push("- La evidencia es parcial o indirecta: formula la respuesta con cautela (p. ej. \"hay material relacionado, pero no confirma del todo…\").");
    }
    lines.push("");
    out += lines.join("\n");
  } else if (cal.confidenceLevel === "low") {
    out +=
      "\n\n[Confianza en evidencia: baja] Indica con claridad si la respuesta es inferida o general. No afirmes certeza fuerte si el contexto es débil.\n";
  }

  if (opts?.strictConnectedDocSummary && cal.evidenceStrength === "weak") {
    out +=
      "\n[Documentos conectados] Si el material recuperado no está claramente alineado con el tema actual de la conversación, dilo: no lo presentes como respuesta directa a ese tema.\n";
  }

  if (opts?.sapTroubleshooting) {
    out += buildSapErrorTrustFragment(cal);
  }

  return out;
}
