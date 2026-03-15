/**
 * Wraps all page content. Design system v1.
 * Variants:
 * - fullWidth: no max-width, content uses full viewport (dashboard, charts).
 * - wide: max-w-[1400px], used for my-work, projects, knowledge, notes, search, project workspace.
 * - standard: max-w-7xl, used for account, admin.
 */
import type { ReactNode } from "react";

export function PageContainer({
  children,
  className = "",
  wide = true,
  fullWidth = false,
}: {
  children: ReactNode;
  className?: string;
  /** true = wide workspace (1400px); false = standard (7xl) for settings/admin. */
  wide?: boolean;
  /** true = no max-width, full viewport (e.g. operational dashboard). */
  fullWidth?: boolean;
}) {
  const base = "w-full min-w-0 px-4 sm:px-5 lg:px-6 xl:px-8 2xl:px-10 py-6 md:py-8";
  const max =
    fullWidth ? "" : wide ? "max-w-[1400px] mx-auto" : "max-w-7xl mx-auto";
  return (
    <div className={`${max} ${base} ${className}`.trim()}>
      {children}
    </div>
  );
}
