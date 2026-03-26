"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  SHELL_CONTENT_TOP_OFFSET_CLASS,
  SHELL_MAIN_MARGIN_COLLAPSED_CLASS,
  SHELL_MAIN_MARGIN_EXPANDED_CLASS,
  SHELL_MOBILE_DRAWER_TOP_CLASS,
  SHELL_SIDEBAR_COLLAPSED_WIDTH_CLASS,
  SHELL_SIDEBAR_EXPANDED_WIDTH_CLASS,
} from "@/lib/layoutSystem";

/**
 * Global app shell: fixed sidebar + main area (header + scrollable page content).
 * Viewport = Sidebar (fixed, full height) + Main (margin-left = sidebar width, scrolls independently).
 * Desktop: sidebar fixed left. Mobile: sidebar hidden; overlay when mobileMenuOpen.
 * Design system — Ribbit private shell (see app/globals.css tokens).
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
  scrollOnRouteChangeKey,
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
  /** Optional key to reset main scroll container when route changes. */
  scrollOnRouteChangeKey?: string;
}) {
  // Effective expanded = manually expanded OR hover-expanded. Width 240px when effective expanded, else 72px.
  const effectiveExpanded = !sidebarCollapsed || Boolean(sidebarHoverExpanded);
  const sidebarWidth = effectiveExpanded
    ? SHELL_SIDEBAR_EXPANDED_WIDTH_CLASS
    : SHELL_SIDEBAR_COLLAPSED_WIDTH_CLASS;
  const mainMargin = effectiveExpanded
    ? SHELL_MAIN_MARGIN_EXPANDED_CLASS
    : SHELL_MAIN_MARGIN_COLLAPSED_CLASS;
  const mainScrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!scrollOnRouteChangeKey) return;
    mainScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [scrollOnRouteChangeKey]);

  return (
    <div className="flex min-h-screen overflow-hidden rb-shell-bg">
      {/* Desktop: fixed sidebar — shell tokens only (no full .rb-brand-gradient on chrome). */}
      <div
        className={`fixed left-0 top-0 z-30 h-screen min-w-0 overflow-hidden border-r border-[rgb(var(--rb-surface-border))]/80 bg-gradient-to-b from-[rgb(var(--rb-shell-bg-strong))] via-[rgb(var(--rb-shell-bg))] to-[rgb(var(--rb-shell-tint))] flex flex-col hidden lg:flex transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] shadow-[inset_-1px_0_0_rgba(15,23,42,0.04)] rb-depth-shell ${sidebarWidth} ${SHELL_CONTENT_TOP_OFFSET_CLASS}`}
        aria-hidden={false}
      >
        {sidebar}
      </div>

      {/* Fixed top header (desktop + mobile). Content is padded below via pt-14. */}
      <div className="fixed top-0 left-0 right-0 z-40">
        {header}
      </div>

      {/* Main: offset by sidebar width, flex-1, scrolls independently; no horizontal overflow */}
      <main
        ref={mainScrollRef}
        className={`${mainMargin} flex-1 min-w-0 min-h-screen overflow-y-auto overflow-x-hidden flex flex-col rb-workspace-bg ${SHELL_CONTENT_TOP_OFFSET_CLASS}`}
      >
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
          <div className={`fixed left-0 ${SHELL_MOBILE_DRAWER_TOP_CLASS} bottom-0 z-50 lg:hidden`}>
            {mobileSidebar}
          </div>
        </>
      )}
    </div>
  );
}
