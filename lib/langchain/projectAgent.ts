import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { HumanMessage } from "@langchain/core/messages";
import type {
  ProjectStatsResult,
  NoteSummary,
  ProjectLinkSummary,
} from "@/lib/services/projectService";
import type { SapIntentCategory } from "@/lib/ai/sapitoIntent";
import { shouldIncludeWorkspaceSummary, isSapKnowledgeIntent } from "@/lib/ai/sapitoIntent";
import { SYSTEM_PROMPT_SAP_KNOWLEDGE } from "@/lib/langchain/prompts/sapKnowledgePrompt";

// ==========================
// Env (OpenAI only; context is built by the API route)
// ==========================

function getOpenAIApiKey(): string {
  const openAIApiKey =
    typeof process !== "undefined" ? process.env.OPENAI_API_KEY : undefined;
  if (!openAIApiKey || String(openAIApiKey).trim() === "") {
    throw new Error("Missing OPENAI_API_KEY for project agent");
  }
  return openAIApiKey;
}

// ==========================
// Types
// ==========================

export type ProjectContext = {
  notes: {
    id: string;
    title: string | null;
    body: string | null;
    module: string | null;
    error_code: string | null;
    scope_item: string | null;
    created_at: string;
  }[];
  links: {
    name: string | null;
    url: string | null;
    link_type: string | null;
    created_at: string;
  }[];
};

/** Context passed from the API route; projectService is only called when projectId is present. */
export type AgentContext = {
  projectId: string | null;
  stats: ProjectStatsResult | null;
  notes: NoteSummary[];
  links: ProjectLinkSummary[];
  mode: "global" | "project" | "notes";
  /** Sapito Brain v1: structured context summary (platform/project/notes) for the prompt */
  sapitoContextSummary?: string;
  /** Optional SAP intent (error/transaction/customizing/process/solution_design) for answer format */
  sapIntent?: SapIntentCategory;
  /** Optional retrieval debug (chunk count, document titles); included in response in development only */
  retrievalDebug?: {
    chunkCount: number;
    documentTitles: string[];
    usedRetrieval: boolean;
    threshold?: string;
    usedProjectMemory?: boolean;
    memoryCount?: number;
  };
};

// ==========================
// Build context text (project mode)
// ==========================

function buildProjectContextText(notes: NoteSummary[], links: ProjectLinkSummary[]): string {
  let notesBlock: string;
  if (notes.length === 0) {
    notesBlock = "No hay notas registradas para este proyecto.";
  } else {
    notesBlock = notes
      .map((note, i) => {
        const lines: string[] = [];
        lines.push(`Nota ${i + 1}: ${note.title ?? "(sin título)"}`);
        const tags: string[] = [];
        if (note.module) tags.push(`Módulo: ${note.module}`);
        if (note.scope_item) tags.push(`Scope item: ${note.scope_item}`);
        if (note.error_code) tags.push(`Error: ${note.error_code}`);
        if (tags.length > 0) {
          lines.push(`Etiquetas: ${tags.join(" | ")}`);
        }
        if (note.body) {
          lines.push(`Detalle: ${note.body}`);
        }
        lines.push(`Fecha: ${note.created_at}`);
        return lines.join("\n");
      })
      .join("\n\n");
  }

  let linksBlock: string;
  if (links.length === 0) {
    linksBlock = "No hay enlaces registrados para este proyecto.";
  } else {
    linksBlock = links
      .map(
        (link, i) =>
          `Enlace ${i + 1}: ${link.name ?? "Sin nombre"} (${link.link_type ?? "Otro"}) → ${link.url ?? ""}`
      )
      .join("\n");
  }

  return `=== NOTAS DEL PROYECTO ===
${notesBlock}

=== ENLACES DEL PROYECTO ===
${linksBlock}`;
}

const GLOBAL_CONTEXT_PLACEHOLDER =
  "No hay contexto de un proyecto concreto. Responde de forma general según los conocimientos del asistente.";

const SYSTEM_PROMPT_PROJECT = `Eres Sapito, el asistente operativo del proyecto SAP. Actúas como copiloto práctico: resumir estado, señalar riesgos cuando los datos lo apoyen y proponer la siguiente acción.

Recibes: datos estructurados del proyecto (tareas abiertas/vencidas/bloqueadas, tickets abiertos/prioridad, actividades vencidas/próximas), notas del proyecto y enlaces.

Formato de respuesta cuando haya contexto útil:
1. Breve resumen de estado (1-2 frases).
2. Interpretación de riesgo o prioridad: si hay tareas vencidas, tickets urgentes/alta prioridad o actividades vencidas, menciónalo con calma y utilidad. No inventes riesgo si no hay datos que lo indiquen; no exageres señales débiles.
3. Siguiente acción sugerida (concreta y breve).

Reglas:
- Usa SIEMPRE los datos estructurados proporcionados para responder. No des respuestas genéricas si tienes números concretos.
- Si no hay información relevante para la pregunta, dilo con claridad y no inventes.
- Responde en ESPAÑOL. Tono: técnico, conciso, cercano y creíble para consultores SAP.
- Para errores SAP en notas: Diagnóstico, Causa, Posible solución.
- Mantén las respuestas cortas. Evita rodeos.`;

const SYSTEM_PROMPT_GLOBAL = `Eres Sapito, el asistente de la plataforma SAP Notes Hub. Sin proyecto concreto: das una vista de plataforma y orientas hacia dónde mirar.

Recibes: datos estructurados de plataforma (proyectos totales/activos, notas totales/creadas hoy, tickets abiertos si aplica).

Formato de respuesta cuando haya datos:
1. Breve resumen de la plataforma (proyectos activos, actividad de notas, tickets si aplica).
2. Si hay señales que requieran atención (p. ej. muchos tickets abiertos), menciónalo con calma. No inventes problemas si los datos no los muestran.
3. Sugerencia de dónde mirar a continuación cuando sea útil: dashboard, lista de proyectos, mi trabajo, notas.

Reglas:
- Usa los datos estructurados proporcionados. Responde en ESPAÑOL. Tono: claro, conciso, profesional.
- Si preguntan por errores o transacciones SAP en general, responde con Diagnóstico, Causa, Posible solución.
- Respuestas cortas. No verboso.`;

const SYSTEM_PROMPT_NOTES = `Eres Sapito, el asistente del hub de notas. Ayudas a ver patrones en la base de notas: módulos más usados, códigos de error frecuentes, transacciones mencionadas.

Recibes: resumen de insights (total notas, tops por módulo, error y transacción). Úsalo para responder con datos reales.

Formato de respuesta cuando haya datos:
1. Breve resumen de lo que muestran los datos (qué se repite, qué destaca).
2. Interpretación práctica: qué puede indicar esa repetición (p. ej. módulos más tocados, errores recurrentes).
3. Acción sugerida cuando sea útil: consolidar conocimiento repetido, crear una nota resumen, etiquetar temas recurrentes, revisar documentación de transacciones repetidas. Mantén la sugerencia concreta y breve.

Reglas:
- Responde en ESPAÑOL. Técnico, conciso, útil.
- Si no hay datos suficientes o no hay repetición clara, dilo con naturalidad.
- No inventes cifras. Solo usa los datos del resumen proporcionado.`;

// ==========================
// SAP intent → answer format instructions (Sapito consulting assistant)
// ==========================

const ANSWER_FORMAT_BY_INTENT: Record<Exclude<SapIntentCategory, "generic">, string> = {
  sap_error: `Formato de respuesta para esta consulta (error SAP):
- Error identificado / área probable
- Causa probable
- Dónde revisar (transacción, tabla, log)
- Acción sugerida`,

  sap_transaction: `Formato de respuesta para esta consulta (transacción SAP):
- Transacción/aplicación identificada
- Propósito
- Datos clave o uso típico
- Consideraciones importantes`,

  sap_customizing: `Formato de respuesta para esta consulta (customizing SAP):
- Escenario
- Análisis
- Pasos recomendados (IMG/customizing)
- Asignaciones o dependencias importantes`,

  sap_process: `Formato de respuesta para esta consulta (proceso SAP):
- Resumen del proceso
- Pasos clave
- Módulos/documentos relacionados
- Riesgos o controles`,

  sap_solution_design: `Formato de respuesta para esta consulta (diseño de solución SAP):
- Escenario
- Opciones de diseño
- Recomendación
- Impactos/consideraciones`,

  workspace_summary: `Formato de respuesta para esta consulta (resumen de plataforma):
- Resumen de la plataforma (proyectos, notas, tickets si aplica).
- Señales que requieran atención si las hay.
- Sugerencia de dónde mirar a continuación.`,

  project_status: `Formato de respuesta para esta consulta (estado del proyecto):
- Resumen de estado del proyecto (tareas, tickets, actividades).
- Riesgo o prioridad si los datos lo indican.
- Siguiente acción sugerida.`,
};

// ==========================
// Prompt template
// ==========================

const template = PromptTemplate.fromTemplate(`
{systemPrompt}

{knowledgeInstruction}

{sapFormatInstruction}

{sapitoContextBlock}

Contexto del proyecto:
----------------------
{projectContext}

Pregunta del usuario:
---------------------
{userMessage}
`);

// ==========================
// Run agent
// ==========================

export async function runProjectAgent(params: {
  message: string;
  context: AgentContext;
  sessionId?: string;
}): Promise<string> {
  const openAIApiKey = getOpenAIApiKey();
  const sessionId = params.sessionId?.trim() || "no-session";
  const ctx = params.context;

  const isProjectMode = ctx.mode === "project" && ctx.projectId != null;
  const isNotesMode = ctx.mode === "notes";
  const includeWorkspaceSummary = shouldIncludeWorkspaceSummary(ctx.sapIntent);

  // PART 1: Prompt selection by intent. project_status must use PROJECT prompt; do NOT use SAP_KNOWLEDGE for project_status.
  let systemPrompt: string;
  if (ctx.sapIntent === "project_status" && isProjectMode) {
    systemPrompt = SYSTEM_PROMPT_PROJECT;
  } else if (ctx.sapIntent === "workspace_summary") {
    systemPrompt = isNotesMode ? SYSTEM_PROMPT_NOTES : SYSTEM_PROMPT_GLOBAL;
  } else if (isSapKnowledgeIntent(ctx.sapIntent)) {
    systemPrompt = SYSTEM_PROMPT_SAP_KNOWLEDGE;
  } else if (includeWorkspaceSummary) {
    systemPrompt = isProjectMode ? SYSTEM_PROMPT_PROJECT : isNotesMode ? SYSTEM_PROMPT_NOTES : SYSTEM_PROMPT_GLOBAL;
  } else {
    systemPrompt = SYSTEM_PROMPT_SAP_KNOWLEDGE;
  }

  const promptUsed =
    systemPrompt === SYSTEM_PROMPT_PROJECT
      ? "SYSTEM_PROMPT_PROJECT"
      : systemPrompt === SYSTEM_PROMPT_GLOBAL
        ? "SYSTEM_PROMPT_GLOBAL"
        : systemPrompt === SYSTEM_PROMPT_NOTES
          ? "SYSTEM_PROMPT_NOTES"
          : "SYSTEM_PROMPT_SAP_KNOWLEDGE";
  if (process.env.NODE_ENV === "development") {
    console.log("[Sapito routing]", {
      intent: ctx.sapIntent,
      projectId: ctx.projectId ?? null,
      promptUsed,
    });
  }

  if (typeof systemPrompt !== "string" || !systemPrompt.trim()) {
    throw new Error("projectAgent: systemPrompt is missing or empty");
  }

  const sapitoContextBlock =
    ctx.sapitoContextSummary?.trim() != null && ctx.sapitoContextSummary.trim() !== ""
      ? includeWorkspaceSummary
        ? `Datos estructurados (usa esto como fuente de verdad para resumir, priorizar y sugerir siguiente acción):\n${ctx.sapitoContextSummary.trim()}`
        : `Documentación y contexto recuperado. Responde únicamente según este contenido. No incluyas resumen de proyecto ni de plataforma.\n${ctx.sapitoContextSummary.trim()}`
      : "";

  // When intent is project_status, prioritize project metrics/overview; do not use SAP-docs-only instruction.
  const knowledgeInstruction =
    ctx.sapIntent === "project_status" && isProjectMode
      ? "El usuario pregunta por el estado o progreso del proyecto. Usa como fuente principal los datos estructurados del proyecto anteriores (resumen del proyecto, tareas, tickets, actividades, notas). Puedes referirte a métricas como progreso, fase, notas, tickets y actividades. Responde en español con un resumen conciso."
      : ctx.sapitoContextSummary?.includes("Contexto SAP Knowledge") ||
        ctx.sapitoContextSummary?.includes("SAP Knowledge Context") ||
        ctx.sapitoContextSummary?.includes("Contexto del proyecto (documentos") ||
        ctx.sapitoContextSummary?.includes("Experiencia previa del proyecto SAP")
        ? `Prioridad de conocimiento para esta respuesta (respeta este orden):
1) Experiencia previa del proyecto (si aparece en el contexto): cuando la uses, EMPIEZA la respuesta con: "Based on previous SAP project experience..."
2) Documentación SAP recuperada (fragmentos en el contexto anterior) — máxima prioridad; la respuesta debe reflejarlos claramente.
3) Conocimiento de proyecto (documentos del proyecto si aparecen en el contexto).
4) Conocimiento general del modelo solo si lo anterior no cubre la pregunta.

Cuando el contexto anterior incluya "Experiencia previa del proyecto SAP" y la uses:
- EMPIEZA la respuesta con: "Based on previous SAP project experience..." y luego la explicación.
Cuando incluya documentación técnica recuperada (Contexto del proyecto o Contexto SAP Knowledge):
- PRIORIZA ese contenido: basa la respuesta en los fragmentos proporcionados.
- Inicia con una frase de grounding (ej.: "Según la documentación SAP...", "According to SAP documentation...") y luego la respuesta estructurada.
- Si la información es parcial, dilo con claridad; no inventes lo que no está en el contexto.
- NUNCA afirmes haber encontrado documentos si no se te proporcionó ninguno.
- Estructura sustancial: ## Escenario, ## Análisis, ## Pasos recomendados, ## Consideraciones. Usa markdown: ## para secciones, - o 1. para listas, **negrita** para términos clave. No uses HTML.`
        : !includeWorkspaceSummary
          ? `Cuando NO haya documentación recuperada en el contexto anterior:
- Responde con conocimiento general SAP de forma clara y útil.
- Indica brevemente que es respuesta general, por ejemplo: "No hay documentación específica indexada para esto; según conocimiento general SAP:" y luego la respuesta estructurada. No inventes documentos. Mantén tono seguro y profesional.
- Formato de salida: usa markdown para legibilidad: ## para secciones, - o 1. para listas, **negrita** para términos clave. No uses HTML.`
          : "";

  const structureNote =
    ctx.sapIntent && ctx.sapIntent !== "generic"
      ? "Presenta cada sección del formato indicado con ## (ej. ## Escenario, ## Análisis, ## Pasos recomendados) para mejor legibilidad. En respuestas muy breves puedes omitir headings."
      : "";

  const sapFormatInstruction =
    ctx.sapIntent && ctx.sapIntent !== "generic"
      ? `${ANSWER_FORMAT_BY_INTENT[ctx.sapIntent]}${structureNote ? `\n\n${structureNote}` : ""}`
      : "";

  const projectContext = includeWorkspaceSummary
    ? isProjectMode
      ? buildProjectContextText(ctx.notes, ctx.links)
      : isNotesMode
        ? "Contexto: panel de notas (insights de la base de notas)."
        : GLOBAL_CONTEXT_PLACEHOLDER
    : isProjectMode
      ? "Pregunta de conocimiento SAP o general. Responde solo con base en la documentación proporcionada. No incluyas resumen de proyecto ni contadores."
      : isNotesMode
        ? "Pregunta de conocimiento o general. Responde solo con base en la documentación proporcionada."
        : GLOBAL_CONTEXT_PLACEHOLDER;

  const prompt = await template.format({
    systemPrompt,
    knowledgeInstruction,
    sapFormatInstruction,
    sapitoContextBlock,
    projectContext,
    userMessage: params.message,
  });

  const fullContext = [sapitoContextBlock, projectContext].filter(Boolean).join("\n");
  const hasProjectOverview =
    /resumen del proyecto|Resumen del proyecto/i.test(ctx.sapitoContextSummary ?? "");
  const hasProjectMetrics =
    /tareas abiertas|tickets abiertos|actividades (vencidas|próximas)/i.test(ctx.sapitoContextSummary ?? "");
  const hasNotesSummary = ctx.notes.length > 0 || /NOTAS DEL PROYECTO|Nota \d+:/i.test(projectContext);
  const hasActivitiesSummary =
    /actividades (vencidas|próximas)|Actividades/i.test(ctx.sapitoContextSummary ?? "");
  const hasTicketsSummary =
    /tickets abiertos|alta prioridad|Tickets/i.test(ctx.sapitoContextSummary ?? "") ||
    (ctx.links?.length ?? 0) > 0;

  if (process.env.NODE_ENV === "development") {
    console.log("[Project Copilot debug]", {
      mode: ctx.mode,
      projectId: ctx.projectId ?? null,
      intent: ctx.sapIntent,
      promptUsed,
      hasProjectOverview,
      hasProjectMetrics,
      hasNotesSummary,
      hasActivitiesSummary,
      hasTicketsSummary,
      contextPreview: fullContext.slice(0, 800),
    });
  }

  const llm = new ChatOpenAI({
    openAIApiKey,
    modelName: "gpt-4o-mini",
    temperature: 0.2,
  });

  const response = await llm.invoke([new HumanMessage(prompt)], {
    metadata: {
      projectId: ctx.projectId ?? "global",
      sessionId,
      mode: ctx.mode,
    },
  });

  const content = response.content;
  const llmReply = typeof content === "string" ? content : String(content ?? "");
  return llmReply;
}
