"use client";

import type { ReactNode } from "react";

export interface ModuleToolbarProps {
  /** Left slot: filter pills / tabs */
  left?: ReactNode;
  /** Right slot: search input or other actions */
  right?: ReactNode;
  className?: string;
}

/**
 * Reusable toolbar for module dashboards: left (pills) + right (search).
 * Use when filters and search are present.
 */
export function ModuleToolbar({ left, right, className = "" }: ModuleToolbarProps) {
  return (
    <div
      className={`flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between ${className}`}
    >
      {left != null && <div className="flex flex-wrap items-center gap-2 min-w-0">{left}</div>}
      {right != null && (
        <div className="w-full lg:w-auto lg:min-w-[200px] shrink-0">{right}</div>
      )}
    </div>
  );
}
