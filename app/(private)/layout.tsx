// app/(private)/layout.tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { UserMenu } from "@/components/UserMenu";
import { GlobalAssistantBubble } from "@/components/ai/GlobalAssistantBubble";
import { AppShell } from "@/components/ui/layout/AppShell";
import { PageContainer } from "@/components/ui/layout/PageContainer";
import { Sidebar } from "@/components/ui/sidebar/Sidebar";
import { Header } from "@/components/ui/header/Header";
import { HeaderSearchInput } from "@/components/ui/header/HeaderSearchInput";
import { QuickActionMenu } from "@/components/ui/actions/QuickActionMenu";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import type { BreadcrumbItem } from "@/components/ui/header/Breadcrumbs";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/my-work": "My Work",
  "/notes": "Notas",
  "/tasks": "Tasks",
  "/projects": "Proyectos",
  "/knowledge": "Knowledge Explorer",
  "/knowledge/search": "Search",
  "/knowledge/documents": "Spaces",
  "/knowledge/spaces": "Documents",
  "/search": "Búsqueda",
  "/tickets": "Tickets",
  "/process-flows": "Flujos de proceso",
  "/account": "Settings",
  "/admin": "Administración",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/projects/") && pathname !== "/projects") return "Proyecto";
  if (pathname.startsWith("/notes/")) return "Nota";
  if (pathname.startsWith("/knowledge/")) return "Knowledge";
  if (pathname.startsWith("/tickets")) return "Tickets";
  if (pathname.startsWith("/tasks")) return "Tareas";
  if (pathname.startsWith("/my-work")) return "My Work";
  return "Project Hub";
}

function buildBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (!pathname || pathname === "/") return [{ label: "Dashboard", href: "/dashboard" }];
  // Project workspace: show only "Proyectos" — project name lives in the workspace header
  if (pathname.startsWith("/projects/") && pathname !== "/projects") {
    return [{ label: "Proyectos", href: "/projects" }];
  }
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [{ label: getPageTitle(pathname) }];
  const items: BreadcrumbItem[] = [];
  let acc = "";
  for (let i = 0; i < segments.length; i++) {
    acc += `/${segments[i]}`;
    const isLast = i === segments.length - 1;
    items.push({
      label: getPageTitle(acc),
      href: isLast ? undefined : acc,
    });
  }
  return items;
}

/** Standard (narrow) workspace: account, admin. Wide for all other private pages. */
function isWideWorkspacePage(pathname: string): boolean {
  if (!pathname) return true;
  if (pathname === "/account") return false;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return false;
  return true;
}

type AppRole = "superadmin" | "consultant";

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
    supabase.auth.getUser().then(async ({ data: { user }, error: userError }) => {
      if (userError || !user?.id) {
        router.replace("/");
        return;
      }
      const userId = user.id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("app_role, is_active")
        .eq("id", userId)
        .single();
      const row = profile as { app_role?: string; is_active?: boolean } | null;
      // No profile or explicitly inactive => cannot access private app
      if (!row || row.is_active === false) {
        router.replace("/pending-activation");
        return;
      }
      const role = row.app_role;
      if (role === "superadmin" || role === "consultant") {
        setAppRole(role as AppRole);
      }
      setIsReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/");
        return;
      }
      // Re-validate is_active on any auth change (e.g. after email confirmation) so we never show private content to inactive users
      const userId = session.user?.id;
      if (!userId) {
        router.replace("/");
        return;
      }
      supabase
        .from("profiles")
        .select("is_active")
        .eq("id", userId)
        .single()
        .then(({ data: profile }) => {
          const row = profile as { is_active?: boolean } | null;
          if (!row || row.is_active === false) {
            router.replace("/pending-activation");
          }
        });
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleToggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("ph-sidebar-collapsed", String(next));
      }
      return next;
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (!isReady) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center" />;
  }

  return (
    <AppShell
      sidebar={
        <Sidebar
          collapsed={collapsed}
          onToggle={handleToggle}
          appRole={appRole}
          onNavigate={(href) => router.push(href)}
          pathname={pathname ?? ""}
          onLogout={handleLogout}
        />
      }
      header={
        <Header
          breadcrumbs={buildBreadcrumbs(pathname ?? "/")}
          center={<HeaderSearchInput placeholder="Search..." />}
          right={
            <>
              <QuickActionMenu />
              <UserMenu />
            </>
          }
        />
      }
    >
      <PageContainer
        wide={isWideWorkspacePage(pathname ?? "")}
        fullWidth={
          pathname === "/dashboard" ||
          (typeof pathname === "string" &&
            pathname.startsWith("/projects/") &&
            pathname.split("/")[2] !== "new") ||
          (typeof pathname === "string" && pathname.startsWith("/notes"))
        }
      >
        {children}
      </PageContainer>
      <CommandPalette />
      <GlobalAssistantBubble />
    </AppShell>
  );
}
