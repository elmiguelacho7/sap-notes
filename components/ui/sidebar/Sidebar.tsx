"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Ticket,
  BookOpen,
  FileText,
  FolderOpen,
  Search,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Briefcase,
  Building2,
  Cloud,
  ArrowLeft,
} from "lucide-react";

const ICON_WRAPPER = "flex items-center justify-center w-5 h-5 shrink-0";

type NavItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }>; roles?: string[] };

const SIDEBAR_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "WORKSPACE",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Projects", href: "/projects", icon: FolderKanban },
      { label: "Tasks", href: "/tasks", icon: CheckSquare },
      { label: "Tickets", href: "/tickets", icon: Ticket },
      { label: "My Work", href: "/my-work", icon: Briefcase },
    ],
  },
  {
    label: "KNOWLEDGE",
    items: [
      { label: "Knowledge", href: "/knowledge", icon: BookOpen },
      { label: "Notes", href: "/notes", icon: FileText },
      { label: "Spaces", href: "/knowledge/documents", icon: FolderOpen },
      { label: "Sapito", href: "/knowledge/search", icon: Search },
    ],
  },
  {
    label: "BUSINESS",
    items: [{ label: "Clients", href: "/clients", icon: Building2, roles: ["superadmin", "admin"] }],
  },
  {
    label: "SYSTEM",
    items: [
      { label: "Admin", href: "/admin", icon: ShieldCheck, roles: ["superadmin"] },
      { label: "Knowledge Sources", href: "/admin/knowledge-sources", icon: Cloud, roles: ["superadmin"] },
      { label: "Settings", href: "/account", icon: Settings },
    ],
  },
];

function getProjectIdFromPath(path: string): string | null {
  const match = path.match(/^\/projects\/([^/]+)/);
  if (!match?.[1] || match[1] === "new") return null;
  return match[1];
}

function SidebarNavItem({
  item,
  isActive,
  isExpanded,
  collapsed,
  showTooltip,
  labelVisible = true,
  onNavigate,
  appRole,
}: {
  item: NavItem;
  isActive: boolean;
  /** True when current path is under this item's path (parent context, not exact route). */
  isExpanded: boolean;
  collapsed: boolean;
  /** Show tooltip only when collapsed and not hover-expanded */
  showTooltip: boolean;
  /** When false, label uses opacity/translate for fade-out (expanded layout only). */
  labelVisible?: boolean;
  onNavigate: (href: string) => void;
  appRole: string | null;
}) {
  const Icon = item.icon;
  if (item.roles?.length && (!appRole || !item.roles.includes(appRole))) return null;

  const baseButtonClass = `relative flex items-center h-10 rounded-xl text-sm font-medium border-l-2 transition-all duration-150 ${
    isActive
      ? "bg-slate-800/80 border-l-indigo-400 text-white"
      : isExpanded
        ? "text-slate-200 bg-slate-800/40 border-l-transparent hover:bg-slate-800/60 hover:translate-x-0.5"
        : "text-slate-400 border-l-transparent hover:bg-slate-800/60 hover:text-slate-100 hover:translate-x-0.5"
  }`;
  const labelTransitionClass = "transition-all duration-200 ease-out";
  const labelVisibleClass = labelVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1";

  if (collapsed) {
    const collapsedButtonClass = `h-[34px] w-[34px] rounded-[11px] flex items-center justify-center transition-all duration-150 ${
      isActive
        ? "bg-slate-800/65 text-slate-100 ring-1 ring-indigo-400/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        : isExpanded
          ? "text-slate-200 hover:bg-slate-800/50"
          : "text-slate-400 hover:bg-slate-800/45 hover:text-slate-100"
    }`;

    return (
      <div className="relative group shrink-0 w-10 h-10 flex items-center justify-center">
        <button
          type="button"
          onClick={() => onNavigate(item.href)}
          className={collapsedButtonClass}
        >
          <span className={`${ICON_WRAPPER} ${isActive ? "text-slate-100" : "text-current"}`}>
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
          </span>
        </button>
        {showTooltip && (
          <span
            className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 z-50 ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-out whitespace-nowrap rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-xs px-2 py-1 shadow-lg"
            role="tooltip"
          >
            {item.label}
          </span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.href)}
      className={`relative flex w-full items-center rounded-xl px-3 gap-3 justify-start ${baseButtonClass}`}
    >
      <span className={`${ICON_WRAPPER} ${isActive ? "text-slate-100" : "text-current"}`}>
        <Icon className="h-5 w-5 shrink-0" aria-hidden />
      </span>
      <span className={`min-w-0 truncate ${labelTransitionClass} ${labelVisibleClass}`}>{item.label}</span>
    </button>
  );
}

export function Sidebar({
  collapsed,
  hoverExpanded = false,
  onHoverExpandChange,
  onToggle,
  appRole,
  onNavigate,
  pathname,
  onLogout,
  userName,
  userEmail,
  projectName,
  projectSubtitle,
  mobileOpen,
  onClose,
}: {
  collapsed: boolean;
  /** When true, sidebar is temporarily expanded by hover (desktop collapsed only). */
  hoverExpanded?: boolean;
  /** Called when mouse enters (true) or leaves (false) sidebar; used for hover-expand width. */
  onHoverExpandChange?: (expanded: boolean) => void;
  onToggle: () => void;
  appRole: string | null;
  onNavigate: (href: string) => void;
  pathname: string;
  onLogout: () => void;
  userName?: string | null;
  userEmail?: string | null;
  projectName?: string | null;
  projectSubtitle?: string | null;
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const isMobileOverlay = Boolean(mobileOpen && onClose);
  const isCollapsedDesktop = collapsed && !isMobileOverlay;
  const showLabels = !collapsed || (hoverExpanded && isCollapsedDesktop);
  const showTooltipWhenCollapsed = isCollapsedDesktop && !hoverExpanded;
  const currentProjectId = getProjectIdFromPath(pathname);
  const isProjectMode = Boolean(currentProjectId);

  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [labelsVisible, setLabelsVisible] = useState(true);

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current != null) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);
  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!collapsed) {
      setLabelsVisible(true);
      return;
    }
    if (hoverExpanded) {
      const t = setTimeout(() => setLabelsVisible(true), 60);
      return () => clearTimeout(t);
    }
    setLabelsVisible(false);
  }, [collapsed, hoverExpanded]);

  useEffect(() => {
    return () => {
      clearOpenTimer();
      clearCloseTimer();
    };
  }, [clearOpenTimer, clearCloseTimer]);

  const handleMouseEnter = useCallback(() => {
    if (!isCollapsedDesktop || !onHoverExpandChange) return;
    clearCloseTimer();
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null;
      onHoverExpandChange(true);
    }, 140);
  }, [isCollapsedDesktop, onHoverExpandChange, clearCloseTimer]);

  const handleMouseLeave = useCallback(() => {
    if (!onHoverExpandChange) return;
    clearOpenTimer();
    setLabelsVisible(false);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      onHoverExpandChange(false);
    }, 180);
  }, [onHoverExpandChange, clearOpenTimer]);

  const projectSections = useMemo<{ label: string; items: NavItem[] }[]>(
    () =>
      currentProjectId
        ? [
            {
              label: "PROJECT",
              items: [
                { label: "Overview", href: `/projects/${currentProjectId}`, icon: LayoutDashboard },
                { label: "Tasks", href: `/projects/${currentProjectId}/tasks`, icon: CheckSquare },
                { label: "Tickets", href: `/projects/${currentProjectId}/tickets`, icon: Ticket },
                { label: "Knowledge", href: `/projects/${currentProjectId}/knowledge`, icon: BookOpen },
                { label: "Phases", href: `/projects/${currentProjectId}/planning`, icon: FolderKanban },
                { label: "Documents", href: `/projects/${currentProjectId}/notes`, icon: FileText },
              ],
            },
          ]
        : [],
    [currentProjectId]
  );

  const visibleSections = isProjectMode ? projectSections : SIDEBAR_SECTIONS;

  /** True if any sidebar item is a child of this path (same section, href starts with path + "/"). */
  const hasSidebarChild = useCallback(
    (path: string) => {
      for (const section of visibleSections) {
        for (const it of section.items) {
          if (it.href !== path && it.href.startsWith(path + "/")) return true;
        }
      }
      return false;
    },
    [visibleSections]
  );

  /** Strong active: only the exact current route (or leaf with no sidebar children). */
  const isActive = useCallback(
    (path: string) => {
      if (pathname === path) return true;
      if (hasSidebarChild(path)) return false;
      return path !== "/dashboard" && pathname.startsWith(path + "/");
    },
    [pathname, hasSidebarChild]
  );

  /** Parent open context: current path is under this path but not exact (softer style). */
  const isExpanded = useCallback(
    (path: string) => {
      if (pathname === path) return false;
      return pathname.startsWith(path + "/");
    },
    [pathname]
  );

  const widthClass = isMobileOverlay ? "w-[240px]" : (collapsed && !hoverExpanded) ? "w-[72px]" : "w-[240px]";
  const showCollapse = !isMobileOverlay && !collapsed;
  const showExpand = !isMobileOverlay && collapsed;
  const displayName = (userName && userName.trim()) || "Usuario";
  const displaySubtext = (userEmail && userEmail.trim()) || "Sesion activa";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside
      className={`flex flex-col h-full min-h-0 shrink-0 bg-slate-950 border-r border-slate-800 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden ${widthClass}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Top branding: logo + product name when expanded; centered logo when collapsed */}
      <div
        className={`flex h-12 shrink-0 items-center border-b border-slate-800 px-4 ${
          !showLabels ? "justify-center" : "justify-between gap-2"
        }`}
      >
        <Link
          href="/dashboard"
          onClick={isMobileOverlay ? onClose : undefined}
          className={`flex items-center gap-3 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950 min-w-0 transition-colors duration-150 hover:bg-slate-800/50 ${
            !showLabels ? "justify-center p-1.5" : ""
          }`}
        >
          <div className="h-8 w-8 shrink-0 rounded-xl bg-indigo-600 flex items-center justify-center text-[10px] font-bold">
            PH
          </div>
          {showLabels && (
            <span className={`truncate text-sm font-semibold transition-all duration-200 ease-out ${labelsVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1"}`}>
              SAP Notes Hub
            </span>
          )}
        </Link>
        {isMobileOverlay && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 transition-colors duration-150"
            aria-label="Cerrar menú"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {showCollapse && (
          <button
            type="button"
            onClick={onToggle}
            className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 transition-colors duration-150"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {showExpand && (
          <button
            type="button"
            onClick={onToggle}
            className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 transition-colors duration-150"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation: icons-only when collapsed and not hover-expanded; full sections when expanded or hover-expanded */}
      <nav
        className={`flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [scrollbar-color:rgba(71,85,105,0.24)_transparent] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700/35 [&::-webkit-scrollbar-thumb:hover]:bg-slate-600/45 [&::-webkit-scrollbar-track]:bg-slate-900/20 ${
          !showLabels ? "pr-1.5 pl-0.5" : ""
        }`}
      >
        {!showLabels ? (
          <>
            <div className="flex flex-col items-center gap-2.5 py-4 px-2">
              {isProjectMode && currentProjectId ? (
                <div className="relative group shrink-0 w-10 h-10">
                  <button
                    type="button"
                    onClick={() => onNavigate("/projects")}
                    className="w-full h-full rounded-xl flex items-center justify-center text-slate-300 border-l-2 border-l-transparent hover:bg-slate-800/60 transition-all duration-150"
                    aria-label="All projects"
                  >
                    <ArrowLeft className="h-5 w-5" aria-hidden />
                  </button>
                  {showTooltipWhenCollapsed && (
                    <span
                      className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 z-50 ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-out whitespace-nowrap rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-xs px-2 py-1 shadow-lg"
                      role="tooltip"
                    >
                      All projects
                    </span>
                  )}
                </div>
              ) : null}
              {visibleSections.map((section) =>
                section.items.map((item) => (
                  <SidebarNavItem
                    key={item.href + item.label}
                    item={item}
                    isActive={isActive(item.href)}
                    isExpanded={isExpanded(item.href)}
                    collapsed={true}
                    showTooltip={showTooltipWhenCollapsed}
                    onNavigate={onNavigate}
                    appRole={appRole}
                  />
                ))
              )}
            </div>
            <div className="flex-grow min-h-0 shrink-0" aria-hidden />
          </>
        ) : (
          <div className="py-4">
            {isProjectMode && currentProjectId ? (
              <div className="px-3.5 mb-3 space-y-2">
                <button
                  type="button"
                  onClick={() => onNavigate("/projects")}
                  className={`inline-flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-all duration-150 ${
                    labelsVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1"
                  }`}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>All projects</span>
                </button>
                <div
                  className={`rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 transition-all duration-200 ease-out ${
                    labelsVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-100 truncate">{projectName?.trim() || "Project"}</p>
                  {projectSubtitle ? (
                    <p className="mt-0.5 text-[11px] text-slate-500 truncate">{projectSubtitle}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {visibleSections.map((section) => (
              <div key={section.label} className="mt-6 first:mt-0">
                <p className={`px-3.5 mt-4 mb-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-500 transition-all duration-200 ease-out ${labelsVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1"}`}>
                  {section.label}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <SidebarNavItem
                      key={item.href + item.label}
                      item={item}
                      isActive={isActive(item.href)}
                      isExpanded={isExpanded(item.href)}
                      collapsed={false}
                      showTooltip={false}
                      labelVisible={labelsVisible}
                      onNavigate={onNavigate}
                      appRole={appRole}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Footer: icon-only when collapsed; profile card when expanded */}
      <div
        className={`mt-auto shrink-0 border-t border-slate-800 flex min-w-0 ${
          !showLabels
            ? "flex-col items-center gap-1 px-0 pt-2.5 pb-2.5"
            : "flex-row items-center justify-between gap-2 px-3.5 pt-3 pb-3"
        }`}
      >
        {showLabels && (
          <div
            className={`min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-2 flex items-center gap-2 transition-all duration-200 ease-out ${
              labelsVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1"
            }`}
          >
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-800 text-[11px] font-semibold text-slate-200">
              {initials || "U"}
            </span>
            <span className="min-w-0 flex flex-col">
              <span className="truncate text-xs font-medium text-slate-100">{displayName}</span>
              <span className="truncate text-[11px] text-slate-500">{displaySubtext}</span>
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onLogout}
          className={`shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-100 transition-colors duration-150 ${
            !showLabels
              ? "h-[34px] w-[34px] rounded-[10px] border border-slate-800/80 bg-slate-900/45 hover:bg-slate-800/65"
              : "h-10 w-10 rounded-lg border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700"
          }`}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
