"use client";

import { useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  CalendarDays,
  FolderKanban,
  CheckSquare,
  Ticket,
  BookOpen,
  FileText,
  FolderOpen,
  Search,
  ListTodo,
  Brain,
  Link as LinkIcon,
  Users,
  ShieldCheck,
  Settings,
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Briefcase,
  Building2,
  Cloud,
  ArrowLeft,
  BarChart3,
  ClipboardList,
} from "lucide-react";

const ICON_WRAPPER = "flex items-center justify-center w-5 h-5 shrink-0";

type NavItem = {
  navKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
};

type SidebarSectionDef = { sectionKey: string; items: NavItem[] };

const SIDEBAR_SECTIONS: SidebarSectionDef[] = [
  {
    sectionKey: "workspace",
    items: [
      { navKey: "dashboard", href: "/dashboard", icon: LayoutDashboard },
      { navKey: "projects", href: "/projects", icon: FolderKanban },
      { navKey: "tasks", href: "/tasks", icon: CheckSquare },
      { navKey: "tickets", href: "/tickets", icon: Ticket },
      { navKey: "reports", href: "/reports", icon: BarChart3 },
      { navKey: "myWork", href: "/my-work", icon: Briefcase },
    ],
  },
  {
    sectionKey: "knowledge",
    items: [
      { navKey: "knowledge", href: "/knowledge", icon: BookOpen },
      { navKey: "notes", href: "/notes", icon: FileText },
      { navKey: "spaces", href: "/knowledge/documents", icon: FolderOpen },
      { navKey: "sapito", href: "/knowledge/search", icon: Search },
    ],
  },
  {
    sectionKey: "business",
    items: [{ navKey: "clients", href: "/clients", icon: Building2, roles: ["superadmin", "admin"] }],
  },
  {
    sectionKey: "system",
    items: [
      { navKey: "admin", href: "/admin", icon: ShieldCheck, roles: ["superadmin"] },
      { navKey: "knowledgeSources", href: "/admin/knowledge-sources", icon: Cloud, roles: ["superadmin"] },
      { navKey: "settings", href: "/account", icon: Settings },
    ],
  },
];

function buildProjectContextNavItems(projectId: string): NavItem[] {
  const base = `/projects/${projectId}`;
  return [
    { navKey: "overview", href: base, icon: LayoutDashboard },
    { navKey: "planning", href: `${base}/planning`, icon: CalendarDays },
    { navKey: "activities", href: `${base}/planning/activities`, icon: ListTodo },
    { navKey: "tasks", href: `${base}/tasks`, icon: CheckSquare },
    { navKey: "tickets", href: `${base}/tickets`, icon: Ticket },
    { navKey: "testing", href: `${base}/testing`, icon: ClipboardList },
    { navKey: "notes", href: `${base}/notes`, icon: FileText },
    { navKey: "brain", href: `${base}/brain`, icon: Brain },
    { navKey: "links", href: `${base}/links`, icon: LinkIcon },
    { navKey: "knowledge", href: `${base}/knowledge`, icon: BookOpen },
    { navKey: "timeline", href: `${base}/planning/calendar`, icon: CalendarDays },
    { navKey: "team", href: `${base}/members`, icon: Users },
    { navKey: "search", href: `${base}/search`, icon: Search },
  ];
}

function projectStatusChipClass(status: string | null | undefined): string {
  const s = String(status ?? "").toLowerCase().trim();
  if (s === "in_progress") return "rb-badge-success";
  if (s === "blocked" || s === "paused") return "rb-badge-warning";
  if (s === "archived") return "rb-badge-neutral";
  if (s === "completed") return "border-sky-500/30 bg-sky-500/12 text-sky-700";
  return "rb-badge-neutral";
}

function formatSidebarShortDate(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type SidebarExecutionHealth = { labelKey: string; tone: "good" | "watch" | "risk" };

/** Display-only hint from plan dates + status (same fields already loaded for sidebar). */
function sidebarExecutionHealth(
  status: string | null | undefined,
  plannedEndIso: string | null | undefined
): SidebarExecutionHealth | null {
  const s = (status ?? "").toLowerCase().trim();
  if (!plannedEndIso?.trim() && !s) return null;
  if (s === "completed" || s === "archived") {
    return { labelKey: "executionHealth.stable", tone: "good" };
  }
  if (plannedEndIso?.trim()) {
    const end = new Date(plannedEndIso.includes("T") ? plannedEndIso : `${plannedEndIso}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    if (!Number.isNaN(end.getTime()) && end.getTime() < today.getTime()) {
      return { labelKey: "executionHealth.behindSchedule", tone: "risk" };
    }
    const days = Math.round((end.getTime() - today.getTime()) / 86400000);
    if (days <= 7 && days >= 0) {
      return { labelKey: "executionHealth.deadlineNear", tone: "watch" };
    }
  }
  if (s === "blocked" || s === "paused") {
    return { labelKey: "executionHealth.blocked", tone: "risk" };
  }
  if (s === "in_progress") {
    return { labelKey: "executionHealth.onTrack", tone: "good" };
  }
  return { labelKey: "executionHealth.planned", tone: "good" };
}

function executionHealthChipSurface(tone: SidebarExecutionHealth["tone"]): string {
  if (tone === "risk") return "border-rose-200/95 bg-rose-50/95 text-rose-900";
  if (tone === "watch") return "border-amber-200/95 bg-amber-50/95 text-amber-950";
  return "border-emerald-200/95 bg-emerald-50/90 text-emerald-900";
}

function getProjectIdFromPath(path: string): string | null {
  const match = path.match(/^\/projects\/([^/]+)/);
  if (!match?.[1] || match[1] === "new") return null;
  return match[1];
}

/** Treat as project workspace only when id looks like a real project UUID (avoids empty/broken contextual nav). */
function isLikelyUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

/** Set to true to log sidebar mode (search: SIDEBAR_NAV_DEBUG). */
const SIDEBAR_NAV_DEBUG = false;

function filterNavItemsForRole(items: NavItem[], appRole: string | null): NavItem[] {
  return items.filter((item) => {
    if (!item.roles?.length) return true;
    return Boolean(appRole && item.roles.includes(appRole));
  });
}

function buildSectionsForRole(sections: SidebarSectionDef[], appRole: string | null) {
  return sections
    .map((s) => ({ sectionKey: s.sectionKey, items: filterNavItemsForRole(s.items, appRole) }))
    .filter((s) => s.items.length > 0);
}

function countNavItems(sections: { sectionKey: string; items: NavItem[] }[]): number {
  return sections.reduce((acc, s) => acc + s.items.length, 0);
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
  const t = useTranslations("sidebar");
  const label = (t as (key: string) => string)(`nav.${item.navKey}`);
  const Icon = item.icon;
  if (item.roles?.length && (!appRole || !item.roles.includes(appRole))) return null;

  const baseButtonClass = `relative flex items-center min-h-10 rounded-xl text-sm font-medium border transition-all duration-200 ${
    isActive
      ? "border-[rgb(var(--rb-brand-primary))]/25 bg-[rgb(var(--rb-brand-primary))]/14 text-[rgb(var(--rb-text-primary))] shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-[rgb(var(--rb-brand-primary))]/28 font-semibold"
      : isExpanded
        ? "border-transparent text-[rgb(var(--rb-text-primary))] bg-slate-100/85 hover:bg-[rgb(var(--rb-brand-primary))]/10 hover:border-[rgb(var(--rb-brand-primary))]/15"
        : "border-transparent text-[rgb(var(--rb-text-secondary))] hover:bg-slate-100/80 hover:text-[rgb(var(--rb-text-primary))]"
  }`;
  const labelTransitionClass = "transition-all duration-200 ease-out";
  const labelVisibleClass = labelVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1";

  if (collapsed) {
    const collapsedButtonClass = `h-[38px] w-[38px] rounded-xl flex items-center justify-center transition-all duration-200 border ${
      isActive
        ? "bg-[rgb(var(--rb-brand-primary))]/14 text-[rgb(var(--rb-text-primary))] ring-1 ring-[rgb(var(--rb-brand-primary))]/35 border-[rgb(var(--rb-brand-primary))]/25 shadow-sm"
        : isExpanded
          ? "text-[rgb(var(--rb-text-primary))] border-transparent bg-slate-100/90 hover:bg-[rgb(var(--rb-brand-primary))]/10"
          : "text-[rgb(var(--rb-text-secondary))] border-transparent hover:bg-slate-100/85 hover:text-[rgb(var(--rb-text-primary))]"
    }`;

    return (
      <div className="relative group shrink-0 w-10 h-10 flex items-center justify-center">
        <button
          type="button"
          onClick={() => onNavigate(item.href)}
          className={collapsedButtonClass}
        >
          <span className={`${ICON_WRAPPER} ${isActive ? "text-[rgb(var(--rb-brand-primary-active))]" : "text-current"}`}>
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
          </span>
        </button>
        {showTooltip && (
          <span
            className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 z-50 ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-out whitespace-nowrap rounded-md bg-[rgb(var(--rb-surface))] border border-[rgb(var(--rb-surface-border))] text-[rgb(var(--rb-text-primary))] text-xs px-2.5 py-1.5 shadow-lg"
            role="tooltip"
          >
            {label}
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
      <span className={`${ICON_WRAPPER} ${isActive ? "text-[rgb(var(--rb-brand-primary-active))]" : "text-current"}`}>
        <Icon className="h-5 w-5 shrink-0" aria-hidden />
      </span>
      <span className={`min-w-0 truncate ${labelTransitionClass} ${labelVisibleClass}`}>{label}</span>
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
  projectClientName,
  projectStartDate,
  projectPlannedEndDate,
  mobileOpen,
  onClose,
}: {
  collapsed: boolean;
  /** Legacy: layout may still pass; ignored (width is toggle-only). */
  hoverExpanded?: boolean;
  /** Legacy: layout may still pass; ignored. */
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
  projectClientName?: string | null;
  projectStartDate?: string | null;
  projectPlannedEndDate?: string | null;
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  /** Layout still passes these for API compatibility; sidebar width is toggle-only. */
  void hoverExpanded;
  void onHoverExpandChange;

  const t = useTranslations("sidebar");
  const tCommon = useTranslations("common");
  const tProjectStatus = useTranslations("projects.status");

  const executionHealth = useMemo(
    () => sidebarExecutionHealth(projectSubtitle ?? null, projectPlannedEndDate ?? null),
    [projectSubtitle, projectPlannedEndDate]
  );
  const planStartLabel = formatSidebarShortDate(projectStartDate ?? null);
  const planEndLabel = formatSidebarShortDate(projectPlannedEndDate ?? null);

  const isMobileOverlay = Boolean(mobileOpen && onClose);
  const isCollapsedDesktop = collapsed && !isMobileOverlay;
  /** Width/labels follow persisted toggle only (no hover-expand). */
  const showLabels = !collapsed || isMobileOverlay;
  const showTooltipWhenCollapsed = isCollapsedDesktop;
  const rawProjectId = getProjectIdFromPath(pathname);
  const currentProjectId = rawProjectId && isLikelyUuid(rawProjectId) ? rawProjectId : null;
  const isProjectMode = Boolean(currentProjectId);

  const globalSectionsForRole = useMemo(
    () => buildSectionsForRole(SIDEBAR_SECTIONS, appRole),
    [appRole]
  );

  /**
   * Inside a project workspace, render a single project-context navigation
   * so the workspace does not compete with a horizontal project nav row.
   */
  const visibleSections = useMemo(() => {
    if (isProjectMode && currentProjectId) {
      const projectSection: SidebarSectionDef = {
        sectionKey: "project",
        items: buildProjectContextNavItems(currentProjectId),
      };

      // Keep only non-overlapping global destinations.
      const preserved = globalSectionsForRole.filter((s) => s.sectionKey === "business" || s.sectionKey === "system");
      return [projectSection, ...preserved];
    }

    const globalCount = countNavItems(globalSectionsForRole);
    if (globalCount > 0) return globalSectionsForRole;
    return buildSectionsForRole(SIDEBAR_SECTIONS, null);
  }, [appRole, currentProjectId, globalSectionsForRole, isProjectMode]);

  const sidebarMode: "global" | "project-context" = "global";

  useEffect(() => {
    if (!SIDEBAR_NAV_DEBUG) return;
    console.debug("[sidebar]", {
      pathname,
      sidebarMode,
      collapsed,
      navItemCount: countNavItems(visibleSections),
      sectionCount: visibleSections.length,
    });
  }, [pathname, sidebarMode, collapsed, visibleSections]);

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

  /**
   * Desktop: outer AppShell already sets w-[72px] / w-[240px]. Aside must fill that hit box exactly
   * (w-full) — a second width transition on aside can desync hit-testing from the visible rail.
   * Mobile overlay: fixed drawer width on aside.
   */
  const asideWidthClass = isMobileOverlay ? "w-[240px]" : "w-full min-w-0";
  const asideBorderClass = isMobileOverlay ? "border-r border-[rgb(var(--rb-surface-border))]/90" : "";
  const toggleBtnClass =
    "shrink-0 flex h-8 w-8 items-center justify-center rounded-md text-[rgb(var(--rb-text-muted))] transition-all duration-200 hover:bg-[rgb(var(--rb-surface-3))]/70 hover:text-[rgb(var(--rb-text-primary))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";
  const displayName = (userName && userName.trim()) || tCommon("userFallback");
  const displaySubtext = (userEmail && userEmail.trim()) || tCommon("sessionActive");
  const initials = displayName
    .split(" ")
    .map((part: string) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside
      className={`flex flex-col h-full min-h-0 shrink-0 bg-transparent overflow-hidden ${asideBorderClass} ${asideWidthClass}`}
    >
      {/* Brand header: wordmark + toggle read as one shell bar (not a floating control) */}
      <div className="shrink-0 px-3.5 pt-3.5 pb-3">
        <div
          className={`group/header flex w-full rounded-[10px] border border-[rgb(var(--rb-surface-border))]/45 bg-[rgb(var(--rb-surface))]/72 transition-[border-color,background-color] duration-200 ${
            showLabels
              ? "min-h-[3rem] flex-row items-center gap-0 pl-3.5 pr-2 py-2"
              : "flex-col items-center gap-1.5 py-3 px-2"
          }`}
        >
          {showLabels ? (
            <>
              <Link
                href="/dashboard"
                onClick={isMobileOverlay ? onClose : undefined}
                className="flex min-w-0 flex-1 items-center rounded-md py-0.5 pl-0 pr-1 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--rb-shell-bg-strong))]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center" aria-hidden>
                    <img
                      src="/branding/ribbit_eyes_brand.svg"
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  </span>
                  <span className="flex min-w-0 items-center gap-0 truncate text-lg leading-none tracking-tight">
                    <span className="shrink-0 font-bold text-[rgb(var(--rb-brand-primary))]">ri</span>
                    <span className="shrink-0 font-extrabold text-slate-900">bb</span>
                    <span className="shrink-0 font-bold text-[rgb(var(--rb-brand-primary))]">it</span>
                  </span>
                </div>
              </Link>
              <span className="shrink-0 h-5 w-px bg-[rgb(var(--rb-surface-border))]/90 mx-0.5" aria-hidden />
              {isMobileOverlay ? (
                <button
                  type="button"
                  onClick={onClose}
                  className={toggleBtnClass}
                  aria-label={t("aria.closeMenu")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onToggle}
                  className={toggleBtnClass}
                  aria-label={t("aria.collapseSidebar")}
                  title={t("aria.collapseSidebar")}
                >
                  <PanelLeftClose className="h-4 w-4" aria-hidden />
                </button>
              )}
            </>
          ) : (
            <>
              <Link
                href="/dashboard"
                className="flex items-center justify-center rounded-md py-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--rb-shell-bg-strong))]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center" aria-hidden>
                  <img
                    src="/branding/ribbit_eyes_brand.svg"
                    alt=""
                    className="h-full w-full object-contain"
                  />
                </span>
              </Link>
              <button
                type="button"
                onClick={onToggle}
                className={toggleBtnClass}
                aria-label={t("aria.expandSidebar")}
                title={t("aria.expandSidebar")}
              >
                <PanelLeftOpen className="h-4 w-4" aria-hidden />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Navigation: icons-only when collapsed and not hover-expanded; full sections when expanded or hover-expanded */}
      <nav
        className={`flex-1 min-h-0 w-full min-w-0 flex flex-col overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.6)_transparent] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400/55 [&::-webkit-scrollbar-thumb:hover]:bg-slate-500/65 [&::-webkit-scrollbar-track]:bg-slate-200/35 ${
          !showLabels ? "pr-1.5 pl-0.5" : ""
        }`}
      >
        {!showLabels ? (
          <>
            <div className="flex w-full min-w-0 flex-col items-center gap-2.5 py-4 px-2">
              {isProjectMode && currentProjectId ? (
                <div className="relative group shrink-0 w-10 h-10">
                  <button
                    type="button"
                    onClick={() => onNavigate("/projects")}
                    className="w-full h-full rounded-xl flex items-center justify-center text-[rgb(var(--rb-text-secondary))] border-l-2 border-l-transparent hover:bg-[rgb(var(--rb-brand-primary))]/10 transition-all duration-150"
                    aria-label={t("allProjects")}
                  >
                    <ArrowLeft className="h-5 w-5" aria-hidden />
                  </button>
                  {showTooltipWhenCollapsed && (
                    <span
                      className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 z-50 ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-out whitespace-nowrap rounded-md bg-[rgb(var(--rb-surface))] border border-[rgb(var(--rb-surface-border))] text-[rgb(var(--rb-text-primary))] text-xs px-2.5 py-1.5 shadow-lg"
                      role="tooltip"
                    >
                      {t("allProjects")}
                    </span>
                  )}
                </div>
              ) : null}
              {visibleSections.map((section) =>
                section.items.map((item) => (
                  <SidebarNavItem
                    key={item.href + item.navKey}
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
            {/* Full rail width below icons so hover hit area matches visible column (not just icon stacks). */}
            <div className="w-full min-w-0 flex-1 min-h-[1px] shrink-0" aria-hidden />
          </>
        ) : (
          <div className="py-4 pb-5">
            {isProjectMode && currentProjectId ? (
              <div className="px-3.5 mb-5 space-y-3">
                <button
                  type="button"
                  onClick={() => onNavigate("/projects")}
                  className={`inline-flex items-center gap-2 rounded-lg px-1 -mx-1 py-1 text-xs font-medium text-[rgb(var(--rb-text-muted))] hover:text-[rgb(var(--rb-text-primary))] hover:bg-slate-100/80 transition-all duration-150 ${
                    showLabels ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1"
                  }`}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>{t("allProjects")}</span>
                </button>
                <div
                  className={`rounded-2xl border border-[rgb(var(--rb-surface-border))]/90 bg-gradient-to-br from-white via-[rgb(var(--rb-surface))]/95 to-[rgb(var(--rb-surface-2))]/60 px-3.5 py-3.5 shadow-[0_10px_28px_-18px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/50 transition-all duration-200 ease-out ${
                    showLabels ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1"
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--rb-text-muted))]">
                    {t("projectContextLabel")}
                  </p>
                  <p className="mt-1.5 text-[15px] font-semibold leading-snug tracking-tight text-[rgb(var(--rb-text-primary))]">
                    {projectName?.trim() || t("projectFallback")}
                  </p>
                  {projectClientName?.trim() ? (
                    <p className="mt-1 text-xs font-medium text-[rgb(var(--rb-text-secondary))] truncate">
                      {projectClientName.trim()}
                    </p>
                  ) : null}
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {projectSubtitle ? (
                      <span className={`rb-badge ${projectStatusChipClass(projectSubtitle)} text-[10px] font-semibold`}>
                        {(tProjectStatus as (key: string) => string)(projectSubtitle) || projectSubtitle}
                      </span>
                    ) : null}
                    {executionHealth ? (
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none ${executionHealthChipSurface(executionHealth.tone)}`}
                      >
                        {(t as (key: string) => string)(executionHealth.labelKey)}
                      </span>
                    ) : null}
                  </div>
                  {(planStartLabel || planEndLabel) && (
                    <p className="mt-2.5 text-[11px] tabular-nums text-[rgb(var(--rb-text-muted))] leading-relaxed">
                      {planStartLabel && planEndLabel
                        ? t("projectDateRange", { start: planStartLabel, end: planEndLabel })
                        : planStartLabel
                          ? t("projectDateStartOnly", { start: planStartLabel })
                          : t("projectDateEndOnly", { end: planEndLabel! })}
                    </p>
                  )}
                </div>
              </div>
            ) : null}
            {visibleSections.map((section, sectionIdx) => (
              <div
                key={section.sectionKey}
                className={
                  section.sectionKey === "project"
                    ? "mt-0.5"
                    : sectionIdx === 1
                      ? "mt-2 border-t border-slate-200/90 pt-6"
                      : "mt-5"
                }
              >
                {section.sectionKey === "project" ? (
                  <p
                    className={`px-3.5 mb-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--rb-brand-primary-active))] transition-all duration-200 ease-out ${showLabels ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1"}`}
                  >
                    {t("sections.projectRail")}
                  </p>
                ) : (
                  <>
                    {sectionIdx === 1 ? (
                      <p
                        className={`px-3.5 mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--rb-text-muted))] transition-all duration-200 ease-out ${showLabels ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1"}`}
                      >
                        {t("sections.platform")}
                      </p>
                    ) : null}
                    <p
                      className={`px-3.5 mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgb(var(--rb-text-muted))] transition-all duration-200 ease-out ${showLabels ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1"}`}
                    >
                      {(t as (key: string) => string)(`sections.${section.sectionKey}`)}
                    </p>
                  </>
                )}
                <div className={section.sectionKey === "project" ? "space-y-1 px-0.5" : "space-y-0.5"}>
                  {section.items.map((item) => (
                    <SidebarNavItem
                      key={item.href + item.navKey}
                      item={item}
                      isActive={isActive(item.href)}
                      isExpanded={isExpanded(item.href)}
                      collapsed={false}
                      showTooltip={false}
                      labelVisible={showLabels}
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

      {/* Footer: quiet profile strip; logout de-emphasized */}
      <div
        className={`mt-auto w-full min-w-0 shrink-0 border-t border-[rgb(var(--rb-surface-border))]/85 flex ${
          !showLabels
            ? "flex-col items-center gap-1.5 px-0 pt-2.5 pb-3"
            : "flex-row items-center justify-between gap-3 px-3 pt-3 pb-3"
        }`}
      >
        {showLabels && (
          <div
            className={`min-w-0 flex-1 flex items-center gap-2.5 min-h-[2rem] transition-all duration-200 ease-out ${
              showLabels ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1"
            }`}
          >
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[rgb(var(--rb-surface-border))]/85 bg-[rgb(var(--rb-surface-2))]/90 text-[10px] font-medium text-[rgb(var(--rb-text-secondary))]">
              {initials || "U"}
            </span>
            <span className="min-w-0 flex flex-col gap-0.5">
              <span className="truncate text-xs font-medium text-[rgb(var(--rb-text-secondary))]">
                {displayName}
              </span>
              <span className="truncate text-[10px] leading-tight text-[rgb(var(--rb-text-muted))]">
                {displaySubtext}
              </span>
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onLogout}
          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-md text-[rgb(var(--rb-text-muted))] transition-colors duration-150 hover:text-[rgb(var(--rb-text-secondary))] hover:bg-[rgb(var(--rb-surface-3))]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          title={t("logoutTitle")}
          aria-label={t("aria.logout")}
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </aside>
  );
}
