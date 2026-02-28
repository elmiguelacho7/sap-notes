/**
 * Shared types for the tickets module.
 * Align with Supabase tables: tickets, clients, projects, profiles.
 */

export type TicketStatus =
  | "open"
  | "in_progress"
  | "pending"
  | "resolved"
  | "closed";

export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type Ticket = {
  id: string;
  title: string;
  status: TicketStatus | string | null;
  priority: TicketPriority | string | null;
  client_id: string | null;
  project_id: string | null;
  created_by: string | null;
  assigned_to: string | null;
  due_date: string | null;
  error_code: string | null;
  category: string | null;
  source: string | null;
  created_at: string;
};

/** Full ticket row for detail view (includes description, updated_at, closed_at, scope_items). */
export type TicketDetailRow = Ticket & {
  description?: string | null;
  updated_at?: string | null;
  closed_at?: string | null;
  scope_items?: string[] | null;
};

export type TicketDetail = TicketDetailRow & {
  client_name: string | null;
  project_name: string | null;
  created_by_name: string | null;
  assigned_to_name: string | null;
};

export type TicketCommentDetail = {
  id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
  created_by_name: string | null;
};

export type TicketAttachmentDetail = {
  id: string;
  file_name: string;
  file_url: string;
  created_at: string;
};

export type TicketWithRelations = Ticket & {
  client_name: string | null;
  project_name: string | null;
  assignee_name: string | null;
};

export type ClientOption = {
  id: string;
  name: string;
};

export type ProjectOption = {
  id: string;
  name: string;
};

export type ProfileOption = {
  id: string;
  full_name: string | null;
};

export type TicketsFilterState = {
  status: string;
  priority: string;
  clientId: string;
  projectId: string;
  assigneeId: string;
  searchText: string;
};

export const TICKET_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "open", label: "Abierto" },
  { value: "in_progress", label: "En progreso" },
  { value: "pending", label: "Pendiente" },
  { value: "resolved", label: "Resuelto" },
  { value: "closed", label: "Cerrado" },
];

/** Status options for detail page (no "Todos"). */
export const TICKET_STATUS_OPTIONS_EDIT: { value: string; label: string }[] =
  TICKET_STATUS_OPTIONS.filter((o) => o.value !== "");

export const TICKET_PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

/** Priority options for detail page (no "Todas"). */
export const TICKET_PRIORITY_OPTIONS_EDIT: { value: string; label: string }[] =
  TICKET_PRIORITY_OPTIONS.filter((o) => o.value !== "");
