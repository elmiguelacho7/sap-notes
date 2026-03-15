/**
 * Context-aware route helpers for global vs project workspace.
 * Use these so navigation stays in the correct context (global or project).
 */

/**
 * Notes list: global /notes or project /projects/[id]/notes
 */
export function getNotesListHref(projectId: string | null | undefined): string {
  return projectId ? `/projects/${projectId}/notes` : "/notes";
}

/**
 * New note: global /notes/new or project /projects/[id]/notes with ?new=1 or use new page with projectId
 */
export function getNotesNewHref(projectId: string | null | undefined): string {
  return projectId ? `/notes/new?projectId=${projectId}` : "/notes/new";
}

/**
 * Note detail (same URL for both; back link is determined by note.project_id)
 */
export function getNoteDetailHref(noteId: string): string {
  return `/notes/${noteId}`;
}

/**
 * Tasks list: global /tasks or project /projects/[id]/tasks
 */
export function getTasksListHref(projectId: string | null | undefined): string {
  return projectId ? `/projects/${projectId}/tasks` : "/tasks";
}

/**
 * Tickets list: global /tickets or project /projects/[id]/tickets
 */
export function getTicketsListHref(projectId: string | null | undefined): string {
  return projectId ? `/projects/${projectId}/tickets` : "/tickets";
}

/**
 * Ticket detail. Pass projectId when coming from project context so error/back links can use it.
 */
export function getTicketDetailHref(
  ticketId: string,
  projectId?: string | null
): string {
  const base = `/tickets/${ticketId}`;
  return projectId ? `${base}?projectId=${projectId}` : base;
}

/**
 * New ticket: global /tickets/new or project /projects/[id]/tickets/new
 */
export function getTicketsNewHref(projectId: string | null | undefined): string {
  return projectId ? `/projects/${projectId}/tickets/new` : "/tickets/new";
}

/**
 * Knowledge list (Spaces & Pages): global /knowledge/documents or project /projects/[id]/knowledge
 */
export function getKnowledgeListHref(projectId: string | null | undefined): string {
  return projectId ? `/projects/${projectId}/knowledge` : "/knowledge/documents";
}

/**
 * Knowledge page editor (single route; breadcrumb back uses space.project_id)
 */
export function getKnowledgePageEditorHref(pageId: string): string {
  return `/knowledge/${pageId}`;
}

/**
 * Knowledge search (global only in current IA)
 */
export function getKnowledgeSearchHref(): string {
  return "/knowledge/search";
}

/**
 * Knowledge explorer home
 */
export function getKnowledgeExplorerHref(): string {
  return "/knowledge";
}
