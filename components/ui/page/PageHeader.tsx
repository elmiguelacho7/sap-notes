import type { ReactNode } from "react";

/**
 * Page title, description, and right-aligned actions. Design system v1 — dark.
 */
export function PageHeader({
  title,
  description,
  actions,
  className = "",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-white tracking-tight sm:text-2xl">{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm text-slate-400">{description}</p>
        )}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      ) : null}
    </div>
  );
}
