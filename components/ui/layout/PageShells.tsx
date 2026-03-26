/**
 * Page shell system: three variants for different page density needs.
 * Use one shell per page type; do not nest shells or add conflicting outer px/max-w.
 */
import type { ReactNode } from "react";
import {
  LAYOUT_WIDTH_DENSE_CLASS,
  LAYOUT_WIDTH_STANDARD_CLASS,
} from "@/lib/layoutSystem";

const base = "w-full min-w-0 flex flex-col";

/** Workspace-style pages: dashboard, my-work, project overview / workspace landing. */
export function WorkspacePageShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${base} ${LAYOUT_WIDTH_STANDARD_CLASS} px-6 lg:px-8 py-8 gap-8 ${className}`.trim()}>
      {children}
    </div>
  );
}

/** List/grid pages: projects, clients, tickets, tasks, other listing pages. */
export function ListPageShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${base} ${LAYOUT_WIDTH_STANDARD_CLASS} px-6 lg:px-8 py-8 gap-8 ${className}`.trim()}>
      {children}
    </div>
  );
}

/** Dense pages: admin, forms, editors, dense detail. */
export function DensePageShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${base} ${LAYOUT_WIDTH_DENSE_CLASS} px-6 lg:px-8 py-6 gap-6 ${className}`.trim()}>
      {children}
    </div>
  );
}
