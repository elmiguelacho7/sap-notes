import type { ReactNode } from "react";

export function PageShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-5xl px-6 py-8 bg-slate-50 min-h-full flex flex-col gap-6 ${className}`}>
      {children}
    </div>
  );
}
