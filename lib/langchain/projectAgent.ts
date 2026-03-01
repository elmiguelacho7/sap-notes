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
  mode: "global" | "project";
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

// ==========================
// System prompts
// ==========================

const SYSTEM_PROMPT_PROJECT = `Eres un asistente de IA que ayuda a un consultor senior SAP a gestionar un proyecto concreto de implementación SAP.

Recibes: la pregunta del usuario, las notas del proyecto y los enlaces del proyecto.

Reglas:
- Basa siempre tus respuestas en el contexto del proyecto cuando sea posible.
- Si hay notas relevantes (mismo error_code, módulo o tema), resúmelas y relaciónalas con la pregunta.
- Si hay enlaces útiles, indica cuáles pueden ayudar y por qué.
- Si el contexto no contiene información relevante, dilo con claridad y no inventes detalles.
- Responde en ESPAÑOL, con un tono claro, conciso y profesional.
- Para errores SAP, intenta estructurar la respuesta como: Diagnóstico, Causa, Posible solución.
- Si el usuario pide un resumen, ofrece un resumen ejecutivo y puntos clave.`;

const SYSTEM_PROMPT_GLOBAL = `You are a SAP implementation assistant without a specific project.
Answer the user's questions in a general way. If the user mentions a project explicitly, treat it as normal conversation context, but do not rely on any project-specific notes.
Responde en ESPAÑOL, con un tono claro, conciso y profesional.
Para errores SAP, intenta estructurar la respuesta como: Diagnóstico, Causa, Posible solución.`;

// ==========================
// Prompt template
// ==========================

const template = PromptTemplate.fromTemplate(`
{systemPrompt}

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

  const systemPrompt = isProjectMode
    ? SYSTEM_PROMPT_PROJECT
    : SYSTEM_PROMPT_GLOBAL;

  const projectContext = isProjectMode
    ? buildProjectContextText(ctx.notes, ctx.links)
    : GLOBAL_CONTEXT_PLACEHOLDER;

  const prompt = await template.format({
    systemPrompt,
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

  if (isProjectMode) {
    const debugHeader = `[LangChain Project Agent] Notas: ${ctx.notes.length}, Enlaces: ${ctx.links.length}.\n\n`;
    return debugHeader + llmReply;
  }

  return llmReply;
}
