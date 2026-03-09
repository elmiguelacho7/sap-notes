"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Activity,
  Ticket,
  BookOpen,
  FileText,
  Search,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Briefcase,
  Building2,
} from "lucide-react";

const ICON_CLASS = "h-[18px] w-[18px] shrink-0";

type NavItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }>; roles?: string[] };

const SIDEBAR_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "HOME",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "My Work", href: "/my-work", icon: Briefcase },
    ],
  },
  {
    label: "PROJECTS",
    items: [{ label: "Projects", href: "/projects", icon: FolderKanban }],
  },
  {
    label: "WORK",
    items: [
      { label: "Tasks", href: "/tasks", icon: CheckSquare },
      { label: "Activities", href: "/activities", icon: Activity },
      { label: "Tickets", href: "/tickets", icon: Ticket },
    ],
  },
  {
    label: "KNOWLEDGE",
    items: [
      { label: "Knowledge", href: "/knowledge", icon: BookOpen },
      { label: "Notes", href: "/notes", icon: FileText },
      { label: "Search", href: "/knowledge/search", icon: Search },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { label: "Clients", href: "/clients", icon: Building2, roles: ["superadmin"] },
      { label: "Admin", href: "/admin", icon: ShieldCheck, roles: ["superadmin"] },
      { label: "Settings", href: "/account", icon: Settings },
    ],
  },
];

function SidebarNavItem({
  item,
  isActive,
  collapsed,
  onNavigate,
  appRole,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  onNavigate: (href: string) => void;
  appRole: string | null;
}) {
  const Icon = item.icon;
  if (item.roles && item.roles.length > 0 && (!appRole || !item.roles.includes(appRole))) return null;
  return (
    <button
      type="button"
      title={collapsed ? item.label : undefined}
      onClick={() => onNavigate(item.href)}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        collapsed ? "justify-center" : "justify-start"
      } ${
        isActive
          ? "bg-slate-800 text-white"
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      }`}
    >
      <Icon className={ICON_CLASS} aria-hidden />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  );
}

export function Sidebar({
  collapsed,
  onToggle,
  appRole,
  onNavigate,
  pathname,
  onLogout,
}: {
  collapsed: boolean;
  onToggle: () => void;
  appRole: string | null;
  onNavigate: (href: string) => void;
  pathname: string;
  onLogout: () => void;
}) {
  const isActive = (path: string, itemLabel?: string) => {
    if (path === "/admin") return pathname === "/admin";
    if (path === "/account") return pathname === "/account";
    if (path === "/clients") return pathname === "/clients";
    if (path === "/my-work") return pathname === "/my-work";
    if (path === "/knowledge/search") return pathname === "/knowledge/search";
    if (path === "/knowledge")
      return pathname === "/knowledge" || (pathname.startsWith("/knowledge/") && !pathname.startsWith("/knowledge/search"));
    if (path === "/tickets") return pathname.startsWith("/tickets");
    if (path === "/tasks") return pathname === "/tasks" || pathname.startsWith("/tasks/");
    if (path === "/activities") return pathname === "/activities" || pathname.startsWith("/activities/");
    if (path === "/projects") return pathname === "/projects" || pathname.startsWith("/projects/");
    return pathname === path || (path !== "/dashboard" && pathname.startsWith(path + "/"));
  };

  return (
    <aside
      className={`flex flex-col shrink-0 bg-slate-950 border-r border-slate-800 transition-[width] duration-300 ${
        collapsed ? "w-16" : "w-[260px]"
      }`}
    >
      <div
        className={`flex h-14 items-center shrink-0 border-b border-slate-800 px-3 ${
          collapsed ? "justify-center" : "justify-between gap-2"
        }`}
      >
        <Link
          href="/dashboard"
          className={`flex items-center gap-2 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            collapsed ? "justify-center p-1" : "min-w-0"
          }`}
        >
          <div className="h-8 w-8 shrink-0 rounded-xl bg-indigo-600 flex items-center justify-center text-xs font-bold">
            PH
          </div>
          {!collapsed && (
            <span className="truncate text-sm font-semibold">SAP Notes Hub</span>
          )}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.label} className="mt-6 first:mt-0">
            {!collapsed && (
              <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarNavItem
                  key={item.href + item.label}
                  item={item}
                  isActive={isActive(item.href, item.label)}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                  appRole={appRole}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div
        className={`flex shrink-0 items-center border-t border-slate-800 px-3 py-3 ${
          collapsed ? "justify-center" : "justify-between gap-2"
        }`}
      >
        {!collapsed && (
          <span className="text-xs text-slate-500 truncate">Sesión activa</span>
        )}
        <button
          type="button"
          onClick={onLogout}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
