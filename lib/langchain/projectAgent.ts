import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { HumanMessage } from "@langchain/core/messages";
import type {
  ProjectStatsResult,
  NoteSummary,
  ProjectLinkSummary,
} from "@/lib/services/projectService";

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
// Prompt template
// ==========================

const template = PromptTemplate.fromTemplate(`
{systemPrompt}

{knowledgeInstruction}

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

  const systemPrompt = isProjectMode
    ? SYSTEM_PROMPT_PROJECT
    : isNotesMode
      ? SYSTEM_PROMPT_NOTES
      : SYSTEM_PROMPT_GLOBAL;

  const sapitoContextBlock =
    ctx.sapitoContextSummary?.trim() != null && ctx.sapitoContextSummary.trim() !== ""
      ? `Datos estructurados (usa esto como fuente de verdad para resumir, priorizar y sugerir siguiente acción):\n${ctx.sapitoContextSummary.trim()}`
      : "";

  const knowledgeInstruction =
    ctx.sapitoContextSummary?.includes("Contexto SAP Knowledge") ||
    ctx.sapitoContextSummary?.includes("SAP Knowledge Context")
      ? "Cuando uses el 'Contexto SAP Knowledge' anterior: basa la respuesta en ese contenido; ofrece pasos procedimentales cuando aplique; no inventes información que no esté en el contexto; si el contexto es insuficiente, dilo con claridad."
      : "";

  const projectContext = isProjectMode
    ? buildProjectContextText(ctx.notes, ctx.links)
    : isNotesMode
      ? "Contexto: panel de notas (insights de la base de notas)."
      : GLOBAL_CONTEXT_PLACEHOLDER;

  const prompt = await template.format({
    systemPrompt,
    knowledgeInstruction,
    sapitoContextBlock,
    projectContext,
    userMessage: params.message,
  });

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
