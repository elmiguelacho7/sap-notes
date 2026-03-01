// app/(private)/layout.tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ListChecks,
  FolderKanban,
  Ticket,
  GitBranch,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ShieldCheck,
  User,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { UserMenu } from "@/components/UserMenu";
import { GlobalAssistantBubble } from "@/components/ai/GlobalAssistantBubble";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/notes": "Notas",
  "/tasks": "Tareas",
  "/projects": "Proyectos",
  "/tickets": "Tickets",
  "/process-flows": "Flujos de proceso",
  "/account": "Cuenta",
  "/admin": "Administración",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/projects/") && pathname !== "/projects") return "Proyecto";
  if (pathname.startsWith("/notes/")) return "Nota";
  if (pathname.startsWith("/tickets")) return "Tickets";
  return "Project Hub";
}

type AppRole = "superadmin" | "consultant";

type NavItemConfig = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: AppRole[];
};

const mainNavItems: NavItemConfig[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Notas", href: "/notes", icon: FileText },
  { label: "Tareas", href: "/tasks", icon: ListChecks },
  { label: "Proyectos", href: "/projects", icon: FolderKanban },
  { label: "Tickets", href: "/tickets", icon: Ticket },
  { label: "Flujos de proceso", href: "/process-flows/demo", icon: GitBranch },
];

const secondaryNavItems: NavItemConfig[] = [
  { label: "Cuenta", href: "/account", icon: User },
  { label: "Administración", href: "/admin", icon: ShieldCheck, roles: ["superadmin"] },
];

function NavItem({
  item,
  isActive,
  collapsed,
  onNavigate,
}: {
  item: NavItemConfig;
  isActive: boolean;
  collapsed: boolean;
  onNavigate: (href: string) => void;
}) {
  const Icon = item.icon;
  const itemTitle = collapsed ? item.label : undefined;
  return (
    <div className="px-1">
      <button
        type="button"
        title={itemTitle}
        onClick={() => onNavigate(item.href)}
        className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors w-full ${
          collapsed ? "justify-center" : "justify-start"
        } ${
          isActive
            ? "bg-indigo-600 text-white shadow-sm"
            : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        }`}
      >
        <Icon
          className={`h-4 w-4 shrink-0 ${
            isActive ? "text-white" : "text-slate-500 group-hover:text-slate-200"
          }`}
        />
        <span className={collapsed ? "hidden" : "truncate"}>{item.label}</span>
      </button>
    </div>
  );
}

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [appRole, setAppRole] = useState<AppRole | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("ph-sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace("/");
        return;
      }
      const userId = session.user?.id;
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("app_role")
          .eq("id", userId)
          .single();
        const role = (profile as { app_role?: string } | null)?.app_role;
        if (role === "superadmin" || role === "consultant") {
          setAppRole(role as AppRole);
        }
      }
      setIsReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const filterByRole = (items: NavItemConfig[]) =>
    items.filter((item) => {
      if (!item.roles || item.roles.length === 0) return true;
      if (!appRole) return false;
      return item.roles.includes(appRole);
    });

  const handleToggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("ph-sidebar-collapsed", String(next));
      }
      return next;
    });
  };

  const isActive = (path: string) => {
    if (path === "/admin") return pathname === "/admin";
    if (path === "/account") return pathname === "/account";
    if (path === "/process-flows" || path === "/process-flows/demo")
      return pathname.startsWith("/process-flows");
    if (path === "/tickets") return pathname.startsWith("/tickets");
    return pathname === path;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (!isReady) {
    return <main className="min-h-screen bg-slate-100 flex" />;
  }

  return (
    <main className="min-h-screen bg-slate-100 flex">
      {/* Sidebar - dark theme */}
      <aside
        className={`bg-slate-950 border-r border-slate-800 flex flex-col transition-[width] duration-300 ease-in-out shrink-0 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <div
          className={`py-4 border-b border-slate-800 flex min-h-[73px] shrink-0 ${
            collapsed
              ? "flex-col items-center justify-center gap-2 px-0"
              : "flex-row items-center gap-2 px-3"
          }`}
        >
          <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
            PH
          </div>
          <div className={collapsed ? "hidden overflow-hidden" : "min-w-0 flex-1"}>
            <p className="text-sm font-semibold text-white truncate">Project Hub</p>
            <p className="text-[11px] text-slate-500 truncate">Entorno interno</p>
          </div>
          {!collapsed && (
            <button
              type="button"
              onClick={handleToggle}
              className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-600 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              aria-label="Contraer menú"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {collapsed && (
            <button
              type="button"
              onClick={handleToggle}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-600 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              aria-label="Expandir menú"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5 text-sm overflow-y-auto min-h-0">
          {filterByRole(mainNavItems).map((item) => (
            <NavItem
              key={item.href}
              item={item}
              isActive={isActive(item.href)}
              collapsed={collapsed}
              onNavigate={(href) => router.push(href)}
            />
          ))}

          {!collapsed && (
            <p className="px-3 pt-5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Ajustes
            </p>
          )}
          {filterByRole(secondaryNavItems).map((item) => (
            <NavItem
              key={item.href}
              item={item}
              isActive={isActive(item.href)}
              collapsed={collapsed}
              onNavigate={(href) => router.push(href)}
            />
          ))}
        </nav>

        <div
          className={`flex items-center border-t border-slate-800 px-3 py-3 shrink-0 ${
            collapsed ? "justify-center flex-col gap-2" : "justify-between gap-3"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-200 shrink-0">
              N
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-slate-300 truncate">Sesión</span>
                <span className="text-xs text-slate-500 truncate">Entorno interno</span>
              </div>
            )}
          </div>
          {collapsed ? (
            <button
              type="button"
              onClick={handleLogout}
              title="Cerrar sesión"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-medium text-slate-400 hover:text-slate-200 shrink-0 transition-colors"
            >
              Cerrar sesión
            </button>
          )}
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <header className="shrink-0 flex items-center justify-between gap-4 px-4 md:px-6 h-16 border-b border-slate-200 bg-white shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900 truncate">
            {getPageTitle(pathname)}
          </h1>
          <UserMenu />
        </header>
        <section className="flex-1 min-h-0 overflow-auto bg-slate-50">{children}</section>
        <GlobalAssistantBubble />
      </div>
    </main>
  );
}
