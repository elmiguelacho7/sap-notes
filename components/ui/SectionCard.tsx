import type { ReactNode } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";

/**
 * Section card: Card with optional title/description and consistent spacing.
 * Use for content sections that need a labeled container.
 */
export function SectionCard({
  title,
  description,
  children,
  className = "",
  headerClassName = "",
  contentClassName = "",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={className}>
      {(title || description) && (
        <CardHeader className={headerClassName}>
          {title && <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</CardTitle>}
          {description && <CardDescription className="mt-0.5 text-xs">{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
