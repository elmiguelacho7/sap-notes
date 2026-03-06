"use client";

import type { ReactNode } from "react";

/**
 * Global app shell: sidebar + main area (header + scrollable page container).
 * Design system v1 — dark theme (slate-950).
 */
export function AppShell({
  sidebar,
  header,
  children,
}: {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-950">
      {sidebar}
      <div className="flex flex-1 min-w-0 flex-col min-h-screen">
        {header}
        <main className="flex-1 overflow-y-auto bg-slate-950">
          {children}
        </main>
      </div>
    </div>
  );
}
