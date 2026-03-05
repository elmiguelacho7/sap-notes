"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  LayoutDashboard,
  Ticket,
  FileText,
  ListChecks,
  Link as LinkIcon,
  BookOpen,
  CalendarDays,
  CalendarClock,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
  CheckSquare,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { ProjectAssistantDock } from "@/components/ai/ProjectAssistantDock";

type ProjectSummary = {
  id: string;
  name: string;
  code?: string | null;
  client_name?: string | null;
  status: string | null;
};

type NavLink = {
  type: "link";
  path: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  type: "group";
  label: string;
  key: string;
  Icon: React.ComponentType<{ className?: string }>;
  children: { key: string; label: string; path: string; Icon: React.ComponentType<{ className?: string }> }[];
};

type SidebarSectionKey = "planificacion" | "conocimiento";

/** Normalize path for comparison: strip trailing slash (keep root). */
function normalizePath(p: string): string {
  const s = (p ?? "").trim();
  if (s === "" || s === "/") return s;
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

/** True when pathname equals href or is a strict subpath (pathname.startsWith(href + "/")). */
function hrefMatchesPath(pathname: string, href: string): boolean {
  const normPath = normalizePath(pathname);
  const normHref = normalizePath(href);
  if (normPath === normHref) return true;
  if (!normHref || normHref === "/") return false;
  return normPath.startsWith(normHref + "/");
}

/** Collect all sidebar link hrefs from nav items (dashboard + group children). */
function getAllNavHrefs(navItems: (NavLink | NavGroup)[], base: string): string[] {
  const hrefs: string[] = [];
  for (const item of navItems) {
    if (item.type === "link") {
      hrefs.push(item.path ? `${base}/${item.path}` : base);
    } else if (item.type === "group") {
      for (const child of item.children) {
        hrefs.push(child.path ? `${base}/${child.path}` : base);
      }
    }
  }
  return hrefs;
}

/** Active href is the longest matching one so only a single nav item is active (no sibling matches). */
function getActiveNavHref(pathname: string, navItems: (NavLink | NavGroup)[], base: string): string | null {
  const hrefs = getAllNavHrefs(navItems, base);
  let best: string | null = null;
  for (const href of hrefs) {
    if (!hrefMatchesPath(pathname, href)) continue;
    if (best === null || href.length > best.length) best = href;
  }
  return best;
}

function getProjectNavItems(projectId: string): (NavLink | NavGroup)[] {
  const base = `/projects/${projectId}`;
  return [
    { type: "link", path: "", label: "Dashboard", Icon: LayoutDashboard },
    {
      type: "group",
      label: "Planificación",
      key: "planificacion",
      Icon: CalendarDays,
      children: [
        { key: "planning-phases", label: "Fases del proyecto", path: "planning", Icon: ListChecks },
        { key: "planning-activities", label: "Actividades por fase", path: "planning/activities", Icon: ListChecks },
        { key: "planning-calendar", label: "Calendario", path: "planning/calendar", Icon: CalendarClock },
        { key: "members", label: "Miembros", path: "members", Icon: Users },
        { key: "tickets", label: "Tickets", path: "tickets", Icon: Ticket },
        { key: "notes", label: "Notas", path: "notes", Icon: FileText },
        { key: "tasks", label: "Tareas", path: "tasks", Icon: CheckSquare },
        { key: "links", label: "Enlaces del proyecto", path: "links", Icon: LinkIcon },
      ],
    },
    {
      type: "group",
      label: "Conocimiento",
      key: "conocimiento",
      Icon: BookOpen,
      children: [
        { key: "knowledge", label: "Base de conocimiento", path: "knowledge", Icon: BookOpen },
      ],
    },
  ];
}

const SIDEBAR_STATUS_LABELS: Record<string, string> = {
  in_progress: "En progreso",
  completed: "Completado",
  paused: "En pausa",
};

function SidebarStatusBadge({ status }: { status: string }) {
  const friendlyStatus = SIDEBAR_STATUS_LABELS[status] ?? status;
  const styles =
    status === "completed"
      ? "bg-blue-50 text-blue-700 ring-blue-200"
      : status === "paused"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-emerald-50 text-emerald-700 ring-emerald-200";
  const dotClass =
    status === "completed"
      ? "bg-blue-500"
      : status === "paused"
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${styles}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {friendlyStatus}
    </span>
  );
}

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const projectId = params?.id as string;

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;

    let isMounted = true;

    const loadProject = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status")
        .eq("id", projectId)
        .single();

      if (!isMounted) return;

      if (!error && data) {
        const row = data as { id: string; name: string; status: string | null };
        setProject({
          id: row.id,
          name: row.name,
          code: null,
          client_name: null,
          status: row.status,
        });
      }
      setLoading(false);
    };

    loadProject();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const navItems = projectId ? getProjectNavItems(projectId) : [];
  const base = projectId ? `/projects/${projectId}` : "";
  const router = useRouter();
  const activeNavHref = base && navItems.length ? getActiveNavHref(pathname ?? "", navItems, base) : null;

  const [collapsed, setCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<SidebarSectionKey, boolean>>({
    planificacion: true,
    conocimiento: true,
  });

  useEffect(() => {
    const path = pathname ?? "";
    const inPlanning =
      path.includes("/planning") || path.includes("/activities") ||
      path.includes("/tickets") || path.includes("/notes") ||
      path.includes("/tasks") || path.includes("/links") || path.includes("/members");
    const inKnowledge = path.includes("/knowledge");
    if (inPlanning) {
      setExpandedSections((prev) => ({ ...prev, planificacion: true }));
    }
    if (inKnowledge) {
      setExpandedSections((prev) => ({ ...prev, conocimiento: true }));
    }
  }, [pathname]);

  const toggleSection = (key: SidebarSectionKey) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex h-full">
      {/* Sidebar contextual del proyecto */}
      <aside
        className={
          "shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col transition-all duration-200 " +
          (collapsed ? "w-16" : "w-64")
        }
      >
        <div className="flex flex-col h-full">
          {/* Toggle + Volver a proyectos */}
          <div className="flex items-center gap-1 border-b border-slate-200 px-2 py-3">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all duration-200"
              title={collapsed ? "Expandir barra" : "Contraer barra"}
            >
              {collapsed ? (
                <PanelLeft className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
            {!collapsed && (
              <Link
                href="/projects"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-all duration-200"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver a proyectos
              </Link>
            )}
          </div>
          {collapsed && (
            <Link
              href="/projects"
              className="flex items-center justify-center border-b border-slate-200 py-3 text-slate-600 hover:bg-slate-100 transition-all duration-200"
              title="Volver a proyectos"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}

          {/* Info básica del proyecto */}
          <div className={"border-b border-slate-200 space-y-1 " + (collapsed ? "px-2 py-3" : "px-4 py-3")}>
            {loading ? (
              <div className={collapsed ? "h-8 w-8 rounded bg-slate-200 animate-pulse" : "h-8 w-36 rounded bg-slate-200 animate-pulse"} />
            ) : project ? (
              <>
                {collapsed ? (
                  <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-indigo-700">
                      {(project.name || "P").charAt(0).toUpperCase()}
                    </span>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {project.name}
                    </p>
                    {(project.client_name ?? project.code) && (
                      <p className="text-xs text-slate-500 truncate">
                        {[project.client_name, project.code].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {project.status && (
                      <SidebarStatusBadge status={project.status} />
                    )}
                  </>
                )}
              </>
            ) : (
              !collapsed && (
                <p className="text-xs text-red-500">
                  Proyecto no encontrado o sin acceso.
                </p>
              )
            )}
          </div>

          {/* Navegación interna del proyecto */}
          <nav className={"flex-1 py-4 space-y-1 text-sm overflow-hidden " + (collapsed ? "px-2" : "px-3")}>
            {navItems.map((item) => {
              if (item.type === "group" && item.children.length > 0) {
                const sectionKey: SidebarSectionKey = item.key === "conocimiento" ? "conocimiento" : "planificacion";
                const isExpanded = expandedSections[sectionKey] ?? true;
                const someChildActive = item.children.some((child) => {
                  const href = child.path ? `${base}/${child.path}` : base;
                  return href === activeNavHref;
                });

                return (
                  <div key={sectionKey} className="mt-3 first:mt-0">
                    <button
                      type="button"
                      onClick={() => toggleSection(sectionKey)}
                      className={
                        "flex w-full items-center rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-wide transition-all duration-200 " +
                        (collapsed ? "justify-center" : "justify-between gap-2") +
                        (someChildActive ? " text-indigo-600" : " text-slate-500 hover:text-slate-700")
                      }
                      title={collapsed ? item.label : undefined}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <item.Icon className="h-3.5 w-3.5 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </span>
                      {!collapsed && (
                        <ChevronDown
                          className={
                            "h-3.5 w-3.5 shrink-0 transition-transform duration-200 " +
                            (isExpanded ? "rotate-180" : "rotate-0") +
                            (someChildActive ? " text-indigo-600" : " text-slate-400")
                          }
                        />
                      )}
                    </button>

                    {isExpanded && !collapsed && (
                      <div className="mt-1 space-y-0.5">
                        {item.children.map((child) => {
                          const href = child.path ? `${base}/${child.path}` : base;
                          const active = href === activeNavHref;
                          const ChildIcon = child.Icon;
                          return (
                            <button
                              key={child.key}
                              type="button"
                              onClick={() => router.push(href)}
                              className={
                                "w-full text-left flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200 " +
                                (active
                                  ? "bg-indigo-600 text-white shadow-sm"
                                  : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900")
                              }
                            >
                              <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{child.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {isExpanded && collapsed && (
                      <div className="mt-1 space-y-0.5">
                        {item.children.map((child) => {
                          const href = child.path ? `${base}/${child.path}` : base;
                          const active = href === activeNavHref;
                          const ChildIcon = child.Icon;
                          return (
                            <button
                              key={child.key}
                              type="button"
                              onClick={() => router.push(href)}
                              title={child.label}
                              className={
                                "w-full flex items-center justify-center rounded-xl px-2 py-2 text-xs font-medium transition-all duration-200 " +
                                (active
                                  ? "bg-indigo-600 text-white shadow-sm"
                                  : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900")
                              }
                            >
                              <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              if (item.type === "link") {
                const href = item.path ? `${base}/${item.path}` : base;
                const active = href === activeNavHref;
                const Icon = item.Icon;
                if (collapsed) {
                  return (
                    <Link
                      key={item.path || "dashboard"}
                      href={href}
                      title={item.label}
                      className={
                        "flex items-center justify-center rounded-xl px-2 py-2 text-xs font-medium transition-all duration-200 " +
                        (active
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900")
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                    </Link>
                  );
                }
                return (
                  <Link
                    key={item.path || "dashboard"}
                    href={href}
                    className={
                      "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200 " +
                      (active
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900")
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              }

              return null;
            })}
          </nav>
        </div>
      </aside>

      {/* Contenido principal del proyecto */}
      <section className="flex-1 px-8 py-6">
        {children}
      </section>
      {projectId && (
        <ProjectAssistantDock projectId={projectId} projectName={project?.name} />
      )}
    </div>
  );
}
