/**
 * Lightweight SAP intent classification for Sapito.
 * Used to select answer format (error, transaction, customizing, process, solution design).
 * Regex/keyword based; no LLM call. Uses pattern detection to boost SAP intent confidence.
 */

import { hasSapPattern } from "@/lib/ai/sapPatternDetection";

export type SapIntentCategory =
  | "sap_error"
  | "sap_transaction"
  | "sap_customizing"
  | "sap_process"
  | "sap_solution_design"
  | "workspace_summary"
  | "project_status"
  | "project_risk"
  | "weekly_focus"
  | "generic";

/** Intents that are SAP knowledge questions; do NOT inject dashboard/project summary. */
export const SAP_KNOWLEDGE_INTENTS: SapIntentCategory[] = [
  "sap_error",
  "sap_transaction",
  "sap_customizing",
  "sap_process",
  "sap_solution_design",
];

export function isSapKnowledgeIntent(intent: SapIntentCategory | undefined): boolean {
  return intent != null && (SAP_KNOWLEDGE_INTENTS as readonly SapIntentCategory[]).includes(intent);
}

/** Only for these intents do we inject platform/project/notes summary (dashboard-style). */
export function shouldIncludeWorkspaceSummary(intent: SapIntentCategory | undefined): boolean {
  return intent === "workspace_summary" || intent === "project_status";
}

/** True when intent is weekly focus (productivity priorities); use workspace focus analyzer, not SAP docs. */
export function isWeeklyFocusIntent(intent: SapIntentCategory | undefined): boolean {
  return intent === "weekly_focus";
}

/** True when intent is project risk radar; use risk analyzer, not SAP docs. */
export function isProjectRiskIntent(intent: SapIntentCategory | undefined): boolean {
  return intent === "project_risk";
}

/** Normalize for accent-insensitive match: strip diacritics so "como" matches "cómo". */
function normalizeForMatch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizedContains(message: string, ...patterns: (string | RegExp)[]): boolean {
  const lower = message.toLowerCase().trim();
  const normalized = normalizeForMatch(message);
  for (const p of patterns) {
    if (typeof p === "string") {
      const patternNorm = normalizeForMatch(p);
      if (lower.includes(p.toLowerCase()) || normalized.includes(patternNorm)) return true;
    } else {
      if (p.test(message) || p.test(lower) || p.test(normalized)) return true;
    }
  }
  return false;
}

/** Known SAP terms: transactions, tech terms. Used to boost transaction/customizing detection. */
export const KNOWN_SAP_TERMS = [
  "VA01", "VA02", "VA03", "VK01", "VK02", "VK11", "VK12", "VL01N", "VL02N", "VL03N",
  "MIGO", "MIRO", "ME21N", "ME22N", "ME23N", "MM01", "MM02", "MM03",
  "SPRO", "SE38", "SE24", "SE80", "SM30", "SM31", "ST22", "SM21", "SM37",
  "IDOC", "IDocs", "ALE", "EDI",
  "HU", "ATP", "CCM", "CO-PA", "COPA", "EWM", "WM", "SD", "MM", "FI", "CO",
  "FICO", "S/4HANA", "S4HANA", "ECC", "BTP", "Fiori", "FIORI",
] as const;

/**
 * Keyword detection for project status / progress / overview questions.
 * Used when projectId is present to classify as project_status instead of generic.
 * Does NOT affect SAP intents (error, transaction, customizing, process) — those are checked first.
 */
export function isProjectStatusQuestion(message: string): boolean {
  if (!message || message.trim().length < 2) return false;
  const m = message.trim();
  return (
    normalizedContains(
      m,
      // Spanish
      "proyecto",
      "estado del proyecto",
      "progreso del proyecto",
      "cómo va el proyecto",
      "cómo va este proyecto",
      "resumen del proyecto",
      "situación del proyecto",
      "estado de mi proyecto",
      // English
      "project status",
      "project progress",
      "project health",
      "how is the project",
      "how's the project",
      "project overview",
      "project summary",
      "progress of the project",
      "progress of this project",
      "status of the project",
      "status of this project",
      "how the project is going",
      "how this project is going"
    ) ||
    /\b(project\s+(status|progress|health|overview|summary|metrics)|estado\s+del\s+proyecto|progreso\s+del\s+proyecto|resumen\s+del\s+proyecto)\b/i.test(m) ||
    /\b(how\s+is\s+(the|this)\s+project\s+(going|doing)?|how('s|\s+is)\s+(the|this)\s+project)\b/i.test(m)
  );
}

function containsKnownSapTerm(message: string): boolean {
  const normalized = message.replace(/\s+/g, " ").toLowerCase();
  for (const term of KNOWN_SAP_TERMS) {
    const t = term.toLowerCase().replace(/-/g, "");
    if (normalized.includes(t)) return true;
    if (new RegExp(`\\b${term}\\b`, "i").test(message)) return true;
  }
  return false;
}

/**
 * Classify user message into one SAP intent category.
 * Order: workspace_summary > project_status (inline) > sap_* > project_status (when projectId) > generic.
 * When projectId is present and the message looks like a project status question, returns project_status before generic.
 */
export function classifySapIntent(message: string, projectId?: string | null): SapIntentCategory {
  if (!message || message.trim().length < 3) return "generic";

  const m = message.trim();

  // Weekly focus / productivity priorities (before workspace_summary to avoid overlap)
  if (
    normalizedContains(
      m,
      "what should i focus on this week",
      "what needs my attention this week",
      "where should i focus now",
      "focus this week",
      "weekly priorities",
      "prioridades de esta semana",
      "en qué debo enfocarme esta semana",
      "qué necesita mi atención",
      "what should i focus on",
      "where should i focus",
      "what needs my attention",
      "weekly focus",
      "enfoque de la semana",
      "prioridades semanales"
    ) ||
    /\b(focus\s+(on\s+)?(this\s+)?week|weekly\s+priorit|prioridades\s+(de\s+)?(esta\s+)?semana)\b/i.test(m)
  ) {
    return "weekly_focus";
  }

  // Project risk radar (explicit risk questions; do not overlap with project status/summary)
  if (
    normalizedContains(
      m,
      "project risk",
      "what risks exist in this project",
      "is this project in danger",
      "is this project at risk",
      "what should worry me",
      "riesgos del proyecto",
      "qué riesgos hay en este proyecto",
      "este proyecto está en riesgo"
    ) ||
    /\b(que\s+riesgos\s+hay|riesgos\s+del\s+proyecto)\b/i.test(normalizeForMatch(m))
  ) {
    return "project_risk";
  }

  // Explicit request for workspace/dashboard/platform summary
  if (
    normalizedContains(
      m,
      "resumen de la plataforma",
      "resumen plataforma",
      "estado de la plataforma",
      "dashboard",
      "workspace summary",
      "resumen del workspace",
      "cuántos proyectos",
      "how many projects",
      "total de notas",
      "tickets abiertos",
      "tickets de la plataforma",
      "vista de plataforma",
      "platform summary",
      "platform overview",
      "resumen general"
    ) ||
    /\b(proyectos\s+totales|proyectos\s+activos|notas\s+totales|notas\s+creadas\s+hoy)\b/i.test(m)
  ) {
    return "workspace_summary";
  }

  // Explicit request for project status / project summary
  if (
    normalizedContains(
      m,
      "estado del proyecto",
      "resumen del proyecto",
      "project status",
      "project summary",
      "cómo va el proyecto",
      "estado de mi proyecto",
      "tareas abiertas",
      "tareas vencidas",
      "tareas bloqueadas",
      "tickets del proyecto",
      "actividades vencidas",
      "actividades próximas",
      "open tasks",
      "overdue tasks",
      "blocked tasks"
    ) ||
    /\b(qué\s+pasa\s+con\s+el\s+proyecto|resumen\s+del\s+proyecto)\b/i.test(m)
  ) {
    return "project_status";
  }

  if (
    normalizedContains(m, "error", "mensaje de error", "código de error", "errorno", "fallo", "exception", "dump", "abend") ||
    /\b(st22|sm21|sm37|sy-mandt|sy-msgno)\b/i.test(m) ||
    /\berror\s+(en|en la|al|al hacer)\b/i.test(m) ||
    /\b(qué es el error|por qué da error|por qué falla|causa del error)\b/i.test(m)
  ) {
    return "sap_error";
  }

  if (
    normalizedContains(m, "transacción", "transaction", "t-code", "tcode", "tc ", "transacción sap", "para qué sirve la transacción") ||
    /\b(tx\s*[a-z0-9]+|transacci[oó]n\s+[a-z0-9]+)\b/i.test(m) ||
    containsKnownSapTerm(m)
  ) {
    return "sap_transaction";
  }

  if (
    normalizedContains(m, "customizing", "configuración", "configurar", "img", "spro", "parámetro", "personalización", "personalizar", "tabla de customizing", "customizing sap") ||
    /\b(cómo configuro|cómo se configura|pasos de customizing|ruta img)\b/i.test(m)
  ) {
    return "sap_customizing";
  }

  if (
    normalizedContains(m, "proceso", "process", "flujo", "workflow", "procedimiento", "paso a paso", "cómo se hace", "cómo hacer", "cómo realizo", "pasos para") ||
    /\b(proceso\s+(de|en)|flujo\s+(de|en)|pasos\s+(para|del))\b/i.test(m)
  ) {
    return "sap_process";
  }

  if (
    normalizedContains(m, "diseño", "solución", "arquitectura", "solution design", "integración", "diseño de solución", "cómo implementar", "enfoque recomendado") ||
    /\b(soluci[oó]n\s+(técnica|funcional)|diseño\s+(de|técnico)|arquitectura\s+sap)\b/i.test(m)
  ) {
    return "sap_solution_design";
  }

  // Pattern boost: if no other category matched but message contains known SAP terms, treat as SAP process.
  if (hasSapPattern(m)) {
    return "sap_process";
  }

  // When in project context, treat project status/progress/overview questions as project_status (before generic).
  if (projectId && isProjectStatusQuestion(m)) {
    return "project_status";
  }

  return "generic";
}
