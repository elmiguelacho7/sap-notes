 import type { ReactNode } from "react";
 
 export function EmptyState({
   title,
   description,
   icon,
   actions,
   className = "",
 }: {
   title: string;
   description?: string;
   icon?: ReactNode;
   actions?: ReactNode;
   className?: string;
 }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-8 text-center ${className}`}
    >
      {icon ? (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description ? (
        <p className="mt-2 text-sm text-slate-600 max-w-sm mx-auto">{description}</p>
      ) : null}
      {actions ? <div className="mt-6 flex justify-center gap-3 flex-wrap">{actions}</div> : null}
    </div>
  );
 }
