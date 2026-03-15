/**
 * Page shell: background, padding, max-width. Use with same width variant as layout.
 * - wide (default): max-w-[1600px] for workspace pages.
 * - wide={false}: max-w-7xl for account/admin so content matches PageContainer.
 */
import type { ReactNode } from "react";

export function PageShell({
  children,
  className = "",
  wide = true,
}: {
  children: ReactNode;
  className?: string;
  /** false = standard width (account/admin). */
  wide?: boolean;
}) {
  const maxWidth = wide ? "max-w-[1600px]" : "max-w-7xl";
  return (
    <div
      className={`mx-auto w-full min-w-0 ${maxWidth} px-4 sm:px-5 lg:px-6 xl:px-8 2xl:px-10 py-8 bg-slate-50 min-h-full flex flex-col gap-6 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
