import type { ReactNode } from "react";

/**
 * Wrapper for data tables: consistent border, rounded corners, overflow.
 * Use with native <table> or grid-based layouts.
 */
export function DataTableShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white ${className}`}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
