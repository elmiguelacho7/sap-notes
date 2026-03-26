// app/(private)/layout.tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { supabase } from "../../lib/supabaseClient";
import { buildShellBreadcrumbs } from "@/lib/privateShellTitles";
import { UserMenu } from "@/components/UserMenu";
import { GlobalAssistantBubble } from "@/components/ai/GlobalAssistantBubble";
import { AppShell } from "@/components/ui/layout/AppShell";
import { Sidebar } from "@/components/ui/sidebar/Sidebar";
import { Header } from "@/components/ui/header/Header";
import { HeaderCommandTrigger, HeaderCommandTriggerIcon } from "@/components/ui/header/HeaderCommandTrigger";
import { QuickActionMenu } from "@/components/ui/actions/QuickActionMenu";
import { CommandPalette } from "@/components/command-palette/CommandPalette";

type AppRole = "superadmin" | "consultant";

function getProjectIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  if (!match?.[1] || match[1] === "new") return null;
  return match[1];
}

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const tShell = useTranslations("common.shell");
  const breadcrumbs = buildShellBreadcrumbs(
    pathname ?? "/",
    tShell as (key: string) => string
  );
  const [isReady, setIsReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [appRole, setAppRole] = useState<AppRole | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sidebarProjectName, setSidebarProjectName] = useState<string | null>(null);
  const [sidebarProjectSubtitle, setSidebarProjectSubtitle] = useState<string | null>(null);
  const [sidebarProjectClientName, setSidebarProjectClientName] = useState<string | null>(null);
  const [sidebarProjectStartDate, setSidebarProjectStartDate] = useState<string | null>(null);
  const [sidebarProjectPlannedEnd, setSidebarProjectPlannedEnd] = useState<string | null>(null);
  const projectId = getProjectIdFromPath(pathname ?? "");

  /** Only persist user preference for collapsed; never persist hover/overlay state. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("ph-sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  /** Route change: drop transient hover-expand so timers/state cannot desync across navigation. */
  useEffect(() => {
    setHoverExpanded(false);
  }, [pathname]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user }, error: userError }) => {
      if (userError || !user?.id) {
        router.replace("/");
        return;
      }
      const metadataName =
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : typeof user.user_metadata?.name === "string"
            ? user.user_metadata.name
            : null;
      setUserName(metadataName);
      setUserEmail(user.email ?? null);
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

  useEffect(() => {
    if (!projectId) {
      setSidebarProjectName(null);
      setSidebarProjectSubtitle(null);
      setSidebarProjectClientName(null);
      setSidebarProjectStartDate(null);
      setSidebarProjectPlannedEnd(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("projects")
          .select("name, status, client_id, start_date, planned_end_date")
          .eq("id", projectId)
          .single();
        if (cancelled) return;
        const row = data as {
          name?: string | null;
          status?: string | null;
          client_id?: string | null;
          start_date?: string | null;
          planned_end_date?: string | null;
        } | null;
        setSidebarProjectName(row?.name?.trim() || null);
        setSidebarProjectSubtitle(row?.status?.trim() || null);
        setSidebarProjectStartDate(row?.start_date?.trim() || null);
        setSidebarProjectPlannedEnd(row?.planned_end_date?.trim() || null);
        if (row?.client_id) {
          const { data: clientRow } = await supabase
            .from("clients")
            .select("name, display_name")
            .eq("id", row.client_id)
            .single();
          if (cancelled) return;
          const c = clientRow as { display_name?: string | null; name?: string | null } | null;
          setSidebarProjectClientName(
            (c?.display_name || c?.name || "").trim() || null
          );
        } else {
          setSidebarProjectClientName(null);
        }
      } catch {
        if (cancelled) return;
        setSidebarProjectName(null);
        setSidebarProjectSubtitle(null);
        setSidebarProjectClientName(null);
        setSidebarProjectStartDate(null);
        setSidebarProjectPlannedEnd(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleNavigate = (href: string) => {
    setMobileMenuOpen(false);
    router.push(href);
  };

  if (!isReady) {
    return <div className="min-h-screen rb-shell-bg flex items-center justify-center" />;
  }

  return (
    <AppShell
      scrollOnRouteChangeKey={pathname ?? "/"}
      mobileMenuOpen={mobileMenuOpen}
      onMobileMenuClose={() => setMobileMenuOpen(false)}
      sidebarCollapsed={collapsed}
      sidebarHoverExpanded={hoverExpanded}
      sidebar={
        <Sidebar
          collapsed={collapsed}
          hoverExpanded={hoverExpanded}
          onHoverExpandChange={setHoverExpanded}
          onToggle={handleToggle}
          appRole={appRole}
          userName={userName}
          userEmail={userEmail}
          projectName={sidebarProjectName}
          projectSubtitle={sidebarProjectSubtitle}
          projectClientName={sidebarProjectClientName}
          projectStartDate={sidebarProjectStartDate}
          projectPlannedEndDate={sidebarProjectPlannedEnd}
          onNavigate={handleNavigate}
          pathname={pathname ?? ""}
          onLogout={handleLogout}
        />
      }
      mobileSidebar={
        mobileMenuOpen ? (
          <Sidebar
            collapsed={false}
            onToggle={handleToggle}
            appRole={appRole}
            userName={userName}
            userEmail={userEmail}
            projectName={sidebarProjectName}
            projectSubtitle={sidebarProjectSubtitle}
            projectClientName={sidebarProjectClientName}
            projectStartDate={sidebarProjectStartDate}
            projectPlannedEndDate={sidebarProjectPlannedEnd}
            onNavigate={handleNavigate}
            pathname={pathname ?? ""}
            onLogout={handleLogout}
            mobileOpen
            onClose={() => setMobileMenuOpen(false)}
          />
        ) : undefined
      }
      header={
        <Header
          breadcrumbs={breadcrumbs}
          center={<HeaderCommandTrigger />}
          right={
            <>
              <HeaderCommandTriggerIcon />
              <QuickActionMenu />
              <UserMenu />
            </>
          }
          onMenuClick={() => setMobileMenuOpen(true)}
        />
      }
    >
      {children}
      <CommandPalette />
      <GlobalAssistantBubble />
    </AppShell>
  );
}
