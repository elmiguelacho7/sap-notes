/**
 * Standard page container: consistent max-width, padding, and section spacing.
 * Use for all main app pages to standardize layout alignment.
 */
import type { ReactNode } from "react";
import { LAYOUT_WIDTH_DENSE_CLASS } from "@/lib/layoutSystem";

export function PageContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`${LAYOUT_WIDTH_DENSE_CLASS} px-6 py-8 flex flex-col gap-8 min-w-0 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
