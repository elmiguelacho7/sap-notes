"use client";

import React from "react";
import { AssigneeDropdown } from "@/app/components/AssigneeDropdown";
import { useAssignableUsers } from "@/components/hooks/useAssignableUsers";

export type AssigneeSelectProps = {
  contextType: "global" | "project";
  projectId?: string | null;
  value?: string | null;
  onChange: (profileId: string | null) => void;
  allowUnassigned?: boolean;
  disabled?: boolean;
  placeholder?: string;
  variant?: "assigned" | "unassigned";
  className?: string;
  /** Ribbit light form styling (ticket/note create flows). */
  appearance?: "default" | "light";
};

/**
 * Reusable assignee selector for tasks, tickets, activities.
 * Loads options from project members (project) or global users (global).
 * Spanish label: "Responsable"; unassigned: "Sin asignar".
 */
export function AssigneeSelect({
  contextType,
  projectId,
  value,
  onChange,
  allowUnassigned = true,
  disabled = false,
  placeholder = "Sin asignar",
  variant,
  className = "",
  appearance = "default",
}: AssigneeSelectProps) {
  const { users, loading } = useAssignableUsers({
    contextType,
    projectId: contextType === "project" ? projectId : undefined,
  });

  const options = users.map((u) => ({ value: u.id, label: u.label }));
  const effectiveVariant = variant ?? (value ? "assigned" : "unassigned");

  return (
    <AssigneeDropdown
      options={options}
      value={value ?? null}
      onChange={onChange}
      disabled={disabled || loading}
      placeholder={placeholder}
      variant={effectiveVariant}
      className={className}
      appearance={appearance}
    />
  );
}
