import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  variant = "page",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** "section" = lighter weight for use inside project workspace (section header, not main page title) */
  variant?: "page" | "section";
}) {
  const isSection = variant === "section";
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${isSection ? "mb-4" : "mb-6"}`}>
      <div>
        <h1
          className={
            isSection
              ? "text-lg font-medium tracking-tight text-slate-700"
              : "text-2xl font-semibold tracking-tight text-slate-900"
          }
        >
          {title}
        </h1>
        {description && (
          <p className={isSection ? "mt-0.5 text-sm text-slate-500" : "mt-1 text-sm text-slate-600"}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
