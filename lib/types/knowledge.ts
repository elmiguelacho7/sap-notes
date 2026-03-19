export type KnowledgeSpaceVisibility = "private" | "project" | "org";

export type KnowledgeSpace = {
  id: string;
  owner_profile_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  visibility: KnowledgeSpaceVisibility;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type KnowledgePageType =
  | "how_to"
  | "troubleshooting"
  | "template"
  | "decision"
  | "meeting_note"
  | "config"
  | "cutover_runbook"
  | "reference";

export type KnowledgePage = {
  id: string;
  space_id: string;
  owner_profile_id: string;
  title: string;
  slug: string;
  page_type: KnowledgePageType;
  summary: string | null;
  is_published: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  /** Optional parent page for subpages. NULL = top-level page. */
  parent_page_id?: string | null;
  /** Block editor document JSON (e.g. BlockNote). */
  content_json?: Record<string, unknown> | null;
  /** Normalized plain text / markdown for search and Sapito indexing. */
  content_text?: string | null;
};

export type KnowledgeBlockType =
  | "rich_text"
  | "checklist"
  | "code"
  | "link"
  | "callout";

export type KnowledgeBlock = {
  id: string;
  page_id: string;
  block_type: KnowledgeBlockType;
  content_json: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type KnowledgeTag = {
  id: string;
  owner_profile_id: string;
  name: string;
  color: string | null;
  created_at: string;
};

export type KnowledgeSearchResult = {
  page_id: string;
  title: string;
  summary: string | null;
  page_type: KnowledgePageType;
  space_id: string;
  rank: number;
};
