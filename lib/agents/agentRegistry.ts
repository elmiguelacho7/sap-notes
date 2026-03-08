/**
 * Central registry for agent visual identity and copy.
 * Sapito imagery is agent-only; no SAP trademarks in assets.
 * Paths are under /agents/sapito/; missing files fall back to available ones.
 */

const SAPITO_BASE = "/agents/sapito";

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

/** Resolve image path; fallback to avatar if specific asset missing. If only one file exists (e.g. sapito-avatar.png), use it for all. */
function img(path: string, fallback: string): string {
  return path || fallback;
}

/** Single asset fallback: when only one Sapito image exists, use it for all slots. */
const singleAssetFallback = `${SAPITO_BASE}/sapito-avatar.png`;

const sapitoAvatar = `${SAPITO_BASE}/sapito-avatar.png`;
const sapitoMain = `${SAPITO_BASE}/sapito-main.png`;
const sapitoThinking = `${SAPITO_BASE}/sapito-thinking.png`;
const sapitoFavicon = `${SAPITO_BASE}/sapito-favicon.png`;

const sapitoAssets: AgentAssetPaths = {
  avatarImage: sapitoAvatar,
  mainImage: sapitoMain || singleAssetFallback,
  thinkingImage: img(sapitoThinking, sapitoAvatar),
  smallIcon: img(sapitoFavicon, sapitoAvatar),
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
