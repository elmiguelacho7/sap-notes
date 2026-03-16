/**
 * Shared assignee (Responsable) primitives for SAP Notes Hub.
 * Use these for consistent assignee logic and UI across tasks, tickets, activities.
 */

export { AssigneeCell, type AssigneeProfile, type AssigneeCellProps } from "@/components/AssigneeCell";
export { AssigneePill, type AssigneePillProps } from "@/components/AssigneePill";
export { AssigneeSelect, type AssigneeSelectProps } from "@/components/AssigneeSelect";
export { useAssignableUsers } from "@/components/hooks/useAssignableUsers";
export type { AssignableUserOption, UseAssignableUsersParams, UseAssignableUsersResult } from "@/components/hooks/useAssignableUsers";
