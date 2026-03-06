/**
 * Sapito Brain v1 — context builder.
 * Decides what structured data to fetch based on scope and builds a compact text summary
 * for injection into the assistant system prompt.
 * Optionally enriches with SAP Knowledge Engine (pgvector) results when the message looks like a technical question.
 */

import {
  getPlatformStats,
  getProjectOverview,
  getNotesInsights,
  type PlatformStats,
  type ProjectOverview,
  type NotesInsights,
} from "@/lib/ai/sapitoTools";
import { searchKnowledge, type KnowledgeChunk } from "@/lib/ai/knowledgeSearch";

export type SapitoScope = "global" | "project" | "notes";

export type BuildSapitoContextParams = {
  scope: SapitoScope;
  projectId?: string | null;
  message?: string;
};

/** Heuristic: message looks like an SAP technical question (transactions, errors, how-to, configuration). */
function looksLikeSapTechnicalQuestion(message: string | undefined): boolean {
  if (!message || message.trim().length < 12) return false;
  const m = message.toLowerCase().trim();
  const technicalTerms =
    /\b(sap|transacci[oó]n|error|m[oó]dulo|va01|vk01|mm01|fi01|configuraci[oó]n|c[oó]mo (configurar|resolver|hacer)|pasos|procedimiento|troubleshoot|tx\s*[a-z0-9]+)\b/i;
  const howTo = /\b(c[oó]mo|qué es|qué hace|d[oó]nde|cu[áa]ndo)\b/i;
  return technicalTerms.test(m) || (howTo.test(m) && m.length > 20);
}

/**
 * Builds a single compact context string for the model prompt.
 * Calls the appropriate tool(s) based on scope; on any failure returns partial or empty context.
 * When the message looks like an SAP technical question, adds semantic search results from knowledge_documents.
 */
export async function buildSapitoContext(
  params: BuildSapitoContextParams
): Promise<string> {
  const { scope, projectId, message } = params;
  const sections: string[] = [];

  try {
    if (scope === "global") {
      const stats = await getPlatformStats();
      sections.push(formatPlatformSummary(stats));
    } else if (scope === "project" && projectId?.trim()) {
      const overview = await getProjectOverview(projectId.trim());
      sections.push(formatProjectSummary(overview));
    } else if (scope === "notes") {
      const insights = await getNotesInsights(10);
      sections.push(formatNotesSummary(insights));
    }

    if (sections.length === 0 && scope === "global") {
      const stats = await getPlatformStats();
      sections.push(formatPlatformSummary(stats));
    }

    // SAP Knowledge Engine: semantic search when message looks like a technical question
    if (looksLikeSapTechnicalQuestion(message)) {
      try {
        const chunks = await searchKnowledge(message ?? "", 5);
        if (chunks.length > 0) {
          sections.push(formatKnowledgeContext(chunks));
        }
      } catch (err) {
        console.error("[sapitoContext] knowledge search error", err);
      }
    }
  } catch (err) {
    console.error("[sapitoContext] buildSapitoContext error", scope, projectId, err);
  }

  if (sections.length === 0) return "";
  return sections.join("\n\n");
}

function formatKnowledgeContext(chunks: KnowledgeChunk[]): string {
  const lines: string[] = ["Contexto SAP Knowledge (documentación técnica recuperada):"];
  const snippetLen = 220;
  for (const c of chunks) {
    const title = c.title || "(sin título)";
    const modulePart = c.module ? ` | Módulo: ${c.module}` : "";
    const summary = c.content.slice(0, snippetLen).trim() + (c.content.length > snippetLen ? "…" : "");
    lines.push(`- ${title}${modulePart}`);
    lines.push(`  Resumen: ${summary}`);
  }
  return lines.join("\n");
}

function formatPlatformSummary(s: PlatformStats): string {
  const lines: string[] = [
    "Resumen de la plataforma:",
    `- Proyectos totales: ${s.totalProjects}`,
    `- Proyectos activos (planificado/en progreso): ${s.activeProjects}`,
    `- Total de notas: ${s.totalNotes}`,
    `- Notas creadas hoy: ${s.notesToday}`,
  ];
  if (s.openTickets != null) {
    lines.push(`- Tickets abiertos (plataforma): ${s.openTickets}`);
  }
  return lines.join("\n");
}

function formatProjectSummary(p: ProjectOverview): string {
  const nameLine = p.projectName
    ? `Proyecto: ${p.projectName} (${p.projectId}).`
    : `Proyecto: ${p.projectId}.`;
  const lines: string[] = [
    "Resumen del proyecto:",
    nameLine,
    `- Tareas abiertas: ${p.openTasks}`,
    `- Tareas vencidas: ${p.overdueTasks}`,
    `- Tareas bloqueadas: ${p.blockedTasks}`,
    `- Tickets abiertos: ${p.openTickets}`,
    `- Tickets alta prioridad: ${p.highPriorityTickets}`,
    `- Actividades vencidas: ${p.overdueActivities}`,
    `- Actividades próximas: ${p.upcomingActivities}`,
  ];
  return lines.join("\n");
}

function formatNotesSummary(n: NotesInsights): string {
  const lines: string[] = [
    "Resumen de notas (insights):",
    `- Total de notas: ${n.totalNotes}`,
  ];
  if (n.topModules.length > 0) {
    lines.push(
      `- Módulos más frecuentes: ${n.topModules.map((m) => `${m.name} (${m.count})`).join(", ")}`
    );
  }
  if (n.topErrorCodes.length > 0) {
    lines.push(
      `- Códigos de error más frecuentes: ${n.topErrorCodes.map((e) => `${e.code} (${e.count})`).join(", ")}`
    );
  }
  if (n.topTransactions.length > 0) {
    lines.push(
      `- Transacciones más mencionadas: ${n.topTransactions.map((t) => `${t.code} (${t.count})`).join(", ")}`
    );
  }
  return lines.join("\n");
}
