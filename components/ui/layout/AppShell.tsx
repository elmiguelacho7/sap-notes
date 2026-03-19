"use client";

import type { ReactNode } from "react";

/**
 * Global app shell: fixed sidebar + main area (header + scrollable page content).
 * Viewport = Sidebar (fixed, full height) + Main (margin-left = sidebar width, scrolls independently).
 * Desktop: sidebar fixed left. Mobile: sidebar hidden; overlay when mobileMenuOpen.
 * Design system v1 — dark theme (slate-950).
 */
export function AppShell({
  sidebar,
  mobileSidebar,
  header,
  children,
  mobileMenuOpen = false,
  onMobileMenuClose,
  sidebarCollapsed = false,
  sidebarHoverExpanded = false,
}: {
  sidebar: ReactNode;
  /** Same as sidebar but with mobileOpen/onClose for overlay; render when mobileMenuOpen. */
  mobileSidebar?: ReactNode;
  header: ReactNode;
  children: ReactNode;
  /** When true, sidebar is shown as overlay on mobile (lg and up unchanged). */
  mobileMenuOpen?: boolean;
  onMobileMenuClose?: () => void;
  /** Desktop sidebar collapsed state: narrow width and main margin. */
  sidebarCollapsed?: boolean;
  /** When true, sidebar is temporarily expanded (e.g. hover); use 240px width. */
  sidebarHoverExpanded?: boolean;
}) {
  // Effective expanded = manually expanded OR hover-expanded. Width 240px when effective expanded, else 72px.
  const effectiveExpanded = !sidebarCollapsed || Boolean(sidebarHoverExpanded);
  const sidebarWidth = effectiveExpanded ? "w-[240px]" : "w-[72px]";
  const mainMargin = effectiveExpanded ? "ml-[240px]" : "ml-[72px]";

  return (
    <div className="flex min-h-screen overflow-hidden bg-slate-950">
      {/* Desktop: fixed sidebar, full height. Never scrolls with page. */}
      <div
        className={`fixed left-0 top-0 z-30 h-screen border-r border-slate-800 bg-slate-950 flex flex-col hidden lg:flex transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${sidebarWidth}`}
        aria-hidden={false}
      >
        {sidebar}
      </div>
      {/* Main: offset by sidebar width, flex-1, scrolls independently; no horizontal overflow */}
      <main
        className={`${mainMargin} flex-1 min-w-0 min-h-screen overflow-y-auto overflow-x-hidden flex flex-col bg-slate-950`}
      >
        {header}
        {children}
      </main>
      {/* Mobile sidebar overlay (separate instance with mobileOpen so drawer shows correctly) */}
      {mobileMenuOpen && mobileSidebar != null && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={onMobileMenuClose}
            aria-hidden
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            {mobileSidebar}
          </div>
        </>
      )}
    </div>
  );
}
