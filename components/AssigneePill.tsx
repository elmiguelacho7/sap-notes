"use client";

import { User } from "lucide-react";
import React from "react";
import type { AssigneeProfile } from "@/components/AssigneeCell";

export type AssigneePillProps = {
  /** Profile id of the assignee (profiles.id) or null when unassigned. */
  profileId: string | null;
  /** Map of profile id -> profile data, or pass a pre-resolved display label. */
  profilesMap?: Map<string, AssigneeProfile>;
  /** Optional: when provided, used as display label (avoids lookup). */
  displayLabel?: string | null;
  /** Compact style for cards (smaller avatar and text). */
  compact?: boolean;
  /** Color scheme to match surrounding surface. Default: dark. */
  tone?: "dark" | "light";
  className?: string;
};

const UNASSIGNED_LABEL = "Sin asignar";

/**
 * Reusable assignee pill for cards and inline display.
 * Shows avatar/initial + display name, or "Sin asignar".
 */
export function AssigneePill({
  profileId,
  profilesMap,
  displayLabel,
  compact = false,
  tone = "dark",
  className = "",
}: AssigneePillProps) {
  const isLight = tone === "light";
  const label =
    displayLabel ?? (profileId && profilesMap ? (profilesMap.get(profileId)?.full_name || profilesMap.get(profileId)?.email || profileId) : null) ?? (profileId ? profileId.slice(0, 8) : null);
  const showUnassigned = !profileId || !label;
  const text = showUnassigned ? UNASSIGNED_LABEL : ((label || profileId?.slice(0, 8)) ?? UNASSIGNED_LABEL);
  const initial = (text.trim() || "?").charAt(0).toUpperCase();

  const sizeClass = compact ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]";
  const textClass = compact ? "text-xs" : "text-sm";

  if (showUnassigned) {
    return (
      <span className={`flex items-center gap-2 text-slate-500 ${textClass} ${className}`}>
        <span
          className={`flex shrink-0 items-center justify-center rounded-full text-slate-500 ${sizeClass} ${
            isLight ? "bg-slate-200" : "bg-slate-700/80"
          }`}
        >
          <User className={compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} />
        </span>
        <span className="truncate max-w-[100px]" title={UNASSIGNED_LABEL}>
          {UNASSIGNED_LABEL}
        </span>
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-2 ${isLight ? "text-slate-700" : "text-slate-300"} ${textClass} ${className}`}>
      <span
        className={`flex shrink-0 items-center justify-center rounded-full font-medium ${sizeClass} ${
          isLight ? "bg-slate-200 text-slate-700" : "bg-slate-600 text-slate-200"
        }`}
      >
        {initial}
      </span>
      <span className="truncate max-w-[120px]" title={text}>
        {text}
      </span>
    </span>
  );
}
