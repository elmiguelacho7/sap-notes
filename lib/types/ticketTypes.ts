export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type TicketStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "closed"
  | "cancelled";

export interface Ticket {
  id: string;
  title: string;
  description: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  project_id: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}
