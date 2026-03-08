/**
 * Central registry for agent visual identity and copy.
 * Sapito imagery is agent-only; no SAP trademarks in assets.
 * Paths are under /agents/sapito/; size-specific assets: sapito-avatar-{24,32,40,64,128,256}.png and sapito-thinking-{24,32,40,64,128,256}.png.
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

/** Returns the image path for Sapito avatar or thinking state at the given pixel size. Avatar 24px uses 32px asset if sapito-avatar-24.png is missing. */
export function getSapitoAvatarSrc(sizePx: number, thinking?: boolean): string {
  const base = thinking ? "sapito-thinking" : "sapito-avatar";
  const size = sizePx === 24 && !thinking ? 32 : sizePx;
  return `${SAPITO_BASE}/${base}-${size}.png`;
}

const sapitoAvatarDefault = `${SAPITO_BASE}/sapito-avatar-40.png`;
const sapitoThinkingDefault = `${SAPITO_BASE}/sapito-thinking-40.png`;

const sapitoAssets: AgentAssetPaths = {
  avatarImage: sapitoAvatarDefault,
  mainImage: `${SAPITO_BASE}/sapito-avatar-64.png`,
  thinkingImage: sapitoThinkingDefault,
  smallIcon: `${SAPITO_BASE}/sapito-avatar-32.png`,
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
