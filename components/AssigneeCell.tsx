"use client";

import { User } from "lucide-react";
import React from "react";
import { useTranslations } from "next-intl";

export type AssigneeProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export type AssigneeCellProps = {
  /** Profile id of the assignee (profiles.id) or null when unassigned. */
  profileId: string | null;
  /** Map of profile id -> profile data, used to resolve display name. */
  profilesMap: Map<string, AssigneeProfile>;
  /** Color scheme to match surrounding surface. Default: dark. */
  tone?: "dark" | "light";
};

/**
 * Standardized assignee pill for tables and lists.
 * - Shows avatar/initial
 * - Uses best-available display name
 * - Fallback: tickets.project.assigneeUnassigned
 */
export function AssigneeCell({ profileId, profilesMap, tone = "dark" }: AssigneeCellProps) {
  const isLight = tone === "light";
  const t = useTranslations("tickets");

  if (!profileId) {
    return (
      <span className={`flex items-center gap-2 ${isLight ? "text-slate-500" : "text-slate-500"}`}>
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
            isLight ? "bg-slate-200 text-slate-500" : "bg-slate-700/80 text-slate-500"
          }`}
        >
          <User className="h-3.5 w-3.5" />
        </span>
        {t("project.assigneeUnassigned")}
      </span>
    );
  }

  const p = profilesMap.get(profileId);
  const label = p ? (p.full_name || p.email || profileId) : profileId.slice(0, 8);
  const initial = (label.trim() || "?").charAt(0).toUpperCase();

  return (
    <span className={`flex items-center gap-2 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${
          isLight ? "bg-slate-200 text-slate-700" : "bg-slate-600 text-slate-200"
        }`}
      >
        {initial}
      </span>
      <span className="truncate max-w-[120px]" title={label}>
        {label}
      </span>
    </span>
  );
}

