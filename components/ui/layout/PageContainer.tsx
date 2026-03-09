/**
 * Wraps all page content. Design system v1.
 * Two variants:
 * - Wide workspace: max-w-[1600px], used for dashboard, my-work, projects, knowledge, notes, search, project workspace.
 * - Standard workspace: max-w-7xl, used for account, admin.
 */
import type { ReactNode } from "react";

export function PageContainer({
  children,
  className = "",
  wide = true,
}: {
  children: ReactNode;
  className?: string;
  /** true = wide workspace (1600px); false = standard (7xl) for settings/admin. */
  wide?: boolean;
}) {
  return (
    <div
      className={
        wide
          ? `max-w-[1600px] mx-auto px-6 md:px-8 xl:px-10 py-8 ${className}`.trim()
          : `max-w-7xl mx-auto px-8 py-8 ${className}`.trim()
      }
    >
      {children}
    </div>
  );
}
