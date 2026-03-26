"use client";

import type { ReactNode } from "react";
import { LAYOUT_WIDTH_PROJECT_CLASS } from "@/lib/layoutSystem";

export type ProjectLayoutProps = {
  header: ReactNode;
  children: ReactNode;
  /** When true, reduces top padding (overview-style pages). */
  compactTop?: boolean;
};

/**
 * Shared wrapper for all /projects/[id] routes.
 * Keeps a consistent width + spacing rhythm and applies the subtle project-mode identity layer.
 */
export function ProjectLayout({ header, children, compactTop = false }: ProjectLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col rb-project-workspace-bg">
      <div className="shrink-0 border-b border-[rgb(var(--rb-surface-border))]/85 bg-[rgb(var(--rb-surface))]/88 backdrop-blur-sm">
        {header}
      </div>
      <section className={`flex-1 w-full min-w-0 ${compactTop ? "pt-4" : "pt-6"} pb-10`}>
        <div className={`w-full min-w-0 ${LAYOUT_WIDTH_PROJECT_CLASS} px-6 lg:px-8 py-6 space-y-6`}>
          {children}
        </div>
      </section>
    </div>
  );
}

