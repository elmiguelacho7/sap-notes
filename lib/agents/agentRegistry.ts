/**
 * Central registry for agent visual identity and copy.
 * Sapito imagery is agent-only; no SAP trademarks in assets.
 * Paths are under /agents/sapito/; size-specific assets are `.svg`.
 */

import { getSapitoDefault, getSapitoThinking } from "@/lib/ui/sapito";

export type AgentAssetPaths = {
  avatarImage: string;
  mainImage: string;
  thinkingImage: string;
  smallIcon: string;
};

export type AgentDefinition = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  avatarImage: string;
  mainImage: string;
  thinkingImage: string;
  smallIcon: string;
};

/** Returns the image path for Sapito avatar or thinking state at the given pixel size. */
export function getSapitoAvatarSrc(sizePx: number, thinking?: boolean): string {
  return thinking ? getSapitoThinking(sizePx) : getSapitoDefault(sizePx);
}

const sapitoAvatarDefault = getSapitoDefault(40);
const sapitoThinkingDefault = getSapitoThinking(40);

const sapitoAssets: AgentAssetPaths = {
  avatarImage: sapitoAvatarDefault,
  mainImage: getSapitoDefault(64),
  thinkingImage: sapitoThinkingDefault,
  smallIcon: getSapitoDefault(32),
};

/**
 * General/global Sapito agent. Uses only global knowledge (project_id IS NULL).
 * Admin-curated, non-client-specific.
 */
export const sapitoGeneral: AgentDefinition = {
  id: "sapito-general",
  name: "Sapito General",
  subtitle: "Consultor SAP basado en conocimiento global",
  description: "Responde usando únicamente conocimiento global curado por administración. No accede a datos de proyectos concretos.",
  ...sapitoAssets,
};

/**
 * Project-scoped Sapito agent. Uses project knowledge first, then global fallback.
 * Never retrieves from other projects.
 */
export const sapitoProject: AgentDefinition = {
  id: "sapito-project",
  name: "Sapito del Proyecto",
  subtitle: "Especialista en el contexto de este proyecto",
  description: "Combina el conocimiento de este proyecto con la base global. No utiliza información de otros proyectos.",
  ...sapitoAssets,
};

const registry: Record<string, AgentDefinition> = {
  [sapitoGeneral.id]: sapitoGeneral,
  [sapitoProject.id]: sapitoProject,
};

export function getAgent(id: string): AgentDefinition | null {
  return registry[id] ?? null;
}

export function getSapitoGeneral(): AgentDefinition {
  return sapitoGeneral;
}

export function getSapitoProject(): AgentDefinition {
  return sapitoProject;
}
